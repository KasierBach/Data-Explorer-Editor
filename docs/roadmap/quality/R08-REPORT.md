# R08 — Cache identity và invalidation

Status: VERIFIED_LOCAL (25/10/2026). Branch `codex/roadmap-r00`, HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`; tree có R00–R08 chưa commit. Không reset/stash/commit/push/deploy. Evidence riêng: `output/roadmap-r08/`, [manifest](r08-verification.json). HEAD một mình không chứa patch đã kiểm tra.

## Contract và phạm vi

M09/M10, B1-F6/F7. Hash tuple nguyên văn bằng JSON + SHA-256; namespace `freshness:v2` tránh tái sử dụng key cũ. SQL/literal/quoted identifier/database giữ case, khoảng trắng và vị trí; numeric/string không bị gộp. Count cache giữ tổng của query; raw result rows luôn đọc driver. Metadata hierarchy identifier dùng tuple thay ghép dấu phân tách. Generation UUID tránh read/increment/write trùng khi hai invalidation đồng thời.

`FreshnessService.invalidateConnection` dùng các namespace metadata thật: hierarchy/databases/relationships/columns/metrics/fullmeta theo connection; query count, NoSQL schema và AI context theo connection/database. AI context không chỉ định database cũng bị invalidation khi default database thay đổi. NoSQL schema key chứa collection và sample size. Giữ authorization trước mọi cache read/refresh.

Raw write, structured mutation, DDL, import, seed, migration và refresh nối về cơ chế này. PostgreSQL/SQLite rollback không được báo success. Mongo ordered bulk failure giữ phần đã ghi và làm mới cache; seed làm mới sau từng phần đã hoàn tất. MySQL DDL có implicit commit, ClickHouse không có batch transaction: callback `onMutation` là thông báo freshness, không phải success. MySQL refresh bảo thủ sau lỗi có write trước đó, kể cả rollback; không tạo row/job success giả. API vẫn trả lỗi. Drop database invalidates trước pool cleanup để lỗi đóng pool không giữ metadata cũ.

Migration ghi processedRows trước cache refresh; retry chỉ bao quanh native import có parameter rejection đã biết. Cache/progress errors không replay batch đã commit. Lỗi cache trong xử lý partial write được log mà không che lỗi DB gốc. Không thêm dependency/framework hoặc thay permission/timeout/retry/threshold.

## Repro và review

- `red-unit.log`: 16 fail/1 pass, exit1. Key collisions, reused concurrent generation, missing raw invalidation/refresh. Một import fixture ban đầu thiếu allowImportExport được sửa theo policy; không coi setup denial là repro.
- `red-native.log`: F6 count/literal và Mongo sample-size collision trên DB thật; initial outsider expectation403 được sửa thành contract404, và refresh bug làm ảnh hưởng reset count. Không tính hai lệch fixture này thành bug riêng.
- `red-mysql-partial.log`: DB thật có INSERT đã commit qua DDL, count còn0, exit1; sau sửa MySQL native xanh. Fixture cuối reset mỗi case, không phụ thuộc thứ tự.
- `red-seed-partial-confirmed.log`: users đã ghi3 nhưng columns còn chỉ `_id`, exit1. Log đầu kỳ vọng empty sai contract Mongo; không dùng log đó làm proof.
- `red-review-cache-errors.log`: processedRows0 thay2 và lỗi cache che lỗi MySQL, exit1; `red-review-retry.log`: cache error khiến batch được replay, exit1. `red-review-mongo-confirmed.log`: native Mongo error bị cache error thay thế, exit1. HTTP500 filter hiện che detail, nên assertion service trực tiếp trên native driver; HTTP contract vẫn kiểm trong các case khác.
- `green-review.log`: 58 tests/5 files, exit0 sau fix review. Full gate của frozen sources còn phải ghi ở manifest.

GitNexus impact trước edit: hash/normalizer/readVersion CRITICAL; buildKey/getVersionKey HIGH, caller query count/metadata/AI schema, flow gatherSchemaContext. Đã cảnh báo trước sửa. Query execute LOW/4 graph callers; invalidation MEDIUM/8 mutation callers; refresh LOW/1; NoSQL cache LOW/2; migration LOW/processor. Interface dispatch và injected closures cần source/runtime bổ sung. Codegraph và Semble đã dùng để đối chiếu nguồn/callers; graph không chứng minh runtime. Impact và regression compare được lưu trong evidence.

Review: tự review của tác giả, chưa review độc lập. Các finding Important về progress/retry/native error đã có RED→GREEN. Dùng `r08-tracked-only.diff` tái dựng baseline của16 tracked paths để tách khỏi R00–R07; 6 dependency files chưa tracked có thay đổi mock/test bắt buộc, ghi rõ ở `review-scope.json`, không giả có baseline byte copy. Protection hashes kiểm các file khác. Full gate đầu bắt12 formatting errors và một mock R04 chưa cập nhật; đã sửa caller fixture. SQLite native error qua Jest realm khác không khớp generic Error matcher; assertion cuối kiểm `SQLITE_ERROR`, message missing-column và dữ liệu/table rollback, không giảm contract.

Full API đầu có429 ở R01 và các case R07 không thấy query tới DB. Hai HTTP fixture R08 dùng native `http.Agent.localAddress` riêng127.0.0.8/127.0.0.9, không spoof header hay sửa limiter; loopback proof có server quan sát đúng IP. Lần full gate sau cô lập: R07 PG/MySQL và16 case R08 pass, R01 còn một assertion cache warm. R01 MEMBER có allowlist nên getDatabases trả allowlist trước cache; trước đây test dựa vào OWNER warm ở case trước. Invalidation đúng của các write khiến giả định theo thứ tự đó không còn đúng. Đã thêm OWNER request ngay trong case, giữ MEMBER success, cache-defined và toàn bộ deny/revoke assertions. File-level impact LOW, 1 tham chiếu từ report, 0 flow sản phẩm. Lần gate đỏ được giữ ở `initial-full-gate/` và `ip-isolated-gate/`; final sources27 paths. Một lần khởi động helper bằng Windows PowerShell5.1 dừng ở Prisma stderr; chạy bằng PowerShell7 đã có sẵn, không thay lệnh sản phẩm hoặc cài runtime mới.

## Gate cuối và nghiệm thu

| Check trên tree cuối | Kết quả và evidence |
|---|---|
| Server full unit | 711/711, 94 files, 0 skipped, exit0; `server-unit.json` |
| API/native integration | 138/138, 14 suites, 0 skipped, exit0; R08 PG/Mongo14 và MySQL2 nằm trong tổng; `api-native.json` |
| Environment guards | 2/2, exit0 trong pretest API; `api-native.log` |
| Client unit | 158/158, 49 result files, exit0; `client-unit.json` (describe suites không phải số files) |
| Browser full | 82/82, 0 failed/skipped/flaky, exit0; `browser-full.json`; HTTP mock, không browser-to-real-backend |
| Static/build | Prisma, server/client lint và build, client prerender1/1, CI scripts8/8 đều exit0; `server-checks.json`, `client-checks.json`. Lint client có warning react-refresh kế thừa ở CommentComposer |
| Dependency audit | Client/server exit1, BASELINE_FAIL, lockfiles và manifests package không đổi trong R08; không gọi full release gate xanh |

F6/F7 không còn sai literal/quoted identifier/database count hoặc stale schema/count sau các mutation đã kiểm tra. Native checks có warm/cold authorization, revoke, raw DML, structured insert/import, DDL/AI/metadata, Mongo sample-size/partial bulk/seed, MySQL implicit commit/rollback và migration success/partial failure. Unit giữ read-only, error/audit/retry, concurrent generation và SQLite seed rollback. Các native engine/capability chưa kiểm tra được giữ giới hạn bên dưới.

Audit CI allowlists: client `GHSA-QWWW-VCR4-C8H2`, server `GHSA-GGR8-5VV4-36MX`. Fresh client blocking: DOMPurify critical `GHSA-CG2G-XH64-V4Q7`, `GHSA-MRV2-3PQR-J5JR`. Server: Azure identity/MSAL `GHSA-XCX6-JX8P-X3H5`; platform-express/multer `GHSA-WC9G-MQFW-JRWM`, `GHSA-QFVM-CV95-JQJF`, `GHSA-535W-7CP7-47Q4`, `GHSA-Q7QP-RJG7-Q26M`; body-parser `GHSA-27R3-JXMH-P828`; nodemailer `GHSA-2X7J-588G-CCC2`, `GHSA-V53P-9FQP-M79J`; proxy-addr critical `GHSA-JQCG-44MW-7W3H`. R10 xử lý dependency; R08 không sửa allowlist.

Teardown: app fixture users/connections0, PG R08 tables/databases0 và other sessions0; Mongo R08 databases0; MySQL R08 tables0; Redis migration active/wait0, client list chỉ có CLI hậu kiểm. Đã kiểm project/working-directory/container creation trước compose down, exit0; không còn container/network project hoặc listener15432/16379/17017/13306/4173. `cleanup-native.json`, `cleanup-ownership.log`, `cleanup-final.json` giữ proof.

Final review: tự review riêng của tác giả, không có Critical/Important còn mở trong phạm vi R08; chưa review độc lập. Không đổi production source sau freeze 27 paths; baseline protection 812 files, chỉ paths R08/canonical docs/index statistics được phép đổi. GitNexus rebuild exit0: 7.329 nodes/19.354 edges/429 clusters/269 flows; detect_changes(all/compare main) trả CRITICAL, 63 tracked files/284 symbols/48 flows cho toàn bộ diff R00–R08, không phải diff riêng R08. Manifest giữ source/evidence hashes, initial failures và giới hạn; không suy graph risk tổng thành risk riêng R08. R09 là gói tiếp theo.

## Quy tắc và giới hạn

OOP/SOLID: freshness sở hữu key/generation/cache family; driver báo boundary thực tế, Query/Migration giữ permission và outcome. DRY: một invalidation path; YAGNI/KISS: dùng crypto, cache, callbacks và transactions sẵn có, không cache rows hoặc tạo durable bus. Nesting cũ trong migration stream giữ cleanup/backpressure; retry catch đã thu hẹp về import. C01–C05, C08, C10 có checks; C07 không thêm SQL/token log. C06 N/A vì không đổi React; C09 không claim tăng hiệu năng, không đổi TTL/budget. Skills: executing-plans, systematic-debugging, TDD, verification-before-completion, GitNexus debugging, Ponytail/review, Writing for Agents.

Rulings: (1) metadata invalidate theo connection vì caller hiện dùng scope đó; query/AI/NoSQL theo database, chi phí cache miss thêm trong cùng connection. (2) MySQL failed batch có write trước đó được refresh bảo thủ vì DDL có thể commit trước khi lỗi; chi phí query count đọc lại sau rollback. (3) giữ các fixture R05 standalone/benchmark mock freshness vì chúng chỉ đo lifecycle; native R08 dùng app/worker/freshness thật. Không suy mock thành native freshness proof. (4) cache warmth là precondition trong chính case; OWNER warm bằng API thật rồi MEMBER/revoked requests kiểm quyền, không xóa warmth assertion để làm xanh. (5) thực hiện tuần tự và self-review theo chỉ dẫn người dùng/roadmap; không áp yêu cầu dispatch reviewer của skill khi trái chỉ dẫn đó.

Không certify native SQL Server/ClickHouse, remote/SSH/network partition, process kill giữa commit và notification, multi-replica hoặc load. Cache outage có thể cần refresh theo connection sau phục hồi; chưa có durable invalidation outbox (R14). Write ngoài Data Explorer cần manual refresh/TTL. Không chạy coverage/remote CI/image/CodeQL trong R08; thuộc R10/release. Client/server dependency audit phải ghi BASELINE_FAIL với allowlist CI đúng; không coi local remediation là release xanh.

Rollback: đảo riêng patch R08, giữ dependencies R00–R07. Key v2 tránh đọc entries cũ khi tiến lên; khi quay về build cũ phải refresh scope/chờ TTL cũ để tránh đọc stale entries. Không đưa lệnh reset toàn tree. Fixture cleanup và final manifest được lưu cùng gate; không commit/push/deploy.
