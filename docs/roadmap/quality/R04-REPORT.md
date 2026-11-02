# R04 — Typed row identity và composite key

**Ngày:** 23/10/2026. **Trạng thái:** VERIFIED_LOCAL với containment công khai bên dưới. Xem command, exit code và hash trong [manifest](r04-verification.json). R00–R03 giữ bằng chứng lịch sử riêng. Không commit/push/deploy.

## Phạm vi và kết quả cần đạt

Identity của một hàng là toàn bộ tuple khóa chính và giá trị gốc, không phải chuỗi dùng làm key cho UI. Với `"001"` và `"1"`, sửa/xóa hàng thứ nhất phải giữ nguyên hàng thứ hai. Với `(A,1)/(A,2)/(B,1)`, chỉnh sửa, pending changes, selection và bulk replace phải phân biệt đủ hai thành phần.

Thực hiện xuyên DataGrid → hook editing → API adapter → DTO → QueryService → SQL strategy. Legacy `pkColumn/pkValue(s)` vẫn dùng được cho khóa đơn thật; khi đi cùng tuple, projection legacy phải khớp. Khóa không được mô tả an toàn phải bị từ chối rõ trước thao tác ghi.

## Thay đổi chính

- Thêm `RowIdentity` có kiểu và tuple optional cho update/delete; giữ chữ ký caller legacy. UI giữ snapshot giá trị gốc riêng với state key, không chuyển key text thành Number và không giải mã state key thành dữ liệu database.
- Selection, từng pending row và target của bulk replace dùng cùng full tuple. Đổi table/connection làm sạch state theo scope; generation guard ngăn request cũ xóa pending changes của bảng mới. Lưu tuần tự dừng khi lỗi; chỉ bỏ các hàng đã lưu thành công, giữ hàng lỗi để người dùng xử lý. Đây không phải transaction nguyên khối cho nhiều request update.
- Server kiểm metadata PK thật, toàn bộ/duy nhất cột khóa, kiểu scalar, unsafe integer, duplicate tuple và legacy projection. Cột update phải khớp chính xác metadata rồi mới xét cấm đổi PK; chặn alias hoa/thường và pseudo-column SQLite.
- Predicate SQL dùng mọi thành phần tuple, identifier quoting và parameter binding. Update kỳ vọng đúng một hàng; delete kỳ vọng đúng số tuple. Mismatch trả conflict 409 và rollback transaction thay vì báo thành công. Giới hạn 1–1000 identity, 1–16 cột/identity, tối đa 2000 tham số gồm updates.
- PostgreSQL/MySQL dùng một connection dành riêng cho transaction; rollback thất bại thì loại connection. MySQL giữ metadata lock của target trước khi kiểm InnoDB và trước DML. SQLite dùng transaction đồng bộ; metadata và DML chỉ định schema main để tránh TEMP shadow.
- SQLite metadata nhận mọi cột composite PK (`pk > 0`); đọc bigint dùng native safeIntegers rồi chuyển số vượt safe integer thành chuỗi. MySQL bật chế độ big-number string. MSSQL sửa join metadata PK và có transaction/predicate đủ tuple.
- UI có nhãn input và nút chọn dòng, trạng thái `aria-pressed`, khóa tương tác khi đang lưu và thông báo khi identity không an toàn. Insert vẫn là thao tác riêng.

## Ma trận hỗ trợ và containment

| Đường dữ liệu | Bằng chứng | Trạng thái / giới hạn |
|---|---|---|
| PostgreSQL 16 | HTTP thật qua Nest/auth/controller/driver, text 001, composite edit/delete, bigint, UUID native, DECIMAL(19,18), stale batch rollback | VERIFIED_LOCAL trong tập case được kiểm |
| MySQL 8.4 InnoDB | HTTP thật cho composite/text/bigint/decimal và stale batch rollback | VERIFIED_LOCAL trong tập case được kiểm |
| MySQL MyISAM / engine khác InnoDB | HTTP thật MyISAM, kiểm dữ liệu không đổi sau denial | CONTAINED: từ chối trước DML; không hứa rollback cho bảng không hỗ trợ |
| SQLite main | HTTP thật file riêng + native in-memory, composite/legacy/bigint/rollback/TEMP shadow | VERIFIED_LOCAL trong tập case được kiểm; public legacy được quy về main |
| MSSQL | Driver contract unit: tuple SQL, parameter, count conflict/rollback; validator GUID | Chưa nghiệm thu native SQL Server; không dùng unit thay bằng chứng engine |
| MariaDB / Cockroach | Dùng strategy alias tương ứng, được giữ trong contract | Chưa chạy engine riêng |
| Khóa date/time/timestamp | Native PostgreSQL precision collision + regression server/UI | CONTAINED đến khi có đọc/serialize không mất precision |
| Khóa numeric/decimal/money đã thành JS number | Validator/hook regression; probe driver SQL Server trong review | CONTAINED: bắt buộc chuỗi decimal chính xác; PostgreSQL/MySQL decimal strings vẫn được kiểm thật |
| Không PK, tuple thiếu/thừa/duplicate, null/object/unsafe number, type không hỗ trợ | Trust-boundary/native tests và UI disable | CONTAINED; không suy đoán identity bằng index dòng |
| MongoDB/Redis/ClickHouse structured row update/delete | Service và UI từ chối loại engine chưa có contract unique typed identity an toàn | CONTAINED; không tuyên bố hỗ trợ composite/BSON hay uniqueness của ClickHouse |

Containment chỉ đóng đường thao tác không an toàn. Nó không đồng nghĩa mọi engine/type đã hỗ trợ chỉnh sửa. Các SQL/raw/NoSQL API khác tiếp tục theo policy R01/R03; R04 không thay chúng bằng structured row editing.

## Review và chu kỳ RED → GREEN

Review độc lập lần đầu tìm bốn finding: temporal precision loss (P1), MyISAM rollback không hiệu lực (P1), alias cột vượt guard PK (P2), GUID SQL Server bị từ chối (P2). Lượt xem lại xác nhận bốn sửa và tìm thêm decimal/numeric precision loss của SQL Server (P1). Parent bổ sung regression đỏ trước sửa, chặn dữ liệu không an toàn ở cả UI/server. Sửa decimal được kiểm lại bằng full unit/native API; không có kết luận độc lập lượt ba trong bằng chứng nghiệm thu.

- SQLite composite/count ban đầu: 6 FAIL. Hook identity: 4 FAIL/1 PASS. Service boundary: 5 FAIL/1 PASS.
- HTTP native ban đầu: 8 FAIL/13 PASS; sau sửa lossless bigint và native SQLite có 21 PASS.
- Regression TEMP shadow: 1 FAIL/6 PASS; lifecycle hook: 2 FAIL/6 PASS; duplicate canonicalization: 1 FAIL/6 PASS.
- Review round 1: service 5 FAIL/7 PASS, UI temporal 1 FAIL, HTTP temporal/MyISAM 2 FAIL/21 PASS.
- Review decimal: service 4 FAIL/12 PASS, UI 1 FAIL/9 PASS; sau sửa full unit và API được chạy lại.

Các số RED là những lượt độc lập, không cộng thành coverage. Log/JSON cục bộ nằm trong `output/roadmap-r04/`, không đóng gói dữ liệu người dùng.

## Gate cuối

Tất cả tiến trình ở bảng dưới đã kết thúc với exit 0; không force-exit, skip, tăng timeout/retry hoặc hạ scope coverage. Unit/API/browser dưới đây chạy trên cùng 26 file source/test R04 đã chụp SHA-256; kiểm lại snapshot trước bàn giao.

| Gate | Kết quả | Phạm vi |
|---|---|---|
| Server unit | 666/666, 88 suites | Toàn bộ suite hiện tại, gồm regression R00–R04 |
| Client unit | 156/156, 48 files | Toàn bộ suite hiện tại; không dùng số describe suites của JSON Vitest thay file count |
| API | 86/86, 6 suites | R04 thêm 26 case, 60 case kế thừa |
| Environment guards | 2/2 | Fixture URLs/config được kiểm trước migrate/test |
| Browser | 12/12 | Chromium + Firefox; mỗi engine 5 case R04 và 1 luồng destructive confirm R03 |
| Server type/build | Exit 0 | Typecheck gồm specs; Nest build |
| Client build | Exit 0 | TypeScript, Vite, bundle budget (application chunk lớn nhất 485 KB), prerender |
| Lint | Exit 0, không warning | 18 server TS và 8 client/browser TS trong scope R04 |

Scope/evidence được đối soát riêng bằng protected-file SHA, manifest/hash/link/JSON, GitNexus detect_changes và diff check; xem số liệu kết thúc trong manifest và ledger.

GitNexus cuối có 7024 nodes/18702 edges/275 flows. Cả scope all và compare với main báo CRITICAL cho diff gộp R00–R04: 47 tracked files, 169 symbols, 37 affected processes. Đây là cảnh báo review/integration, không phải gate runtime và không phải chỉ riêng R04. File untracked không được tự coi đã nằm trong git-diff scope; manifest liệt kê/hash 26 file R04 riêng.

Browser dùng strict API mock, không phải browser kết nối backend thật. API kiểm auth/controller/driver/database riêng. Không cộng hai tầng thành một test full-stack browser duy nhất.

## Phân biệt lỗi harness và rủi ro sản phẩm

Native better-sqlite3 giữ constructor lỗi của Jest VM đầu tiên; suite R03 dùng `.toThrow()` có thể nhận promise đã reject nhưng matcher coi lỗi khác realm là không throw. Diagnostic ghi `SQLITE_READONLY` với `instanceof Error=false`. Thay hai matcher bằng kiểm rejection chứa chính native code `SQLITE_READONLY`; vẫn giữ assertion dữ liệu không đổi và query_only phục hồi. Không giảm assertion read-only hoặc đổi policy.

Browser lượt đầu: 5 PASS/3 FAIL. Hai composite case dùng locator label không khớp cách browser tính tên select; role combobox xác nhận đúng trạng thái selected. Case Chromium đầu còn Loading khi hết assertion budget. Giữ trace/screenshot lỗi, sửa locator, chạy lại với timeout 60s/retry 0/worker 1 nguyên gốc. Các lần chậm trước vẫn được lưu, không tuyên bố hết flake.

Unit chỉ ra metadata fixture cũ thiếu cột `name`; lint chỉ ra hai biến schema thừa và một throw trong finally của cleanup test. Đã hoàn thiện fixture, bỏ biến thừa và dùng assert kiểm target cleanup. Lần formatter gặp lỗi mở một file đã được chạy lại đúng file. Không đổi threshold/skip/timeout để làm xanh.

## UI/UX trong phạm vi R04

Đã xem render desktop Chromium/Firefox của grid: hai hàng cùng tenant giữ selection riêng; giá trị sau bulk replace hiển thị đúng hàng; nút chọn có tên và trạng thái; no-PK/temporal/decimal không phát write. Impeccable detector với ba file grid/hook/identity trả danh sách rỗng; đó là kiểm cơ học nguồn, không chứng nhận WCAG hay toàn bộ UI.

Giao diện hiện có vẫn dùng chữ nhỏ và target chọn hàng dưới 44px; toast lưu/replace có thể chồng lên vùng điều hướng. R04 không có full-page a11y, keyboard-only toàn luồng, mobile/touch, WebKit, theme/contrast matrix hoặc visual golden gate. Các mục này thuộc R11/R12, không gán điểm UI toàn sản phẩm từ một ảnh desktop.

## Quy tắc thiết kế và giới hạn còn lại

Giữ OOP/strategy sẵn có, thêm type và utility nhỏ thay vì dựng hierarchy/capability framework. Trust-boundary validation và lifecycle rollback được giữ ở ranh giới chung. C01/C03/C04/C05/C06/C08/C10 được chứng minh bằng metadata, count conflict, connection release, scope generation, error retention, behavior regression và compatibility legacy. Nesting transaction/cleanup còn trên hai tầng ở một số nơi vì rollback/release phải chạy đúng thứ tự; không tách wrapper chỉ để đạt số tầng hình thức.

Không có kiểm tra optimistic concurrency cho giá trị non-PK: identity đúng không phát hiện người khác đã sửa nội dung hàng. Multi-row update UI là nhiều request, có thể thành công một phần; không hứa all-or-nothing. Chưa benchmark metadata+transaction overhead hoặc kiểm mọi trigger/UDF/external side effect, schema DDL race và driver configuration. Metadata/type hỗ trợ có thể mở rộng sau khi có lossless retrieval và native regression tương ứng.

Chưa đo lại coverage lines/branches/functions/workflows; test count không phải tỷ lệ bao phủ. Chưa có remote CI, full dependency/container security scan hoặc release gate toàn sản phẩm. R05–R14 và các P0 khác vẫn theo roadmap. Giữ diff R00–R03, không reset/stash/commit/push/deploy.
