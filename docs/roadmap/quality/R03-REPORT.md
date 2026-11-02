# R03 — Read-only, SQL destructive confirmation và policy Mongo/Redis

**Ngày:** 23/10/2026, Asia/Saigon. **Trạng thái:** `VERIFIED_LOCAL` trong phạm vi engine/case ghi dưới đây.
**Branch:** `codex/roadmap-r00`. **Base HEAD:** `3d7ec60845ddc2a07284c2873d9d3727acd30744`, v1.6.7. Working tree tiếp nối R00/R01/R02, chưa commit/push/deploy.

## Kết quả và contract

S08/S09 được ghim bằng regression: comment marker nằm trong literal/quoted identifier không được che statement ghi ở phía sau. Guard xét toàn batch trước khi lấy pool, kiểm quyền trước thực thi; `confirmed:true` chỉ xác nhận tác động đã được cho phép, không cấp quyền WRITE hoặc vượt connection/role chỉ đọc.

Scanner lexical có giới hạn dùng chung cho split, phân loại và cảnh báo. Nó giữ SQL raw cho driver, tạo projection bỏ literal để tìm keyword thực thi và một projection riêng giữ quoted identifier để cảnh báo đúng tên đối tượng. Từ khóa `DELETE` trong dữ liệu đọc không bị nhận nhầm thành thao tác ghi. SQL chưa đóng quote, backslash quoting phụ thuộc mode, comment thực thi/lồng nhau, dollar quote ngoài PostgreSQL và MySQL/MariaDB hash comment bị từ chối rõ; không đoán quyền khi không hiểu cú pháp. Giới hạn 500.000 ký tự/100 statement được giữ.

Mọi SQL được phân loại là đọc chạy native read-only trên PostgreSQL/MySQL/SQLite, bao gồm query count và đọc trang bảng. Vì `SELECT stored_function()` có thể ghi, chỉ bật native mode khi connection có `readOnly:true` là chưa đủ: VIEWER có READ nhưng không có WRITE vẫn truy cập được connection cho ghi ở chế độ default/full. R03 khóa cả đường này. Explicit write/opaque CALL vẫn đi qua WRITE/confirmation và transaction ghi theo contract hiện có.

Đây là thay đổi tương thích có chủ ý: SELECT có tác dụng ghi sẽ bị database từ chối kể cả owner trên connection writable; cần dùng thao tác ghi tường minh được policy cho phép. PostgreSQL/MySQL có thêm transaction cho query đọc; chưa benchmark chi phí round-trip. Native mode bổ sung cho quyền ứng dụng, không thay thế chúng.

## Phạm vi sửa

- [SQL/Mongo guard](../../../server/src/query/query-guard.util.ts): một scanner có giới hạn; keyword/prefix chính xác; metadata warning không lấy tên từ literal; PRAGMA chỉ cho tập đọc hỗ trợ. MySQL và alias MariaDB dùng cùng policy comment/ASCII whitespace; `#` trong literal vẫn đọc bình thường.
- [QueryService](../../../server/src/query/query.service.ts): từ chối lexical form không hỗ trợ trước pool; truyền native flag vào query đơn, batch đọc, count và table window. Native violation PostgreSQL `25006`, MySQL read-only transaction và SQLite read-only được trả 403 có audit. Quy tắc role/resource R01 vẫn giữ.
- [Interface](../../../server/src/database-strategies/database-strategy.interface.ts), [PostgreSQL](../../../server/src/database-strategies/postgres.strategy.ts), [MySQL](../../../server/src/database-strategies/mysql.strategy.ts), [SQLite](../../../server/src/database-strategies/sqlite.strategy.ts): option `readOnly` tùy chọn. PostgreSQL dùng `BEGIN READ ONLY`; MySQL dùng `START TRANSACTION READ ONLY`; SQLite bật `query_only` đồng bộ trong transaction rồi khôi phục trạng thái cũ trong `finally`. Commit/rollback/release và cap kết quả được giữ.
- Mongo dùng lại validator/sanitizer hiện có và duyệt pipeline được hỗ trợ, kể cả `$lookup.pipeline`/`$facet` lồng nhau. `$out`, `$merge` và stage không biết bị chặn. Aggregate không an toàn cũng không được endpoint này nhận chỉ vì connection writable.
- [Redis](../../../server/src/database-strategies/redis.strategy.ts): xuất và dùng lại whitelist command hiện có, không suy luận GET/SET theo prefix SQL. Endpoint command chỉ nhận tập đọc hỗ trợ.
- [Unit lexical](../../../server/src/query/query-guard.r03.spec.ts), [unit routing](../../../server/src/query/query-policy.r03.spec.ts), [SQLite thật](../../../server/src/query/read-only-strategy.r03.spec.ts), [HTTP thật](../../../server/test/query-policy-r03.e2e-spec.ts), [fixture overlay](../../../server/test/compose.r03.yml), [browser](../../../client/e2e/authenticated-workspace.spec.ts). Các test cũ có kỳ vọng sai về keyword trong literal/cú pháp không hoàn chỉnh được sửa contract, không bỏ case hoặc giảm random runs.

Không thêm dependency, không đổi schema database, timeout/retry/skip/coverage threshold, global skills hoặc cấu hình plugin. Không sửa frontend production trong R03.

## Bằng chứng theo tình huống

| Tình huống | Kiểm tra đã thực hiện | Kết luận trong phạm vi này |
|---|---|---|
| Literal chứa `--`, `/*`, quoted identifier và batch có DELETE | Unit trước/sau sửa; HTTP PostgreSQL/MySQL có `confirmed:true`, đối chiếu dữ liệu trực tiếp | Không ghi qua connection read-only; parser không bỏ statement sau literal |
| Keyword ghi trong dữ liệu SELECT | Unit và HTTP PostgreSQL/MySQL | Literal vẫn đọc được; không hiện warning chỉ vì chứa chữ DELETE |
| CTE ghi, WHERE trong literal/identifier, opaque statement | Unit lexical/attack/fuzz | Không lấy WHERE trong dữ liệu làm predicate; cần confirmation cho write không xác định tác động |
| MySQL `# '\nDELETE ... # '` | Reviewer xác minh harmless engine probe; unit/service RED, HTTP writable từ chối 400 và hàng vẫn nguyên | Hash comment bị từ chối trước pool; alias MariaDB có regression riêng |
| `--` + Unicode whitespace không khớp engine | Probe reviewer không chứng minh write bypass; unit ghim MySQL/MariaDB | Từ chối cú pháp mơ hồ; không nâng thành finding đã khai thác ghi |
| SELECT gọi hàm xóa dữ liệu | HTTP PostgreSQL/MySQL read-only connection, 403 rồi đọc lại thành công; đối chiếu table trực tiếp | Native transaction chặn tác dụng ghi và pool tiếp tục dùng được |
| Resource READ không WRITE, connection writable | HTTP VIEWER thực, assert READ=true/WRITE=false, default/full trên hai engine; `confirmed:true`, count/ordinary read sau denial | Quyền READ không trở thành WRITE qua stored function |
| Query/count/table window | Unit kiểm flag chính xác; HTTP ordinary read/count dưới VIEWER | Native flag được truyền vào các đường đã sửa, không chỉ raw query đầu tiên |
| SQLite native mode | In-memory SQLite thật: DELETE RETURNING, batch, restore query_only sau lỗi và giữ trạng thái ON trước đó | Write bị chặn; mode không rò sang thao tác tiếp theo |
| Mongo `$out`/`$merge` | HTTP MongoDB 7: 403, collection output không xuất hiện, source còn một document | Đường aggregate ghi bị chặn trước driver |
| Mongo pipeline lồng nhau/stage không biết | Unit routing assert không gọi pool; dùng lại validator có giới hạn | Fail closed cho tập hỗ trợ; không tuyên bố đã chạy engine cho mọi nesting |
| Redis GET/SET | HTTP Redis 7: GET đọc giá trị gốc, confirmed SET 403, key không đổi | Phân loại bằng command thật, không dùng ngữ pháp SQL |
| Batch writable sau confirmation | HTTP PostgreSQL: request chưa xác nhận 403, confirmed 201 và dữ liệu đổi đúng fixture | Luồng ghi được phép vẫn chạy |
| Lỗi statement thứ hai sau DELETE | HTTP PostgreSQL/MySQL: lỗi 500, đối chiếu table vẫn đủ hàng | Transaction rollback giữ batch atomic trong case đã chạy |
| UI AI → review → insert → execute → cancel → execute → confirm | Chromium/Firefox, strict API mock, ghi nhận từng POST `/api/query` | Hủy không gửi confirmed request; confirm phát đúng một confirmed request với SQL gốc |

Mongo F4 trước đây là hardening P2, không phải lỗ hổng engine đã được chứng minh. Bằng chứng mới xác nhận prevention `$out/$merge` trên MongoDB 7; không khẳng định mọi nested pipeline trước sửa đều thực thi được hoặc nâng toàn bộ F4 thành P0.

## Gate và bằng chứng đỏ/xanh

| Gate | Lệnh / phạm vi | Kết quả trên tree cuối |
|---|---|---|
| Backend unit | `cd server; node node_modules/jest/bin/jest.js --runInBand --json` | **640/640**, 85 suites, exit 0; lần cuối 50,868s |
| API thật | Jest `jest-e2e.json --runInBand --detectOpenHandles`, hai E2E URL explicit | **60/60**, 5 suites, exit 0; 19 test R03 + 41 test R00/R01/R02 |
| Environment guard | `node --test test/e2e-environment.test.cjs` | 2/2, exit 0 |
| Browser R03 | `playwright test e2e/authenticated-workspace.spec.ts --project=chromium --project=firefox` | **2/2**, exit 0; Chromium 20,1s, Firefox 31,3s, timeout 60s/retry 0 không đổi |
| Server TypeScript/build/lint | Compiler gồm specs, build hiện có, lint 15 file TS R03 | exit 0 từng lệnh; không có lint warning/error cuối |
| Client unit | Vitest toàn bộ suite với cấu hình cũ | **146/146**, 47 files, exit 0; lần cuối 18,11s |
| Client build/lint | Build TypeScript/Vite/budget/prerender; lint browser spec R03 | exit 0 từng lệnh; bundle budget hiện có đạt |
| Diff/docs/hash | Git whitespace, link/anchor, JSON và SHA-256 | Kết quả đối chiếu được ghi trong [manifest R03](r03-verification.json); không thay hash source lịch sử để giả lập gate mới |

Bằng chứng raw đặt trong `output/roadmap-r03/` bị ignore; manifest portable ghi file hash, command/exit/count và giới hạn. Không chỉnh kết quả 12 FAIL trong baseline audit cũ thành PASS. Những lần chạy trước source cuối không được dùng thay gate cuối.

- RED lexical đầu: 21 fail/4 pass; RED policy: 9 fail/1 pass. Native API đầu có lỗi MySQL nhận SELECT side effect 201 làm đổi hàng; đã sửa transaction read-only và chạy lại đối chiếu dữ liệu.
- Review bổ sung cho classified-read/hash comment/count flag tạo 8 fail/63 pass trước sửa. Alias MariaDB tạo thêm 5 fail/47 pass trước sửa cuối; test tương ứng được giữ trong full unit.
- Phân biệt lỗi harness: kỳ vọng status 400 thay vì denial 403 đã có, import enum fixture sai, và SQLite UDF reentrant gặp database busy không chứng minh native vulnerability. SQLite test hiện dùng DELETE RETURNING với writable control. Không tính các lỗi harness là finding sản phẩm mới.
- Browser trước đó có Chromium timeout, Firefox có lần pass rồi lần serial cả hai timeout ở bước khác nhau. Giữ log/trace. Máy có 15,78 GiB RAM, một mốc còn 0,78 GiB khi fixture hoạt động. Sau dừng riêng bốn fixture container, mốc trước browser còn 1,40 GiB và cả hai pass với cùng assertions/budgets. Điều này không đủ để khẳng định thiếu RAM là nguyên nhân duy nhất hay luồng đã hết flake.
- Client full suite đầu có 145 pass/1 timeout ở AiConfigTab, giới hạn 5.000ms. Diagnostic nguyên file 7/7, case đó 1.385ms; full suite nguyên cấu hình chạy lại 146/146. Không sửa source/test/config phía client để làm xanh. Lint server ban đầu bắt một type cast thừa trong test mới; bỏ cast, giữ assertion và chạy lại full server unit/typecheck/lint sau sửa.

## Impact và review

GitNexus impact được chạy trước sửa symbol. Shared interface có HIGH/22 direct references, 7 implementations, là lower bound; đã cảnh báo trước sửa, giữ option tùy chọn và kiểm type/build/callers. Scanner mới sau refresh có LOW/4 caller trực tiếp; raw query và count có caller tương ứng, table-window/count mỗi phần LOW/1 caller trực tiếp. Những số này giúp chọn phạm vi kiểm tra, không chứng minh runtime an toàn.

Index được refresh thành công trong lượt làm: 6.925 nodes/18.443 edges/274 flows, trước các sửa cuối. `detect_changes(all)` nhận diff gộp R00–R03 là **CRITICAL**, 36 tracked files/84 symbols/23 affected processes; class/section attribution có thể rộng và chưa bao trùm mọi file mới chưa track. Giữ cảnh báo cho scope tích hợp; không coi đây là 36 file chỉ do R03 hay dùng graph thay test. Không commit hoặc merge.

Có reviewer độc lập đọc phạm vi R03: hai finding Important còn hở (resource READ/native flag, MySQL hash comment), rồi re-review phát hiện alias MariaDB. Hai finding là đường hở tồn tại trước R03, không gán là regression mới. Reviewer xác nhận explicit writable path/read-only role và count/table window sau sửa native flag; alias được parent sửa tối thiểu và có RED/full-suite regression, chưa có lượt reviewer độc lập thứ ba xác nhận alias. Reviewer không chạy full HTTP/browser gate; nghiệm thu dựa gate thực thi của parent, không gọi là chứng nhận toàn repo.

So với snapshot trước R03, 33 file đang sửa ngoài phạm vi gói này giữ nguyên hash; ba file thay đổi đúng dự kiến là browser spec, QueryService và QueryService spec. GitNexus tự cập nhật số index trong AGENTS.md/CLAUDE.md; không thay quy tắc của hai file. Các source/test mới và source trước đó chưa dirty được liệt kê riêng trong manifest R03.

## Hậu kiểm fixture

Chỉ dùng dữ liệu synthetic và cổng loopback. Sau API cuối: PostgreSQL user/connection/organization/r03 table/function đều 0, không còn app session; MySQL không table/function fixture; không Mongo database `r03_*` hoặc Redis key `r03:*`; Redis chỉ có client hậu kiểm, không subscriber/app client. Kiểm compose ownership/path trước khi dừng riêng project `data-explorer-e2e`.

Đã dừng và xóa bốn container fixture cùng network; hậu kiểm **0 container fixture/0 listener** trên 15432/16379/17017/13306. Không prune Docker, xóa history hay tác động container khác. Lệnh xóa thư mục rỗng `server/output/roadmap-r03` trước đó bị automatic policy chặn; giữ nguyên và không vòng qua lệnh bị chặn.

## Giới hạn và bước tiếp theo

- Chưa đo lại lines/branches/function coverage hoặc tỷ lệ phủ workflow; số test không phải coverage toàn sản phẩm.
- Browser dùng strict API mock; chưa browser → backend → database thật trong cùng một luồng, chưa mobile/WebKit/a11y toàn trang. Những kết quả UI R02 là lịch sử riêng.
- Native DB đã kiểm PostgreSQL 16/MySQL 8.4/SQLite. MariaDB alias đi qua MySQL 8.4 fixture để kiểm routing/comment rejection; **chưa có MariaDB server độc lập**, MSSQL/ClickHouse native isolation hoặc mọi extension/UDF/dialect mode.
- Scanner có tập cú pháp hỗ trợ; không phải SQL parser đầy đủ. Những cú pháp bị từ chối có thể từng chạy được trước đây. Tài khoản database quyền thấp vẫn là lớp cần thiết; không dùng regex/guard này thay quyền database production.
- Chưa benchmark transaction đọc, full dependency/container/security audit, remote CI hoặc release gate. Không phát hành chỉ vì R03 local pass.
- Các gate local ghi trên đã đạt; bước tiếp theo trong roadmap là **R04 — typed row identity và composite key**. Các mục khác và Gate A chưa tự đóng.

## Nguồn contract kỹ thuật

- [PostgreSQL 16 lexical structure](https://www.postgresql.org/docs/16/sql-syntax-lexical.html), [SET TRANSACTION / READ ONLY](https://www.postgresql.org/docs/16/sql-set-transaction.html).
- [MySQL 8.4 transaction characteristics](https://dev.mysql.com/doc/refman/8.4/en/set-transaction.html).
- [SQLite comments](https://www.sqlite.org/lang_comment.html), [PRAGMA query_only](https://www.sqlite.org/pragma.html#pragma_query_only).
- [MongoDB $out](https://www.mongodb.com/docs/manual/reference/operator/aggregation/out/).

Các nguồn giải thích contract; kết quả thực thi trong báo cáo dựa test đã chạy ở checkout này.
