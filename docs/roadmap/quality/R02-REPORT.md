# R02 — Backup toàn tổ chức chỉ dành cho OWNER/ADMIN

**Ngày:** 22/10/2026, Asia/Saigon. **Trạng thái:** `VERIFIED_LOCAL`.
**Branch:** `codex/roadmap-r00`. **Base HEAD:** `3d7ec60845ddc2a07284c2873d9d3727acd30744`, v1.6.7. Working tree tiếp nối R00/R01, chưa commit/push/deploy.

## Contract và kết quả

Theo contract đã chốt trong [roadmap R02](../ROADMAP.md#r02--backup-đúng-ranh-giới-quyền), full organization backup là thao tác quản trị dành cho OWNER/ADMIN, cùng hướng kiểm quyền với restore. R02 không triển khai xuất một phần theo từng resource. Đây là quyết định trong roadmap hiện tại; đề xuất filter từng resource ở audit cũ không thay thế contract này.

Trước sửa, MEMBER/VIEWER không thấy saved query bị hạn chế trong danh sách nhưng vẫn gọi GET backup và nhận toàn bộ gói, gồm SQL/snapshot/ERD. Sau sửa, server dùng lại guard OWNER/ADMIN của restore, chặn request trước truy vấn artifact. UI vẫn có tab Sao lưu để giải thích quyền; MEMBER/VIEWER không có control export/restore hay ô JSON. Handler phía client cũng kiểm tra quyền, nhưng server là nơi thực thi ranh giới bảo mật.

OWNER/ADMIN vẫn xuất và khôi phục được backup hợp lệ. Test API xác nhận dữ liệu SQL, dashboard dataSnapshot, ERD layout, connection references và policy của ba loại resource được giữ qua restore; policy gắn đúng teamspace mới, MEMBER/VIEWER không được cấp quyền rộng hơn. Hạ ADMIN xuống MEMBER chặn cả export/restore với cùng JWT cũ.

Package không có connection records, password hay sshPrivateKey từ cấu hình connection synthetic. Kiểm tra này không có nghĩa tự động xóa chuỗi bí mật do người dùng chủ động viết trong SQL, snapshot hoặc settings; full backup có chủ đích chứa dữ liệu của tổ chức và chỉ cấp cho vai trò quản trị theo contract.

## Thay đổi nhỏ nhất

- [OrganizationBackupService](../../../server/src/organizations/services/organization-backup.service.ts): export gọi `ensureOwnerOrAdminAccess`; bỏ helper member-only không còn caller. Restore, audit logging và cấu trúc package version 1 giữ nguyên implementation.
- [TeamPage](../../../client/src/presentation/pages/TeamPage.tsx): hiển thị lời giải thích thay cho panel thao tác nếu thiếu quyền, guard hai handler, đặt tên truy cập cho textarea. Ba nút trong panel có chiều cao tối thiểu 44px sau khi browser test phát hiện nút export chỉ cao 40px.
- [Bản dịch](../../../client/src/presentation/pages/TeamPage/teamI18n.ts): thêm đúng một thông báo Việt/Anh. Không đổi key hiện có, route, API response, database schema hoặc dependencies.
- [Unit server](../../../server/src/organizations/services/organization-backup.service.spec.ts), [unit UI](../../../client/src/presentation/pages/TeamPage.backup.test.tsx), [API R02](../../../server/test/organization-backup.e2e-spec.ts), [browser R02](../../../client/e2e/team-backup.spec.ts) duy trì regression.

## Bằng chứng theo tình huống

| Tình huống | Bằng chứng đã chạy | Kết luận trong phạm vi test |
|---|---|---|
| E08: MEMBER/VIEWER không thấy SQL trong list nhưng lấy qua backup | HTTP list rỗng, export 403, response không có marker SQL/snapshot/ERD; restore 403 và số query không đổi | Đã chặn đường full backup cho vai trò thấp |
| Người ngoài tổ chức | Export/restore 403 qua app thật | Không có quyền quản trị từ token của user khác |
| OWNER/ADMIN export | HTTP 200; đủ query, widget snapshot, ERD, ba policy/teamspace links; không có connection credentials fixture | Đường quản trị hợp lệ giữ dữ liệu trong package |
| E07: OWNER/ADMIN restore | HTTP 201, đọc PostgreSQL trực tiếp đối chiếu artifacts và policy/teamspace mới; list MEMBER/VIEWER vẫn rỗng | Round-trip package hợp lệ không mở rộng các policy đã kiểm tra |
| ADMIN bị hạ quyền, JWT cũ | Hai endpoint đều 403; số query không đổi | Quyền được đọc lại từ membership hiện tại |
| Deny trước truy vấn artifact | Unit MEMBER/VIEWER/non-member assert không đọc organization/query/dashboard/ERD/policy và không log export thành công | Không thực hiện export trước kiểm quyền |
| UI MEMBER/VIEWER | Component test cả hai role; browser VIEWER ở 1280/390px | Hiện lời giải thích; không có export/restore controls |
| UI OWNER/ADMIN | Component test cả hai role; browser OWNER trên Chromium/Firefox | Control hợp lệ còn hoạt động; keyboard mở tab và kích hoạt download, hiện lỗi 403 |
| Bố cục và a11y | Browser 1280/390px, không tràn ngang, nút export có vùng bấm >=44px; axe trong panel backup | Không có axe violation trong vùng được chọn, không phải chứng nhận toàn trang |

API R02 có 8 test, dùng app Nest/HTTP guard/Prisma/PostgreSQL/Redis thật trên dữ liệu synthetic. Token fixture được ký bằng JwtService; không mô phỏng permission service. Connection chỉ là cấu hình sentinel để kiểm package, không mở driver PostgreSQL nguồn hoặc gọi provider ngoài. Test restore diễn ra trong tổ chức fixture, không dùng backup người dùng thật.

Browser dùng API mock khai báo rõ method/path và helper strict R00 cho phần còn lại; endpoint chưa khai báo không trả thành công mặc định. Bằng chứng browser là UI/mock, tách biệt bằng chứng backend API thật; chưa chạy browser nối trực tiếp backend trong gói này. 390px là viewport hẹp trên hai browser desktop, không phải kiểm chứng iOS/WebKit.

## Gate trên tree cuối

| Gate | Lệnh | Kết quả |
|---|---|---|
| Backend unit | `cd server; node node_modules/jest/bin/jest.js --runInBand` | 584/584, 82 suites, exit 0 |
| Client unit | `cd client; npm run test:ci` | 146/146, 47 suites, exit 0 |
| API + environment guards | `cd server; npm run test:e2e -- --detectOpenHandles`, URL fixture explicit | 41/41 API, 4 suites + 2 Node guards; exit 0, tự thoát |
| Browser focused | `cd client; playwright test e2e/team-backup.spec.ts --project=chromium --project=firefox` | 8/8, exit 0 |
| Server TypeScript | `tsc --noEmit --incremental false` | exit 0, gồm specs |
| Server build | `cd server; npm run build` | exit 0 |
| Client build | `cd client; npm run build` | TypeScript + Vite + bundle budget + prerender, exit 0 |
| Focused lint | ESLint 3 file server và 4 file client/E2E của R02 | exit 0 hai phía |

41 API tests = 23 R00 + 10 R01 + 8 R02; 2 environment guards được báo riêng. Tổng số test không phải tỷ lệ phủ lines/branches/workflow. Chưa chạy lại full browser suite hoặc full lint/dependency/container/remote CI gate; không gọi toàn release gate xanh.

## RED → GREEN, impact và review

Đã xem unit đỏ và HTTP đỏ trước production fix: MEMBER/VIEWER nhận backup thành công thay vì Forbidden/403. UI regression sau khi fixture ổn định có đúng hai test đỏ cho MEMBER/VIEWER, hai test OWNER/ADMIN pass. Browser ban đầu có đúng hai failure do vùng bấm export 40px, sau chỉnh UI giữ nguyên ngưỡng >=44px và pass.

Các lỗi harness ban đầu được phân biệt rõ: unit thiếu fixture organization nên trả NotFound; component click trước khi initial async effects ổn định; API so JSON policy bằng chuỗi khiến thứ tự key PostgreSQL gây false failure; TypeScript fixture role chưa thu hẹp enum. Đã sửa bằng fixture hợp lệ, await act, deep equality và literal roles. Không hạ assertions, tăng timeout/retry, skip hay thay coverage scope để đạt pass.

Impact trước sửa export trả LOW nhưng `partial=true`/0 caller trong khi context thấy controller và test; đã đối soát caller bằng source. Sau full rebuild, export nhận đúng một production caller/controller, LOW; vẫn là ranh giới bảo mật cần API regression. Helper bị xóa chỉ được export dùng. TeamPage/handlers LOW. `getTeamText` CRITICAL, 12 caller/8 flow; đã cảnh báo trước sửa, chỉ thêm một key và chạy toàn client unit.

Index cuối: 6.866 nodes, 18.314 edges, 274 flows, exit 0. `detect_changes(all)` trên diff gộp R00/R01/R02 trả CRITICAL, 23 tracked files, 41 symbols, 18 affected; không coi đây là phạm vi riêng R02. File test mới được kiểm tra riêng, không suy từ graph rằng mọi flow đã được bao phủ. Codegraph/Semble hỗ trợ định vị; Agentmemory chỉ trả metadata các lượt trước, roadmap/source/test hiện tại là căn cứ chính. Front-End Checklist không tìm thấy lỗi tĩnh có thể chứng minh trong snippet đã đưa; kết luận UI dựa thêm vào browser/axe, không dựa riêng heuristic đó.

Không có independent review thành công sau lỗi hạn mức reviewer ở lượt trước; R02 được tự review riêng source/caller/contract và evidence. [Manifest](r02-verification.json) ghi hash file, command và exit code; full logs `output/r02-*` chỉ ở local, bị Git ignore. Giữ nguyên báo cáo/manifest R00/R01 làm lịch sử.

## Cleanup và giới hạn

Hậu kiểm PostgreSQL sau suite: 0 user, connection, saved query, dashboard, widget, ERD, teamspace, resource policy và organization; 0 app session. Redis chỉ còn client hậu kiểm, không app client/subscriber. Sau xác minh compose ownership, đã dọn riêng fixture: 0 container, 0 listener trên 15432/16379; browser server 4173 cũng đóng. Không đụng container dự án khác.

Chưa kiểm chứng restore với mọi package malformed/legacy, backup rất lớn, concurrent export/role change giữa một request, failure injection/rollback giữa restore hoặc engine nguồn ngoài fixture. Không thay đổi thuật toán restore ở R02 và không tuyên bố nó có transaction all-or-nothing. Chưa đo lại coverage hoặc full UX toàn project.

**Gói kế tiếp: R03 — SQL read-only/destructive policy.** Bypass SQL đã xác nhận vẫn P0; R04–R14 và A01/A02 giữ mở theo roadmap. Sản phẩm chưa release-ready; không commit/push/deploy trong lượt này.
