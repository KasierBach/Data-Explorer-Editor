# R05 — Migration stream và failure lifecycle

Ngày kiểm: **23/10/2026**, Asia/Saigon. Trạng thái: **VERIFIED_LOCAL trong phạm vi bên dưới**. Branch `codex/roadmap-r00`, HEAD nền `3d7ec60845ddc2a07284c2873d9d3727acd30744`; thay đổi còn ở working tree, kế thừa R00–R04. Chưa commit/push/deploy. [Manifest có hash và exit code](r05-verification.json), [roadmap](../ROADMAP.md), [progress ledger](../ROADMAP-PROGRESS.md).

## Kết quả đối với người dùng

Migration PostgreSQL không còn làm API chết bởi callback của stream khi đọc xong hoặc gặp lỗi. Lỗi đọc, lỗi ghi và mất kết nối trở thành job `failed` có thông tin lỗi; trạng thái `completed` chỉ xuất hiện sau khi batch cuối được xác nhận. Subscription mở sau khi job kết thúc cũng nhận terminal state rồi đóng.

Transfer vẫn có thể ghi được một phần trước khi lỗi. Progress chỉ đếm số dòng driver đã xác nhận; commit xảy ra trước khi acknowledgment/progress được lưu có thể chưa được đếm. Vì chưa có checkpoint để tiếp tục an toàn, cùng job đã bắt đầu streaming sẽ bị từ chối khi stalled recovery hoặc manual retry, với yêu cầu kiểm tra target trước khi mở transfer mới. Không hứa rollback toàn bộ hoặc resume.

## Nguyên nhân và sửa đổi

| Vấn đề đã xác minh | Thay đổi | Bằng chứng |
|---|---|---|
| `pg` 8.18.0 bọc `query_timeout` và gọi callback của Submittable; stream chưa có callback nên ném `queryCallback is not a function` | Cấp callback cho `pg-query-stream` 4.14.0; lỗi đi qua stream và worker | Child native ban đầu 3/3 đỏ; bản cuối 4/4 xanh |
| Checked-out client không còn idle error handler của pool; socket error có thể thành unhandled event | Gắn handler cho client trong thời gian stream sở hữu nó, gỡ khi release; release có guard một lần | Native `pg_terminate_backend` trong child riêng: lỗi có kiểm soát, process exit 0, stream closed, pool total/waiting 0 |
| `pg-cursor.close` chờ `ReadyForQuery` trên socket chết hoặc backend đang chạy lâu | Dùng hook `_destroy` của Node stream: đường lỗi hoàn tất destruction và loại client; đường đóng khỏe giữ cursor close gốc; callback completion có guard | Deadline 100 ms phải trả lỗi trước 750 ms, trong khi server deadline vẫn 1 s và query sleep 2 s; bản trước sửa nhận lỗi sau 1068 ms và thất bại |
| Setup tạo pool nhưng metadata/target preflight lỗi trước khi trả context | Giữ partial context và đóng pool đã tạo khi setup thất bại | Unit preview preflight kiểm cả source/target close |
| Service nuốt lỗi, tự gọi `moveToFailed` với lock token giả | Lưu failed progress rồi throw về processor đang sở hữu BullMQ lock | Unit processor thật; native job failed và health API còn sống |
| Close-before-end bị treo; listener và batch đang chạy chưa được phối hợp | Tuần tự hóa xử lý chunk, backpressure, nhận premature close, drain write đang chạy rồi cleanup listener/pool | Unit stream close, source error trong in-flight write và native API |
| Khi adaptive split, source failure vẫn cho sub-batch kế tiếp chạy | Chia sẻ terminal failure flag với vòng lặp batch; kiểm trước từng import attempt | Regression 500 → rejected parameter limit → 250 đang ghi → source lỗi: chỉ 250 được xác nhận, không gửi 250 còn lại |
| Retry timeout/disconnect có thể lặp write đã commit | Chỉ shrink/retry lỗi giới hạn tham số đã biết trước execution: MSSQL `EREQUEST/8003`, SQLite `SQLITE_ERROR/too many SQL variables` | Unit classifier và pipeline; timeout chỉ có một import attempt |
| Target trả false/partial ack nhưng pipeline vẫn đếm đủ batch | Kiểm `success` và `rowCount`, chỉ cộng số được xác nhận, partial phải failed | Hai case ack 0/1 và regression full unit |
| Subscription sau terminal còn heartbeat/listener; active job che terminal progress | Public status ưu tiên terminal progress; initial-terminal subscription complete và teardown | Unit + native HTTP ticket và controller Observable |
| Worker chết sau commit nhưng trước progress, retry append lần nữa | Persist stage trước streaming và từ chối replay khi stage đã qua queued | Kill child sau commit 5 dòng vào target không PK; native stalled recovery và manual retry giữ nguyên đúng 5 dòng |

Không sửa production `MigrationProcessor`: cơ chế catch/rethrow hiện có hoạt động khi service trả rejection đúng. Client đã hiểu `completed`/`failed` và error; giữ nguyên shape jobId/status/stage/ticket và ownership. Source READ/target WRITE được giữ qua kiểm tra native API kế thừa.

## Ma trận thực thi

| Lớp kiểm tra trên source cuối | Kết quả | Giới hạn diễn giải |
|---|---:|---|
| Backend unit toàn bộ | **678/678**, 89 suites, exit 0 | Baseline R05 là 666/666; thêm 12 lifecycle cases, không phải coverage % |
| Client unit toàn bộ | **156/156**, 48 files, exit 0 | Client không có production change R05 |
| Native API/integration toàn bộ | **96/96**, 9 suites, exit 0 | 86 kế thừa + 10 R05; chạy `--detectOpenHandles`, không force-exit |
| Environment guards | **2/2**, exit 0 | Chỉ URL loopback/database E2E/Redis DB15; không dùng cấu hình production |
| Server TypeScript gồm specs; Nest build | Exit 0 từng bước | Không nâng dependency/schema/config timeout |
| Client production build | Exit 0 | TypeScript/Vite/bundle budget/prerender của script hiện có |
| ESLint | **10 file TS**, exit 0 | Hai fixture CJS kiểm riêng bằng `node --check`; không tuyên bố đã typed-lint CJS |
| Prettier; CJS syntax | **12 file** format và **2 CJS** syntax, exit 0 | Giữ cấu hình hiện có |

10 case R05 native gồm: đọc 5 dòng; missing source; client deadline; mất socket thật; HTTP copy 5 và 4505 dòng; source division-by-zero; target CHECK failure; ownership/ticket và completed-job replay; kill worker sau commit/trước progress. Hai case copy so sánh count và checksum dữ liệu, multi-batch có 3 batch. Lỗi nguồn/đích kiểm API health còn 200. Target replay cố ý không PK để unique constraint không che duplicate.

Native stream chạy trong child để crash hồi quy không giết Jest/API parent. Deadline giữ client 100 ms, server 1 s và budget child 15 s/test 20 s từ lúc định nghĩa fixture. Không tăng budget/retry, thêm skip, thu hẹp assertion hoặc global uncaught-exception handler để có green. Fault worker dùng lock/stalled interval ngắn chỉ trong queue riêng; production worker config không đổi.

Client hồi quy lượt đầu **155 pass/1 fail** ở test provider-save của AiConfigTab (6351 ms, VM reporter `STACK_TRACE_ERROR`) khi build chạy song song. Focused cùng cấu hình 7/7; full suite chạy lại khi không còn build song song **156/156**, exit 0. Giữ cả evidence đỏ và xanh; không thay source client, assertion, timeout, retries hoặc worker config. Chưa có bằng chứng đủ để kết luận chắc nguyên nhân tải máy.

Không có lượt browser mới trong R05. Kết quả browser mock 12/12 Chromium/Firefox của R04 vẫn là snapshot lịch sử. Các case API và Observable không phải browser-to-real-backend, không chứng minh trải nghiệm SSE qua nhiều replica/proxy hoặc toàn bộ UI/UX.

## Review và quy tắc thực hiện

Một final review độc lập chỉ đọc gói R05 tìm **2 Important, 0 Critical, 0 Minor**: socket/deadline và adaptive split sau source failure. Parent ghim RED cho cả hai trước sửa: native 2 fail/2 pass; lifecycle 1 fail/11 pass. Một lượt sửa đưa cả hai về GREEN rồi chạy lại full suite phía trên. Không có lượt re-review; bằng chứng nghiệm thu là source cuối, regressions và full gates. Các điều reviewer chưa chứng nhận được giữ ở phần giới hạn.

Áp dụng executing-plans, systematic-debugging, TDD, requesting-code-review, verification-before-completion, GitNexus, Codegraph/Semble, Ponytail và writing-for-agents. Không cài/nâng tool global trong R05. Các quyết định có chi phí được ghi rõ:

- Giữ checkout hiện tại để không mất dependencies R00–R04 chưa commit; lúc tích hợp cần tách commit theo concern.
- Dùng R05 trong roadmap và ledger làm brief/spec cho định dạng Rxx; không tạo kế hoạch Task N trùng lặp.
- Static import dependency bắt buộc `pg-query-stream` để production/child/Jest dùng cùng module contract; chi phí load nhỏ khi strategy được nạp.
- Từ chối replay và ambiguous retry thay vì giả lập resume; người dùng cần kiểm target khi lỗi sau một phần transfer.
- Dùng hook destruction của Node stream vì graceful cursor close không hoàn tất trên dead socket; healthy completion giữ đường đóng chuẩn. Không truy cập cờ private của pg client hoặc sửa dependency.
- Giữ OOP strategy hiện có; SOLID/DRY bằng sửa boundary chung, YAGNI/KISS bằng không thêm framework retry/resume/abstraction. Nesting xử lý batch/cleanup giữ thứ tự write → acknowledged progress → failed → release.
- C01/C03–C05/C07/C08/C10 được đối chiếu bằng trust-boundary, async lifecycle, error/replay và regression; C02 quyền kiểm qua API kế thừa, C06 không có React change; C09 chưa benchmark, không tuyên bố nhanh hơn.
- CJS dùng syntax/format check theo runtime; không mở rộng TS project/lint scope để che parsing error. Helper test `startPipeline` từng được sửa trước impact riêng; ledger ghi thiếu sót này, không coi impact sau là đã làm trước.

## Scope và khả năng đối soát

Gói có **12 source/test file**: 4 production, 2 unit spec có sẵn, 1 lifecycle unit spec và 5 integration/child fixture. SHA-256 được ghim ở manifest; output đầy đủ được giữ trong `output/roadmap-r05/` (ignored). Snapshot trước R05 có 85 file dirty/untracked được bảo vệ. `.zcode/` ngoài scope. AGENTS/CLAUDE chỉ được cập nhật thống kê do rebuild index.

GitNexus upstream impact trước sửa: `exportStream` LOW/1 direct (Cockroach subclass), `runMigrationPipeline` LOW/1 (worker), context LOW/2, terminal/progress methods LOW/0–1. Dynamic dispatch có caller thực dù graph không ghi đủ. Index cuối **7085 nodes/18814 edges/408 clusters/268 flows**; flow count là đồ thị suy ra, không phải số workflow người dùng đã test. `detect_changes(all)` và compare `main` đều **CRITICAL: 52 tracked files/204 symbols/46 processes**, đã cảnh báo trước nghiệm thu. Đây là **diff gộp R00–R05**, không gán toàn bộ cho R05; untracked source kiểm riêng bằng snapshot. Source hash các gói cũ vẫn giữ snapshot lịch sử; chỉ refresh hash artifact tài liệu canonical khi tài liệu thay đổi.

Hậu kiểm fixture: 0 synthetic User/Connection/Organization, 0 bảng/view R03–R05, 0 client PG/queue riêng R05, 0 Mongo/MySQL fixture tương ứng. Bốn container/network test do lượt này tạo được dừng/xóa; cổng fixture không còn listener. Không xóa cache/history/config global; giữ logs làm evidence. Thư mục R03 rỗng từng bị policy chặn xóa được giữ nguyên, không thử bypass.

## Còn mở và bước tiếp theo

- Chưa đo lại line/branch/function/workflow coverage %. Test counts không thay tỷ lệ coverage hay danh mục mọi case người dùng.
- Native PostgreSQL được kiểm trong R05. Non-PG engine chỉ có shared-consumer/driver contract liên quan; chưa chứng nhận native transfer/cancel MSSQL/MySQL/MariaDB/Cockroach/Mongo/SQLite/Redis/ClickHouse.
- Chưa có whole-transfer transaction, checkpoint/resume, exact progress sau unacknowledged commit hoặc rollback mọi trigger/external side effect. Partial writes là contract công khai.
- Chưa kiểm worker-lock loss khi worker cũ vẫn sống, nhiều replica, cross-process SSE, Redis outage, forced external queue deletion hoặc closePool failure recovery. Giữ best-effort cleanup hiện có.
- Chưa audit toàn bộ UI/a11y/mobile/WebKit, benchmark/load, dependency/container security hay remote CI/release gate. Đây là nghiệm thu cục bộ của R05, không kết luận hết lỗi toàn project.

**Bước triển khai tiếp theo: R06 — entitlement giao dịch đồng thời**, theo acceptance đã có trong roadmap. R06–R14 và các release gates còn mở.
