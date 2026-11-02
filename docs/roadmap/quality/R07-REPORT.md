# R07 — Vòng đời truy vấn, Cancel, timeout và kết quả theo tab

Trạng thái: **VERIFIED_LOCAL** ngày 25/10/2026 (Asia/Saigon), bắt đầu 24/10. Branch `codex/roadmap-r00`, HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`; toàn bộ R00–R07 đang là thay đổi local, chưa commit/push/deploy. Bằng chứng chi tiết ở `output/roadmap-r07/` (Git ignored); [manifest portable](r07-verification.json) giữ kết quả cuối và SHA-256. Dependency audit còn đỏ, chưa đạt release gate.

## Vấn đề và tác động người dùng

1. Registry giữ pool thay vì execution đang chạy: Cancel không nhận đúng handle; PostgreSQL có thể gửi lệnh hủy qua chính connection đang bận. API trả lỗi timeout không chứng minh statement đã dừng.
2. COUNT chạy sau phần query chính có thể bị bỏ khỏi registry/deadline. Người dùng thấy hết tác vụ nhưng database vẫn chạy.
3. Client disconnect không truyền hủy tới execution. Native driver read-timeout cũng có thể reject sớm trong khi server database vẫn xử lý.
4. Khi control connection thất bại, đóng socket nguồn và báo true vẫn có thể để statement chạy ngầm. Native RED xác nhận trên PostgreSQL và MySQL.
5. QueryEditor thiếu tabId trong query key; hai tab cùng SQL gộp execution. Đổi connection tự chạy SQL cũ trên đích mới. Review còn phát hiện việc remount khôi phục eligibility từ metadata, có thể lặp lại SQL đã lưu mà người dùng chưa bấm Run.

## Thay đổi

- QueryService giữ queryId/ownership, bind callback handle riêng cho query và COUNT; deadline phủ toàn chu trình, registry chỉ retire sau driver completion. Cancel trước khi handle được publish được giữ lại để gửi đúng execution.
- PostgreSQL dùng control Client riêng nhắm PID của client đã lease; MySQL dùng control connection riêng và KILL QUERY theo threadId của source. Không phụ thuộc source pool còn slot. Chỉ clone transport config, không truyền runtime flags gây warning.
- Execution handle chống cancel trùng và giữ source lease tới khi cancel đang chờ kết thúc; late control connection không được hủy client đã trả pool. Cancel sau kết thúc trả false.
- PostgreSQL native read-timeout chờ drain/error/end; MySQL chờ ping xếp sau command trước discard. Control login lỗi trả false, giữ theo dõi tới native completion. Rollback lỗi discard connection. TCP close không được xem là bằng chứng remote query đã dừng.
- SQL Server publish actual Request và gọi Request.cancel; hiện chỉ có unit proof, chưa native SQL Server. Engine chưa hỗ trợ cancel giữ registry tới driver completion, không giả lập thành công.
- Controller truyền AbortSignal khi HTTP response bị đóng sớm và gỡ listener khi hoàn tất; không thêm field public API.
- QueryEditor tách cache/execution theo tab, connection, database; chỉ Run hoặc explicit runRequestedAt cấp quyền thực thi. Khôi phục editor giữ SQL soạn thảo nhưng không tự chạy lại. Adapter truyền signal xuống fetch, giữ confirmation guard và không serialize signal vào body.

## Phương pháp và bằng chứng

Giữ nguyên test timeout/retry/skip/coverage scope. Các lượt RED filtered được lưu riêng, không dùng làm final gate. PostgreSQL/MySQL là database thật trong Docker fixture loopback; browser dùng mock API qua UI thật, không phải browser nối backend thật.

| Lớp kiểm chứng | Kết quả đã quan sát trước chốt gate |
|---|---|
| Lifecycle/driver RED | Registry/handle/lease, MSSQL Request, rollback failure có RED trước sửa |
| Native control failure RED | 3 fail/1 pass; còn statement sau response trên PG app/native timeout và MySQL native timeout |
| Native PG + MySQL sau sửa | 15/15 PASS, exit 0 (`native-check-6`) |
| Core unit | 69/69 PASS, exit 0 (`core-check-3`) |
| Browser đổi connection/hai tab | 4/4 PASS Chromium + Firefox, exit 0 (`browser-green-4`), trước review fix remount |
| Full backend unit | 686/686 PASS, 91 suites, exit 0 (`server-final`) |
| Review độc lập | 0 Critical, 1 Important remount phải sửa, 0 Minor mới; parent chịu final gates |

Browser harness failures do readiness/selector/IME textarea/mock autocomplete được giữ như chẩn đoán, không gọi là lỗi sản phẩm. Test dùng thao tác paste vào Monaco view-lines và kiểm exact request payload. Inactive tab được giữ mounted/hidden; assertion kiểm kết quả tab cũ không hiển thị trong tab active, không bắt xóa kết quả riêng của tab cũ. Adapter unit đầu chưa đợi kết quả trước sửa nên không được tính là RED độc lập.

## Quyết định và giới hạn

Các Ruling đầy đủ được giữ trong [progress ledger](../ROADMAP-PROGRESS.md); manifest chốt sẽ trích nguyên danh sách R07 và final review.

- Giữ checkout hiện tại để bảo vệ dependencies R00–R06 chưa commit. Trước R07 có 105 file được hash; `.zcode/` ngoài phạm vi. Không tạo worktree thiếu các thay đổi đó, không tự commit.
- Timeout kích hoạt cancellation nhưng không bỏ registry sớm. Đổi lại, engine không hỗ trợ hủy hoặc control login lỗi có thể chờ native completion thay vì trả timeout sớm.
- Mất toàn bộ kết nối tới remote DB không cho phép chứng nhận remote statement đã dừng. Thông báo yêu cầu kiểm database và writes trước retry; request có thể đã ghi dữ liệu trước khi cancel.
- Chỉ chứng nhận stop/rollback trên local PG16 và MySQL8.4. Proxy/pooler, SSH, remote routing, SQL Server thật và các engine khác cần native certification riêng.
- Registry vẫn theo process. Multi-replica routing, connection budget, throughput/load, remote CI và release gate thuộc R14/chưa kiểm.
- Không chứng nhận toàn bộ workflow/UI/keyboard/IME/mobile/a11y bằng các case desktop này. Gõ nhanh mất ký tự trong harness được ghi cho R11/R12; chưa kết luận nguyên nhân production.
- Không đưa ra phần trăm line/branch/workflow coverage: số test PASS không phải tỷ lệ phủ nhu cầu người dùng. R08–R14 và các P0/release gates còn mở.

R06 có một Minor harness cleanup đã deferred trong báo cáo R06; R07 không tự sửa lại scope đó. Không cài thêm dependency, không đổi schema, không gửi dữ liệu tới provider bên ngoài.

## Nghiệm thu

Lượt tiếp tục 25/10 đã đóng lỗi remount bằng RED→GREEN trên code hiện tại. Full browser **82/82 PASS**, server unit **686/686**, client unit **158/158**, API **122/122** và guards **2/2**, lint/build hai phía cùng checks phụ đều exit0. Native PostgreSQL9/MySQL6 nằm trong API122, không cộng lặp thành số coverage. Theo ngoại lệ dependency baseline tại roadmap8.3: R07 VERIFIED_LOCAL, dependency audit FAIL giữ ở R10 và không claim release/production.

## Tiếp tục 25/10 — lỗi remount và review hiện tại

RED mới: `remount-red.json`, exit 1, exact payload có thêm `connection-next` sau reload dù chưa bấm Run. Nguyên nhân là `runNonce` và `executionScope` được khôi phục từ `executedQuery` trên connection hiện tại. Sửa hai initializer thành `0`/`null`; giữ nguyên SQL, metadata, pagination và đường Run/explicit run request. Không thêm dependency, schema, wrapper hoặc thay API. Fixture giờ bấm Execute rõ ràng cho từng tab; mọi assertion cũ được giữ, thêm kiểm SQL không mất và Run sau restore gửi đúng connection B.

Impact QueryEditor UID: LOW, 0 direct/flow trong GitNexus; Codegraph xác nhận dynamic render MainContent → QueryEditor, nên graph zero không đồng nghĩa không có caller. Impact openQueries ban đầu UNKNOWN rồi có CRITICAL253/52 với quan hệ không khớp; đã cảnh báo và full rebuild index. Sau rebuild, UID trả LOW/1 direct/0 flow; source có ba test caller. Không sửa helper trước khi giải quyết lookup sai. Final detect all/compare main: CRITICAL, 58 tracked files/254 symbols/47 processes của diff gộp R00–R07, đã cảnh báo; untracked source/hash được kiểm riêng.

Các MCP đã dùng thực tế ở lượt này: GitNexus query/context/impact/detect; Codegraph xác nhận render và contract/driver callers; Semble tìm registry cleanup/MySQL timeout/ActiveQueriesPanel. Các cảnh báo "no covering tests" của graph không thay kết quả runtime. Impeccable context cho phép scoped fix trên incumbent, detector `[]`; không init/hook/redesign. Ponytail/Systematic Debugging/TDD/Verification/Ponytail Review và Writing for Agents hỗ trợ quy trình, không được coi là chứng nhận tự động toàn repo.

### Self-review trên tree hiện tại

Review tuần tự trong cùng chat, không dispatch reviewer mới. Finding Important remount của review lịch sử đã được tái hiện và đóng. Không tìm thêm Critical/Important production trong scope R07 đã đọc và kiểm; review này không phải review độc lập mới hoặc chứng nhận release.

| Quy tắc | Áp dụng/bằng chứng |
|---|---|
| OOP/SOLID | Controller chuyển signal, service giữ ownership/deadline/registry, strategy sở hữu lease/control/request; optional callback giữ compatibility các engine. Không ép capability giả. |
| YAGNI/KISS/DRY | Reuse execution helper/strategy và React Query AbortSignal; lỗi restore sửa đúng hai initializer, không thêm abstraction hoặc sửa hook không có consumer. |
| Nesting | Giữ finally/rollback/release; nesting đáng chú ý ở phần COUNT/transaction kế thừa phục vụ lifecycle và count fallback, không tách chỉ để đạt số tầng. Hai initializer mới không thêm tầng. |
| C01 | Types/build pass; options/handle typed, malformed/ownership/policy chạy trong full unit/API. Test doubles còn dùng cast tại boundary driver đã có; không dùng để bypass validation production. |
| C02 | Native owner allow/outsider deny, queryId đúng, neighbor query hoàn tất; full policy/auth API giữ guard. |
| C03 | Native PG/MySQL cancel multi-statement rollback preceding writes; duplicate/completed cancel không tác động borrower mới. Không retry write. |
| C04 | Native app/client timeout, COUNT, disconnect/socket/control failure; registry/lease chờ completion, timer/listener/finally cleanup. |
| C05 | Timeout yêu cầu inspect DB/writes, false cancel không giả dừng, API còn sống sau fault; không swallow query error thành empty success. |
| C06 | Query key theo tab/connection/database; restore không cấp quyền chạy; input giữ nguyên và Execute sau restore đúng đích; late response không ghi đè run mới. |
| C07 | Artifact portable chỉ chứa synthetic case/status/hash, không token/credential; runtime output Git ignored. Không certify redaction/retention toàn hệ thống hoặc thay audit policy SQL kế thừa. |
| C08 | Fresh RED đúng lỗi payload rồi browser6/6 GREEN; native15/15 trong API122/122, không skip/budget/retry change. Browser mock tách khỏi real-backend API. |
| C09 | N/A tối ưu hiệu năng: không thêm cache/index/benchmark hoặc claim throughput; pool load/multi-replica chưa kiểm. |
| C10 | Diff resume chỉ hai dòng source + fixture/assertions bắt buộc; sources19 frozen bằng SHA-256; toàn baseline810 được đối soát, không đổi dependency/schema. |

Evidence mới: `output/roadmap-r07/resume-2026-10-25/`. Unit server686/686 (91 files), client158/158 (49 files); API122/122 (12 suites, native PG9/MySQL6) và guards2/2; server/client lint/build, prerender1/1, CI script tests8/8 đều exit0. Client lint có warning `CommentComposer.tsx:17` kế thừa ngoài scope. Browser focused6/6 và full82/82 exit0; 0 skipped/failed/flaky, config timeout/retry/worker/projects không đổi. Browser/API/full-unit đều kiểm source cuối, frozen19 sources đối soát lại sau gate.

Dependency gate **FAIL trên dependency/lockfile không đổi của baseline resume**, dùng đúng CI allowlist: client `GHSA-QWWW-VCR4-C8H2`, server `GHSA-GGR8-5VV4-36MX`. Client DOMPurify critical `GHSA-CG2G-XH64-V4Q7`, `GHSA-MRV2-3PQR-J5JR`; server Azure identity/MSAL, Nest/multer/body-parser/nodemailer high và proxy-addr critical. Chi tiết advisory trong hai audit logs; remediation thuộc R10. Không gọi full release gate xanh hoặc tự nâng dependency để đóng R07.

Hậu kiểm fixture: 0 User/Connection/Organization/Payment/BillingSubscription, 0 bảng/constraint/client/statement PG của fixture, 0 MySQL statement/table, Mongo database và Redis key tương ứng. Sau kiểm ownership project/config/created time, down riêng bốn container/network của lượt này; không còn container hoặc listener ở15432/16379/17017/13306. Không sửa/xóa `.zcode/`, dữ liệu người dùng hoặc thay đổi R00–R06 ngoài source overlap đã thuộc R07.

Ảnh render bổ sung: `resume-2026-10-25/visual-captures/query-lifecycle-r07-reload-fa7fc-isted-SQL-on-the-new-target-chromium/test-finished-1.png`. Đã nhìn ảnh: page gốc ở connection B vẫn giữ SQL và Data Output trống/chờ Run; page restore được kiểm bằng exact payload/visible assertions trước khi đóng trong test. Lượt capture bổ sung1/1 exit0, không thay budget/assertion. Config capture đầu thiếu webServer cwd nên setup timeout180s/0tests (giữ `visual.json`); sửa đúng cwd client, không nâng timeout. Header có overlap kế thừa ngoài diff, giữ cho R11/R12; không chứng nhận toàn bộ layout/a11y từ ảnh này. Sau capture không còn listener4173 hoặc các cổng fixture.
