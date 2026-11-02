# R01 — Kiểm quyền trước cache và thống nhất policy connection

**Ngày:** 22/10/2026, Asia/Saigon. **Trạng thái:** `VERIFIED_LOCAL`.
**Branch:** `codex/roadmap-r00`. **Base HEAD:** `3d7ec60845ddc2a07284c2873d9d3727acd30744`, v1.6.7. Đây là working tree chưa commit/push/deploy, tiếp nối R00.

## Kết quả cho người dùng

Request phải được xác minh quyền connection, membership hiện tại, resource policy, role và database đích trước khi sử dụng pool hay dữ liệu metadata/sample đã cache. Người bị thu hồi quyền không tiếp tục nhận dữ liệu chỉ vì JWT còn hạn hoặc owner đã làm nóng cache. Quyền owner được giữ theo contract hiện tại.

Thao tác ghi dạng form/API dùng cùng team policy với query: role readonly bị chặn cả khi request không chứa SQL. Table-window và raw query đều bị chặn khi override sang database ngoài whitelist. Insert/update/delete bị từ chối trả 403 và dữ liệu SQLite kiểm chứng trực tiếp không đổi. Guard database cũng chạy cho schema request có `operations: []`.

Danh sách database của thành viên chỉ trả whitelist cấu hình hiện tại; root hierarchy không lộ database ngoài whitelist từ cache dùng chung. Metadata columns/full metadata mở đúng database được chọn, kể cả database mặc định không nằm trong whitelist. Danh sách whitelist không đồng nghĩa đã kiểm tra trực tiếp mọi database đó tồn tại trên server.

## Phạm vi sửa

| Thành phần | Thay đổi | Ranh giới được giữ |
|---|---|---|
| [ConnectionsService](../../../server/src/connections/connections.service.ts) | `authorizeAccess` tái dùng quyền resource và team policy; getPool gọi nó trước warm/pending pool | Pool key, concurrency guard, tunnel/cleanup cũ; context có credential mã hóa chỉ dùng nội bộ |
| [Team policy](../../../server/src/permissions/utils/team-connection-access.util.ts) | Thiếu membership của connection tổ chức thì deny; readonly + write bị deny dù không có SQL | Owner bypass theo contract, resource permission vẫn kiểm tra riêng |
| [MetadataService](../../../server/src/metadata/metadata.service.ts) | Authorize trước cache cho hierarchy/databases/relationships/columns/metrics/fullmeta; refresh trước invalidate; whitelist hiện tại | Cache nội dung dùng chung nhưng quyết định quyền không cache; `null` chỉ dành cho enumeration metadata |
| [NoSqlService](../../../server/src/nosql/nosql.service.ts) | Authorize và query-enabled trước get/del cache sample, cả refresh | Quyền đọc schema không tự cho phép lấy sample values khi query bị tắt |
| [QueryService](../../../server/src/query/query.service.ts) | Guard ghi chung nhận database hiệu lực, role policy cho row/schema/import/seed/create/drop; giữ Forbidden trong các catch | Global readonly, resource WRITE, operation flags và validation cũ |
| [Connection type](../../../server/src/connections/entities/connection.entity.ts) | Bổ sung userId và hai field JSON policy đã có trong Prisma response | Không thêm field DB, migration hoặc đổi response wire |

Không sửa frontend, package/dependency/lockfile hoặc schema/migration trong gói R01. Thay đổi R00 đang có được giữ nguyên, `.zcode/` không đụng đến.

## Regression theo case audit

| Case / tình huống | Bằng chứng mới | Giới hạn diễn giải |
|---|---|---|
| K01: metadata cache cold/warm của owner, outsider đọc | HTTP outsider deny 403/404 cả trước và sau warm; owner đọc được; unit authorize trước cache ở sáu public read methods | Không chứng minh Redis nhiều replica production |
| K02: cached NoSQL sample và refresh | Sample synthetic trong Redis thật không bị đọc/trả/xóa cho outsider; unit deny trước Redis get/del/driver, query-disabled cũng deny | Không chạy MongoDB driver thật hoặc sample hợp lệ trên MongoDB |
| T03: role readonly ghi bằng API row | Insert/update/delete đều 403; SELECT trực tiếp SQLite xác nhận dữ liệu nguyên vẹn | Không chạy mọi engine database |
| T05: database override qua browse/raw query | Cùng trả 403 trên connection đã warm; unit warm pool deny trước createPool | Không chứng minh SQL qualifier cross-catalog hoặc parser chống mọi bypass |
| Schema/import/seed readonly | HTTP cả ba deny 403; schema empty operations với database bị cấm có unit regression riêng | Không thay thế R03 SQL semantic/native restriction |
| Đường hợp lệ | Owner/member readonly đọc row thật; owner/full member insert thật thành công | Không phải nghiệm thu mọi feature database |
| Thu hồi quyền khi JWT chưa hết hạn | Resource policy deny rồi membership delete; cùng JWT không đọc được metadata đã warm | Không phải đo latency revocation đa replica hay mọi race đồng thời |
| Selected database | Unit columns/full metadata cold chỉ mở database được chọn, không mở default bị cấm | Chưa chạy engine đa database thật |

[Suite API R01](../../../server/test/connection-policy.e2e-spec.ts) có 10 test; [connections spec](../../../server/src/connections/connections.service.spec.ts), [metadata spec](../../../server/src/metadata/metadata.service.spec.ts), [NoSQL spec](../../../server/src/nosql/nosql.service.spec.ts), [policy spec](../../../server/src/permissions/utils/team-connection-access.util.spec.ts) và [query spec](../../../server/src/query/query.service.spec.ts) giữ các regression focused.

## Kiểm chứng trên tree cuối

| Gate | Lệnh tại server | Kết quả |
|---|---|---|
| Full unit | `node node_modules/jest/bin/jest.js --runInBand` | 580/580, 82 suites, exit 0 |
| Environment + API | `npm run test:e2e -- --detectOpenHandles`, URL fixture explicit | 2 Node guards + 33/33 API, 3 suites, exit 0; không force-exit |
| TypeScript gồm specs | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | exit 0 |
| Build | `npm run build` | Prisma client hiện tại + Nest build, exit 0 |
| Focused ESLint | ESLint 12 file TS production/spec/E2E của R01 | exit 0 |
| Graph | Full rebuild `--force --index-only --name Data-Explorer-Workspace --workers 4` | exit 0; 6.841 nodes, 18.222 edges, 274 flows |

33 API tests gồm 23 test R00 và 10 test R01. 580 unit tests là tổng suite hiện tại, tăng 17 so với mốc R00 563; đây không phải số workflow độc lập hoặc tỷ lệ coverage. UI/browser/client không chạy lại trong R01; 142 client/58 browser của R00 là số lịch sử. Lines/branches coverage chưa đo lại, scope coverage không đổi.

Fixture dùng PostgreSQL app DB, Redis và file SQLite riêng, dữ liệu synthetic; guards/controllers/PermissionsService/driver SQLite thật. R01 tạo JWT qua JwtService của app cho user fixture, không tự mô phỏng guard; password login được test ở R00. Không gọi AI/mail/bank thật. Hướng dẫn dựng fixture ở [README](README.md).

Đã quan sát test đỏ trước sửa cho warm-cache/pool, readonly structured insert, private database list, selected-database và empty schema operations. Lần API đầu có ba failure do fixture đoán sai route/method và permission enum; đã sửa fixture theo controller/enum, không tính ba failure đó là lỗi sản phẩm. Không hạ assertion, đổi timeout/retry hay skip để đạt pass.

Trước cleanup: User 0, Connection 0, PostgreSQL app session 0; Redis không có app client/subscriber. Xác minh project label và working directory trước khi dọn riêng compose fixture; hậu kiểm còn 0 container, 0 listener ở cổng 15432/16379. Không dừng Docker Desktop hoặc đụng container dự án khác.

## Impact, review và công cụ

Trước sửa getPool được đánh giá CRITICAL và đã cảnh báo; guard ghi chung MEDIUM, các method chuyên biệt LOW. Chỉ sửa policy ở điểm dùng chung sau khi trace caller, giữ pool lifecycle/concurrency. Index cuối nhận đúng authorizeAccess với 9 caller trực tiếp. Impact getPool sau rebuild vẫn CRITICAL: 18 caller trực tiếp, 49 symbol upstream, 5 module Query/Metadata/AI/NoSQL/Database-strategies.

`detect_changes(all)` cuối trả LOW, 19 tracked files/35 symbols/0 recognized execution flows cho diff gộp R00/R01. Không dùng kết quả này để hạ rủi ro getPool; file mới và flows không được nhận diện được review source/test riêng. Index không có PDG security analysis đầy đủ. Codegraph/Semble/Agentmemory đã được kiểm tra ở mạch công việc trước; không giả định những công cụ đó đã xác minh runtime patch này.

Reviewer độc lập không thực thi được do usage limit; không có independent review thành công. Self-review riêng đã tìm và sửa hai regression selected database và schema request rỗng, có test đỏ/xanh. Bằng chứng portable gồm source/test và [manifest hash + gate](r01-verification.json); full logs cục bộ `output/r01-*` bị Git ignore, không chứa trong evidence bundle portable. Manifest không thay thế việc chạy lại checks trên tree mới.

## Còn mở và gói tiếp theo

- **P0 R02:** backup tổ chức vẫn cần lọc saved SQL/dashboard/ERD theo quyền resource, repro E08 chưa được sửa ở gói này.
- **P0 R03:** SQL read-only lexical bypass và SQL native/cross-catalog semantics vẫn chưa sửa; không tuyên bố mọi raw SQL đều an toàn sau R01.
- Context AI/query export dùng pool policy chung đã đối soát source, chưa chạy provider/export cross-engine thật. AiConnectionService còn bọc một số denial thành 500 hoặc null trước schema gather; normalization UX lỗi thuộc M20/R10.
- A01 login locale và A02 legacy cache wiring vẫn mở. Chưa chứng minh Redis production multi-replica, coverage toàn workflow, remote CI hoặc full release gate. Các gói R04–R14 giữ trạng thái theo roadmap.

**R01 đạt cục bộ trong phạm vi trên; toàn sản phẩm chưa release-ready. Gói tiếp theo là R02.** [Roadmap](../ROADMAP.md) và [progress ledger](../ROADMAP-PROGRESS.md) là trạng thái triển khai hiện tại; báo cáo R00 và baseline audit giữ nguyên lịch sử.
