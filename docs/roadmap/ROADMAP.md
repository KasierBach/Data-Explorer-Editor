# Data Explorer — Roadmap tổng hợp và quy trình triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Dùng `superpowers:executing-plans` để thực hiện từng gói việc và `superpowers:verification-before-completion` trước mọi kết luận hoàn tất. Mặc định thực hiện tuần tự trong phiên hiện tại; chỉ dùng subagent khi người dùng hoặc chỉ dẫn áp dụng cho phép rõ. Checklist là trạng thái thực hiện, không phải minh chứng đã kiểm tra.

**Goal:** Khắc phục lỗi đã xác nhận về quyền, dữ liệu, tác vụ, thanh toán và UI; biến workflow quan trọng thành kiểm tra có thể tái lập trong CI; sau đó phát triển tính năng theo nhu cầu người dùng đã được xác minh.

**Architecture:** Giữ React/Zustand/TanStack/Monaco ở client và NestJS/Prisma/PostgreSQL/Redis/BullMQ cùng database strategies ở server. Sửa tại cơ chế dùng chung sau khi truy vết caller; duy trì contract hoặc chuyển contract xuyên UI → adapter → DTO → strategy có kiểm thử. Tận dụng permission, freshness, dialog và translation primitives hiện có.

**Tech Stack:** TypeScript, React, NestJS, Prisma/PostgreSQL, Redis/BullMQ, SQL/NoSQL drivers, Jest, Vitest, Playwright, axe-core; môi trường làm việc Windows/PowerShell, CI hiện dùng Node 22.

**Spec:** Ba báo cáo B1/B2/B3 và gói ghép ở mục 1 là nguồn đặc tả vấn đề/acceptance. Tài liệu này là **một roadmap chính thức để điều phối công việc**, không tự cấp quyền push/deploy hoặc thay thế việc kiểm tra code ở HEAD sắp sửa.

**Ngày lập:** 22/10/2026, Asia/Saigon. **Baseline source:** `3d7ec60845ddc2a07284c2873d9d3727acd30744`, v1.6.7. Các phép thử baseline thuộc 20/10; artifact và HEAD được đối soát lại ngày 22. **Trạng thái lúc lập: chưa triển khai remediation.**

**Cập nhật triển khai 25/10 (snapshot lịch sử):** R00–R09 đạt `VERIFIED_LOCAL` trong phạm vi từng báo cáo; R04 có containment theo engine/type, R05 giữ caveat partial transfer và từ chối replay chưa an toàn, R06 dùng signed local-provider fixture và có một Minor test cleanup deferred. R07 đóng native cancel/timeout và stale/remount; dependency audit lúc đó còn đỏ thuộc R10. R08 đóng cache identity/invalidation, giữ partial-write và cache-outage limits. R09 dùng durable comment events độc lập audit retention, giữ references/quyền, có batch/checkpoint/backup và inventory legacy. Trạng thái R10–R14 hiện tại nằm ở các cập nhật bên dưới và [progress ledger](ROADMAP-PROGRESS.md). Xem [báo cáo R00](quality/R00-REPORT.md), [báo cáo R01](quality/R01-REPORT.md), [báo cáo R02](quality/R02-REPORT.md), [báo cáo R03](quality/R03-REPORT.md), [báo cáo R04](quality/R04-REPORT.md), [báo cáo R05](quality/R05-REPORT.md), [báo cáo R06](quality/R06-REPORT.md), [báo cáo R07](quality/R07-REPORT.md), [báo cáo R08](quality/R08-REPORT.md), [báo cáo R09](quality/R09-REPORT.md) và [hướng dẫn kiểm chứng](quality/README.md). Sổ M01–M20 bên dưới giữ trạng thái lịch sử lúc lập; trạng thái hiện tại không được suy từ cột lịch sử đó. Chưa đạt điều kiện phát hành vì R13/R14 và external/release gates còn mở.

**Snapshot triển khai 27/10:** R10/R11/R12 đạt `VERIFIED_LOCAL` trên frozen uncommitted tree; clean-export gates gồm server unit758/758, client coverage165/165, native API162/162, localized browser208/208 và real full-stack2/2. Remote CI/image scan/manual zoom chưa chạy. R13 giữ `BLOCKED` vì chưa có quyết định ma trận entitlement/lifecycle; copy quảng bá không được enforce đã được bỏ, không tự đặt quota. R14 targeted audit đang `DOING`: CSV UTF-8 và Mongo Decimal128 đã có RED→GREEN, nhưng NULL-vs-empty, typed Mongo mutation, migration resume, scale và external provider còn giới hạn rõ. Final GitNexus `compare main` cảnh báo CRITICAL cho blast radius cộng dồn R00–R14; số chính xác và artifact nằm trong [verification manifest](quality/r10-r14-verification.json). Xem [progress ledger](ROADMAP-PROGRESS.md), [R10](quality/R10-REPORT.md), [R11](quality/R11-REPORT.md), [R12](quality/R12-REPORT.md), [R13](quality/R13-REPORT.md), [R13 decision](quality/R13-DECISION.md) và [R14](quality/R14-REPORT.md). Không có commit/push/deploy.

**Addendum R14 ngày 01/11:** BSON discriminator không còn tin field `_bsontype` do user data cung cấp; native RegExp, MinKey/MaxKey và compatible BSON7 branding có unit/native regression. Final coverage776/776, native tuần tự184/184, typecheck/lint/build/audit/helper đạt; independent focused re-review không còn finding. Một lượt native chạy song song coverage có R04 teardown timeout dù184body pass, được giữ là failed observation và không tăng budget. Xem [addendum](quality/R14-BSON-DISCRIMINATOR-ADDENDUM.md) / [manifest](quality/r14-bson-discriminator-verification-2026-11-01.json). Cumulative blast radius vẫn CRITICAL110file/380symbol/132flow. R14 vẫn `DOING_BOUNDED`, R13 vẫn `BLOCKED_PRODUCT_DECISION`; không tự nâng thành release/remote/deploy claim.

**Chốt technical scope R14 ngày 01/11:** follow-up cùng root đóng thêm schema analysis/sample-row spoofing và fresh final gate đạt server778/778, native184/184, client177/177, browser230/230, clean full-stack3/3 cùng typecheck/lint/build/audit/helper. Audit CSV NULL, typed Mongo write, Redis overwrite/TTL/snapshot và migration resume xác nhận mỗi mục thiếu product contract hoặc checkpoint/wire semantics; không có production edit an toàn để tự suy. Trạng thái hiện tại chuyển sang `BLOCKED_PRODUCT_CONTRACT`: mọi technical item có contract hiện hữu đã VERIFIED_LOCAL, nhưng R14 không phải DONE/release-ready. Chi tiết, hashes và cleanup caveat xem [final manifest](quality/r14-final-local-verification-2026-11-01.json) / [progress ledger](ROADMAP-PROGRESS.md) / [R14 report](quality/R14-REPORT.md). R13 vẫn deferred/`BLOCKED_PRODUCT_DECISION`; không commit/push/deploy.

## Global Constraints — quy tắc bắt buộc

Trạng thái hiện tại và số gate cuối xem [progress ledger](ROADMAP-PROGRESS.md), [BSON discriminator addendum 01/11](quality/R14-BSON-DISCRIMINATOR-ADDENDUM.md) / [manifest](quality/r14-bson-discriminator-verification-2026-11-01.json), [manifest cleanup/R10–R14](quality/cleanup-r10-r14-verification-2026-10-31.json), [native read R14](quality/r14-native-verification-2026-10-31.json) và [full test-source TypeScript R10, chốt01/11](quality/test-types-verification-2026-11-01.json). Các snapshot phía trên là lịch sử, không thay kết quả của tree mới. R10–R12 giữ VERIFIED_LOCAL; R13 vẫn BLOCKED_PRODUCT_DECISION, R14 BLOCKED_PRODUCT_CONTRACT sau khi technical scope có contract hiện hữu đã verified. Không tuyên bố toàn roadmap DONE khi remote CI, actual zoom/screen-reader, policy entitlement và provider/scale contracts chưa đủ bằng chứng.

1. Theo [AGENTS.md](<../../AGENTS.md>). Trước khi sửa function/class/method, chạy GitNexus `impact({target: "symbolName", direction: "upstream"})`, nêu caller, execution flow và mức rủi ro. HIGH/CRITICAL phải cảnh báo trước khi sửa. Không sửa symbol khi thiếu impact bắt buộc; nếu tool không hoạt động, làm phần độc lập và ghi blocker cụ thể.
2. Khám phá code bằng GitNexus query/context, Codegraph/Semble khi có; kiểm tra freshness. Kết quả graph không phải bằng chứng runtime. Không tự nâng/cài lại integration toàn máy chỉ để hoàn tất một task repo.
3. **Không làm xanh bằng cách tăng timeout/retry, thêm skip/early return, giảm assertion, hạ threshold hoặc thu hẹp coverage scope.** Thay đổi test contract chỉ khi hành vi sản phẩm đã được chốt, có giải thích và không làm mất case cũ.
4. Giữ validation, permission, transaction, cancellation, staleness/error guards và accessibility khi tái cấu trúc. Không bỏ chúng để giảm dòng code.
5. Dùng database/account/provider fixture riêng, dữ liệu tổng hợp. Xác nhận URL/port/ownership trước seed/migrate/write; test config không được âm thầm lấy credential hoặc fallback provider production từ `.env`. Chỉ cho phép external endpoint sandbox đã khai báo khi thực sự kiểm tra tích hợp đó. Không dùng credential/data production, gửi email, chuyển tiền hoặc gọi provider tính phí chỉ để smoke test.
6. Không thay framework, editor, state library hoặc nâng major dependency để “theo xu hướng”. Mọi dependency mới phải có nhu cầu cụ thể mà code/dependency hiện có không giải quyết hợp lý.
7. Scope mỗi gói việc gồm production callers, tests, fixture, DTO/types, exports, config và docs liên quan. Không refactor ngoài phạm vi hoặc sửa advisory không liên quan trong một task coverage.
8. Không xóa/reset/stash/commit thay đổi của người dùng. Khi cần branch, dùng prefix `codex/`. Khi cần worktree, kiểm tra/reuse checkout phù hợp trước, dùng công cụ worktree được hỗ trợ và giữ rõ đường dẫn đang thao tác.
9. Trước commit phải chạy GitNexus `detect_changes()`; khi review regression so default branch dùng `detect_changes({scope: "compare", base_ref: "main"})`. Chỉ stage file thuộc task. Không push khi full gate của đúng tree còn đỏ; quyền push/deploy đến từ chỉ dẫn người dùng, không đến từ file này.
10. Kết luận dựa vào output **và process exit**. `pending`, `blocked`, `not run`, `contained` phải được ghi đúng; mock pass không trở thành full-stack pass, runner xanh không chứng minh assertion đã chạy.
11. Áp dụng bộ quy tắc OOP/SOLID/YAGNI/KISS/DRY/nesting bên dưới khi thiết kế, sửa code và review mỗi gói việc. Đọc lại trước khi bắt đầu task; không coi tên nguyên tắc là lý do tự mở rộng scope hoặc refactor cả project.

### Nguyên tắc OOP, SOLID, YAGNI, KISS, DRY và nesting

Các quy tắc này áp dụng cho phần code đang thay đổi và caller bắt buộc. Ưu tiên đúng nghiệp vụ, an toàn dữ liệu, quyền truy cập và contract trước việc giảm dòng code hoặc làm kiến trúc đẹp hơn. Dùng cấu trúc sẵn có của project; không bắt code đã có phải được viết lại chỉ để đồng nhất phong cách.

| Nguyên tắc | Cách áp dụng trong project | Điều cần tránh khi review |
|---|---|---|
| **OOP — đóng gói trách nhiệm và trạng thái** | Service/strategy quản lý đúng hành vi và invariant của mình; giữ ranh giới controller → service → repository/driver hiện có. Ưu tiên composition và dependency injection sẵn có khi cần phối hợp hành vi. React tiếp tục dùng component/hook phù hợp. | Ép mọi hàm thành class, tạo base class hoặc cây kế thừa chỉ để tái sử dụng vài dòng; để caller sửa trực tiếp trạng thái nội bộ hoặc vượt lớp kiểm quyền. |
| **SOLID — trách nhiệm và contract rõ** | **S:** mỗi module có một trách nhiệm nghiệp vụ rõ, tách khi có lý do thay đổi độc lập. **O:** dùng extension point/strategy đã có khi thực sự thêm biến thể. **L:** implementation thay thế nhau phải giữ input/output, validation, lỗi và lifecycle đã cam kết. **I:** interface chỉ yêu cầu hành vi caller cần. **D:** logic nghiệp vụ phụ thuộc contract tại ranh giới cần thay thế/kiểm thử, tận dụng DI hiện có. | Chia mỗi method thành một service, tạo interface cho mọi class hoặc thêm tầng chỉ để đủ chữ SOLID. Không ép driver hỗ trợ giả một năng lực; phải công bố capability/unsupported rõ và test contract liên quan. |
| **YAGNI — chỉ xây thứ đang cần** | Chỉ thêm field, option, abstraction, dependency và cấu hình cần cho acceptance hiện tại hoặc caller đang tồn tại. Ghi nhu cầu tương lai vào backlog, kèm bằng chứng khi có. | Xây framework, plugin system, generic factory hoặc nhánh tương thích chưa có người dùng/caller; thêm dependency để giải quyết vài dòng logic có sẵn. |
| **KISS — cách đơn giản nhưng đầy đủ** | Chọn giải pháp ít thành phần nhất mà vẫn xử lý đủ input, lỗi, quyền, concurrency và cleanup trong scope. Dùng tên rõ, luồng tuyến tính và API/helper quen thuộc của project. | One-liner khó đọc, boolean flag làm hàm có nhiều chế độ không liên quan, hoặc bỏ validation/error/cancel/stale guards để rút ngắn code. |
| **DRY — một nguồn cho cùng quy tắc nghiệp vụ** | Trace caller, tái dùng helper/policy hiện có; sửa root cause ở điểm dùng chung rồi cập nhật caller và regression. Chỉ trích xuất logic khi các nơi thực sự có cùng ý nghĩa, contract và lý do thay đổi. | Copy policy quyền/giá/identity sang nhiều lớp; gom các đoạn chỉ giống cú pháp nhưng khác nghiệp vụ vào abstraction khó hiểu. Một ít lặp rõ ràng có thể phù hợp hơn abstraction sai; ghi lý do khi giữ lặp quan trọng. |
| **Nesting — giữ luồng điều khiển dễ theo dõi** | Mục tiêu tối đa **2 tầng control-flow lồng nhau** trong một hàm; trên **3 tầng** phải cân nhắc guard clause/early return hoặc helper có tên phản ánh một bước nghiệp vụ. Nếu vẫn cần sâu hơn, ghi lý do cụ thể trong ledger/review. Tính `if/else`, vòng lặp, `switch`, `try/catch` thực sự bao quanh nhau; không tính object/JSON/JSX layout như cùng một loại độ sâu. | Ternary lồng nhau, callback/promise chain để lách số tầng, hoặc tách hàm chỉ để qua ngưỡng. Không làm mất `finally`, transaction rollback, resource cleanup, thứ tự side effect hay kiểm quyền khi làm phẳng luồng. |

**Cách nghiệm thu:** reviewer phải chỉ ra phần tái sử dụng, trách nhiệm/contract bị tác động và abstraction/nesting đáng chú ý trong diff. Ngoại lệ cần lý do gắn với nghiệp vụ hoặc lifecycle, không ghi chung chung “để sau”. Đây là quy tắc review bắt buộc; chưa có lint rule tự động mới và không được tuyên bố toàn bộ code cũ đã tuân thủ.

### Quy tắc coding bổ sung — C01–C10

**Đối soát ngày 22/10/2026:** các mục dưới là quy tắc áp dụng theo rủi ro của diff, được chọn từ nguồn chính thức và các lỗi đã có trong project. Không phải chứng nhận code cũ đã tuân thủ hoặc lệnh tự động nâng dependency/config.

| Mã | Quy tắc áp dụng | Bằng chứng cần có khi task chạm tới |
|---|---|---|
| **C01 — Kiểu dữ liệu và invariant** | Input ngoài hệ thống đi qua validation/narrowing trước sử dụng; ưu tiên `unknown` cho dữ liệu chưa xác minh. Không dùng `any`, double-cast hoặc `!` để che contract sai. Dùng discriminated union/exhaustive handling khi trạng thái có các nhánh loại trừ nhau; phân biệt null, thiếu field, zero và chuỗi rỗng. Theo [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html). | Typecheck cùng case null/malformed/kiểu biên; giữ nguyên typed identity và tiền/entitlement. Server hiện `strictNullChecks: true` nhưng `noImplicitAny: false`; siết strict dần ở R10 sau baseline, không tuyên bố toàn backend đã strict. |
| **C02 — Ranh giới tin cậy** | Validate hình dạng/giới hạn ở server, kiểm quyền riêng theo user/resource/operation/database hiện tại. Query parameterization cho giá trị; identifier phải validate/quote đúng driver. Không coi UI, DTO hợp lệ, JWT còn hạn hoặc cache hit là đủ quyền. Theo [OWASP validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) và [authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). | Allow/deny, outsider, revoke, sai database/operation và input độc hại; denied không gọi driver hoặc đổi dữ liệu. Không thay parser/native enforcement bằng thêm regex cảm tính. |
| **C03 — Atomicity và idempotency** | Nhiều write cùng một invariant phải có transaction hoặc chiến lược partial/compensation được chốt; concurrent write dùng cơ chế DB phù hợp, không check-then-write bằng state process. Callback/retry phải có định danh chống xử lý lặp khi cần. Không giả định app DB transaction bao trùm database ngoài hoặc payment provider. Cơ sở atomicity: [PostgreSQL 16 transactions](https://www.postgresql.org/docs/16/tutorial-transactions.html). | Test concurrent/duplicate/failure giữa chừng và DB before-after; nêu isolation/rollback boundary. Không tự retry write không idempotent hoặc gọi network dài trong transaction. |
| **C04 — Async và lifecycle có giới hạn** | Mỗi promise/job phải có nơi await hoặc chịu trách nhiệm bắt lỗi; timer/listener/stream/pool/tunnel được giải phóng cả khi fail/cancel. Giới hạn timeout, concurrency, queue/buffer và dùng backpressure khi stream. Chặn response cũ ghi đè state mới; timeout không tự chứng minh truy vấn DB đã bị hủy. Đây là policy từ các repro R05/R07/R08 của project. | Test cancel/error/disconnect và liveness; không còn orphan task/session/listener. Dùng cancellation API đúng capability và version của driver, không thêm wrapper chỉ để giả lập cancel. |
| **C05 — Error contract và trạng thái rõ** | Giữ lỗi permission/validation/conflict/cancel có ý nghĩa khi đi qua các lớp; không catch rồi trả `[]`, null hoặc success để che failure nếu contract không quy định. Chỉ có một nơi chịu trách nhiệm chuyển lỗi ra HTTP/UI; fallback phải có lý do và trạng thái phân biệt được. | Assert mã/status, nội dung UI và dữ liệu cuối; không retry mọi lỗi hoặc nuốt cleanup error. Áp M20/R10, không thêm hệ exception song song. |
| **C06 — React state/effect đúng mục đích** | Dữ liệu suy ra từ props/state được tính trực tiếp; tránh sao chép thành state đồng bộ bằng effect. Side effect do click nằm ở handler; effect dùng để đồng bộ hệ ngoài và có cleanup/dependency đúng. Không sửa object store/props trực tiếp. Theo [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect). | Case đổi connection/org/tab nhanh, unmount/remount và response stale; không mất input hoặc gửi write lặp. Chỉ memoize khi có chi phí/lý do, không bọc mọi component bằng memo. |
| **C07 — Quan sát được, giữ kín dữ liệu** | Lỗi/job quan trọng có operation/request/job ID, outcome và thời gian cần thiết để điều tra; log có cấu trúc và giới hạn kích thước. Không log trực tiếp access token, password, SSH key, connection string hoặc mặc định toàn bộ SQL/row snapshot. Theo [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html). | Error path có dấu vết đủ tái hiện mà không lộ dữ liệu; kiểm redaction và retention đúng loại log. Không biến audit retention thành persistence của dữ liệu cộng tác. |
| **C08 — Test hành vi, cô lập và có khả năng bắt regression** | Test kết quả người dùng/DB quan sát được; kiểm nội bộ chỉ khi cần chứng minh một boundary như deny trước driver. Fixture riêng, reset có ownership, test không phụ thuộc thứ tự; dùng locator theo role/name và assertion có auto-wait thay sleep cứng. Theo [Playwright best practices](https://playwright.dev/docs/best-practices). | Bug test đã đỏ đúng nguyên nhân rồi xanh; đủ allow/deny/empty/boundary/error/concurrency theo rủi ro. Phân biệt mock/API/browser thật; không dùng snapshot hoặc line coverage thay assertion nghiệp vụ. |
| **C09 — Đo trước khi tối ưu** | Đo đúng dữ liệu/tải trước-sau, kiểm N+1, pagination, batch/stream và bộ nhớ có giới hạn; chỉ thêm index/cache/memo khi có lý do. Dùng plan đúng engine, tham khảo [PostgreSQL 16 EXPLAIN](https://www.postgresql.org/docs/16/using-explain.html); `EXPLAIN ANALYZE` thực sự chạy câu lệnh, chỉ dùng fixture/transaction an toàn đã kiểm soát. | Query count/plan/latency và memory khi liên quan; không tuyên bố nhanh hơn từ suy đoán hoặc dataset rỗng. Bảo toàn permission/freshness khi thêm cache. |
| **C10 — Diff nhỏ, tương thích và tài liệu đúng phiên bản** | Một patch giải quyết một vấn đề có thể review; cập nhật contract/caller/test cùng nhau, tách refactor không cần thiết. Tra docs đúng version/runtime hiện dùng trước khi chép API mới; thay schema/dependency phải có compatibility/rollback riêng. Theo [Google small changes](https://google.github.io/eng-practices/review/developer/small-cls.html) và [code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html). | Diff/impact, command/exit và giới hạn rõ; review feedback bằng source/repro trước khi sửa. Repo đang pin Prisma 6.19.3, không dùng API ORM 8 từ trang docs mới như thể tương thích hoặc tự nâng major. |

**Thứ tự áp dụng:** đánh dấu C01–C10 liên quan ở bước đóng scope; quy tắc không liên quan có thể ghi N/A kèm lý do ngắn. Mỗi mục có rủi ro thực cần check tương ứng; chỉ đổi Markdown thì kiểm link/hash/diff. Không cài thêm linter, đặt ngưỡng độ dài hàm/file tùy ý, hoặc chạy mọi loại scan cho mọi task chỉ để tick checklist.

### Chọn skill theo công việc và giai đoạn roadmap

**Đã tra ngày 22/10/2026:** helper `skill-installer` lấy được 39 mục từ danh mục `.curated` của `openai/skills`; đã đối chiếu entrypoint của các skill có sẵn và đọc SKILL.md công khai của hai ứng viên dưới đây. Trạng thái là snapshot hiện tại, phải kiểm lại catalog/khả năng callable khi đổi máy hoặc phiên. Skill là hướng dẫn workflow; có file SKILL.md không tự chứng minh tool, auth hay runtime đã hoạt động.

| Skill có sẵn | Khi dùng | Kết quả/giới hạn cần giữ |
|---|---|---|
| `ponytail:ponytail` | Mọi task code trong phạm vi đã chốt | Sửa nhỏ nhất nhưng đủ, trace caller, không bỏ security/validation/cleanup; chỉ load phần hướng dẫn thực sự cần. |
| `superpowers:systematic-debugging` | Bug, test fail, lỗi driver/concurrency hoặc behavior bất ngờ | Repro → giả thuyết → kiểm chứng → root cause rồi mới sửa; lỗi harness tách khỏi lỗi sản phẩm. |
| `superpowers:test-driven-development` | Thêm/sửa logic có behavior, security, money hoặc data integrity | Regression đỏ đúng lỗi rồi xanh; test tài liệu/đổi chữ đơn giản không cần dựng test giả. |
| `gitnexus-impact-analysis` + `gitnexus-refactoring` | Trước sửa symbol; đổi tên/tách/di chuyển code | Impact + caller/contract; rename theo graph, không find-and-replace mù. Index stale/partial phải ghi giới hạn. |
| `ponytail:ponytail-review` | Review diff và code liên quan trước bàn giao | Đúng → an toàn → chịu tải → có test → hiệu năng → tinh gọn; không dùng nhận xét style để mở rộng task. |
| `superpowers:receiving-code-review` | Nhận feedback từ reviewer/tool | Xác minh với source và repro trước khi áp dụng; nêu lý do kỹ thuật nếu góp ý sai hoặc ngoài scope. |
| `superpowers:verification-before-completion` | Trước claim hoàn tất, commit hoặc PR | Đọc output lẫn exit trên tree cuối; self-review và review độc lập báo riêng, không giả lập reviewer thành công. |
| `playwright` | Khảo sát/thao tác UI thật, repro có browser | Skill thiên về CLI; test hồi quy bền vững dùng suite Playwright của repo theo acceptance. Bằng chứng mock không thành full-stack. |
| `codex-security:security-scan` | Khi task thực sự là security scan có scope rõ, ví dụ R14 có mục tiêu | Dùng workflow/report chuẩn của skill, không bật full scan cho từng bug. Đọc yêu cầu delegation của skill và quyền hiện có trước khi dùng; không tự mở lại audit toàn repo. |

#### Skill global bổ sung — đối soát 22/10/2026

**Phạm vi cài đặt:** 32 skill đã được cài dùng chung tại `C:/Users/Admin/.codex/skills/` từ UI UX Pro Max, Impeccable, Caveman và manifest phát hành chính thức của Matt Pocock. Đây là kết quả của lượt cài global riêng trước đó; cập nhật roadmap này không cài lại, bật hook hoặc đổi cấu hình. Các entrypoint bên dưới đã được đọc để chọn workflow; UI UX Pro Max mới có smoke test tìm kiếm/design-system, Impeccable mới có checksum/probe/help/version. Chưa chạy các workflow này trên Data Explorer để nghiệm thu Rxx.

| Skill đã cài global | Trigger và giai đoạn phù hợp | Kết quả cần có / giới hạn |
|---|---|---|
| [ui-ux-pro-max](C:/Users/Admin/.codex/skills/ui-ux-pro-max/SKILL.md) | Chọn guideline interaction/accessibility, layout, bảng/chart cho R11–R12 hoặc feature UI đã được chốt | Tra theo vấn đề, stack React và loại sản phẩm; ghi guideline nào giải quyết case nào. Dùng design system/component hiện có; đề xuất từ dữ liệu không phải kiểm chứng UI hoặc nhu cầu thị trường. Không tự ghi đè design system bằng `--persist`/`--force`. |
| [impeccable](C:/Users/Admin/.codex/skills/impeccable/SKILL.md) | Audit/critique/adapt/harden/polish đúng màn hoặc luồng của R11–R12; review UI khi R04/R07/R09 làm đổi hành vi | Ưu tiên mode Operate của công cụ dữ liệu: thao tác, trạng thái lỗi, keyboard, responsive và nhất quán. Dùng refinement để giữ giao diện hiện tại; chọn playbook theo task, rồi kiểm render và suite repo. Hook, pin shortcut, init/doctor hoặc redesign toàn app là scope riêng. |
| [grilling](C:/Users/Admin/.codex/skills/grilling/SKILL.md), alias `grill-me` | Còn quyết định sản phẩm/acceptance chưa rõ, nhất là entitlement R13 hoặc enrollment/recovery của feature 2FA riêng sau R12 | Đọc code/evidence để tự tìm fact trước, chỉ hỏi quyết định chưa thể suy ra. Ghi lựa chọn và acceptance được người dùng chốt; không mở lại contract R01/R02 hoặc trì hoãn repro R03 đã rõ. |
| [codebase-design](C:/Users/Admin/.codex/skills/codebase-design/SKILL.md) | Thay contract/ranh giới implementation ở R04 typed identity, R07 execution lifecycle hoặc R09 persistence | Nêu invariant, caller, error/lifecycle và nơi test qua interface thật; tận dụng helper/strategy có sẵn cùng OOP/SOLID/YAGNI. Thuật ngữ trong phân tích không cấp quyền đổi tên service/API hoặc dựng lớp mới. Chỉ mở nhánh thiết kế song song khi task cần và được phép. |
| [domain-modeling](C:/Users/Admin/.codex/skills/domain-modeling/SKILL.md) | Có thuật ngữ nghiệp vụ hoặc quyết định domain cần chốt: identity R04, cancel/timeout R07, entitlement/quota R13 | Định nghĩa qua case cụ thể và đối chiếu code; ghi glossary/ADR dưới khu vực docs phù hợp khi thật sự có nội dung cần duy trì. Không dùng glossary thay spec, không tự tạo bộ tài liệu hoặc đổi contract đang được bảo vệ. |
| [writing-for-agents](C:/Users/Admin/.codex/skills/writing-for-agents/SKILL.md) | Sửa roadmap, progress, hướng dẫn tác vụ hoặc tài liệu bàn giao | Mỗi pointer có trigger, bước có tiêu chí xong kiểm tra được; giữ một nguồn quy tắc và dẫn tới evidence. Không sao chép cả SKILL.md vào roadmap hoặc thêm nhiều tài liệu chỉ để nhắc agent. |
| [handoff — Matt Pocock](C:/Users/Admin/.codex/skills/handoff/SKILL.md) | Người dùng cần chuyển chat/agent hoặc bàn giao công việc dài đang dở | Ghi đúng branch/HEAD, file đang sửa, repro, trạng thái gate, blocker và bước tiếp; dẫn tới ledger/report thay vì chép lại, redact secret. Upstream ghi vào `%TEMP%` trên Windows; báo đường dẫn và chỉ giữ đến khi bàn giao xong. Phân biệt với `agentmemory:handoff` dùng để khôi phục phiên. |
| [tdd — Matt Pocock](C:/Users/Admin/.codex/skills/tdd/SKILL.md) | Tham khảo thiết kế regression/integration theo hành vi ở R03–R10 khi cần hướng dẫn interface/mock | Bổ sung cách chọn case cho workflow `superpowers:test-driven-development` đang bắt buộc; không tạo vòng red/green thứ hai hoặc thêm test chỉ lặp implementation. Không suy số test thành coverage. |
| [diagnosing-bugs](C:/Users/Admin/.codex/skills/diagnosing-bugs/SKILL.md) | Bug khó tái hiện, timing/load/open handles ở R05/R07/R08/R10 cần feedback loop rõ | Chỉ chọn thêm phần chẩn đoán có ích so với `superpowers:systematic-debugging`; ghi giả thuyết, probe và kết quả, che credential trong artifact. Dùng repro có sẵn trước khi dựng harness mới. |
| [code-review — Matt Pocock](C:/Users/Admin/.codex/skills/code-review/SKILL.md) | Cần review riêng hai trục Standards/Spec và có baseline/spec rõ | Upstream dùng `git diff <ref>...HEAD`, mặc định không bao gồm thay đổi chưa commit; không dùng nó chứng nhận working tree hiện tại. Phải khai báo phạm vi diff, tracker/spec và quyền delegation trước khi chạy; nếu self-review tuần tự thì ghi đúng là self-review, không giả đã chạy workflow hai reviewer. `ponytail-review` vẫn là lựa chọn mặc định cho diff cục bộ. |
| [improve-codebase-architecture](C:/Users/Admin/.codex/skills/improve-codebase-architecture/SKILL.md) | Chỉ khi có yêu cầu đánh giá kiến trúc của module/hotspot cụ thể sau khi scope đã chốt | Upstream có exploration agent, báo cáo HTML và vòng chọn phương án. Chỉ dùng khi quy trình đó cần và được phép; không mở audit toàn repo/refactor mới để thay cho các lỗi R03–R14 đã có acceptance. |

**Cách phối hợp:** giữ workflow triển khai/verification ở đầu roadmap; chọn chuyên môn khi trigger khớp. Với R11–R12: lấy incumbent UI và repro làm đầu vào → tra UI UX Pro Max nếu thiếu guideline → dùng playbook Impeccable phù hợp để audit/sửa → xác minh Playwright/axe và keyboard/zoom theo acceptance R11/R12. Đây là trình tự theo nhu cầu, không phải yêu cầu load cả hai skill cho mọi chỉnh CSS. Màu/font/animation chỉ đổi khi cần giải quyết vấn đề đã xác nhận; không redesign để “theo trend”.

**Giữ ngoài quy trình mặc định:** `caveman`/`ultracave`/`megacave` là tùy chọn giọng trả lời, không phải gate chất lượng và không được làm mất chi tiết lỗi/evidence. `agentskills/agentskills` là đặc tả, không có skill để thực thi. Các router/orchestrator `ask-matt`, `implement`, `implement-spec`, `wayfinder`, `to-spec`, `to-tickets`, `setup-matt-pocock-skills` chỉ cân nhắc khi người dùng chuyển sang quy trình spec/tracker tương ứng; không tự tạo ticket, thay AGENTS, mở branch/worktree hay triển khai song song chỉ vì đã cài. Các bộ frontend thiên về thay visual world không được bật chồng lên refinement R11/R12.

| Skill mới tìm thấy | Trạng thái | Cách chọn cho project |
|---|---|---|
| [gh-fix-ci — SKILL.md](https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-fix-ci/SKILL.md) | **Chưa cài**, chưa chạy; ứng viên cho R10 khi có GitHub Actions check thật bị fail | Đọc log CI/PR và chốt fix plan; cần `gh` auth đúng repo và quyền sửa đã được người dùng cấp. Skill có yêu cầu approval trước implement; đối chiếu authorization hiện có, không tự cấp quyền push/merge. Không coi nó xử lý CI provider ngoài GitHub Actions. |
| [security-best-practices — SKILL.md](https://raw.githubusercontent.com/openai/skills/main/skills/.curated/security-best-practices/SKILL.md) | **Chưa cài**, chưa chạy; ứng viên bổ sung review bảo mật JavaScript/TypeScript | Chỉ dùng khi yêu cầu security rõ và có reference phù hợp stack; chưa xác minh reference riêng NestJS/Prisma. Đối chiếu skill security đã có, tránh hai workflow làm trùng một audit. |

**Quy tắc chọn skill:** mỗi task chọn workflow chính và chuyên môn cần cho rủi ro cụ thể, ghi tên/trigger trong ledger; không load tất cả chỉ vì có sẵn. Đọc SKILL.md thực tế trước khi áp dụng, kiểm nguồn/ref và script/quyền/side effect trước khi cài skill ngoài; không chạy installer hoặc script tải về chỉ để xem danh sách. Tìm thấy không đồng nghĩa đã cài, đã đăng nhập, đã chạy hoặc đã kiểm chứng. Yêu cầu người dùng và AGENTS là ràng buộc phải đối chiếu khi skill có hướng dẫn khác; không dùng skill để tự mở rộng scope, gửi thông tin ra ngoài, commit/push/deploy hoặc spawn agent không được phép. Lần tra catalog cũ chỉ đọc tài liệu; lượt chọn skill cho roadmap này cũng chỉ sửa docs/manifest, không đổi cài đặt global hoặc source. Khi đổi máy/user Windows, xác minh lại đường dẫn skill; hướng dẫn “Skill tool” của upstream phải ánh xạ sang cách đọc/gọi skill thực tế của Codex.

## Review Focus — năm lớp lỗi phải được ghim bằng test

| Input/tình huống | Kỳ vọng | Gói chịu trách nhiệm |
|---|---|---|
| Cache warm, user khác hoặc vừa bị thu hồi quyền | Không trả metadata/sample/row trước authorization | R01, R02, R08 |
| Text key `"001"`, bigint và composite key | Sửa/xóa đúng một identity, không đổi row bên cạnh | R04 |
| Hai request/transaction cùng lúc | Không double-write, mất entitlement hoặc ghi đè state mới | R06, R07, R13 |
| Driver/stream/DB lỗi giữa chừng | API còn sống, tài nguyên đóng, trạng thái partial/failure đúng thực tế | R05, R07, R10 |
| UI có dữ liệu/modal mở, bàn phím/mobile, VI/EN | Control không chồng, có tên, focus đúng, state không bị kẹt | R11, R12 |

---

## 1. Nguồn sự thật và baseline

| Nguồn | Nội dung phải dùng |
|---|---|
| [B1 — Audit tổng thể](<../../output/audit-2026-10-20/BAO_CAO_DANH_GIA_PROJECT.md>) | F1–F13; hướng sản phẩm/thị trường, cơ hội và giới hạn |
| [B2 — Workflow, coverage, UI/UX](<../../output/workflow-audit-2026-10-20/BAO_CAO_WORKFLOW_COVERAGE_UI_UX.md>) | Q1–Q4; U1–U8; 30 workflow families và phạm vi coverage |
| [B3 — Runtime bổ sung](<../../output/audit-completion-2026-10-20/BAO_CAO_BO_SUNG_HOAN_TAT_AUDIT.md>) | B3-01–B3-06; database/browser thật, acceptance và giới hạn |
| [Gói ghép](<../../output/audit-completion-2026-10-20/GOI_GHEP_BAO_CAO.md>) | M01–M20; ánh xạ finding và chỉnh các kết luận cũ |
| [Evidence JSON](<../../output/audit-completion-2026-10-20/COMPLETION_EVIDENCE.json>) / [63 case](<../../output/audit-completion-2026-10-20/DANH_MUC_63_CASE.md>) | Case ID, PASS/FAIL, input và finding tương ứng |
| [Feature-gap analysis cũ](<../../plans/feature-gap-analysis.md>) | Danh mục ứng viên tính năng; không phải trạng thái hiện tại hoặc cam kết triển khai |

**Vị trí canonical:** File này là `D:\Data Explorer\docs\roadmap\ROADMAP.md`. Roadmap, progress và evidence được gom trong `docs/roadmap/`; `.gitignore` cho phép riêng thư mục này, giữ các tài liệu khác trong `docs/` và `/plans/` theo quy tắc ignore hiện có.

**Lưu ý tính di động:** Báo cáo/harness trong `output/` đang bị Git ignore. Trước khi chuyển việc sang máy/worktree khác, R00 phải lưu một evidence bundle có version và đường dẫn sử dụng được; roadmap được commit một mình không tự mang theo các artifact đó. Không commit hàng loạt runtime, node_modules, SQLite, token hoặc log chưa rà soát. Link nội bộ dùng đường dẫn tương đối; các link `output/` chỉ tồn tại khi mang theo evidence local. Dependency đã cài trong checkout audit có thể được prune theo retention record mà không xóa source/log/coverage evidence.

| Chỉ số baseline | Giá trị | Cách diễn giải |
|---|---:|---|
| Backend unit lines / branches | 50,16% / 42,86% | Snapshot Jest, không phải workflow coverage |
| Frontend unit/component lines / branches | 15,85% / 10,09% | Snapshot V8 include source chưa được import bởi test |
| Unit suites | Server 563 tests; client 142 tests | Không chứng minh behavior của mọi driver/DB |
| Browser có sẵn | 19 scenario, 56 lượt chạy | Nhiều API mock, lặp theo browser/device |
| API E2E cũ | Runner 22 pass | Hai test security early-return; phải sửa độ tin cậy |
| Runtime audit bổ sung | 63 case: 51 pass, 12 fail | 12 fail → 6 finding mới + 4 finding cũ; không phải 12 root cause |

Không tự cập nhật các số trên khi chạy một tập focused test. Tạo snapshot mới với HEAD, scope, command, version runtime và exitcode; giữ baseline lịch sử.

## 2. Trạng thái công việc và cách dùng file

Mỗi lần làm việc chọn **một gói Rxx** đang đủ điều kiện. Hoàn tất tất cả caller/fixture/test bị ảnh hưởng trước khi chuyển gói. Có thể làm một phần chuẩn bị độc lập của gói sau, nhưng không bỏ qua dependency hoặc gate của gói trước.

| Trạng thái | Nghĩa chính xác |
|---|---|
| TODO | Chưa bắt đầu triển khai |
| DOING | Đang có thay đổi hoặc kiểm tra thực thi |
| BLOCKED | Có điều kiện cụ thể chưa đáp ứng; ghi việc độc lập vẫn làm được |
| CONTAINED | Đã chặn hành vi nguy hiểm, chưa phục hồi đầy đủ năng lực |
| VERIFIED_LOCAL | Repro và focused checks đúng trên đúng tree/môi trường cục bộ |
| DONE | Đạt acceptance, gate yêu cầu và review; có evidence cho HEAD hiện tại |

Mỗi trạng thái cần dòng cập nhật: `Rxx | trạng thái | HEAD/tree | phạm vi đã làm | lệnh + exit | finding còn mở | bước kế tiếp`. Không đánh dấu DONE chỉ vì source đã viết, toast thành công hoặc HTTP 200.

**Ưu tiên không đổi tự động theo lịch.** P0 còn mở thì chưa chuyển sang mở rộng tính năng production; các việc an toàn/CI/UX độc lập vẫn có thể chuẩn bị. Các mốc 30/60/90 ngày ở mục 11 là khung quản trị có điều kiện, không phải hạn hoàn tất cố định.

## 3. Sổ việc tổng hợp M01–M20

| Mã | Ưu tiên | Công việc | Gói thực hiện | Trạng thái lúc lập |
|---|---|---|---|---|
| M01 | P0 | Authorize trước cached metadata/schema/sample | R01 | TODO |
| M02 | P0 | Policy role/database thống nhất cho raw query, browse, mutation/import | R01 | TODO |
| M03 | P0 | Backup/export không vượt quyền resource | R02 | TODO |
| M04 | P0 | Read-only enforcement không bỏ lọt write; gia cố Mongo pipeline | R03 | TODO |
| M05 | P1 | Identity giữ kiểu, đủ composite key cho update/delete/selection | R04 | TODO |
| M06 | P1 | Migration PG stream không crash API | R05 | TODO |
| M07 | P1 | N distinct paid orders cộng đủ entitlement khi đồng thời | R06 | TODO |
| M08 | P1 | Cancel/timeout đúng execution, không bỏ statement chạy ngầm | R07 | TODO |
| M09 | P1 | Cache key không gộp literals/identifiers phân biệt hoa thường | R08 | TODO |
| M10 | P1 | Data/schema write làm mới cache đúng scope | R08 | TODO |
| M11 | P1 | Comment/thread bền vững, không lệ thuộc 500 audit events/retention | R09 | TODO |
| M12 | P1 | Dependency gate xanh bằng bản sửa có kiểm tra | R10 | TODO |
| M13 | P1 | Assertion thật, full-stack CI, coverage và teardown | R00 + R10 | TODO |
| M14 | P1 sản phẩm | Quyền lợi Free/Pro rõ và enforce nhất quán | R13 | TODO |
| M15 | P2 khi scale | Query/job lifecycle nhiều replica, pool/queue budget | R14 | TODO |
| M16 | P1 | Header responsive không overlap/occlusion | R11 | TODO |
| M17 | P1/P2 | Modal/keyboard/labels/scroll focus/contrast/SVG | R12 | TODO |
| M18 | P2 | CTA 2FA phản ánh đúng năng lực hỗ trợ | R12 | TODO |
| M19 | P2 | I18n và html lang ổn định xuyên route | R12 | TODO |
| M20 | P2 | Phân biệt query/validation/conflict với lỗi nội bộ | R10 | TODO |

**Giữ ngoài số bug đã xác nhận:** B1-F4 Mongo aggregate là P2 policy hardening; chưa có bằng chứng write bypass thành công. R03 thêm test và enforcement theo mức bằng chứng, không quảng bá một lỗ hổng chưa xác nhận.

## 4. Quy trình chuẩn cho mỗi gói việc

- [ ] **Bước 1 — Xác nhận đầu vào:** Đọc roadmap/task và AGENTS; lấy `git status --short`, HEAD, branch, diff hiện có; kiểm tra nguồn repro và môi trường. Không dùng report cũ để đoán trạng thái mới.
- [ ] **Bước 2 — Truy vết và impact:** GitNexus query → context → upstream impact từng symbol cần sửa. Ghi caller, process, client/server contract và risk; dùng Codegraph/Semble để lấy context khi phù hợp. Cảnh báo HIGH/CRITICAL trước edit.
- [ ] **Bước 3 — Đóng scope và tái hiện:** Chọn input cụ thể, expected result, fixture, output DB/API/UI trước/sau; chọn C01–C10 và skill liên quan, ghi N/A/lý do khi không áp dụng. Với bug nghiêm trọng, thêm regression test bền vững và xác nhận đỏ do đúng lỗi sản phẩm, không do sai endpoint/setup.
- [ ] **Bước 4 — Sửa nhỏ nhất đủ:** Sửa cơ chế dùng chung và toàn bộ caller bắt buộc theo OOP/SOLID/YAGNI/KISS/DRY/nesting ở Global Constraints. Không thêm abstraction/framework hoặc thay đổi quyền lợi ngoài task. Cập nhật migration/DTO/export/docs khi contract thay đổi.
- [ ] **Bước 5 — Focused verification:** Test affected files, repro cũ và các input lớp Review Focus của task; dùng engine thật cho behavior driver/concurrency/mutation. Đọc assertion, state cuối và process exit.
- [ ] **Bước 6 — Review phạm vi:** Kiểm tra diff, caller chưa đổi, handling lỗi/cancel/stale, secret và compatibility; đối chiếu sáu quy tắc thiết kế, ghi lý do cho abstraction/lặp/nesting được giữ. Dùng `detect_changes` theo AGENTS trước commit. Review độc lập chỉ khi phương thức đó đã được cho phép; không tự sinh chat/subagent.
- [ ] **Bước 7 — Gate và ghi nhận:** Chạy gate tương ứng mục 8 trên tree cuối, lưu evidence. Chỉ chuyển VERIFIED_LOCAL/DONE khi đúng điều kiện. Nếu chỉ containment, ghi rõ feature bị giới hạn và case đầy đủ còn mở.
- [ ] **Bước 8 — Bàn giao:** Nêu đã đổi gì, vì sao, bằng chứng nào, giới hạn, rủi ro và rollback. Commit/push/deploy theo quyền đã được cấp, không tự coi đây là bước bắt buộc của yêu cầu viết roadmap.

Một tập focused xanh không chứng minh full gate xanh. Sau thay đổi mới, kết quả cũ chỉ giữ làm lịch sử; tính lại phạm vi và chạy gate cần thiết cho tree cuối. Không lặp full suite sau mỗi lần đọc file; ưu tiên affected checks và một full gate ở điểm chốt ổn định.

## 5. Đợt A — Fixture đáng tin, quyền truy cập và identity dữ liệu

### R00 — Baseline, evidence bundle và test harness thật

**Map:** M13 phần setup; phải thực hiện trước khi dùng test làm bằng chứng cho các gói khác.

**Files:** [auth-security.e2e-spec.ts](<../../server/test/auth-security.e2e-spec.ts>), [app.e2e-spec.ts](<../../server/test/app.e2e-spec.ts>), [fixture browser](<../../client/e2e/support/authenticated-api.ts>), [CI](<../../.github/workflows/ci.yml>). Chỉ promote case cần cho fix hiện tại; không chuyển toàn bộ script audit thành một test khổng lồ.

**Interfaces:** Giữ auth response `data ?? body` rồi đọc `access_token`; comment dùng `commentId`, active query dùng `queryId`, backup restore nhận `{ backup }`. Saved-query controller không có GET `/:id`; ownership test dùng list/PATCH/DELETE có thật. Fixture user A/B có resource thật và ownership được assert trước negative request.

- [x] Lưu evidence nhỏ có version/HEAD; loại secrets, token, runtime và dữ liệu không cần thiết; chỉ đưa fixture synthetic cùng test thực sự sử dụng nó vào phạm vi Git. Hiện chưa commit.
- [x] Tách validator của snapshot lịch sử khỏi regression gate: `compile-completion.cjs` xác minh bộ baseline 51 PASS/12 FAIL, không dùng nó để chứng minh fix mới đạt. Regression sau sửa dùng suite được duy trì, còn baseline giữ nguyên.
- [x] Thay early return che setup lỗi bằng fail rõ; cô lập brute-force/rate-limit state đúng môi trường test. Không sửa production limit để test dễ pass.
- [x] Mock endpoint chưa khai báo phải fail test, trừ allowlist phụ rõ ràng. Phân biệt API mock và full-stack bằng tên/project/report.
- [x] **Đạt cục bộ:** tampered token và user A truy cập connection thật của B thực sự chạy assertion; teardown hoàn tất không force-exit, không còn app session PG/Redis hay fixture user/connection. Chưa có CI hoặc review độc lập thành công; không suy ra lifecycle production đã hết lỗi.

### R01 — Quyền thống nhất và authorize trước cache

**Map:** M01/M02, B1-F1/F2. **Depends:** R00.

**Files:** [PermissionsService](<../../server/src/permissions/services/permissions.service.ts>), [team access utility](<../../server/src/permissions/utils/team-connection-access.util.ts>), [ConnectionsService](<../../server/src/connections/connections.service.ts>), [QueryService](<../../server/src/query/query.service.ts>), [MetadataService](<../../server/src/metadata/metadata.service.ts>), [NoSqlService](<../../server/src/nosql/nosql.service.ts>), cùng specs hiện có trong các thư mục đó.

**Interfaces:** Đầu vào hiệu lực là user, resource, operation và database đích; kết quả là context được authorize hoặc denial trước cache/driver. Reuse PermissionsService và `assertTeamConnectionAccess`; không tạo permission system song song. Một quyền đọc schema không tự trở thành quyền sample values hay ghi dữ liệu.

- [x] R01a cục bộ: authorize trước cache của metadata và NoSQL sample/refresh; regression cache cold/warm, owner/member/outsider, revoke resource/membership. K02 dùng sample synthetic trong Redis thật, chưa chạy MongoDB thật.
- [x] R01b cục bộ: reuse policy tại pool và guard ghi chung, áp database/role cho table-window, insert/update/delete, schema/import/seed/create/drop database. Context AI và query export đi qua pool chung đã được đối soát source; chưa chạy provider/export cross-engine. Backup tổ chức thuộc R02; SQL parser/read-only semantic thuộc R03.
- [x] **VERIFIED_LOCAL:** regression K01/K02/T03/T05 pass trong phạm vi báo cáo; raw SQL/table-window cùng deny database override, readonly mutation trả 403 và SQLite không đổi, revoke với JWT cũ vẫn deny. Unit kiểm tra deny trước cache/driver. 580 unit + 33 API + 2 environment guards pass; typecheck/build/focused lint exit 0. [Evidence và giới hạn](quality/R01-REPORT.md). Chưa có independent review thành công, remote CI hoặc release gate.

### R02 — Backup đúng ranh giới quyền

**Map:** M03, B3-05. **Depends:** R00; dùng policy mới R01 khi cần export theo resource.

**Files:** [OrganizationBackupService](<../../server/src/organizations/services/organization-backup.service.ts>), [OrganizationsController](<../../server/src/organizations/organizations.controller.ts>), [OrganizationService client](<../../client/src/core/services/OrganizationService.ts>), control backup tương ứng ở TeamPage sau context/impact.

**Contract mặc định của gói:** Full organization backup là thao tác OWNER/ADMIN, cùng hướng kiểm quyền với restore. Export một phần theo quyền user là tính năng khác, chưa mở rộng ở task này. Guard ở server; client diễn đạt quyền và lỗi rõ.

- [x] Ghim E07/E08 bằng API thật: MEMBER/VIEWER không thấy query bị cấm trong list, export/restore trả 403; non-member deny; OWNER/ADMIN xuất và khôi phục fixture hợp lệ. ADMIN vừa bị hạ quyền vẫn bị chặn với JWT cũ.
- [x] Đối chiếu SQL, dashboard dataSnapshot, ERD, policy và teamspace links sau restore trực tiếp trong PostgreSQL; password/sshPrivateKey cấu hình connection không xuất vào package. UI giải thích quyền, giữ controls cho OWNER/ADMIN, keyboard/download/error/geometry và axe panel pass trên Chromium/Firefox ở 1280/390px.
- [x] **VERIFIED_LOCAL:** HTTP E08 đỏ trước sửa đã chuyển thành denial đúng contract; round-trip package hợp lệ giữ policy đã kiểm tra. 584 backend unit, 146 client unit, 41 API + 2 environment guards và 8 browser mock runs pass; build hai phía/focused lint/typecheck pass. [Phạm vi và giới hạn](quality/R02-REPORT.md). Chưa có independent review, remote CI, malformed/large-backup/failure-injection gate; không tuyên bố restore all-or-nothing hoặc partial export theo resource.

### R03 — Read-only và destructive policy đúng cú pháp/driver

**Map:** M04, B1-F3/F4. **Depends:** R00/R01.

**Files:** [query-guard.util.ts](<../../server/src/query/query-guard.util.ts>), [guard specs](<../../server/src/query/query-guard.util.spec.ts>), [attack-vector specs](<../../server/src/query/query-guard.attack-vectors.spec.ts>), [QueryService](<../../server/src/query/query.service.ts>), [SqlUtil](<../../server/src/utils/sql.util.ts>), Mongo/Redis strategies và validator khi impact yêu cầu.

**Interfaces:** Guard phân loại toàn batch trước execution; mọi statement ghi cần đúng quyền và confirmation theo contract. Không coi `confirmed: true` là quyền vượt read-only. Driver/database read-only được dùng như lớp bảo vệ khi hỗ trợ, không thay permission của app.

- [x] Ghim S08/S09: scanner có giới hạn giữ ranh giới quote/comment/batch; quoted identifier, block comment, CTE ghi và cú pháp hỗ trợ có regression. MySQL/MariaDB hash comment, Unicode comment whitespace mơ hồ và dạng lexical không hỗ trợ bị từ chối trước pool; literal keyword đọc được.
- [x] Destructive cancel không phát confirmed request; confirm phát đúng một confirmed request trên Chromium/Firefox với API mock. HTTP PostgreSQL kiểm tác động ghi sau confirmation; PostgreSQL/MySQL kiểm rollback khi statement thứ hai lỗi. Native read-only áp dụng cho mọi SQL classified-read, cả VIEWER READ/không WRITE trên connection writable, count và table window.
- [x] Mongo dùng lại validator/sanitizer, duyệt `$lookup.pipeline`/`$facet`, chặn stage ghi/không biết; MongoDB 7 xác minh `$out/$merge` không tạo output. Redis GET/SET được kiểm bằng command và Redis thật. F4 là prevention đã kiểm, không gán mọi nesting trước sửa thành exploit engine đã chứng minh.
- [x] **VERIFIED_LOCAL:** 640 backend unit, 146 client unit, 60 API thật (19 R03), 2 environment guards và 2 browser mock runs pass; typecheck/build/focused lint đạt. Read-only/confirmation đúng trên case/engine đã ghim, có review độc lập tìm thêm lỗi và regression sau sửa. [Báo cáo R03 và giới hạn](quality/R03-REPORT.md), [manifest](quality/r03-verification.json). Chưa đo lại coverage, standalone MariaDB/MSSQL/ClickHouse native isolation, full browser→backend, remote CI hay release gate; giữ các lần timeout trước, không gọi local pass là hết flake.

### R04 — Typed row identity và composite key xuyên suốt

**Map:** M05, B3-02/B3-03. **Depends:** R00/R01.

**Files:** [useDataGridData](<../../client/src/presentation/modules/DataGrid/useDataGridData.ts>), [useDataGridEditing](<../../client/src/presentation/modules/DataGrid/useDataGridEditing.ts>), [DataGrid](<../../client/src/presentation/modules/DataGrid/DataGrid.tsx>), [ApiDatabaseAdapter](<../../client/src/core/adapters/ApiDatabaseAdapter.ts>), [database adapter interface](<../../client/src/core/domain/database-adapter.interface.ts>), [update DTO](<../../server/src/query/dto/update-row.dto.ts>), [delete DTO](<../../server/src/query/dto/delete-rows.dto.ts>), QueryService và mọi strategy/caller của update/delete.

**Contract mục tiêu:** Identity là đủ tuple key với giá trị giữ kiểu từ row/metadata; predicate dùng mọi cột key đã được validate. Single-key caller cũ chỉ được chuyển sang tuple một phần tử theo một quy tắc tương thích rõ. Không suy kiểu từ `isNaN(Number(rowId))`; state key của UI không được dùng như giá trị database nếu đã encode/stringify.

- [x] Ghim G01 với `"001"`/`"1"`; G02 với `(A,1)/(A,2)/(B,1)` cho edit, selection và delete. Có UUID PostgreSQL native, text, bigint vượt safe integer, no-PK và giá trị không hợp lệ tại trust boundary; thêm decimal chính xác và TEMP shadow regression.
- [x] Containment client/server cho identity không an toàn: no-PK/unsafe scalar, temporal, numeric đã mất precision; structured mutation Mongo/Redis/ClickHouse bị khóa. MySQL non-InnoDB bị từ chối trước DML. Lý do hiện trên UI hoặc error API, không bỏ yêu cầu G01/G02.
- [x] Tuple contract đồng bộ UI → adapter → DTO → strategy; SQL parameters cho mọi thành phần key; count mismatch trả conflict và rollback. Legacy chỉ dùng được khi khớp PK metadata thật.
- [x] **VERIFIED_LOCAL trong phạm vi hỗ trợ đã kiểm:** G01/G02 qua native PostgreSQL/MySQL InnoDB/SQLite và browser mock Chromium/Firefox; count/payload/row liền kề có assertions. MSSQL có driver contract unit, chưa native engine; MariaDB/Cockroach chưa chạy engine riêng. Không đánh dấu toàn bộ engine/type composite đã DONE. Ma trận và giới hạn: [R04 report](quality/R04-REPORT.md), [manifest](quality/r04-verification.json).

**Còn mở để mở rộng hỗ trợ R04:** lossless temporal và numeric retrieval cho driver hiện trả JS number; native MSSQL/MariaDB/Cockroach; BSON/Redis/ClickHouse identity contract. Phải thêm acceptance/native proof trước gỡ containment; không cần chờ mở rộng này để bắt đầu R05.

**Gate A:** Không còn tái hiện unauthorized disclosure/write ở K01/K02/T03/T05/S09/E08; mutation identity sai đã sửa hoặc feature được containment rõ. Pilot chỉ được xét nếu phạm vi không hỗ trợ/containment được công khai và các P0 khác đóng.

## 6. Đợt B — Tác vụ dài, thanh toán, cache và dữ liệu cộng tác

### R05 — Migration stream và failure lifecycle

**Map:** M06, B3-01. **Depends:** R00; quyền source READ/target WRITE theo R01.

**Files:** [PostgresStrategy](<../../server/src/database-strategies/postgres.strategy.ts>), [Postgres specs](<../../server/src/tests/database-strategies/postgres.strategy.spec.ts>), [MigrationService](<../../server/src/migration/migration.service.ts>), [MigrationProcessor](<../../server/src/migration/migration.processor.ts>), [migration specs](<../../server/src/migration/migration.service.spec.ts>), client MigrationService/Hub nếu status contract đổi.

**Interfaces:** Giữ jobId/status/progress ticket ownership; stream failure trở thành job failed có kiểm soát. Deadline, return pool và terminal state phải nhất quán. Migration vẫn là transfer một chiều theo caveat hiện có, không tự hứa rollback/resume.

- [x] Promote repro M02/child crash vào integration process cô lập với pg 8.18.0/pg-query-stream 4.14.0; thêm native socket loss và deadline regression.
- [x] Sửa callback/client error/destruction và pool/listener cleanup; deadline ngắn có assertion phân biệt với server deadline, không tăng timeout hoặc dùng global uncaught exception handler. Adaptive split dừng sub-batch mới sau source failure, drain write đã bắt đầu.
- [x] **VERIFIED_LOCAL:** 5/4505 rows đúng count/checksum, nguồn/đích lỗi không giết API, failed/terminal progress đúng; kill worker sau commit/trước progress rồi stalled/manual retry giữ đúng 5 rows ở target không PK. Full gates: 678 server unit, 156 client unit, 96 API/integration, 2 guards; type/build/static checks exit 0. [R05 report](quality/R05-REPORT.md), [manifest](quality/r05-verification.json).

**Giới hạn R05:** Native PostgreSQL; không whole-transfer rollback/resume hoặc exactly-once qua mọi fault. Stage guard từ chối replay đã bắt đầu; partial/unacknowledged commit cần kiểm target. Multi-replica SSE/fencing, Redis outage và native transfer các engine khác còn mở; xem report. R06 là gói tiếp theo.

### R06 — Entitlement giao dịch đồng thời

**Map:** M07, B3-04. **Depends:** R00.

**Files:** [BillingService](<../../server/src/billing/billing.service.ts>), [billing specs](<../../server/src/billing/billing.service.spec.ts>), [MomoProvider](<../../server/src/billing/providers/momo.provider.ts>), [schema](<../../server/prisma/schema.prisma>) chỉ khi constraint/migration thực sự cần.

**Contract:** Cùng payment chỉ activate một lần; N payment khác nhau của cùng user cộng tổng duration đúng. Serialize theo user/subscription ở database transaction, dùng hàng ổn định có tồn tại để khóa trước read/extend; giữ lock order nhất quán. Không dùng mutex trong memory để giả vờ xử lý nhiều replica.

- [x] Ghim B03–B07 bằng PostgreSQL native: signature/amount/provider mismatch, sequential/concurrent duplicate, delayed failed, nhiều order cùng user có/chưa subscription, user B không bị User A lock chặn; thêm stale profile expiry race.
- [x] Khóa User ổn định trước payment claim và subscription read/extend; Payment/Subscription/User commit hoặc rollback cùng transaction. Provider verify ngoài transaction; profile expiry kiểm lại predicate sau khi chờ row lock, không ghi đè renewal.
- [x] **VERIFIED_LOCAL:** bốn monthly credit đúng 120 ngày, duplicate chỉ 30, monthly/yearly/monthly của hai provider đúng 425; database constraint fault rollback rồi retry đúng. Full gates: 678 server unit, 156 client unit, 107 API/integration, 2 guards, server types/build và static checks. [R06 report](quality/R06-REPORT.md), [manifest](quality/r06-verification.json).

**Giới hạn R06:** signed local-provider fixture qua verifier thật, chưa bank live/protocol đầy đủ, refund/cancel hoặc high-contention capacity. Một Minor cleanup helper khi barrier timeout được deferred và ghi rõ. Không nâng timeout/retry/skip để đạt gate, không thêm schema/dependency. R07 là gói tiếp theo.

### R07 — Query execution handle, Cancel và timeout

**Map:** M08, B1-F5. **Depends:** R00/R01.

**Files:** [QueryService](<../../server/src/query/query.service.ts>), [strategy interface](<../../server/src/database-strategies/database-strategy.interface.ts>), các strategy có cancel, [ActiveQueriesPanel](<../../client/src/presentation/modules/Query/ActiveQueriesPanel.tsx>) và caller tương ứng sau impact.

**Contract:** Public API giữ queryId + ownership. Registry phải giữ handle của chính execution đang chạy; strategy cancel đúng statement thay vì nhận pool bất kỳ. Với PG, phát lệnh cancel bằng control connection riêng tới PID của execution; không gửi lệnh cancel trên cùng connection đang bị query chiếm.

- [x] Ghim X01 bằng PostgreSQL/MySQL native: query sleep trong registry, owner cancel đúng statement, outsider deny, neighbor hoàn tất; control connection riêng, không chờ slot source pool.
- [x] App/native timeout, COUNT, disconnect/socket loss, completed/duplicate cancel và rollback failure giữ handle/registry tới driver completion. Browser kiểm late response, đổi connection, hai tab cùng SQL và restore không tự chạy SQL cũ trên đích mới; Run sau restore vẫn đúng đích.
- [x] **VERIFIED_LOCAL 25/10:** native15/15 trong API122/122, server unit686/686, client158/158, browser full82/82 (focused R07:6/6), guards2/2 và lint/build hai phía exit0. [R07 report](quality/R07-REPORT.md), [manifest](quality/r07-verification.json). Không tăng timeout/retry/skip/threshold.

**Giới hạn R07:** native PG16/MySQL8.4 local; MSSQL chỉ driver unit, không certify proxy/SSH/remote partition/multi-replica/load. Control lỗi có thể chờ native completion; timeout không chứng minh rollback mọi write. Dependency audit client/server còn đỏ trên lockfile không đổi, giữ R10 theo mục8.3; chưa release/production. R08 là gói tiếp theo lúc nghiệm thu R07; đã có mốc bên dưới.

### R08 — Cache identity và invalidation

**Map:** M09/M10, B1-F6/F7. **Depends:** R01/R03 và các đường mutation của R04.

**Files:** [FreshnessService](<../../server/src/common/freshness/freshness.service.ts>), QueryService, MetadataService, NoSqlService, [AI service](<../../server/src/ai/ai.service.ts>) và cache callers trong impact.

**Contract:** Key giữ nguyên ngữ nghĩa SQL/literal/identifier, connection/database và option result/count; không lowercase tùy tiện. Authorization luôn chạy trước dữ liệu cache. Dùng freshness/version/invalidation hiện có cho write, DDL, import, migration và refresh; không xóa cache toàn hệ thống để che scope sai.

- [x] Query khác literal `ABC`/`abc`, identifier quoted khác case và database khác không dùng chung kết quả/count sai. Kiểm tra thực sự loại dữ liệu nào đang cache, không báo nhầm count cache thành row cache.
- [x] Sau mỗi đường write/DDL thành công, count/metadata/schema/AI context liên quan được làm mới; failure trước write không tạo state giả, partial write phải phản ánh thực tế.
- [x] **Đạt khi:** F6/F7 repro không còn sai kết quả; cache warm/cold đều đúng quyền và freshness; không làm query nhạy cảm đọc state của connection/tab khác.

**Mốc 25/10:** VERIFIED_LOCAL, [báo cáo R08](quality/R08-REPORT.md), [manifest](quality/r08-verification.json). Gate cuối: server 711/711, client 158/158, API 138/138 (R08 native 16 là subset), guards 2/2, browser 82/82, lint/build/Prisma/prerender/CI scripts exit 0. Raw rows không cache; chỉ numeric count. Partial MySQL/Mongo/ClickHouse giữ lỗi và state thực tế; native SQL Server/ClickHouse, remote/multi-replica/load và coverage/CI chưa certify. Audit hai phía BASELINE_FAIL trên lockfiles không đổi thuộc R10; chưa release. Teardown/protection/source hashes được ghi trong manifest. Self-review, chưa review độc lập; không commit/push/deploy.

### R09 — Comment persistence độc lập audit retention

**Map:** M11, B1-F9. **Depends:** R01/R02.

**Files:** [CollaborationService](<../../server/src/collaboration/collaboration.service.ts>), [collaboration specs](<../../server/src/collaboration/collaboration.service.spec.ts>), [schema](<../../server/prisma/schema.prisma>) và migration mới nếu cần, audit readers/retention, [TeamCommentsDrawer](<../../client/src/presentation/pages/TeamPage/components/TeamCommentsDrawer.tsx>).

**Contract:** Thread/comment/reply là dữ liệu sản phẩm bền vững; audit là lịch sử thao tác. Giữ commentId/threadId/reaction references và permission hiện có. Nếu chuyển storage, importer/replay phải idempotent; không tạo hai source of truth không có kế hoạch đóng.

- [x] Ghim comment còn đọc được sau >500 organization events và sau cleanup audit; test edit/delete/resolve/reaction/mention và revoke quyền.
- [x] Di chuyển legacy events theo batch/checkpoint, kiểm kê dữ liệu có thể phục hồi; event đã bị retention xóa không được báo là phục hồi thành công.
- [x] **VERIFIED_LOCAL:** state đọc mới và reload đúng, migration không duplicate thread, retention audit không xóa comment còn hiệu lực; account/resource deletion theo contract. Backup app DB fixture đã restore thử trước migration; [rollback và inventory](quality/R09-MIGRATION.md). Native15/15 trong API153/153, server711/711, client158/158, browser82/82, guards2/2; lint/build/Prisma/prerender/CI scripts exit0. [Report](quality/R09-REPORT.md), [manifest](quality/r09-verification.json). Audit BASELINE_FAIL trên lockfiles không đổi thuộc R10; self-review, chưa independent review/remote CI/coverage/production migration hoặc capacity proof. Initial migration atomic; orphan legacy cần reconciliation, event đã retention xóa không được phục hồi. Không commit/push/deploy.

**Gate B:** Không còn process crash ở migration fixture; entitlement concurrency đúng; Cancel dừng execution thật; cache và comment regression đạt. Những gói đã sửa phải có integration test bền vững, không chỉ script trong output.

## 7. Đợt C — Release gate, UI/UX và ranh giới gói dịch vụ

### R10 — Dependency, CI, coverage và error contract

**Map:** M12/M13/M20; B1-F8/F10, B2-Q1/Q2/Q4, B3-06. **Depends:** R00; thêm regression vào CI theo từng fix trước đó.

**Files:** [CI](<../../.github/workflows/ci.yml>), [npm audit gate](<../../.github/scripts/npm-audit.mjs>), [gate specs](<../../.github/scripts/npm-audit.test.mjs>), [client package](<../../client/package.json>), [server package](<../../server/package.json>), [Vitest config](<../../client/vite.config.ts>), QueryService/mutation error mapping và [CI/CD docs](<../../docs/operations/ci-cd.md>).

- [x] Refresh dependency audit tại HEAD đang sửa; ghi advisory, dependency path, runtime/dev scope và fix chính thức. Dùng allowlist CI hiện có có lý do; không tự thêm advisory vào allowlist để mở gate hoặc chạy `audit fix --force` mù. **Verify local 31/10:** audit hai package theo đúng allowlist CI exit0; không đổi allowlist.
- [ ] Thêm PG+Redis backend E2E vào CI; full-stack browser job có API và target DB thật. Mở rộng Mongo/MySQL theo phạm vi driver đã thay đổi; engine chưa chạy phải được nêu.
- [ ] Cài provider coverage khớp Vitest như dependency dự án có review; không dùng junction tạm của audit làm hạ tầng CI. Upload report/trace/log, pin include/exclude ổn định.
- [x] Điều tra open handles rồi bỏ `--forceExit` khi teardown đạt; không chỉ gỡ flag và tăng timeout. **Verify local 31/10:** native163/163,19suites với detectOpenHandles; helper limiter giữ TTL/limit và cách ly bucket giữa fixture, không sửa production.
- [x] Ghim S04: syntax/missing table/constraint dùng mã query/validation/conflict rõ; lỗi hạ tầng vẫn phân biệt. UI không tự retry write không idempotent. **Verify local 31/10:** native R10 và full native pass; giữ regression no-write-retry và thêm session-ownership cases.
- [ ] **Đạt khi:** gate chạy được từ clean checkout có fixture đúng, fail khi regression được tái đưa vào, không có assertion bị bỏ qua, artifacts cho đúng SHA và zero exit với test thực sự chạy. Không coi coverage threshold là bằng chứng an toàn duy nhất.

**Full test-source static gate, chốt 01/11:** `npm run typecheck` ở server dùng tsconfig hiện có, gồm unit/E2E và chạy sau Prisma generation. Negative control đọc source trước sửa tái hiện 7 lỗi; source hiện tại có 0 lỗi. Không đổi strictness, roots, ngân sách hoặc assertion. [Report](quality/R10-TEST-TYPES-REPORT.md) / [manifest](quality/test-types-verification-2026-11-01.json) giữ baseline, test output và lần native R09 timing failure riêng. Compiler PASS không tự chứng minh runtime hoặc release PASS.

**Coverage policy:** Đầu tiên tái lập baseline với cùng scope rồi đặt floor không giảm; chỉ ratchet sau số đo mới được review. Mục tiêu kế hoạch sau các luồng chính: server ≥65% lines/55% branches, client ≥35% lines/25% branches; changed logic hướng tới 80%/75%. Đây là mục tiêu quản trị, chưa là gate đã cài và không được enforce ngay bằng cách bỏ source khỏi mẫu số. Security/money/data integrity cần đủ case allow/deny/success/failure/concurrency dù line% đạt cao.

### R11 — Header responsive và thao tác di động

**Map:** M16, B2-U1/Q3. **Files:** [Navbar](<../../client/src/presentation/modules/Layout/Navbar/index.tsx>), [NavUserSection](<../../client/src/presentation/modules/Layout/Navbar/components/NavUserSection.tsx>), [MobileWorkspaceBar](<../../client/src/presentation/modules/Layout/MobileWorkspaceBar.tsx>), [mobile browser tests](<../../client/e2e/mobile-workspace.spec.ts>).

**Skill theo trigger:** `ui-ux-pro-max` cho guideline navigation/hit target/responsive; `impeccable adapt/harden` cho refinement đúng màn; Playwright theo viewport/locale/state bên dưới để kiểm chứng. Xem [quy tắc chọn skill](#skill-global-bổ-sung--đối-soát-22102026); không mở redesign toàn app.

- [x] Ghim Help/Teams overlap ở desktop và mode/Teams/theme trên mobile. Thu gọn controls theo chỗ trống bằng component hiện có, không sửa bằng giấu các hành động quan trọng không có lối truy cập khác. **VERIFIED_LOCAL:** wrapping layout và header dưới portal; regression giữ navigation, theme, Teams và pointer/keyboard Profile.
- [x] Kiểm VI/EN, light/dark, có/không token timer, widths 360/390/412/768/1024/1280/1440; đo overlap/hit target, keyboard order và viewport sau animation. **Phạm vi evidence:** matrix header, mobile suites và reflow/keyboard320/640; actual browser zoom/screen-reader không được suy từ các phép đo này.
- [ ] **Đạt khi:** không chồng/che click; chọn đúng SQL/NoSQL/Teams/theme; bottom bar vẫn thao tác được và editor/results/AI không làm mất lối đóng/quay lại. No-overflow chỉ là một assertion trong tập này.

### R12 — Accessibility, modal, i18n và trạng thái 2FA

**Map:** M17/M18/M19. **Files:** [ProfileDialog](<../../client/src/presentation/modules/Layout/ProfileDialog/index.tsx>), [SecurityTab](<../../client/src/presentation/modules/Layout/ProfileDialog/components/SecurityTab.tsx>), [ConnectionDialog](<../../client/src/presentation/modules/Connection/ConnectionDialog.tsx>), [ResultTable](<../../client/src/presentation/modules/Query/ResultTable.tsx>), [App](<../../client/src/App.tsx>), [SEO](<../../client/src/presentation/components/shared/Seo.tsx>), clickable Dashboard/Explorer actions, translation và dialog primitives liên quan.

**Skill theo trigger:** `impeccable audit/clarify/harden` và guideline `ui-ux-pro-max` khi cần; kiểm acceptance bằng axe + manual keyboard/zoom và suite repo. Chỉ dùng `grilling` nếu mở feature 2FA thật cần quyết định enrollment/recovery; R12d hiển thị đúng trạng thái chưa hỗ trợ vẫn làm theo scope đã chốt.

- [x] R12a: Dùng dialog primitive hiện có cho Profile; accessible name/labels/error associations, focus vào/giữ trong/return, Escape đóng và scroll region của bảng dùng được bằng keyboard. **VERIFIED_LOCAL:** Profile/Connection/Save labels, Save error alert/described-by, focus trap/return, result scroll focus, direct320px và keyboard full-stack.
- [ ] R12b: Chuyển clickable div thành button/link/widget action đúng semantics; xử lý SVG trang trí, selected/normal text contrast và focus visible. Scan authenticated state có dữ liệu/modal/error, không chỉ public/empty. **Đã verify scoped:** native buttons, SVG/names và Dashboard recent-connection focus/axe; comprehensive contrast/assistive-technology acceptance vẫn mở.
- [ ] R12c: Một cơ chế sở hữu html lang xuyên login/logout/route/reload; thay text VI/EN hard-code bằng translation hiện có.
- [x] R12d: Enable 2FA hiện chỉ placeholder phải hiển thị đúng “chưa hỗ trợ” và không giả thao tác thành công. Triển khai 2FA/passkey thật là gói tính năng riêng cần enrollment/recovery/session tests, chưa tự thêm vào task này. **Verify local:** Profile/Security và full-stack keyboard xác nhận trạng thái unsupported.
- [ ] **Đạt khi:** keyboard task từ login đến connection/query/save/Profile hoàn tất; không còn axe critical/serious đã xác nhận ở màn chính; manual keyboard/zoom kiểm tra riêng, VI/EN nhất quán và lang không biến mất khi chuyển route.

### R13 — Free/Pro entitlement và quản lý phiên bản gói

**Map:** M14, B1-F11. **Depends:** R06, R10; cần quyết định quyền lợi sản phẩm trước enforcement mới.

**Skill theo trigger:** `grilling` chốt quyết định kinh doanh chưa rõ; `domain-modeling` làm rõ entitlement/quota/expiry qua case cụ thể. Đối chiếu fact từ code và evidence trước khi hỏi; giữ test giao dịch của R06 và không tự thay giá/quyền lợi.

**Files:** BillingService/plan definitions, [billing tab](<../../client/src/presentation/modules/Layout/ProfileDialog/components/BillingTab.tsx>), [billing return page](<../../client/src/presentation/pages/BillingReturnPage.tsx>), UsersService và server endpoints chịu entitlement theo impact.

- [ ] Lập bảng Free/Pro từ code/UI/docs hiện có: tính năng/quota, server source of truth, thời hạn, expired/pending/failed/refund, cách hiện trạng thái. Trình một phương án cụ thể để quyết định kinh doanh; không tự đổi giá hoặc phát minh giới hạn.
- [ ] Sau khi chốt, enforce ở server với UI phản ánh cùng contract; không unlock chỉ từ return URL hoặc client state. Cập nhật trạng thái expiry nhất quán, không dựa riêng vào `user.plan` có thể stale.
- [ ] **Đạt khi:** paid webhook, expiry, duplicate/out-of-order và quota boundary có fixture; feature được quảng bá khớp quyền thực. Bank sandbox phải có evidence riêng; local signature fixture không đủ để tuyên bố payment end-to-end.

**Gate C:** Full gate đúng tree đạt; các blocker quyền/dữ liệu/runtime/tiền đã đóng, UI chính dùng được; entitlement không quảng bá năng lực chưa có. Có thể mở pilot giới hạn theo mục 9; không tự deploy.

## 8. Lệnh kiểm tra và cách chọn gate

Chạy từ đúng working directory; trên Windows dùng `npm.cmd` khi PowerShell shim làm sai tham số. Các lệnh dưới đã đối chiếu với package scripts hiện có lúc lập roadmap; nếu script đổi, cập nhật command/evidence cùng task.

### 8.1 Focused checks

Từ `D:\Data Explorer\server`, ví dụ với các file có thật:

```powershell
node node_modules/jest/bin/jest.js --runInBand src/query/query.service.spec.ts src/query/query-guard.util.spec.ts
node node_modules/jest/bin/jest.js --runInBand src/billing/billing.service.spec.ts
```

Từ `D:\Data Explorer\client`:

```powershell
node node_modules/vitest/vitest.mjs run src/presentation/modules/DataGrid/useDataGridData.test.tsx
```

Đây là ví dụ chọn affected files, không phải tập đủ cho mọi task. Sửa DataGrid identity phải thêm regression hook/browser mutation thật, không chỉ chạy lại test metadata cũ.

### 8.2 Full local gate tại tree cuối

Client, working directory `D:\Data Explorer\client`:

```powershell
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run test:prerender
node --test ../.github/scripts/deploy-render.test.mjs ../.github/scripts/npm-audit.test.mjs
npm.cmd run build
npm.cmd run test:e2e
```

Server, working directory `D:\Data Explorer\server`:

```powershell
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
npm.cmd run test:e2e
```

E2E server cần `DATABASE_URL`, `REDIS_URL`, secrets và target fixtures **chỉ vào hạ tầng test**. Migration schema chỉ deploy vào app DB test đã kiểm tra URL; không copy lệnh migrate deploy sang production vô điều kiện. Browser suite hiện tại dùng mock chưa thay full-stack job của R10.

Dependency gate: chạy `node ../.github/scripts/npm-audit.mjs` từ mỗi package với **đúng allowlist hiện có trong CI**, ghi env giá trị nào được áp dụng. Không đưa số advisory từ 20/10 thành số hiện tại khi chưa refresh. Build/scan image, CodeQL/dependency-review và CI checks thực thi theo cấu hình đang áp dụng; local commands không chứng minh remote CI đã đạt.

Coverage: server có `npm.cmd run test:cov`; client chưa có script coverage chính thức tại baseline. R10 phải tạo cấu hình/provider bền vững trước khi đưa coverage gate vào CI. Giữ all-source scope như B2 hoặc công bố rõ thay đổi mẫu số hợp lý; không so hai phần trăm khác scope như một xu hướng tăng/giảm.

### 8.3 Quy tắc kết quả

| Loại thay đổi | Bằng chứng bắt buộc |
|---|---|
| Permission/cache/read-only | Unit attack cases + HTTP hai user + target DB thật; denied không đổi dữ liệu |
| Mutation identity | Browser request payload + đọc DB trước/sau; đúng row, đúng count, đúng kiểu |
| Billing | Real transaction concurrency; signature fixture + sandbox riêng nếu claim provider flow |
| Migration/cancel/timeout | Driver/process thật; trạng thái DB/job/process cuối, cleanup và API liveness |
| UI/UX | Browser data-loaded/modal/error + keyboard + axe + geometry/hit target |
| Dependency/config/CI | Build, gates hiện có và đúng remote SHA; compatibility/lockfile diff được review |
| Chỉ tài liệu roadmap | Kiểm link/path/script/mapping/status và diff; không chạy lại full product suite chỉ để sửa Markdown |

Nếu dependency gate đỏ có từ baseline, ghi `BASELINE_FAIL` cùng advisory và kế hoạch R10; task khác có thể VERIFIED_LOCAL với giới hạn nhưng không gọi full gate xanh, không push khi gate yêu cầu còn đỏ. Nếu regression do patch mới, dừng chuyển task và sửa nguyên nhân.

## 9. Release/pilot, rollback và quản lý rủi ro

### G0 — Sẵn sàng triển khai task

- [ ] HEAD/diff/môi trường và evidence đã xác nhận; AGENTS/impact đủ; repro đỏ đúng nguyên nhân; scope/expected behavior rõ.

### G1 — Có thể review fix

- [ ] Đóng đủ caller/contracts/fixture; repro và affected checks đạt; không giảm guard; có diff/impact/evidence và rollback phù hợp.

### G2 — Có thể cân nhắc pilot giới hạn

- [ ] P0 đã đóng; sai identity, API crash, payment lost update và cancel sai đã sửa hoặc tính năng liên quan bị vô hiệu hóa rõ và ghi CONTAINED.
- [ ] Full-stack CI cho login → connection → query → save/reload, destructive confirm/cancel, hai user isolation và mutation key đạt.
- [ ] UI chính keyboard/mobile dùng được; có metrics và cách báo lỗi; giới hạn engine/feature chưa hỗ trợ được công bố.
- [ ] Gate dependency/build/tests bắt buộc đạt tại đúng SHA; release có người chịu trách nhiệm và chỉ diễn ra theo authorization.

### G3 — Có thể xác nhận phạm vi production cụ thể

- [ ] Engine/provider được quảng bá có integration/sandbox evidence và giới hạn rõ; production configuration/secrets/migrations được review.
- [ ] Backup/restore app DB đã diễn tập với tiêu chí phục hồi đã chốt; không dùng organization artifact backup như bằng chứng PITR.
- [ ] Có load/soak/failure test theo concurrency/dataset thực, số pool, latency/error budget và recovery mục tiêu đã thống nhất.
- [ ] Monitoring phân biệt user query errors và system errors, audit không ghi credentials/sample data bừa bãi, có runbook rollback và owner.

Rollback ứng dụng dùng commit/image đã biết đạt; **không tự rollback database schema** bằng cách đảo migration hoặc xóa bảng. Data migration phải có backup và kiểm tra restore/compatibility trước rollout. Khi thực sự xảy ra ghi nhầm/mất quyền lợi, lưu bằng chứng, khoanh feature, đối soát/reconcile dữ liệu theo kế hoạch; không chạy SQL “sửa nhanh” vào production chưa được phép.

## 10. R14 — Audit có mục tiêu và mở rộng theo dữ liệu thật

**Map:** M15 và các phần W01–W30 còn thiếu. **Depends:** Các gate trước theo vùng rủi ro; không cần đợi mọi P2 mới kiểm tra một nhánh P0 liên quan.

### 10.1 Phép kiểm tra tiếp theo, không mở lại audit toàn repo vô hạn

- [x] Mỗi gói fix được audit lại ở boundary dùng chung và caller gián tiếp; nếu tìm lỗi cùng root, mở rộng cùng task. Lỗi root khác được ghi backlog với repro, không lén kéo scope dài vô hạn. **Chu kỳ31/10:** session ownership RED→GREEN, Save/Dashboard semantics và fixture limiter cùng boundary; native/context-switch/identity regressions được replay, phần ngoài contract vẫn ghi giới hạn.
- [ ] Chọn session/refresh race, connection switch/late responses, import/export round-trip Unicode/quote/newline/NULL, Mongo ObjectId/date/decimal, Redis TTL/types/scan và binary/bigint theo luồng thật được dùng. **Đã verify:** single-runtime refresh/logout races, context-switch, CSV UTF-8/quote/newline, native Mongo Long/bigint/Binary/Timestamp và opaque array metadata, Redis read TTL/types/exact-glob-cursor/TYPE/lookahead, bigint/composite regressions. [R14 native evidence](quality/r14-native-verification-2026-10-31.json) không chứng nhận stable SCAN snapshot, typed BSON writes hoặc toàn bộ export round-trip. NULL-vs-empty, typed Mongo writes và Redis write/TTL-copy contract chưa đủ để đánh dấu toàn dòng DONE.
- [ ] Migration cancel/resume/retry là feature chưa có contract đầy đủ; chốt semantics về partial rows, duplicate, idempotency và rollback caveat trước khi bổ sung UI/endpoint. Không hứa “resume an toàn” bằng cách chạy lại toàn job.
- [ ] Chỉ kiểm scale nhiều replica sau khi có nhu cầu: ownership/cancel cross-process, shared concurrency cap, queue retention và ngân sách pool; không tách microservice sớm.
- [ ] OAuth/email/payment/LLM thật chỉ test khi có account/sandbox/cost boundary hợp lệ. Giữ kết quả `NOT_RUN_EXTERNAL` đến lúc có evidence, không thay bằng mock pass.

**Audit lại đủ khi:** tất cả repro trọng yếu được chạy trên tree mới; caller cùng boundary có allow/deny/failure tests; không còn blocker trong phạm vi release; phần chưa kiểm có owner/giới hạn rõ. Không dùng mục tiêu “tìm hết mọi lỗi” hoặc một tỷ lệ coverage tùy ý làm điều kiện dừng.

### 10.2 Chọn tính năng sản phẩm sau khi nền tảng ổn

Giữ các ứng viên từ B1/feature-gap analysis, nhưng không tự đánh dấu “thiếu” từ một tài liệu cũ; rà checkout và hỏi đúng bài toán người dùng trước khi chọn. Mỗi chu kỳ chỉ chọn một use case đủ nhỏ để ship và đo:

| Nhánh | Ứng viên | Điều kiện được ưu tiên |
|---|---|---|
| First successful query | Hướng dẫn connection/credential error, ví dụ schema và onboarding ngắn | Nhiều người bỏ cuộc trước query đầu; đã có baseline task success |
| Reuse query/workspace | Save/open/share/history rõ, khôi phục context và conflict handling | Người dùng lặp truy vấn/làm nhóm thường xuyên |
| AI có kiểm chứng | Review/edit/run, schema đúng quyền, lỗi có cách sửa, chi phí/latency rõ | Có task thật và bộ đánh giá SQL đúng kết quả; không chỉ đo số tin nhắn |
| Data/schema tools | Index/view/constraint management, DDL/schema diff, explain, BLOB/CLOB | Có nhóm user cần thao tác cụ thể và engine ưu tiên rõ |
| Dashboard/reporting | Live refresh có timestamp, lịch chạy/export/embed | Phân biệt snapshot và dữ liệu hiện tại; có nhu cầu dùng lặp thực sự |
| Team/enterprise/MCP | SSO/provisioning, retention, scoped external assistant tools | Khách hàng cần/quyền riêng tư rõ; guard và audit đã ổn |

Trước khi khẳng định xu hướng/so sánh thị trường mới, cập nhật nguồn chính thức và ngày. Nghiên cứu B1 là nguồn lịch sử; việc đối thủ có tính năng không tự chứng minh user hiện tại cần.

Thu thập time-to-first-query, connection/query failure, retry/cancel, save/share/export, AI SQL phải sửa và task success desktop/mobile. Lập baseline trước, rồi chốt mục tiêu bằng số; không bịa conversion hoặc mức sẵn sàng trả tiền. Không log raw SQL, sample values, credential hoặc PII vào analytics theo mặc định. Làm task-based usability với 5–8 người mục tiêu để phát hiện trở ngại; không coi mẫu đó là khảo sát đại diện thống kê.

## 11. Khung 30/60/90 ngày và thứ tự thực hiện

Giả định đội nhỏ có người quen repo; điều chỉnh sau R00 và impact. Đây là khung ưu tiên, không cam kết khối lượng hoặc ngày phát hành.

| Cửa sổ kế hoạch | Phạm vi trọng tâm | Điều kiện chuyển tiếp |
|---|---|---|
| 0–30 ngày | R00 → R01/R02/R03/R04; bắt đầu R05/R06/R07 và regression CI tối thiểu | Gate A; không còn P0 trong scope pilot, identity nguy hiểm được khóa/sửa |
| 31–60 ngày | Hoàn tất R05–R10, R11/R12; chốt policy R13 | Gate B/C, full-stack và release checks đáng tin, UX chính dùng được |
| 61–90 ngày | Pilot có kiểm soát, external/sandbox checks, targeted audit R14; chọn một nhánh sản phẩm | Metrics/task success có baseline; G2 trước pilot, G3 trước claim production |

Nếu P0 chưa đóng, không “đúng lịch” bằng cách bỏ gate hoặc chuyển lỗi sang ghi chú. Nếu một gói hoàn thành sớm, chuyển gói đủ dependency tiếp theo; không cần chờ mốc lịch.

## 12. Quyết định còn phải chốt và phạm vi không tự mở rộng

| Quyết định | Mặc định của roadmap | Khi cần quyết định khác |
|---|---|---|
| Engine integration đầu tiên | PostgreSQL bắt buộc cho repro; SQLite giữ suite hiện có; MySQL/Mongo/Redis mở theo task | Khi có dữ liệu người dùng/driver scope chứng minh engine khác ưu tiên hơn |
| Backup toàn organization | OWNER/ADMIN ở R02 | Partial export theo quyền là feature mới có contract/test riêng |
| Composite PK | Target hỗ trợ typed tuple xuyên suốt; containment được ghi riêng | Chưa gọi DONE/full CRUD nếu mới chặn editing |
| Free/Pro | Lập và duyệt entitlement matrix, giữ giá hiện có đến khi có quyết định | Thay giá/quota/quyền lợi cần quyết định kinh doanh cụ thể |
| 2FA | Bỏ CTA gây hiểu nhầm, không giả triển khai | Enrollment/recovery thật là gói security feature riêng |
| Execution/branch/push/deploy | Roadmap lần này chỉ là tài liệu; lần triển khai chọn task và quyền tương ứng | Không suy quyền publish từ việc người dùng đồng ý tạo roadmap |

Không cần hỏi lại các lựa chọn routine đã đủ bằng chứng trong task. Nếu cần input để đổi policy/behavior kinh doanh, chuẩn bị phương án và acceptance review được trước khi hỏi; tiếp tục phần độc lập. Khi automatic approval/tool policy từ chối, ghi đúng action/lý do, không chạy đường vòng để vượt chặn.

## 13. Mẫu cập nhật mỗi lượt và Definition of Done

Mẫu báo cáo thực hiện:

```text
Task: Rxx / Mxx / finding gốc
Status: TODO | DOING | BLOCKED | CONTAINED | VERIFIED_LOCAL | DONE
HEAD/tree và phạm vi file:
Impact: symbol, direct callers, flows, risk, cảnh báo nếu HIGH/CRITICAL
Repro trước sửa: command, input, trạng thái lỗi và exit
Thay đổi: root cause và contract/callers đã cập nhật
Design review: OOP/SOLID/YAGNI/KISS/DRY/nesting; reuse và lý do ngoại lệ nếu có
Coding rules / skills: C01–C10 liên quan, N/A/lý do; skill đã dùng và trạng thái tool/runtime
Kiểm tra sau sửa: command, phạm vi, DB/browser, assertion chính, exit
Full gate: PASS | FAIL | NOT_RUN, lý do và phạm vi chính xác
Evidence: log/trace/screenshot/DB before-after tại đúng SHA
Còn mở / rủi ro / rollback:
Bước tiếp theo:
```

Checklist để đánh dấu DONE:

- [ ] Đủ acceptance của task và lớp Review Focus; input đã gây lỗi được chứng minh không còn lỗi trên đúng code đang bàn giao.
- [ ] Tất cả caller/DTO/types/fixture/export/docs bắt buộc đã cập nhật, không để compatibility nửa vời.
- [ ] Đã review OOP/SOLID/YAGNI/KISS/DRY/nesting trên diff; không thêm tầng/class/interface không cần thiết, không nhân bản policy; ngoại lệ nesting/abstraction có lý do và không làm mất guards/lifecycle.
- [ ] C01–C10 liên quan có bằng chứng tương ứng; skill dùng đúng trigger/scope, phân biệt đã tìm/cài/chạy/kiểm chứng; không claim đã enforce tự động hay toàn repo tuân thủ khi chưa kiểm tra.
- [ ] Tests thực sự chạy assertion; không skip/early-return vì setup thất bại; có integration ở nơi mock không đủ.
- [ ] Không regress quyền, transaction, error/cancel/stale guards hoặc accessibility; không lộ credential trong artifact.
- [ ] Gate cần thiết đạt, diff/impact được review, evidence gắn đúng HEAD/tree; kết quả cũ không thay kiểm tra tree mới.
- [ ] Hạ tầng tạm được dọn theo tên/path sở hữu đã kiểm tra; chỉ chạm tài nguyên của task, giữ nguyên dữ liệu người dùng.
- [ ] Roadmap/ledger cập nhật trạng thái, việc còn thiếu và phạm vi claim. Commit/push/remote SHA chỉ ghi khi đã thực sự làm và được phép.

**Điểm tiếp tục hiện tại:** R13 chờ phê duyệt ma trận Free/Pro và billing lifecycle trong [decision record](quality/R13-DECISION.md); R14 chỉ tiếp tục các boundary đã có contract/evidence mới, không mở audit toàn project hoặc tự thiết kế multi-replica/provider flow. R10–R12 giữ `VERIFIED_LOCAL`, không nâng thành DONE khi remote CI/manual zoom-screen-reader còn thiếu. Image build/scan/SBOM đã có evidence local31/10, không phải remote release image của SHA đã commit. Không dùng local pass thay release gate và không tự deploy.

**Ghi chú lịch sử:** Khi roadmap được tạo ban đầu, production source/full product gate/CI migration chưa được triển khai và mọi task là TODO. Trạng thái hiện tại phải đọc từ [progress ledger](ROADMAP-PROGRESS.md) và [manifest31/10](quality/cleanup-r10-r14-verification-2026-10-31.json); ghi chú lịch sử này không hạ hoặc nâng trạng thái hiện tại.
