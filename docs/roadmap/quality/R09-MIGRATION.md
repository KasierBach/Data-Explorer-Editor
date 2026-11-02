# R09 — Migration và phục hồi comment

Áp dụng cho Prisma 6.19.3/PostgreSQL và migration `20261025000000_durable_comment_events`. Chỉ fixture local đã được chạy; đây không phải xác nhận production rollout.

## Trước cutover

1. Kiểm tra đúng app database, phiên bản schema và dung lượng. Đặt maintenance window, dừng toàn bộ old writers/retention workers trước khi chụp backup và chạy migration. Không rolling deploy old/new comment writers cùng nhau.
2. Chụp backup đầy đủ app DB, lưu checksum và thử restore vào database riêng. Backup cần cả AuditLog, CommentReaction, users, organizations và resources; backup organization hiện có không phải backup app DB cho migration này.
3. Kiểm kê audit comment theo organization/resource và `(createdAt,id)`, JSON lỗi, resource mất, reply/edit/delete/resolve thiếu root và reaction thiếu creation. Event đã bị retention xóa không thể phục hồi từ DB hiện tại. Đối chiếu backup cũ nếu cần phục hồi lịch sử.
4. Chạy migration bằng workflow triển khai đã được kiểm tra cho môi trường đích. Initial DDL + replay + checkpoint chạy trong **một transaction**; lỗi rollback toàn migration. Mỗi lượt đọc tối đa500 events, không đồng nghĩa mỗi batch initial migration commit riêng. Corpus lớn có thể giữ transaction/locks lâu; cần đo thời gian/dung lượng trên bản sao trước production.
5. Kiểm checkpoint và inventory bên dưới, rồi khởi động **chỉ phiên bản mới**. Đối chiếu thread/comment/reply IDs, edits, deleted payloads, mentions, attachments, reaction và resolution trước mở lại truy cập.

## Nguồn state và checkpoint

CommentEvent là nguồn state duy nhất sau cutover; audit vẫn ghi activity với `storageVersion:2`, không có fallback hoặc importer chạy trong app. Create/reply dùng `id=commentId`; event sửa/xóa/resolve có ID riêng. Thứ tự replay mới theo sequence. Organization/resource cascade xóa events/reactions; author deletion giữ shared content với actor ẩn danh. Soft-deleted payload/attachment/mention/reaction không trả ra reader, các reply khác vẫn đọc được.

SQL function `data_explorer_backfill_comment_events(n)` nhận1–500, dùng advisory transaction lock, watermark và checkpoint cố định. Unique ID/legacyAuditId chống duplicate. Gọi riêng function commit cùng checkpoint trong transaction của caller; nếu caller rollback thì events và checkpoint cùng rollback. Marker completed không nhập thêm old events sau watermark. Không reset marker trên production để nhập lại dữ liệu mà chưa đối chiếu ordering/scope và backup; dừng old writers là bắt buộc.

`copied` đếm event, **không đếm thread được phục hồi**. `skipped` gồm malformed/resource mất/duplicate/new audit marker; cần kiểm kê nguyên nhân từ corpus/backup. Reply mất root có thể được giữ trong CommentEvent để đối chiếu nhưng reader không dựng thread giả. Initial fixture có8 audit events:6 copied,2 skipped,1 orphan reply và1 orphan reaction; chỉ1 complete thread. Maintained native test kiểm checkpoint/batch/rollback/restart/replay và corpus malformed/duplicate riêng.

```sql
SELECT * FROM "CommentBackfill" WHERE id='legacy-audit-v1';
SELECT r.id, r."commentId" FROM "CommentReaction" r
LEFT JOIN "CommentEvent" e ON e.id=r."commentId" WHERE e.id IS NULL;
SELECT e.id, e.action, e."threadId" FROM "CommentEvent" e
LEFT JOIN "CommentEvent" root ON root.id=e."threadId"
  AND root."organizationId"=e."organizationId"
  AND root."resourceType"=e."resourceType" AND root."resourceId"=e."resourceId"
  AND root.action='TEAM:COMMENT_CREATE'
WHERE root.id IS NULL;
SELECT convalidated FROM pg_constraint
WHERE conname='CommentReaction_commentId_fkey';
```

Reaction FK được tạo `NOT VALID` để giữ legacy orphan phục vụ reconciliation, vẫn enforce mọi insert/update mới và cascade của reference hợp lệ. Migration validate ngay nếu không có orphan. Nếu còn orphan, lưu inventory/backup, phục hồi creation hợp lệ hoặc quyết định xử lý từng orphan; không xóa âm thầm. Khi inventory rỗng mới `ALTER TABLE "CommentReaction" VALIDATE CONSTRAINT "CommentReaction_commentId_fkey";`. SQL CHECK resource binding phải được giữ trong mọi schema deployment; không thay migration này bằng `db push`.

## Rollback

Trước mở lại writes: giữ maintenance, restore **toàn app DB backup trước migration** vào đích đã xác minh, triển khai lại phiên bản app/schema tương ứng và đối soát trước mở truy cập. Fixture backup trước migration đã restore vào scratch DB và kiểm8 audit/2 reactions/không có CommentEvent, rồi xóa scratch.

Sau có writes mới: backup trước migration không chứa các durable writes mới. Restore trực tiếp sẽ mất chúng. Chụp thêm backup hiện tại, giữ maintenance, đối chiếu/export dữ liệu mới và chốt recovery riêng trước downgrade; không drop CommentEvent hoặc bật lại reader audit cũ rồi báo rollback an toàn. Không có down migration tự động hoặc dual-source replay trong runtime.
