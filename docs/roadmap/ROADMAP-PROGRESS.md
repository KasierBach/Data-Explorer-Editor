# Tiến độ triển khai ROADMAP.md

**Plan:** [ROADMAP.md](ROADMAP.md). **Baseline:** `3d7ec60845ddc2a07284c2873d9d3727acd30744`. **Branch:** `codex/roadmap-r00`. Ngày bắt đầu: 22/10/2026, Asia/Saigon. Chưa commit/push/deploy.

## Final-goal — chốt autonomous scope có contract, 02/11

[Report](quality/FINAL-GOAL-2026-11-02.md) / [manifest](quality/final-goal-verification-2026-11-02.json). Tiếp tục đúng dirty tree sau khi Codex bị lỗi hạ tầng; không reset/stash/commit/push/deploy. Đóng các gap test/harness cuối có contract: strict AI-autocomplete fixture, R06 drain/primary-error failure path, header/NoSQL lazy-route readiness và mobile locale readiness. Header/mobile readiness waits dùng timeout explicit5.000ms, giữ assertion window cũ; không đổi production source, cấu hình retry/test timeout, assertion hoặc coverage budget.

Gate authoritative cuối: server coverage **781/781 trong 97 suite**, native **187/187 trong 20 suite** + guards **2/2**, focused auth+billing **23/23** và R06 **13/13**; server typecheck/lint/build exit0. Client coverage **177/177**, full E2E/config TypeScript **0 diagnostic**, full lint0error/1warning Fast Refresh kế thừa. Browser mock API **232/232** trên Chromium/Firefox/mobile Chromium/mobile WebKit,1worker,retries0,exit0; clean browser-to-real-backend **3/3**. Root/retained checkout khớp **789/789 application file**, prebuilt bundle bind70file, không copy `server/.env`. Cleanup đúng project `data-explorer-codex-goal`:0container/network/listener;19volume giữ nguyên, không global prune.

Các lượt 229/230,228/232,231/232,222/232,231/232 và run bị ngắt ở case190 được giữ nguyên theo phân loại RED/resource-starved/incomplete; không relabel thành pass. Các mốc 230/230 phía dưới là snapshot lịch sử trước final-goal. GitNexus cumulative vẫn CRITICAL **112file/382symbol/132flow** cho toàn dirty tree; sửa readiness riêng LOW. R00–R12 giữ VERIFIED_LOCAL trong scope report; R13 vẫn `BLOCKED_PRODUCT_DECISION`, R14 vẫn `BLOCKED_PRODUCT_CONTRACT`; provider/manual/scale/remote CI/release vẫn chưa verified, nên không gọi roadmap DONE hoặc release-ready.

## Follow-up A01 / R06 — tiếp tục chat bị ngắt, 01/11

[Residual manifest](quality/r00-r06-residual-verification-2026-11-01.json) ghi RED→GREEN và hashes trên dirty tree tại mốc01/11. A01: cả EN/VI request với account lưu locale ngược lại, sai password/thiếu hash, đều trả generic credentials theo request. Native VI chứng minh email thiếu/tồn tại cùng401/message. R06 tại mốc đó drain `allSettled` sau unlock; regression observation failure gọi webhook ký local thật và đòi payment đã `paid` trước khi lỗi gốc thoát. Final-goal02/11 đóng tiếp rollback/release failure precedence: catch primary → rollback/release → await pending → ưu tiên primary; focused R06 đạt13/13.

Backend cuối đạt **781/781 unit (97 suites)**, **186/186 native trực tiếp (20 suites)** + **2/2 guards**, full typecheck/lint/build exit 0. Coverage all-source: **55.88% lines / 47.43% branches / 50.14% functions / 55.05% statements**, không đổi scope/threshold. Browser đạt **230/230** trên Chromium/Firefox/mobile Chromium/mobile WebKit; clean full-stack đạt **3/3**, đều exit 0. Clean export bind 789 application files và không copy `server/.env`; hậu kiểm độc lập khớp 789/789 original + export, `.zcode` 2/2, 17/17 source hash R14, 0 fixture container/network và 19 volume giữ nguyên. GitNexus cumulative CRITICAL **112 files / 382 symbols / 132 flows**, riêng login/helper LOW.

Các giới hạn cũ được phân loại theo source mới: A02 cache và AI context error đã CLOSED_LATER ở R10, R07 restore/remount ở 25/10; A01 và R06 cleanup CLOSED tại follow-up này. R00–R12 chỉ VERIFIED_LOCAL trong scope report. R13 deferred/BLOCKED_PRODUCT_DECISION; R14 BLOCKED_PRODUCT_CONTRACT. Không chứng nhận native mọi engine/SSH/proxy/load/replicas, provider sandbox, actual zoom/screen reader hay remote/release bằng local test pass. Snapshot lịch sử phía dưới giữ nguyên.

## R14 — chốt technical scope có contract, BLOCKED_PRODUCT_CONTRACT, 01/11

[Final manifest](quality/r14-final-local-verification-2026-11-01.json) bind command/result với source hashes và clean-export application fingerprint. Tiếp tục từ handoff trên đúng dirty tree, giữ R13 deferred và không reset/stash/commit/push/deploy. Docker29.9.2 đã truy cập được nên caveat `NOT_RUN` của follow-up được đóng bằng test thật: focused native R14 **21/21** + environment guards **2/2**, full native tuần tự **184/184 trong20suite** với `--detectOpenHandles`, exit0.

Audit bốn boundary còn lại không tìm thấy production edit nào được phép tự suy contract. CSV đã mất tín hiệu NULL-vs-empty ngay trên wire (`null` và `''` cùng empty cell, import `defval:''`). Mongo row update/delete cố ý chặn trước strategy vì DTO chưa có typed identity/Extended JSON envelope; generic JSON insert/MQL mutation vẫn tồn tại nhưng không có subtype-preserving guarantee. Redis `insertRow` vẫn đi qua `SET`, có thể overwrite type/xóa TTL, trong khi overwrite/TTL-copy/missing-key policy chưa được duyệt; SCAN không thể là stable snapshot khi keyspace đổi. Migration có partial commit và cố ý từ chối replay vì chưa có checkpoint/idempotency/whole-transfer rollback. Ghi rõ behavior hiện tại: Mongo typed edit/migration replay được contain, còn CSV vẫn lossy, generic Mongo JSON writes không preserve subtype và Redis insert vẫn giữ overwrite/TTL risk; không tự đặt sentinel, BSON wire format, TTL semantics hoặc retry algorithm. Trạng thái hiện tại chuyển từ `DOING_BOUNDED` sang **BLOCKED_PRODUCT_CONTRACT**: technical scope có contract hiện hữu đã hoàn tất, nhưng R14 không phải DONE/release-ready.

Final current-tree gates: server typecheck/lint/build exit0; coverage **778/778,97suite**, lines55,83%/branches47,40%/functions50,14%/statements55,01%. Client lint exit0 với1warning Fast Refresh không thuộc R14; coverage **177/177,53files**, lines18,84%/branches11,94%; build và bundle budget đạt. Browser **230/230** trên Chromium/Firefox/mobile Chromium/mobile WebKit. Full-stack in-place dừng đúng guard vì checkout có `server/.env`; source-equivalent clean export **862 source files**, không copy `.env`, đạt **3/3**. Client/server npm audit theo đúng allowlist CI, Prisma helper4/4, prerender1/1 và CI scripts8/8 đều exit0.

Docker down đúng4container fixture + network; hậu kiểm0 owned container/network, host giữ19volume, không global prune. Xóa recursive clean export bị policy chặn và không vòng qua; `output/r14-final-full-stack-20261101/` cùng hai junction dependency vẫn còn trong ignored output. Không có provider call, commit, push hoặc deploy.

## R14 — BSON discriminator consumer follow-up, 01/11

Rà cùng root sau addendum phát hiện hai consumer còn tin trực tiếp `_bsontype`: `NoSqlService.analyzeSchema` phân loại ordinary object thành `objectid`, và `MongoDbStrategy.getSampleRows` đổi ordinary object thành `"[object Object]"`. GitNexus impact trước sửa đều LOW: schema analysis có2caller trực tiếp/0flow nhận diện; sample rows có0caller/0flow nhận diện, với giới hạn strategy dispatch động.

Hai regression unit RED đúng lỗi:2fail/24pass. Sửa tối thiểu bỏ string discriminator khỏi schema analysis; sample rows chỉ convert top-level ObjectId khi có BSON7 brand thật và dùng serializer đã kiểm chứng. GREEN focused26/26; full server unit778/778 trong97suite; typecheck/lint/build exit0. Production search không còn `_bsontype`; chuỗi này chỉ còn trong regression/fixture. Tại đúng lượt follow-up, focused native là `NOT_RUN` vì sandbox không truy cập Docker API và dịch vụ duyệt quyền trả503; đây là quan sát lịch sử, không suy pass. Lượt chốt phía trên đã chạy lại native thật và chuyển trạng thái hiện tại sang `BLOCKED_PRODUCT_CONTRACT`. Không commit/push/deploy.

## R14 — BSON discriminator hardening, addendum 01/11

[Addendum](quality/R14-BSON-DISCRIMINATOR-ADDENDUM.md) / [manifest](quality/r14-bson-discriminator-verification-2026-11-01.json). Một document thường có `_bsontype: "ObjectId"` từng bị đọc thành BSON giả, làm query trả `"[object Object]"` và metadata che field người dùng. Sửa không còn tin string field: BSON 7 thật dùng global type/version brands; native RegExp, MinKey/MaxKey có output ổn định; ordinary document vẫn đệ quy bình thường. Không mở typed write/Extended JSON import/export.

RED unit hợp lệ: 1fail/14pass. Lỗi cú pháp `$arrayToObject` native đầu là harness failure trước application code; sau sửa fixture, 20 case cũ giữ pass. Independent review tìm3 Medium (native RegExp, Min/Max sentinel, multiple BSON copies); đã sửa và review lại không còn finding. Final focused unit18/18, native21/21; full coverage776/776 trong97suite, full native tuần tự184/184 trong20suite + guards2/2 với detectOpenHandles; typecheck/lint/build/audit/helper4/4 exit0. Coverage all-source55,74%lines/47,36%branches/50,02%functions/54,92%statements, không đổi scope/threshold.

Full-native đầu chạy đồng thời coverage có184 test body pass nhưng R04 `afterAll` quá120s, exit1; không tăng timeout/retry hoặc dùng làm final. Fixture mới chạy tuần tự đạt184/184. Tất cả Compose project sở hữu đã down,0container/network, host giữ19volume, không global prune. GitNexus cumulative vẫn CRITICAL:110file/380symbol/132flow; giữ cảnh báo integration. R14 tổng thể vẫn DOING_BOUNDED, R13 vẫn BLOCKED_PRODUCT_DECISION; client/browser/full-stack/remote CI không rerun và không nâng release claim.

## R10 — Full test-source TypeScript, chốt 01/11

[Report](quality/R10-TEST-TYPES-REPORT.md) / [manifest](quality/test-types-verification-2026-11-01.json). Bắt đầu ngày 31/10, nghiệm thu ngày 01/11 theo đồng hồ host; evidence giữ run path `output/roadmap-r10-test-types-20261031/`. R10 vẫn VERIFIED_LOCAL, R13 BLOCKED_PRODUCT_DECISION và R14 DOING_BOUNDED. Không reset/stash/commit/push/deploy; giữ toàn bộ R00–R14 và `.zcode/`.

Đã đóng 7 diagnostic trong 5 file test bằng mock Express đúng kiểu, chữ ký Jest `importData` từ strategy, khai báo Mongo `_id: number`, thu hẹp `jobId`, generic `KeyvRedis<unknown>` và mảng resource ID `string[]`. Không sửa mã production, tsconfig, test discovery, lockfile hoặc dependency; không giảm ngân sách hay assertion. CI chạy `npm run typecheck` ngay sau Prisma generation. Compiler trả 0 diagnostic và exit 0 trước test và sau build. Negative control dùng read overlay của source test cũ trả đúng 7 lỗi; source hiện tại trả 0 lỗi. Cả 165 lời gọi `expect` giữ nguyên.

Baseline unit đạt 22/22 và native đạt 27/27. Gate cuối đạt 772/772 unit trong 97 suite và 183/183 native trong 20 suite, kèm 2 environment guards và `detectOpenHandles`. Lint, build, audit, Prisma helper và actionlint đều exit 0. Lượt native đầu có 181 pass và 2 fail ở R09 do timeout 5 giây và `ECONNRESET`; log được giữ nguyên. R09 chạy riêng đạt 12/12 rồi full-native tuần tự đạt 183/183 mà không đổi source hoặc ngân sách. Chưa chứng minh đã loại bỏ flakiness/timing sensitivity. Các sửa annotation của migration, Keyv và resource array có cây cú pháp JavaScript giống baseline; thay đổi mock SSE và guard `jobId` được kiểm bằng runtime regression.

Docker đã dọn đúng 4 container fixture và network, giữ nguyên 19 volume cùng mọi image/tag/container của project khác và không tạo volume mới. Không có lượt client/browser/full-stack/container scan mới trong gói test-only này; kết quả trước giữ qualification của snapshot gốc. Cumulative CRITICAL impact và hash cuối nằm trong manifest. Các gate release, sản phẩm và kiểm thử thủ công chưa đủ điều kiện vẫn mở.

## R14 — Native BSON reads và Redis key browsing, snapshot 31/10

Gói đọc native đã VERIFIED_LOCAL trong phạm vi [report](quality/R14-NATIVE-READ-REPORT.md) / [manifest](quality/r14-native-verification-2026-10-31.json); R14 tổng thể vẫn DOING_BOUNDED, R13 vẫn BLOCKED_PRODUCT_DECISION. Giữ HEAD/branch và toàn bộ R00–R14 chưa commit, `.zcode/`; không reset/stash/commit/push/deploy hoặc provider call.

Baseline affected83/83 trước sửa. Native RED18tests:15fail/3pass, gồm BSON Long/Binary/Timestamp bị bung trường nội bộ, bigint làm JSON500, metadata opaque BSON, Redis exact/glob/TYPE/cú pháp sai và thiếu next-page lookahead. Hai case distinct bị readonly guard từ chối đúng contract; sửa fixture dùng owner writable connection để kiểm đường đọc và giữ riêng readonly denial, không đổi guard. Array-metadata RED thêm1fail/19pass. GREEN focused20/20, Redis edge/existing driver48/48, server772/772 (97suites), native183/183 (20suites, guards2/2, detectOpenHandles) và build/lint/audit/helper exit0. Coverage toàn source55,69% lines/47,28% branches, thresholds giữ nguyên.

Sửa chỉ Mongo/Redis strategies và Redis `/data` tmpfs của fixture. BSON Long unsafe/native bigint dùng exact string, safe integer vẫn number; Binary/Timestamp theo JSON native, metadata không bung opaque array members. Redis key-list giữ shape bảng, áp cursor/MATCH/COUNT/TYPE, khử trùng batch, lookahead và chỉ total khi traversal từ0 kết thúc. Không hứa stable snapshot khi keyspace đổi, subtype-preserving BSON writes, parser key có khoảng trắng hoặc whole-keyspace work cap.

Full test-source TypeScript còn7diagnostic kế thừa, so compiler với snapshot strategies trước sửa nhận đúng cùng7 và0diagnostic mới; không ghi full typecheck xanh. Thử agent tra contract bị provider rate limit, self-review bằng source/native evidence, không giả có reviewer độc lập.

Docker fixture ghim image ID có sẵn, `--pull never`, loopback và tmpfs mọi datastore. Hậu kiểm0user/connection/org/payment/subscription,0R14MongoDB/key Redis; down đúng4container/network, giữ19volume có sẵn,0volume mới, không đổi image tag/container project khác. Cumulative compare-main vẫn CRITICAL:109file/376symbol/132flow theo manifest; giữ cảnh báo khi tích hợp. Client/browser/full-stack trước đó vẫn là evidence lịch sử ở đúng snapshot, không chạy lại hay tự nâng thành release gate.

## Chốt cleanup và kiểm chứng độc lập R10–R14 — 31/10

Không reset/stash/commit/push/deploy. Ba tài liệu lịch sử được gom vào `docs/archive/local-notes/`, giữ byte/hash và ignore; bỏ build metadata cũ và dependency trong hai checkout audit, giải phóng **2.389.511.220 byte dữ liệu có sẵn**. Source/log/coverage evidence cũ5.046file giữ nguyên checksum. Dependency/cache tạm của lượt kiểm chứng mới cũng đã được dọn sau khi giữ evidence; không cộng phần tạm đó thành net savings từ dữ liệu cũ. [Cleanup/retention report](quality/CLEANUP-2026-10-31.md).

Docker dọn8container fixture cũ/2network cũ; sau kiểm chứng cũng dọn4container fixture mới, network, builder/cache riêng, application/scanner/tool images do lượt này tạo. Giữ18volume có sẵn, image gốc và container của project khác; còn19volume vì volume Redis test mới được giữ, không global prune. Không còn fixture/listener/process do lượt test tạo.

R10 tiếp tục VERIFIED_LOCAL: native **163/163,19suites**, guards2/2, server unit **758/758**, local build/Trivy/SPDX SBOM cho hai image và health smoke đạt. Compose migration npx RED127 → bundled Prisma CLI qua Node GREEN, fresh fixture DB đủ9migration rồi cleanup. Namespace limiter chỉ nằm trong helper E2E; native test chứng minh5attempts rồi blocked và hai app fixture độc lập.

R11/R12 tiếp tục VERIFIED_LOCAL: wrapping/portal stacking, Save labels/error association, Dashboard connection action names/keyboard-focus visibility và reflow320/640 được ghim RED→GREEN. Full-stack **3/3** gồm luồng keyboard login→connection→query→save→Profile và two-user isolation. Monaco Ctrl+M dùng được; không sửa editor theo giả thuyết thiếu module đã bị bác bỏ. Client unit/coverage **177/177,53files**, lines18,84%/branches11,93% toàn source; build/lint/audit đều đạt. Browser cuối **230/230**, Chromium/Firefox/mobile Chromium/mobile WebKit, không skipped/unexpected/flaky và process exit0. Số đo và snapshot từng gate xem [manifest31/10](quality/cleanup-r10-r14-verification-2026-10-31.json), không dùng snapshot208/226 trước đó thay tree cuối.

R14 session race được mở rộng từ repro thực: late401 không refresh hai lần, logout/đăng nhập mới không bị completion cũ khôi phục/đăng xuất, response thành công cũ không trả dữ liệu vào phiên mới. Giữ no-write-retry sau unknown outcome. R14 vẫn DOING_BOUNDED vì NULL-vs-empty, typed Mongo mutation, migration resume, scale/provider contracts còn mở. R13 vẫn BLOCKED_PRODUCT_DECISION; chưa có matrix/quota/lifecycle/sandbox được duyệt và không tự tạo entitlement.

Manual direct-browser320px Profile pointer/geometry/Tab/Escape/return-focus đạt. Host không áp dụng Ctrl++ (viewport/scale đo trước-sau giống nhau), nên actual zoom là NOT_VERIFIED_HOST_CAPABILITY; screen reader/remote CI/provider sandbox chưa chạy. Self-review riêng scope/ownership/guards/evidence; chưa có independent reviewer thành công. GitNexus compare-main trên final indexed tree vẫn CRITICAL cho diff cộng dồn; kết quả chính xác và artifact trong manifest31/10.

## Snapshot 27/10 — R10/R11/R12 VERIFIED_LOCAL; R13 BLOCKED; R14 DOING

Giữ baseline/R00–R09 và `.zcode/`; không reset/stash/commit/push/deploy. [R10](quality/R10-REPORT.md) đóng dependency high/critical gate, coverage floor, CI/full-stack/error contract và cache lifecycle trên frozen local tree; baseline mới: core gates exit0, native E2E162/162, browser82/82, full-stack2/2. Clean export842–843 source files dùng npm ci; final CI-order results trong `output/roadmap-final-clean-20261026/`, gồm localized browser208/208 và real full-stack2/2. Remote Actions/image scan/deploy vẫn NOT_RUN.

[R11](quality/R11-REPORT.md) dùng layout wrap thay absolute overlap; matrix56 case widths360/390/412/768/1024/1280/1440 × VI/EN × light/dark × timer, mỗi case kiểm SQL/NoSQL/theme/Teams/geometry; chia một process mỗi width do Windows runner dài bị interrupt, tất cả batch exit0. [R12](quality/R12-REPORT.md) dùng dialog primitive, labels/focus/scroll semantics/native buttons/i18n/2FA unsupported; authenticated data-loaded axe critical/serious zero light/dark và Connection/Profile scan exit0. Manual zoom/screen reader, remote CI chưa chạy.

[R13](quality/R13-REPORT.md) có [decision record](quality/R13-DECISION.md): payment/webhook/expiry giữ regression R06; xóa copy quota/tính năng không được server enforce. Không thêm entitlement tùy ý. Cần người dùng duyệt matrix Free/Pro, quota/reset, over-quota behavior, refund/cancel/chargeback/grace/downgrade, stacked purchase và sandbox; trạng thái BLOCKED, Gate C chưa đạt.

[R14](quality/R14-REPORT.md) targeted audit: CSV RED Unicode mojibake → UTF-8 GREEN, quote/newline pass; NULL-vs-empty vẫn BLOCKED contract. Mongo ObjectId/Date pass, Decimal128 RED BSON object → exact string GREEN. Migration safe resume, typed Mongo mutation, multi-replica/shared cap, Redis write TTL/SCAN và external provider vẫn CONTAINED/NOT_RUN đúng ledger; không gọi R14 DONE.

Self-review cuối 27/10: JSON/evidence path/diff whitespace đều hợp lệ; localized browser208/208, real full-stack2/2 và R11 matrix56 case đều trỏ tới artifact mới nhất. GitNexus `compare main` trên đúng tree cuối báo **CRITICAL: 103 files, 362 symbols, 66 execution flows**; đây là blast radius cộng dồn R00–R14, không phải test failure mới. Cần giữ cảnh báo này khi tích hợp và tách/review theo concern; không có commit/push/deploy.

## R09 — VERIFIED_LOCAL (25/10)

HEAD/tree: baseline trên + R00–R09 chưa commit. CommentEvent là nguồn state duy nhất; audit chỉ activity. Giữ commentId/threadId/reaction references, current permission và anonymous shared content khi author bị xóa; resource/org cascade. [Report](quality/R09-REPORT.md), [manifest](quality/r09-verification.json), [migration/rollback](quality/R09-MIGRATION.md), evidence `output/roadmap-r09/`.

Native RED→GREEN đóng cửa sổ500 và retention/remount; regression thêm nested reply, author/admin mutation, revoked resource policy/membership cùng JWT, COMMENT revoke/READ còn, missing/wrong-org references, attachments/deletion, audit outage/durable rollback và reaction/delete race. Backfill batch/checkpoint/watermark/rollback/restart/replay có maintained native spec. Initial corpus8:6events copied/2skipped,1complete thread,1orphan reply/1orphan reaction; corpus cuối14:7events copied/7skipped,1complete thread, replay0copied. Event đã bị retention xóa không tự phục hồi. Backup app DB fixture đã restore thử; production cần maintenance và dừng old writers.

Gate cuối: server711/711 (94 suites), client158/158, API153/153 (16 suites, R09 native15 là subset), guards2/2, browser82/82 không failed/skipped/flaky; Prisma/lint/build, prerender1/1 và CI scripts8/8 exit0. Audit client/server exit1 BASELINE_FAIL với đúng CI allowlists, manifests/lockfiles không đổi. Không nới timeout/retry/assertion/coverage budget; giữ lỗi fixture uppercase READ và lượt hook timeout khi processes chồng, sau đó chạy tuần tự full gate.

Freeze5source paths; baseline protection819files, chỉ schema/service R09 và3canonical docs được phép đổi. Teardown0 User/Connection/Organization/Payment/Subscription/CommentEvent/Reaction,0 PG/MySQL app session,0 temporary DB/function/table, Mongo fixture DB và Redis active/wait0. Down riêng4containers/network theo ownership exit0; không listener fixture/browser hoặc test process còn lại. Index7372nodes/19519edges/431clusters/269flows; detect all/compare main CRITICAL65files/305symbols/48flows của diff cộng dồn R00–R09, đã cảnh báo và đối soát riêng scope/hash R09. Self-review tuần tự, chưa independent review/remote CI/coverage/production migration hoặc capacity/large corpus proof. Bước tiếp: R10; không reset/stash/commit/push/deploy.

## R08 — VERIFIED_LOCAL (25/10)

HEAD/tree: baseline trên + dependencies R00–R08 chưa commit; cache identity giữ case/tuple/options, shared invalidation cho raw/grid/DDL/import/seed/migration/refresh, Mongo sample-size và partial commits đúng native boundary. [Report R08](quality/R08-REPORT.md), [manifest](quality/r08-verification.json), evidence `output/roadmap-r08/`; freeze27 source paths, protection baseline812 files. RED chứng minh F6/F7, Mongo sample/seed partial, MySQL implicit commit và cache-error progress/retry/native-error boundaries; focused review58/58 exit0.

Gate cuối: server711/711 (94 files), client158/158 (49 files), API138/138 (14 suites; R08 native16 là subset), environment guards2/2, browser82/82 không failed/skipped/flaky; Prisma/lint/build, prerender1/1, CI scripts8/8 exit0. Client lint có warning kế thừa CommentComposer. Client/server audit exit1 BASELINE_FAIL trên manifests/lockfiles không đổi trong R08, đúng allowlists CI; R10 xử lý, chưa release/push. Không thay timeout/retry/assertion/coverage budget. Initial gate failures được giữ, repair mock R04/SQLite native matcher và test R01 warm-cache tự lập có giải thích trong report; native fixture R08 dùng real loopback IP riêng để không tiêu budget limiter của suite cũ.

Teardown kiểm users/connections0, PG R08 tables/databases/sessions0, Mongo/MySQL R08 resources0, Redis active/wait0; compose down đúng ownership exit0, container/network/listener fixture không còn. Self-review theo chỉ dẫn tuần tự, chưa independent review/remote CI/coverage/native SQL Server/ClickHouse/multi-replica certification. Cache outage/external writes còn recovery/TTL limits, durable invalidation ở R14. Bước tiếp: R09 — comment persistence; không commit/push/deploy.

## R00 — VERIFIED_LOCAL

Phạm vi: test fixture/config, API mock contract, teardown và evidence portable. Chưa sửa các lỗi quyền/cache/dữ liệu/thanh toán production của R01–R14.

### Quyết định thực hiện

- Ruling: dùng nhánh riêng trong checkout hiện tại, giữ dependencies và audit artifact đang có; không tạo worktree mới cho gói harness này. Hệ quả: các file đang sửa dùng chung trong checkout; `.zcode/` được giữ nguyên.
- Ruling: làm từng gói theo mục 2 roadmap; lượt này nghiệm thu R00. R01 chỉ bắt đầu sau khi harness đủ tin cậy, không coi roadmap 90 ngày là yêu cầu triển khai mọi tính năng trong một lượt.
- Ruling: không tự commit/push; giữ diff để người dùng review. Checklist không thay thế test output/process exit.
- Ruling: bộ baseline portable chỉ giữ case/finding tổng hợp và hash tài liệu nguồn đã rà soát. Full logs, DB, token và runtime cũ không được đưa vào Git. Baseline lịch sử không phải regression suite sau fix.

### Impact và giới hạn công cụ

- GitNexus index khớp baseline HEAD; `auth-security.e2e-spec.ts` và `app.e2e-spec.ts`: LOW, không có production caller/process upstream.
- `mockAuthenticatedApi` trong helper chung: LOW, hai caller là mobile workspace và billing return. Bản cục bộ trong authenticated-workspace: LOW, một caller trong chính file test.
- Truy vấn `mockAuthApi` theo tên trả CRITICAL (454 symbol, không có UID và quan hệ không khớp source). Đã hoàn lại riêng edit đó, cảnh báo và kiểm tra UID file: LOW, 0 caller/process upstream. Không dùng kết quả theo tên làm bằng chứng sửa production.
- Codegraph/Semble được dùng để định vị; source trực tiếp được dùng khi kết quả không trả đúng phần test cần đọc. Agentmemory recall không có kết quả phù hợp.

### Bằng chứng đang có

- RED security: hai test cũ thất bại khi thêm `expect.hasAssertions()`; cả hai đã trả về mà không có assertion. Log local: `output/r00-security-red.log`.
- RED API mock: endpoint chưa khai báo trả thành công, trái với `rejects.toThrow`. Log/trace Playwright local.
- RED → GREEN environment guard: hai Node tests chứng minh endpoint không rõ/remote/DB sai/query override bị chặn và không thừa kế provider credentials.
- Backend full-stack: 23/23 pass, 2 suites, `--detectOpenHandles`, exit 0, không force-exit. Lần kiểm tra đầu còn phát hiện Prisma đọc `.env`; đã chặn riêng loader env trong harness, giữ runtime Prisma/DB thật.
- Teardown harness đóng thêm Redis client do cấu hình cache `store` cũ không được lifecycle `stores` v6 quản lý. Việc sửa wiring cache production thuộc R10; lượt này không tuyên bố đã sửa nó.

### Quan sát cần theo dõi ngoài R00

- A01: login lỗi có thể chọn ngôn ngữ theo user.language nếu tài khoản tồn tại, còn email thiếu dùng Accept-Language/default. Thực nghiệm cùng request không header trả thông báo EN cho user EN và VI cho email thiếu. Case R00 so thông báo ở cùng locale EN; khác biệt locale mặc định vẫn còn và cần triage về user enumeration.
- A02: cấu hình cache AppModule tạo `cache-manager-redis-yet` qua `store`, trong khi Nest cache-manager hiện dùng `stores`. Cần kiểm chứng cache có thực sự dùng Redis giữa hai replica và sửa lifecycle ở R10/R14.

**Mốc kết thúc R00:** R01 là gói kế tiếp lúc nghiệm thu R00; đã triển khai tiếp ở phần dưới. M13 còn phần CI/coverage R10. Kết quả lịch sử R00 ở [báo cáo R00](quality/R00-REPORT.md).

### Review cuối của R00

- Reviewer độc lập không thực thi được do model báo usage limit; không có review độc lập thành công. Thay bằng lượt self-review riêng, không đánh dấu review độc lập DONE.
- Self-review tìm ra test mock Page dùng type quá rộng và route hiện tại trả `Disposable`; đã sửa stub theo đúng interface, không ép sang Page đầy đủ.
- Self-review siết HTTP method/fixture connection của các endpoint đã khai báo; webServer không reuse server cũ để tránh dùng sai VITE_API_URL.
- `npm run test:e2e` không có E2E URL đã được chạy và từ chối trước khi boot suite (exit 1, 0 test). Đây là negative guard check, không phải full gate pass.
- Client unit lần đầu: 141 pass/1 timeout tại AiConfigTab trong lúc nhiều gate chạy đồng thời. Lần chạy lại nguyên lệnh đạt 142/142, exit 0. Không tăng timeout/retry hoặc sửa assertion; chưa coi một lần rerun pass là đã sửa hết flakiness.
- GitNexus refresh incremental thất bại vì `file_fts` inconsistency. Full rebuild `--force --index-only --name Data-Explorer-Workspace --workers 4` thành công, exit 0: 6.824 nodes/18.114 edges/274 flows. Sau warmup, context theo UID đúng và impact của mockAuthApi là LOW, một caller cùng file. detect_changes cuối trả LOW, 8 tracked files, 5 symbols, 0 production flows. Các file mới được review thêm bằng Git/status và source, không suy từ detect_changes.
- Final gate: Node guard 2/2; API full-stack 23/23; server unit 563/563; client unit 142/142; browser mock 58/58; typecheck server và test TS client, focused lint hai phía và diff whitespace đều exit 0.
- Teardown hậu kiểm trên fixture mới: user 0, connection 0, PostgreSQL app session 0; Redis không có app connection/subscriber. Docker fixture được dọn riêng sau khi kiểm tra ownership.
- Final self-review: không tìm thấy Critical/Important còn mở trong phạm vi R00. Deferred ngoài gói: A01/A02 ở trên; các remediation R01–R14 giữ TODO. Chưa có independent review/remote CI/release gate cho toàn sản phẩm.

## R01 — VERIFIED_LOCAL

Phạm vi hiện tại: M01/M02 trong ranh giới connection/metadata/sample/pool và guard ghi của QueryService. Đã sửa production backend; không thay frontend, dependency/lockfile, schema/migration. Chưa commit/push/deploy. [Báo cáo chi tiết](quality/R01-REPORT.md), [manifest](quality/r01-verification.json).

### Cách sửa và impact

- Thêm `ConnectionsService.authorizeAccess` dùng `findRawOne` + PermissionsService + `assertTeamConnectionAccess`; xác minh quyền hiện tại trước cache/pool. Không tạo hệ quyền song song, không cache quyết định phân quyền theo JWT.
- Metadata kiểm quyền trước đọc cache; filter database theo whitelist hiện tại. Chọn database hợp lệ vẫn hoạt động nếu database mặc định bị cấm. Chỉ enumeration metadata được bỏ qua database mặc định, không áp ngoại lệ này cho pool/query.
- NoSQL sample/refresh phải có quyền connection/database và query-enabled trước Redis get/del. Readonly write guard không còn phụ thuộc có chuỗi SQL; insert/update/delete/schema/import/seed/create/drop cùng policy và giữ Forbidden khi bị từ chối.
- Impact trước sửa: getPool CRITICAL (19 caller, 5 module trong snapshot trước sửa); đã cảnh báo trước sửa. Guard ghi MEDIUM (8 caller); method chuyên biệt LOW; Connection entity MEDIUM (3 caller). Giữ concurrency/pending-pool/cleanup và contract cũ.
- Full rebuild cuối: 6.841 nodes/18.222 edges/274 flows, exit 0. Context authorizeAccess nhận đúng 9 caller trực tiếp. Impact getPool cuối CRITICAL, 18 caller trực tiếp/49 symbol upstream/5 module. `detect_changes(all)` trả LOW, 19 tracked files/35 symbols/0 recognized flows; đây không phải bằng chứng production ít rủi ro. Các file mới và runtime được kiểm tra riêng, không suy 0 flow thành không ảnh hưởng.

### Regression và gate cuối

- Đã quan sát test đỏ: warm pool/cache, sample cache, readonly structured insert, database list, metadata mở nhầm database mặc định, schema operations rỗng bỏ qua database guard. Các regression tương ứng pass sau sửa; không tăng timeout/retry, skip hoặc hạ assertion.
- Lần API đầu có ba lỗi fixture: dùng sai method/path xóa row/schema và enum permission viết hoa. Đã sửa theo controller/enum hiện tại; ghi là lỗi harness, không phải ba lỗi sản phẩm.
- Server unit: 580/580, 82 suites, exit 0. API: 33/33, 3 suites (10 test R01 + 23 test R00), kèm 2 Node environment guards, exit 0; tự thoát với detectOpenHandles.
- TypeScript gồm specs: exit 0. Server build: exit 0. Focused ESLint 12 file TS của R01: exit 0. Whitespace diff được kiểm tra riêng sau khi hoàn tất tài liệu.
- Backend thật: PostgreSQL app DB, Redis và SQLite synthetic; HTTP guards/controllers/permissions thật. K02 là cache negative-path synthetic, không phải integration MongoDB. JWT R01 ký bằng JwtService thật cho fixture user; password login thuộc suite R00.
- Hậu kiểm trước cleanup: User 0, Connection 0, PostgreSQL app session 0; Redis chỉ còn client hậu kiểm, không subscriber/app client. Xác minh compose ownership rồi dọn riêng project fixture; sau cleanup còn 0 container và 0 listener trên hai cổng fixture.

### Review và giới hạn còn lại

- Reviewer độc lập không chạy được do usage limit; không có kết quả review độc lập. Self-review riêng phát hiện và sửa lỗi selected database và schema operations rỗng, có test đỏ/xanh tương ứng.
- Chưa chạy UI/browser/provider thật trong R01; kết quả frontend/browser R00 là bằng chứng lịch sử. Chưa đo lại lines/branches hoặc tỷ lệ phủ workflow; không gọi 580 tests là coverage toàn sản phẩm.
- Chưa chứng minh multi-replica Redis cache production (A02/R10), mọi engine, native SQL cross-catalog/read-only semantic (R03), hoặc export/AI full-stack. AiConnectionService vẫn có nhánh bọc denial thành lỗi 500/null, chưa thống nhất UX lỗi (M20/R10), nhưng pool từ chối trước schema gather.
- R02 backup tổ chức và R03 SQL read-only bypass vẫn P0; chưa release-ready. A01 login locale và các mục R04–R14 giữ mở theo roadmap.

**Mốc kết thúc R01:** R02 là gói kế tiếp tại thời điểm nghiệm thu R01; đã thực hiện tiếp ở phần dưới. Không đánh dấu toàn roadmap DONE.

## R02 — VERIFIED_LOCAL

Contract: full organization backup chỉ OWNER/ADMIN, cùng guard với restore theo roadmap đã chốt. Không mở rộng thành partial export theo resource. [Báo cáo R02](quality/R02-REPORT.md), [manifest](quality/r02-verification.json). Chưa commit/push/deploy.

### Quyết định và phạm vi

- Ruling: ưu tiên contract OWNER/ADMIN trong roadmap hiện tại thay vì triển khai filter từng resource từ đề xuất audit cũ. MEMBER/VIEWER không được full export; chủ sở hữu/quản trị có full backup theo vai trò. Chi phí nếu cần partial export: cần task/contract riêng, không âm thầm thay đổi package trong R02.
- Dùng lại `ensureOwnerOrAdminAccess` trước query artifact; xóa helper member-only không còn caller. Không sửa restore algorithm/package version/schema/dependencies.
- UI hiện lời giải thích Việt/Anh cho role thấp, không có controls export/restore; hai handler giữ guard. Textarea có accessible name; ba nút panel tối thiểu 44px sau browser RED vùng bấm export 40px.
- Impact trước edit: export LOW nhưng partial/0 caller không khớp context controller; helper xóa LOW/1 direct caller; TeamPage/handlers LOW. getTeamText CRITICAL, 12 caller/8 flow: đã cảnh báo trước sửa, chỉ thêm key và chạy full client unit.

### Test và review

- Đã xem RED unit và API thật: MEMBER/VIEWER nhận backup 200 thay vì 403 dù query list rỗng. Sau sửa full API pass 41/41 = 23 R00 + 10 R01 + 8 R02; kèm 2 Node environment guards, exit 0/detectOpenHandles, không force-exit.
- E07 round-trip OWNER/ADMIN đối chiếu SQL, snapshot dashboard, ERD layout và chính xác policy/teamspace mapping trong PostgreSQL. MEMBER/VIEWER vẫn không đọc được query sau restore. Sentinel password/SSH key connection không có trong package. Demote ADMIN với JWT cũ chặn hai endpoint và không tăng số query.
- Full backend unit 584/584, 82 suites; full client unit 146/146, 47 suites; exit 0. TypeScript server gồm spec, build server và build client (TypeScript/Vite/budget/prerender) exit 0. Focused lint 3 file server/4 file client exit 0.
- Browser mới 8/8 trên Chromium/Firefox, viewport 1280/390px, mock API strict; keyboard tab/download, lời giải thích role thấp, error 403, không tràn ngang, export target >=44px và axe panel pass. Chưa chạy full browser suite/browser nối backend thật hoặc iOS/WebKit trong R02.
- Lỗi harness ban đầu được sửa riêng: fixture organization thiếu, click trước initial effects, stringify policy key-order, role type chưa thu hẹp. Không coi đó là lỗi sản phẩm; không giảm assertion/coverage hay tăng timeout/retry.
- Self-review riêng source/callers/contract/evidence; không có independent review thành công sau lỗi hạn mức ở lượt trước. Không tuyên bố đã có reviewer độc lập mới.
- Full graph rebuild exit 0: 6.866 nodes/18.314 edges/274 flows. Context sau refresh nhận export gọi guard OWNER/ADMIN; impact export LOW/1 caller controller. detect_changes(all) CRITICAL, 23 tracked files/41 symbols/18 affected cho diff gộp R00/R01/R02; giữ cảnh báo rủi ro, không coi graph là test runtime.

### Hậu kiểm và việc còn mở

- Fixture PostgreSQL: 0 user/connection/query/dashboard/widget/ERD/teamspace/policy/organization, 0 app session; Redis không app client/subscriber. Đã kiểm ownership rồi dọn riêng compose: 0 container/listener test, browser server cũng đóng.
- Chưa test restore package malformed/legacy/khổng lồ, failure injection/rollback hoặc đổi role giữa một request; restore không được tuyên bố transaction all-or-nothing. Full admin backup không tự redaction bí mật do người dùng viết trong SQL/settings/snapshot.
- Chưa đo lại lines/branches hoặc tỷ lệ phủ workflow; chưa chạy full dependency/container/remote CI/release gate. R03 bypass SQL read-only vẫn P0, các mục R04–R14/A01/A02 tiếp tục mở.

**Bước tiếp theo:** R03, bắt đầu từ repro S09/read-only và adversarial SQL regression trước khi sửa parser/driver policy.

## Sắp xếp tài liệu — 22/10/2026

Theo yêu cầu người dùng, chuyển roadmap/progress và toàn bộ evidence portable vào `docs/roadmap/`, giữ `quality/` bên trong để report, manifest và baseline đi cùng nhau. README gốc có link truy cập; `.gitignore` chỉ mở ngoại lệ cho thư mục mới. File hướng dẫn công cụ và tài liệu cũ ngoài bộ này giữ nguyên vị trí.

Đã cập nhật liên kết tương đối và đường dẫn canonical; manifest lưu đường dẫn mới, giữ originalPath/originalSha256 khi cần để không mất snapshot trước di chuyển. Source/test và kết quả R00/R01/R02 không đổi. Lượt này chỉ kiểm link, JSON, hash và diff tài liệu; không chạy lại test sản phẩm hoặc bắt đầu R03.

## Bổ sung quy tắc thiết kế — 22/10/2026

Theo yêu cầu người dùng, thêm OOP, đủ năm nguyên tắc SOLID, YAGNI, KISS, DRY và nesting vào Global Constraints của roadmap; gắn vào bước sửa/review, mẫu báo cáo và Definition of Done để các lượt sau phải đối chiếu. Nesting hướng tới tối đa 2 tầng control-flow; trên 3 tầng cần cân nhắc làm phẳng/tách bước, hoặc ghi lý do giữ nguyên lifecycle. Không ép class/interface/abstraction, không refactor ngoài scope và không bỏ validation/quyền/cleanup để đạt chỉ tiêu hình thức. Đây là quy tắc review; chưa thêm lint rule hoặc audit toàn bộ code cũ. Chỉ cập nhật tài liệu và hash evidence, không thay source/test hoặc trạng thái R03.

## Tra cứu thêm skill và quy tắc coding — 22/10/2026

Tra danh mục chính thức bằng helper skill-installer: 39 curated skills; đối chiếu file các skill đang có và đọc SKILL.md remote của gh-fix-ci/security-best-practices. Hai ứng viên chưa cài/chưa chạy, không thay cấu hình global. Không dùng danh sách thư mục skills cục bộ đơn thuần để kết luận tool đã kết nối.

Roadmap bổ sung C01–C10: type/invariant, trust boundary, atomicity/idempotency, bounded async/cleanup, error contract, React state/effect, logging kín dữ liệu, test hành vi cô lập, đo hiệu năng và diff/compatibility/version. Nguồn liên kết trực tiếp là TypeScript, React, Google Engineering Practices, OWASP, PostgreSQL 16 và Playwright. Docs Prisma hiện chuyển sang ORM 8 trong khi package pin 6.19.3: không chép API mới hoặc tự nâng major; quy tắc transaction chỉ dựa khái niệm/version phù hợp. Node v22 docs không mở được qua web tool trong lượt này nên không dùng làm nguồn xác minh API.

Có bảng chọn skill/trigger/output, ưu tiên skill hiện có; gh-fix-ci chỉ cân nhắc cho R10 với GitHub Actions/auth/authorization phù hợp, security-best-practices chỉ khi yêu cầu bảo mật rõ và không trùng scan hiện có. Gắn C01–C10/skill vào bước đóng scope, báo cáo và DoD. Chỉ cập nhật tài liệu/manifest, không thêm lint tự động, chạy test sản phẩm hoặc triển khai R03.

## Chọn skill global cho roadmap — 22/10/2026

Đối chiếu entrypoint đã cài với scope Rxx, thêm bảng 11 nhóm skill và alias `grill-me` vào roadmap. Bảy nhóm dùng theo trigger: UI UX Pro Max, Impeccable, grilling, codebase-design, domain-modeling, writing-for-agents và handoff Matt Pocock. Gắn chỉ dẫn trực tiếp vào R11/R12 và quyết định entitlement R13. Không mở giai đoạn hay thay ưu tiên: R03 read-only/destructive policy vẫn là bước triển khai tiếp theo.

TDD và diagnosing-bugs chỉ bổ sung phần hướng dẫn còn thiếu cho workflow hiện có. Code-review Matt mặc định đọc diff đã commit và dùng agent song song, nên chưa chứng nhận working tree hiện tại; baseline/spec/tracker và quyền delegation phải đủ trước khi dùng. Improve-codebase-architecture chỉ theo yêu cầu module/hotspot đã chốt, không tự mở audit toàn repo. Caveman là tùy chọn giọng trả lời; AgentSkills là đặc tả. Các orchestrator/tracker/setup không thành quy trình mặc định chỉ vì đã cài.

`writing-for-agents` được áp dụng cho cập nhật tài liệu này. Việc đọc những entrypoint khác để chọn workflow không phải đã thực thi hoặc nghiệm thu chúng. Bản cài global là kết quả của lượt cài riêng; lần này chỉ sửa roadmap, ledger và hash manifest. Giữ nguyên source/test, kết quả R00/R01/R02 và trạng thái R03–R14; không chạy lại test sản phẩm, commit/push hoặc đổi cấu hình global.

Kiểm chứng tài liệu: 148 link/anchor nội bộ hợp lệ, 39 dòng hash file/artifact trong các manifest khớp, 11 entrypoint được chọn khớp hash và 36 file đang sửa ngoài phạm vi docs giữ nguyên. JSON parse, trailing whitespace và `git diff --check` đều đạt; các cảnh báo CRLF của file cũ không phải thay đổi trong lượt này. Đây là kiểm tra tài liệu, không đo lại coverage hoặc chạy acceptance UI.

## R03 — triển khai và bằng chứng RED ban đầu

Mốc lịch sử lúc bắt đầu triển khai; xem kết quả gate cuối và trạng thái hiện tại ở phần R03 phía dưới.

Tiếp tục trong checkout `codex/roadmap-r00`, HEAD gốc `3d7ec60845ddc2a07284c2873d9d3727acd30744`, kế thừa R01/R02 chưa commit; không reset/stash hoặc mở worktree thiếu các sửa phụ thuộc. Dùng executing-plans, systematic-debugging và TDD. GitNexus/Codegraph/Semble đối chiếu guard và call path; agentmemory recall không trả kết quả cho R03/S08/S09.

Ruling: dùng một scanner lexical có giới hạn cho comment/quote/batch và projection phân loại code; không thêm parser dependency hoặc quảng bá thành parser đầy đủ mọi dialect. Các dạng không xác định an toàn (backslash quoting, executable/nested comment, quote chưa đóng) phải bị từ chối rõ. Postgres dollar quote, doubled quote, backtick và bracket identifier được ghim bằng regression; input raw của statement vẫn được giữ cho driver.

Impact trước sửa: normalizeSql LOW/3 caller trực tiếp, splitter LOW/3, analyzeDestructiveSql LOW/1, isSqlAllowedOnReadOnly LOW/1; cùng tác động luồng assertQueryAllowed. assertQueryAllowed LOW/1 caller trực tiếp theo graph; graph không chứng minh rủi ro runtime thấp. Target enforceExecutionGuards không tồn tại; đã tra lại method thực. Repro mới 21 FAIL/4 PASS trước sửa, log tại `output/roadmap-r03/guard-red.*` (bị ignore).

Đã sửa bước đầu scanner và guard; focused regression mới qua, nhưng suite mở rộng còn đỏ do các test cũ coi keyword nằm trong literal/identifier là write, và yêu cầu splitter/normalizer luôn thành công trên cả cú pháp lỗi. Chưa nghiệm thu: cần đối chiếu contract/test semantics với engine thật, hoàn tất Mongo/Redis policy, native read-only khi khả thi, browser confirm/cancel và gate cuối. Không đổi timeout/retry/skip/threshold hoặc bỏ case để làm xanh.

Docker Desktop ban đầu chưa có daemon; đã yêu cầu khởi động app và `docker version` sau đó trả server 29.8.1. Chưa chạy fixture/migrate trong mốc này. Lượt đầu chạy test chưa thực thi do đặt sai đường dẫn log, đã chạy lại và có exit 1 thật. Lệnh gộp có xóa thư mục rỗng `server/output/roadmap-r03` bị policy chặn; thư mục được giữ nguyên, không vòng qua lệnh xóa bị chặn.

## R03 — VERIFIED_LOCAL

**Ngày nghiệm thu local:** 23/10/2026. [Báo cáo chi tiết](quality/R03-REPORT.md), [manifest](quality/r03-verification.json). Cùng branch/HEAD gốc với các gói trước; không commit/push/deploy.

### Contract và implementation

- Guard xét toàn batch trước pool bằng scanner lexical có giới hạn, giữ raw SQL cho driver. Comment marker/literal/quoted identifier không che statement ghi; CTE/opaque write và WHERE trong dữ liệu không né confirmation. Literal keyword vẫn đọc được; cú pháp lexical không hỗ trợ trả lỗi rõ.
- PostgreSQL/MySQL/SQLite chạy mọi SQL classified-read trong native read-only, cả connection writable có VIEWER READ/không WRITE ở default/full mode. Query count và table window có flag. Explicit write vẫn cần WRITE và confirmation theo tác động; `confirmed:true` không vượt role/connection policy.
- Mongo dùng lại sanitizer/validator, duyệt tập pipeline hỗ trợ và nested `$lookup`/`$facet`; chặn `$out/$merge` và stage không biết. Redis dùng chung whitelist command hiện có. Không thêm dependency/schema hoặc đổi ngân sách test.
- Independent review tìm hai Important gap còn hở và re-review tìm alias MariaDB. Parent sửa cả hai tên loại mysql/mariadb, ghim RED trước sửa và full gate sau sửa; không có lượt review độc lập thứ ba. Đây là các đường hở trước R03, không gán là regression mới.

### Gate cuối và khác biệt bằng chứng

- Backend unit **640/640**, 85 suites; client unit **146/146**, 47 files; API thật **60/60**, 5 suites = 19 R03 + 41 R00/R01/R02; environment guards **2/2**; từng process exit 0, không force-exit.
- HTTP PostgreSQL 16/MySQL 8.4: chặn side-effect function và quoted-comment DELETE, quyền VIEWER thực/counter count, đọc lại sau denial, confirmation cho writable batch và rollback khi statement thứ hai lỗi. MongoDB 7 không tạo output `$out/$merge`; Redis 7 giữ key sau SET bị deny. SQLite native mode kiểm in-memory thật, khôi phục query_only.
- Browser strict API mock **2/2**, Chromium 20,1s/Firefox 31,3s: AI→review→insert→execute→cancel→execute→confirm; hủy không phát confirmed request, confirm đúng một request. Không phải browser nối backend thật.
- TypeScript server gồm specs, server build và client build TypeScript/Vite/budget/prerender exit 0; lint 15 server TS + 1 browser spec exit 0. Lint ban đầu chỉ ra type cast thừa trong test; giữ assertion và rerun full unit/typecheck/lint sau bỏ cast.
- Giữ RED lịch sử: lexical 21 fail, policy 9 fail, review bổ sung 8 fail, alias MariaDB 5 fail. Native HTTP đầu MySQL có tác dụng ghi thật đã chặn; status expectation/import fixture/SQLite reentrant busy được phân biệt là lỗi harness.
- Browser có timeout trước khi dừng fixture; client full đầu 145/146 do timeout AiConfigTab 5 giây, diagnostic 7/7 rồi full cấu hình cũ 146/146. Không tăng timeout/retry, skip, giảm runs/assertions/coverage scope. Những lần fail này vẫn là bằng chứng nhạy điều kiện chạy, chưa đủ kết luận hết flake.

### Scope, cleanup và giới hạn

- Interface impact HIGH/22 direct references/7 implementations được cảnh báo trước sửa; scanner sau refresh LOW/4 caller. detect_changes(all) **CRITICAL**, 36 tracked files/84 symbols/23 affected processes cho diff gộp R00–R03; không thay test runtime bằng graph hoặc tự tích hợp diff lớn.
- 33 file đang sửa ngoài scope giữ hash; ba file protected thay đổi đúng dự kiến. GitNexus tự cập nhật count trong AGENTS.md/CLAUDE.md, không thay quy tắc. Source/test hash của các mốc cũ giữ lịch sử; chỉ refresh hash tài liệu canonical có thay đổi.
- Hậu kiểm 0 user/connection/organization/app session và table/function R03 PostgreSQL; không MySQL fixture table/function, Mongo r03 database hay Redis r03 key; Redis chỉ client hậu kiểm. Xác minh ownership, dừng/xóa riêng bốn container/network fixture; 0 container/0 listener test. Thư mục rỗng bị policy chặn xóa được giữ, không bypass.
- Chưa đo coverage lines/branches/workflow; chưa native engine MariaDB độc lập/MSSQL/ClickHouse, mọi UDF/extension/dialect mode, mobile/WebKit/a11y toàn trang, benchmark transaction đọc, full dependency/container/remote CI/release gate. SELECT có tác dụng ghi nay bị từ chối có chủ ý. F4 chỉ có prevention engine cho `$out/$merge`, không tuyên bố mọi nesting trước sửa đã exploit.

**Bước tiếp theo:** R04 — typed row identity/composite key. Gate A và các mục R04–R14 còn mở; R03 local pass không chứng nhận toàn sản phẩm sẵn sàng phát hành.

## R04 — điểm bắt đầu (lịch sử)

Tiếp tục ngày 23/10/2026 trên `codex/roadmap-r00`, HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`, kế thừa R00–R03 chưa commit. Snapshot 64 file trước R04 tại `output/roadmap-r04/before.json`; giữ các file ngoài scope, không reset/stash/commit/push. Dùng executing-plans, TDD, GitNexus/Codegraph/Semble; baseline full server/client đang chạy, mọi kết quả R03 vẫn là snapshot lịch sử.

Ruling: dùng progress ledger hiện có và mục R04 trong ROADMAP làm brief/spec, không chạy helper task-start vốn đòi format Task N không có trong roadmap. Tiếp tục checkout hiện tại theo lựa chọn đã dùng ở các gói trước để giữ dependencies chưa commit; không cài lại dependencies hoặc dựng worktree thiếu R01–R03. Chi phí nếu cần tách diff: phải tách các concern có kiểm chứng sau khi hoàn tất, không được xem toàn diff là chỉ R04.

Pre-flight: UI selection/edit/bulk-replace dùng state key, adapter chuyển payload, DTO/service kiểm trust boundary, strategy bind SQL và kiểm affected rows đều dùng cùng identity. Lỗi hiện tại: UI chuyển string key sang Number; metadata chỉ lấy cột PK đầu; server tin pkColumn client gửi và không kiểm số hàng tác động. ClickHouse có PK không đảm bảo uniqueness và count mutation ước lượng; Mongo BSON `_id` không được phân biệt khỏi chuỗi hex chỉ bằng JSON string.

Ruling: giữ legacy pkColumn/pkValue(s) cho caller khóa đơn; bổ sung tuple identity đầy đủ làm contract mới, legacy projection phải khớp tuple. Legacy chỉ hợp lệ nếu metadata thật có đúng một PK. Không giải mã state key thành khóa database. UI giữ snapshot tuple gốc cho edit/selection; mọi hàng phải có đủ PK scalar an toàn. Server kiểm metadata PK thật, từ chối no-PK/missing/extra/duplicate/unsafe key và rollback count mismatch. Đường chưa bảo đảm identity/engine phải chặn rõ và ghi CONTAINED, không đánh dấu composite support đã DONE cho engine đó.

Kế hoạch R04: (1) baseline và RED G01/G02 ở hook + SQLite/HTTP; (2) tuple contract + server validation/predicate + transaction/count check; (3) UI state/selection/bulk-replace dùng đủ key, giữ dữ liệu gốc và báo lỗi thay vì success giả; (4) API PostgreSQL/MySQL/SQLite + browser UI, full suites/typecheck/build/lint; (5) review độc lập toàn phạm vi R04, sửa finding quan trọng, báo cáo/manifest và trạng thái đúng bằng chứng. Không thay timeout/retry/assertions/coverage scope.

Impact trước sửa: IDatabaseAdapter CRITICAL/10 direct references/10 flow; UpdateRowParams và DeleteRowsParams HIGH/15 direct references mỗi kiểu, đã cảnh báo. useDataGridEditing LOW/1 direct/2 flow; DataGrid/DataGridRow disambiguate Function, LOW/1 caller mỗi symbol; adapter/DTO/QueryService/driver mutation targets LOW theo graph (0 không phải chứng minh không có dynamic caller). Phạm vi dự kiến chạm DTO, hai interface, adapter, hook/UI, bốn SQL strategies và tests/fixtures tương ứng; không sửa thuật toán import/insert/AI.

## R04 — VERIFIED_LOCAL, có containment

**Ngày nghiệm thu local:** 23/10/2026. [Báo cáo chi tiết](quality/R04-REPORT.md), [manifest](quality/r04-verification.json). Goal R04 giữ nguyên phạm vi, cùng branch `codex/roadmap-r00`/HEAD gốc `3d7ec60845ddc2a07284c2873d9d3727acd30744`; R00–R03 là thay đổi kế thừa chưa commit. Không commit/push/deploy.

### Contract và implementation

- UI giữ giá trị gốc trong full tuple, state key tách khỏi DB key. `"001"` và `"1"` không bị Number-coercion; `(A,1)/(A,2)/(B,1)` không trộn pending/selection/bulk replace. Scope generation ngăn request bảng cũ xóa sửa mới; save dừng khi lỗi và giữ đúng pending chưa thành công.
- DTO/adapter/service/SQL drivers cùng tuple contract, legacy projection phải khớp metadata PK thật. Reject no-PK/missing/extra/duplicate/unsafe key; cột update phải đúng metadata, không đổi PK qua alias/pseudo-column. Predicate bind đủ tuple; mismatch count trả 409 và rollback.
- Native bigint SQLite đọc bằng safeIntegers rồi serialize số lớn thành chuỗi; MySQL big-number strings; SQLite metadata đủ composite và schema main tránh TEMP shadow. MySQL giữ metadata lock trước kiểm InnoDB và DML. MSSQL sửa metadata join và binding tuple/transaction, nhưng chưa native engine.
- Containment công khai: temporal, exact numeric đã trở thành JS number, unsupported key types, MySQL non-InnoDB và structured row mutation Mongo/Redis/ClickHouse. PG/MySQL exact decimal strings và PG UUID native vẫn có proof. Không gán composite toàn engine là DONE; phần mở rộng và SQLServer native còn mở trong R04.

### Bằng chứng và review

- Baseline trước R04: **640 server/146 client**, exit 0. RED đầu: SQLite 6 fail; hook 4 fail/1 pass; service 5 fail/1 pass; HTTP 8 fail/13 pass. Có RED bổ sung schema shadow, duplicate canonicalization và lifecycle UI.
- Review độc lập tìm 4 finding: timestamp precision, nontransactional MySQL, alias vượt cấm PK và GUID SQL Server; lượt review lại xác nhận bốn sửa rồi tìm decimal precision loss. Parent ghim RED trước sửa: review service 5 fail/7 pass, UI temporal 1 fail, HTTP 2 fail/21 pass; decimal service 4 fail/12 pass và UI 1 fail/9 pass. Không có kết luận độc lập lượt ba trong gói bằng chứng; parent full unit/native API sau sửa decimal.
- Gate cuối: **666/666 backend unit (88 suites), 156/156 client unit (48 files), 86/86 API thật (6 suites = 26 R04 + 60 kế thừa), 2/2 environment guards, 12/12 browser mock Chromium/Firefox (10 R04 + 2 R03)**. Từng process exit 0, không force-exit. Exit JSON được ghi để kết quả vẫn kiểm lại được sau khi session handle hết hạn.
- Native HTTP kiểm PG/MySQL/SQLite composite update/delete, legacy text, bigint không mất precision, stale delete rollback; thêm UUID PG native, DECIMAL(19,18) hai giá trị rất sát nhau PG/MySQL, PG timestamp collision bị chặn và MyISAM bị từ chối trước DML.
- Server TypeScript gồm specs, Nest build, client TypeScript/Vite/bundle budget/prerender và lint **18 server + 8 client/browser TS** đều exit 0; không warning lint. Browser giữ timeout 60s/retry 0/worker 1. Lượt đầu browser 5 pass/3 fail (2 locator Scope và 1 Loading); giữ trace/screenshot, sửa locator role và kiểm lại, không đổi ngân sách.
- Hai matcher R03 native SQLite chuyển sang rejection có mã `SQLITE_READONLY` sau diagnostic cross-realm native Error; vẫn giữ assertion dữ liệu không đổi/query_only restore. Unit fixture metadata được bổ sung cột thực; linter bắt biến thừa/cleanup assert. Không giảm validation/coverage để có green.

### Thiết kế, skill và scope

- Giữ strategy OOP và shared utility; SOLID/YAGNI/KISS/DRY được đối chiếu theo invariant/caller, không thêm framework capability hoặc class hierarchy. C01/C03–C06/C08/C10 có regression tương ứng; C02 permissions kế thừa được kiểm lại qua full API. C07 giữ log/error primitives; C09 chưa benchmark transaction/metadata overhead. Nesting transaction/cleanup giữ thứ tự rollback/release, ghi ngoại lệ thay vì tách wrapper hình thức.
- Dùng executing-plans/TDD/systematic-debugging/verification-before-completion, requesting-code-review, GitNexus impact/CLI, Codegraph/Semble, Ponytail; Impeccable kiểm hẹp grid và writing-for-agents cho tài liệu. Detector nguồn grid/hook/identity trả `[]`, không phải chứng nhận a11y. Không cài/nâng tool global để làm task này.
- Impact sau refresh: getRowIdentity **HIGH**, 3 caller trực tiếp/luồng DataGrid, đã cảnh báo trước sửa; assertPrimaryKeyIdentities LOW/1, MySQL runRowMutation LOW/2, QueryService update/delete LOW/1. Đồ thị dynamic callers có thể thiếu. Trước format/index mới, private prepareRowMutation chưa được resolve nên không dùng kết quả thiếu làm “LOW/0”. Rebuild chính thức sửa FTS inconsistency của index, không nâng package.
- Protected baseline 64 file và source snapshot 26 file được đối soát bằng SHA-256 ở manifest. Source hash R00–R03 vẫn là lịch sử, không rewrite cho khớp tree mới; chỉ refresh hash tài liệu canonical khi tài liệu đã thay đổi. `.zcode/` ngoài scope giữ nguyên.
- GitNexus cuối index **7024 nodes/18702 edges/275 flows**. `detect_changes(all)` và `detect_changes(compare, main)` đều **CRITICAL: 47 tracked files/169 symbols/37 processes** cho diff gộp R00–R04; untracked source được review riêng trong manifest 26 file. AGENTS.md/CLAUDE.md chỉ tự đổi count của index, không đổi quy tắc.

### Cleanup và việc còn mở

Fixture dùng synthetic user/database/table/key và loopback riêng. Hậu kiểm 0 User/Connection/Organization và 0 table R03/R04 PostgreSQL; không MySQL fixture table, Mongo database hay Redis key tương ứng. Dừng/xóa riêng 4 container/network do task dựng; proof listener/container cuối được lưu ở manifest. Scratch SQLite của từng suite được đóng/kiểm real path rồi teardown; giữ log/trace làm evidence. Thư mục rỗng R03 từng bị automatic approval review chặn xóa được giữ nguyên, không thử vòng qua.

Chưa đo lại coverage%; chưa native MSSQL/MariaDB/Cockroach, mobile/WebKit/full-page a11y, optimistic row-content concurrency, benchmark, mọi trigger/DDL/external side effect, remote CI hoặc release gate. Multi-row UI save có thể thành công một phần theo contract đã báo, không phải một transaction chung. UI nhỏ/toast chồng vùng header được ghi cho R11/R12.

**Bước tiếp theo:** R05 — migration stream/failure lifecycle theo dependency và impact. Các P0 khác/Gate A còn mở; VERIFIED_LOCAL của R04 không phải chứng nhận release toàn sản phẩm.

## R05 — VERIFIED_LOCAL

Goal bắt đầu 23/10/2026: migration stream/callback và failure lifecycle, theo acceptance R05 trong ROADMAP. Tiếp tục branch `codex/roadmap-r00`, HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`, giữ R00–R04 chưa commit. Snapshot **85 file** trước R05 ở `output/roadmap-r05/before.json`; không reset/stash/commit/push/deploy. Dùng executing-plans, systematic-debugging, TDD và GitNexus/Codegraph/Semble; baseline backend đang chạy.

Ruling: tiếp tục checkout hiện tại theo workflow R00–R04 đã được dùng và để giữ dependencies chưa commit; không dựng worktree từ HEAD thiếu remediation. Dùng roadmap R05 và ledger này làm brief/spec thay helper Task N không phù hợp định dạng Rxx. Chi phí: diff gộp cần tách concern khi tích hợp; không được gán cả diff là R05.

Pre-flight: PostgreSQL exportStream là producer, pipeline batch/import là consumer, worker quyết định BullMQ failed/completed, controller/client đọc progress ownership. Giữ public jobId/status/stage/ticket, source READ/target WRITE; fail không được biến thành success. Không thêm resume/rollback migration tổng thể. Ngắt/restart cùng job phải bị từ chối rõ nếu không chứng minh tiếp tục an toàn.

Impact trước sửa: PG exportStream LOW/1 direct (Cockroach subclass), runMigrationPipeline LOW/1 direct worker, resolveMigrationContext LOW/2 direct (preview/pipeline), processor.process LOW/0 theo graph; dynamic queue/stream dispatch không được coi là không có caller. Codegraph xác nhận producer/consumer/worker path; installed pg 8.18.0 query_timeout wrapper gọi callback của Submittable trong khi exportStream chưa cung cấp callback.

Kế hoạch: (1) promote child-process native PG crash/deadline repro và lifecycle unit RED; (2) sửa stream callback/cleanup, context setup cleanup và fail propagation/progress terminal/replay guard; (3) native integration 5 rows/multi-batch/checksum/source-target errors/interrupt-retry/ownership và resource assertions; (4) full relevant gates, một review độc lập cuối, sửa finding bằng RED→GREEN, report/manifest và roadmap chính xác.

### R05 — triển khai trước final review

- Baseline server **666/666**, 88 suites, exit 0. Repro child-process native PG **3/3 FAIL**: đọc 5 rows, missing source và deadline đều thấy `TypeError: queryCallback is not a function`; không giết Jest/API của parent. Sau callback fix và giữ server/client deadlines: **3/3 PASS**, child/pool đóng, không dùng global uncaught-exception handler.
- Lifecycle unit RED **5/5 fail**: preflight pool leak, fake BullMQ lock failure, replay, thiếu terminal progress và close-before-end bị treo. Sau sửa 5/5 pass. RED tiếp **2 fail/5 pass** cho subscription sau terminal và retry timeout có thể duplicate; sau sửa 22/22 qua các suite liên quan. RED ack **2 fail/8 pass**, sau sửa 25/25; thêm non-Error failure regression (1 fail/10 pass) trước normalize.
- `exportStream` cấp callback thật cho pg-query-stream, release một lần sau close/error, không tắt statement_timeout. Setup context đóng cả những pool đã tạo nếu metadata/target setup lỗi. Pipeline tuần tự/backpressure, drain write đang chạy trước fail/close, không chạy queued chunk sau source failure; listener cleanup gồm close. Progress đếm rowCount thực được xác nhận; thiếu/sai acknowledgment phải failed.
- Job fail được throw về worker sở hữu lock, không gọi `moveToFailed` với token giả. Public stage/status/error và SSE terminal được cập nhật; subscription mở sau terminal tự đóng. Guard stage được lưu trước streaming từ chối stalled/manual replay để không append hai lần. Client contract giữ nguyên.
- Native HTTP/worker ban đầu đỏ do dynamic import cần Jest VM flag; đổi sang static import của dependency bắt buộc đã cài, cùng style các driver. Sau đó **5/5 API R05 PASS**: 5/4505 rows checksum đúng, source division-by-zero/target CHECK thành failed và health API còn sống, owner/ticket và completed-job retry. Không đổi Jest budget/skip/assertion để vượt lỗi harness.
- Native fault test **1/1 PASS**: commit batch rồi kill worker trước progress; BullMQ stalled recovery và manual retry đều fail rõ, no-PK target vẫn đúng 5 rows; không còn PG client theo application_name sau child đóng. Fixture worker lockDuration/stalledInterval ngắn chỉ là cấu hình fault test riêng, không thay production hoặc test budget cũ.

Ruling: không tự retry timeout/disconnect vì server có thể đã commit — chỉ giữ adaptive shrink khi driver báo lỗi tham số trước execution (MSSQL EREQUEST/8003, SQLite too-many-variables) — chi phí là cần người dùng kiểm tra target và khởi tạo transfer mới sau lỗi kết nối; tránh duplicate âm thầm. Unit cũ đã đổi timeout-success fixture thành lỗi tham số thật và ack đúng batch count, giữ assertions chunking.

Ruling: pg-query-stream là dependency bắt buộc, dùng static import để cùng contract module trong production/child/Jest — không cần sửa config VM toàn suite — chi phí tải module nhỏ khi load strategy thay vì lúc export đầu tiên.

Impact bổ sung: failJob/completeJob/getPublicJob LOW/1 direct mỗi method; controller.progress LOW/0, batch-error classifier LOW/0 theo graph nhưng có pipeline caller thực; mocks/helpers unit LOW/0 theo index. Cleanup và progress path kiểm qua unit/native thay vì suy an toàn từ zero caller. Helper startPipeline của test đã chuyển sang mô phỏng worker-owned transition trước khi ghi impact riêng; đây là thiếu sót thứ tự quy trình, không coi impact sau là bằng chứng đã làm trước.

### R05 — final review và nghiệm thu

Một final review độc lập chỉ đọc gói R05 tìm **2 Important, 0 Critical, 0 Minor**. Không thêm re-review. Parent tái hiện RED trước một lượt sửa rồi full gates:

- Socket PG: native disconnect làm child exit 1; client timeout 100 ms chỉ được quan sát sau 1068 ms (assert <750 ms fail). Nguyên nhân checked-out client không có error handler và cursor.close chờ ReadyForQuery. Sửa handler trong thời gian sở hữu client, hook Node `_destroy` hoàn tất lỗi và discard client, guard callback/release một lần; healthy cursor close giữ nguyên. **4/4 native stream GREEN**, kể cả deadline phân biệt với server 1 s và ngắt backend thật.
- Adaptive split: source lỗi trong lúc sub-batch 250 đang ghi vẫn chạy thêm 250; RED 1 fail/11 pass thấy 3 import attempts. Chia sẻ terminal flag vào vòng lặp trước từng import; **12/12 lifecycle GREEN**, chỉ ack 250/batch1, tổng 2 attempts tính cả pre-execution rejection. Drain write đã bắt đầu trước pool close.

Gate cuối source R05: **678/678 backend unit, 89 suites; 96/96 API/integration, 9 suites; 2/2 guards**. Server TypeScript gồm specs/Nest build, client TypeScript/Vite/bundle budget/prerender, ESLint 10 TS, Prettier 12 file và syntax 2 CJS đều exit 0. Không force-exit, thêm skip hoặc nới timeout/retry. Các lượt RED/intermediate giữ nguyên ở output và manifest.

Client full hồi quy có lượt đầu 155 pass/1 fail ở AiConfigTab provider-save, duration 6351 ms và VM report STACK_TRACE_ERROR khi build chạy song song. Source client R05 không đổi; focused 7/7 với cùng cấu hình. Giữ nguyên test/config/assertion và chạy lại full khi không còn build song song: **156/156, 48 files, exit 0**. Lượt fail vẫn nằm trong manifest; chưa kết luận chắc nguyên nhân tài nguyên chỉ từ phép so sánh này.

Ruling bổ sung: dùng Node stream destruction hook để không phụ thuộc portal acknowledgment trên socket lỗi; không sửa node_modules hoặc dùng private pg client flags. Typed ESLint chỉ 10 TS trong project hiện có; hai fixture CJS kiểm syntax/format, không đổi config global để che parser error. Shared strategy OOP/SOLID, DRY ở boundary, YAGNI/KISS không thêm retry framework/resume. C09 không benchmark, C06 không React change; các nguyên tắc còn lại đối chiếu với trust-boundary/async/error/regression tương ứng.

Snapshot source cuối có **12 file** và baseline **85 file** được đối soát SHA; inherited sources R00–R04 giữ nguyên ngoài PostgresStrategy trong scope, tài liệu canonical/manifest chỉ refresh artifact hash. GitNexus index cuối **7085 nodes/18814 edges/408 clusters/268 flows**; detect all và compare main đều **CRITICAL: 52 tracked files/204 symbols/46 processes** cho diff gộp R00–R05, đã cảnh báo người dùng; untracked source được kiểm riêng. Không reset/stash/commit/push/deploy; `.zcode/` ngoài scope.

Hậu kiểm 0 User/Connection/Organization, 0 bảng/view R03–R05, 0 client PG/queue riêng R05, không Mongo/MySQL fixture/key tương ứng. Đã down riêng bốn container/network của lượt test, cổng 15432/16379/17017/13306/4173 không còn listener. Giữ bằng chứng output; thư mục R03 trước đây bị policy chặn xóa vẫn giữ nguyên, không bypass.

Chi tiết contract, acceptance, review và giới hạn ở [R05 report](quality/R05-REPORT.md), [manifest](quality/r05-verification.json). Chưa đo coverage %, chưa browser R05, multi-replica SSE/fencing khi worker cũ còn sống, Redis outage/cleanup failure, whole-transfer rollback/resume, native transfer engine khác hoặc release gate. Partial/unacknowledged commit vẫn cần kiểm target; refusal replay là containment công khai. **Bước tiếp theo: R06 — entitlement giao dịch đồng thời.**

## R06 — VERIFIED_LOCAL

Goal R06 bắt đầu 23/10/2026, cùng branch `codex/roadmap-r00`, HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`. Snapshot trước sửa: **98 file** tại `output/roadmap-r06/before.json`; giữ R00–R05 chưa commit, `.zcode/` ngoài scope, không commit/push/deploy. Dùng executing-plans/TDD/systematic-debugging/GitNexus/Codegraph/Semble, final review độc lập một lượt sau triển khai.

Ruling: tiếp tục checkout hiện tại và dùng R06/ledger làm brief/spec thay workspace Task N — giữ nguyên dependency chưa commit của R00–R05 và định dạng Rxx đã áp dụng — chi phí là diff gộp cần tách concern khi tích hợp, không coi HEAD cũ đủ chứa các sửa trước.

Pre-flight: hai webhook controller MoMo/ZaloPay → `handleProviderWebhook` → provider verification → payment claim → subscription/user trong Prisma transaction. Existing conditional payment claim chặn duplicate cùng order; read/extend của các order khác nhau chưa serialize theo user. User tồn tại theo Payment FK, subscription có thể chưa tồn tại nên không thể chỉ khóa subscription row. Không network call trong transaction, không mutex trong memory, không đổi public response shape/provider amount catalog để sửa concurrency.

Impact `handleProviderWebhook`: GitNexus **LOW**, 2 caller trực tiếp `handleMomoWebhook`/`handleZaloPayWebhook`, 0 process membership được index; đây vẫn là đường thanh toán quan trọng, không coi LOW graph là rủi ro nghiệp vụ thấp. Tests/fixtures và createPrisma mock cần theo contract transaction mới; phải ghi impact trước sửa helper có sẵn.

Kế hoạch nghiệm thu:

1. Baseline unit; native PG fixture riêng và signed local-provider callbacks. Ghim RED nhiều monthly/mixed order đồng thời (có/chưa subscription), duplicate, rollback; giữ invalid signature/amount/provider boundary và delayed failed không downgrade.
2. Sửa nhỏ nhất trong transaction bằng khóa hàng User ổn định trước claim/read/extend với lock order nhất quán; không thêm schema/dependency nếu không cần. Bốn monthly credit 120 ngày, duplicate chỉ 30; hỗn hợp theo duration catalog.
3. Native hai user độc lập: giữ lock user A mà callback B vẫn kết thúc, không global lock. Test rollback payment/subscription/user và retry sau fault; provider chỉ fixture local, không bank/live payment.
4. Full relevant unit/API/type/build/static gates, một final review/fix pass RED→GREEN, rebuild/detect_changes, scope/SHA/cleanup, report/manifest/canonical roadmap.

Baseline server **678/678**, 89 suites, exit 0. Native signed-provider RED **4 fail/6 pass**: bốn monthly (có/chưa subscription), mixed monthly/yearly mất duration; valid ZaloPay callback nhận order MoMo (201 thay 400). Khóa User bằng parameterized Prisma raw query trước claim/read/extend và check provider khớp payment; unit mock bổ sung raw query sau impact createPrisma LOW/1. Native **10/10 GREEN**, billing unit **5/5 GREEN**; giữ callback verification ngoài transaction.

Ruling: mở scope R06 thêm UsersService.findById và regression liên quan — profile-expiry là writer khác có thể ghi đè quyền mới mua sau khi chờ User lock, làm user Free dù subscription đã renew — chi phí là cần full profile/auth regression ngoài billing. GitNexus findById LOW/1 direct getProfile; users spec LOW/0, nhưng tác động thực bao gồm profile entitlement. Chỉ sửa sau native RED, giữ snapshot R00–R05.

Native expiry RED: `findById` trả Free/expired sau khi payment vừa thành công. Sửa conditional expiry update trong transaction trước đọc profile mới; predicate được database recheck sau khi chờ row lock, chỉ expire subscription đúng hạn. Không trả snapshot user đã stale. Giữ lock order User → subscription như billing; không thêm schema/dependency.

Kiểm tra static ban đầu bắt test payload `unknown` không khớp Supertest và type assertion thừa ở duplicate fixture; sửa kiểu fixture/object và dùng Array.from, không đổi assertion nghiệp vụ hoặc budget. RED expiry chạy riêng có 10 case filtered (không phải skipped trong source); nghiệm thu phải chạy đủ cả suite, không dùng kết quả filtered thay full gate.

Impact helper mới concurrentCredits trước bỏ non-null assertion thừa trả UNKNOWN/not indexed; đã đối chiếu 3 call sites trực tiếp trong native spec và chỉ bỏ annotation TypeScript bị erase khi chạy, không thay behavior/assertion. Không coi UNKNOWN là LOW/0; index sẽ refresh cuối.

### R06 — final review

Final review độc lập hoàn tất trên cùng `/root/r06_review`: **0 Critical, 0 Important production, 1 Minor harness**. Review từng bị usage limit ngắt sau kết luận sơ bộ; resume cùng lượt để lấy verdict/declined-to-judge đầy đủ, không dispatch review thứ hai. Reviewer kiểm source hiện tại và native 11/11/build evidence; parent chịu trách nhiệm full unit/API/static và scope.

Final lịch sử24/10: minor lúc đó là `concurrentCredits` chưa drain pending khi barrier timeout; không ảnh hưởng production hoặc lượt native đã thành công. Finding giữ nguyên provenance/severity, nhưng trạng thái hiện tại đã `CLOSED_LATER` tại final-goal02/11 bằng cleanup tuần tự, await pending và primary-error precedence; regression R06 đạt13/13. Không dùng snapshot lịch sử này làm giới hạn hiện tại.

Final: Ruling: bank/live delivery và acknowledgement — chỉ chứng nhận signed local provider verification — chi phí là settlement/retry/response-envelope cần kiểm riêng trước live release.

Final: Ruling: timestamp cũ/tương lai/malformed — giữ paidAt và duration-start policy hiện có, không tự đổi credit lịch sử — chi phí là ngày entitlement có thể bất ngờ với timestamp lạ, policy chưa được chứng nhận.

Final: Ruling: merchant/app id và signed payload khác thường — giữ verifier contract, chỉ thêm provider-to-payment equality — chi phí là chưa chứng nhận protocol đầy đủ.

Final: Ruling: lỗi mạng checkout/callback tới trước lưu order-id — giữ checkout path ngoài R06, test từ payment đã persist — chi phí là các recovery/race checkout đó còn mở.

Final: Ruling: status reader dùng nhiều query — giữ API reader, chứng minh writer atomicity — chi phí là một poll có thể ghép snapshot trước/sau activation, cần refresh.

Final: Ruling: concurrent failed callback response — DB paid không downgrade, response theo notification vào giữ nguyên — chi phí là ack có thể báo failed dù entitlement đã paid; live retry chưa kiểm.

Final: Ruling: contention/timeouts/pool exhaustion/throughput — giữ budget mặc định, chỉ chứng nhận race bốn client, không thêm retry chung — chi phí là contention cao có thể timeout, không có capacity guarantee.

Final: Ruling: manual edits/historical inconsistency/refund/cancel/future writers — chỉ những writer đã review phối hợp User trước subscription — chi phí là writer mới phải giữ lock order và business rule để không phá invariant.

Final: Ruling: concurrent account deletion — giữ cascade hiện có, không thêm retention/refund policy — chi phí là xóa account có chủ ý cũng xóa billing records.

Final: Ruling: frontend cache/token và enforcement rộng — giữ shape API, xác minh stored/current profile — chi phí là consumer khác có thể stale theo refresh path hiện có.

Final: Ruling: inherited scope/index/release — parent kiểm baseline 98 file, SHA/index/detect/cleanup, reviewer chỉ gói R06 — chi phí là diff cộng dồn vẫn cần tách concern và release gates.

Gate R06 cuối (23–24/10): **678/678 server unit, 89 suites; 156/156 client unit, 48 files; 107/107 API/integration, 10 suites; 2/2 guards**. Server types gồm specs/build, ESLint/Prettier 5 TS; exit codes và source hashes trong manifest. Không force-exit/skip/retry/timeout change. Removal `pending!` thừa đã kiểm emitted JavaScript giống hệt; chỉ khác annotation bị erase, không đổi assertions/behavior giữa gate và source cuối.

Hậu kiểm 0 User/Connection/Organization/Payment/Subscription, không fixture tables/constraint/client R06; Mongo/MySQL/Redis fixture không còn. Dừng/xóa riêng bốn container/network do lượt test tạo, cổng fixture không còn listener. Giữ log evidence và thư mục R03 từng bị policy chặn xóa; không đụng global config/history hoặc `.zcode/`. GitNexus index cuối 7118 nodes/18885 edges/411 clusters/268 flows; detect all/compare main đều **CRITICAL: 56 tracked files/209 symbols/46 processes** của diff gộp R00–R06, đã cảnh báo. Scope 98-file baseline và links/hashes được ghi trong manifest. [R06 report](quality/R06-REPORT.md), [manifest](quality/r06-verification.json). Bước tiếp: **R07**; chưa release gate toàn sản phẩm.

## R07 — VERIFIED_LOCAL

Goal bắt đầu 24/10/2026, branch `codex/roadmap-r00`, HEAD nền `3d7ec60845ddc2a07284c2873d9d3727acd30744`. Snapshot trước R07 **105 file** ở `output/roadmap-r07/before.json`; giữ R00–R06 chưa commit và `.zcode/`, không commit/push/deploy. Dùng executing-plans/TDD/systematic-debugging/GitNexus/Codegraph/Semble và final reviewer một lượt.

Ruling: giữ checkout hiện tại và dùng R07/ledger làm brief/spec — các remediation trước chưa commit là dependencies cần giữ — chi phí là diff gộp cần tách concern khi tích hợp. Không dựng worktree từ HEAD thiếu R00–R06.

Pre-flight đã thấy: registry giữ pool chung; PG cancel tự tìm PID rồi phát cancel trên cùng pool/client nên không trỏ statement đang chạy; MySQL đợi KILL QUERY trên connection đang bận; MSSQL không giữ Request. Timeout race có thể xóa registry trước khi driver kết thúc; optional count chạy sau registry/deadline. QueryEditor dùng active connection/database trong query key và enabled runNonce cũ, có thể tự chạy lại SQL khi đổi context; lightweight useQueryExecution là luồng khác cần đối chiếu caller trước sửa.

Kế hoạch: (1) baseline + native X01 RED owner/deny/right statement, duplicate/completed cancel, deadline và rollback; (2) truyền execution handle từ driver lúc acquire/request thật, quản lý lease/cancel/finish và control connection riêng, teardown cả lỗi native; (3) registry bao phủ toàn execution/count và không orphan khi timeout/disconnect; (4) UI regression đổi tab/connection và late response trên luồng thực; (5) full gates, một final review/fix pass, index/scope/hash/cleanup/report/manifest. Không sửa cache identity R08 hoặc nâng dependency trong R07.

Baseline server **678/678**, 89 suites, exit 0. Lifecycle unit RED **2/2 fail**: owner cancel nhận pool thay handle và timeout xóa registry trước khi driver drain. Native PG spec đã thêm nhưng chưa chạy do Docker engine tắt; giữ setup failure log và khởi động bằng Docker Desktop CLI, không coi lỗi môi trường là RED nghiệp vụ.

Impact trước sửa: QueryService.executeQuery LOW/3 caller trực tiếp (controller, count fallback, schema), timeout/register LOW/1, resolveQueryCount LOW/1; PG execute LOW/3, transaction LOW/2, cancel LOW/1 lower-bound do dynamic interface dispatch. Interface execute LOW/2 theo graph, thực tế nhiều strategies/caller cần đối chiếu. QueryEditor UID LOW/0 theo graph nhưng Workspace render thực là caller; không coi zero là không cần UI regression.

Ruling: deadline kích hoạt cancel nhưng chỉ retire registry khi driver kết thúc — tránh orphan statement và không báo đã dừng khi cancel không hỗ trợ — chi phí là engine chưa hỗ trợ cancel có thể chờ native driver hoàn tất thay vì trả timeout giả và bỏ registry. Native nghiệm thu dừng thực bắt buộc cho engines có cancel; khả năng engine khác phải ghi đúng, không suy từ PG.

Sau khi user mở Docker, native PostgreSQL RED **3/3 fail**: owner cancel false, backend vẫn chạy sau deadline, multi-statement không hủy/rollback được. Callback handle + PG control Client riêng/lease guard + timeout drain đưa **3/3 GREEN**. Driver RED **2/2 fail** (không publish handle, native read-timeout trả lại client vẫn bận); sau sửa **4/4 GREEN** cùng lifecycle. Không dùng pool lookup PID hoặc phát cancel trên target đang bận.

Count phase RED phát hiện registry đã bị xóa dù COUNT đang chạy; cleanup hook cũ chờ đúng 5s query nên timeout thêm. Đã thêm teardown cancel chỉ PID có marker suite sau assertions, không tăng hook/test budget; chuyển optional count vào cùng registry/deadline và bind handle count thật. Lượt filtered RED được giữ, full native sau sửa phải chạy đủ không filter.

PostgreSQL sau count/disconnect sửa: **5/5 native GREEN**, gồm owner/deny/right-query + neighbor, deadline, count, HTTP disconnect và rollback. HTTP disconnect RED trước sửa đợi 3s vẫn còn statement; controller giờ truyền AbortSignal nội bộ, remove listener cuối, không thêm field người dùng gửi. Query controller impact LOW/0 theo graph; api_impact route lookup trả test routes không khớp endpoint nên không dùng làm bằng chứng, caller/contract kiểm bằng source và HTTP native.

MySQL/SQLServer driver RED **2 fail/2 pass** không publish đúng handle; sau sửa **6/6 unit GREEN** cùng lifecycle. MySQL native3/3 đầu qua nhưng có warning clone runtime config; thêm one-session pool proof giữ nguyên thread sau cancel và không invalid config, RED bắt warning trước sửa. Chỉ clone transport options do strategy cấu hình, không truyền normalized internal flags. openQueryExecution mới chưa index (UNKNOWN); kiểm hai caller trực tiếp single/transaction bằng source, không coi UNKNOWN là LOW.

Fixture hồi quy PG/MySQL dùng EventEmitter thật như client driver; unit expectations giữ đủ limit/offset/readOnly và thêm onExecution Function cho contract mới, không giảm assertion dữ liệu/count/rollback. Impact test files LOW theo graph. R03 native SQLite fixture không sửa vì không fail. QueryEditor phải kiểm luồng thật; useQueryExecution chỉ được re-export và không có consumer thực hiện tại, không lấy sửa hook chết làm bằng chứng UI đã sửa.

PG thêm native socket loss và native client read-timeout: một RED cho thấy chỉ close socket chưa đảm bảo pg_sleep dừng. Đã gọi control cancel trước discard khi read-timeout; native PG7 + MySQL4 **11/11 GREEN** trên đường control thành công, API còn sống sau pg_terminate_backend. MySQL one-session proof giữ nguyên thread sau cancel và không warning invalid config sau khi clone transport options.

**Còn phải giải quyết trước nghiệm thu:** fallback khi control connection thất bại hiện discard source; TCP close không chứng minh backend đã dừng (bài read-timeout vừa chứng minh). Phải thêm failure-path native proof và giữ ack/registry/lease đúng tới lúc wire query dừng, không tuyên bố “stopped” chỉ vì driver promise reject. Không dùng 11/11 đường thành công để che failure path này.

Browser RED đầu: hai tab cùng SQL có 1 execution thay vì 2 (lỗi thật); case đổi connection chưa qua bootstrap vì lazy editor vẫn Loading khi poll5s bắt đầu. Sửa fixture chờ Run toolbar visible trước poll, giữ config timeout60s/retry0/worker1 và toàn bộ assertions; không coi bootstrap failure là regression sản phẩm. openQueries mới chưa index (UNKNOWN), có 2 caller trong spec; chỉ sửa readiness trước khi sửa UI. Dùng runner Playwright đã chuẩn hóa trong repo để lưu regression cần bởi roadmap/TDD, không cài CLI mới. Frontend Checklist static pass không tìm issue nhưng không chứng minh runtime, browser là bằng chứng chính.

Control-failure RED lần hai: PG cả app/native timeout và MySQL native timeout còn statement chạy sau response (3 fail/1 pass). Sau sửa control lỗi trả false, giữ lease tới wire completion (PG drain; MySQL ping xếp sau command), native đầy đủ **15/15 GREEN**, không nới budget. Rollback-failure unit RED2/2 rồi GREEN: rollback lỗi phải discard source, không trả connection còn transaction vào pool. Timeout copy không khẳng định backend stopped khi remote state không xác định.

Ruling: lỗi toàn bộ đường mạng tới remote database — không thể chứng nhận remote statement đã dừng chỉ bằng socket close; giữ driver completion khi còn wire và yêu cầu kiểm tra database/writes khi timeout — chi phí là response có thể chờ native completion và partition vẫn cần điều tra vận hành.

Ruling: sửa QueryEditor thực thay hook không có consumer; thêm tabId vào query key và ghim context khi Run, hủy fetch khi đổi context — không thay API payload/confirmation guard — chi phí là cần Run lại sau khi đổi kết nối/database, không tự chạy SQL cũ trên đích mới.

Ruling: MainContent giữ các tab không active mounted và hidden; mỗi tab được giữ kết quả riêng, assertion kiểm không hiển thị kết quả tab cũ trong tab active thay vì yêu cầu xóa khỏi DOM — chi phí là background tab có thể hoàn tất query riêng, không có nghĩa đổi tab tự hủy mọi query.

Ruling: fixture browser dùng thao tác paste SQL chuẩn sau click Monaco view-lines; textarea đầu là ime readonly chứ không phải editor input, gõ từng ký tự đã bị mất ký tự ở harness — giữ exact payload assertions và kiểm nội dung editor trước Execute — chi phí là chưa chứng nhận tốc độ gõ/IME, ghi nhận cho UI hardening R11/R12.

Ruling: adapter-red ban đầu chưa đợi xong trước sửa production nên kết quả thực tế là GREEN; không tính làm bằng chứng RED — browser RED và native/driver RED là bằng chứng lỗi trước sửa, adapter unit chỉ là regression hậu kiểm — chi phí là không có RED độc lập cho adapter signal ở lượt đầu.

Impeccable context không có PRODUCT.md và cho phép scoped fixes trên code hiện có; không tự init/redesign/hook. Dùng playbook harden cho stale state/concurrent operations; detector và render checks chỉ chứng nhận màn/flow này. Final reviewer duy nhất r07_review được dispatch read-only theo executing-plans ở lượt lịch sử, không có implementer agent per task.

### Chốt R07 ngày 25/10/2026

Tiếp tục trên cùng HEAD/branch và bảo vệ baseline resume810 files. Fresh remount RED exit1 chứng minh request có thêm `connection-next` khi chưa Run; sửa hai initializer QueryEditor (`runNonce=0`, `executionScope=null`) giữ SQL nhưng không khôi phục execution eligibility. Fixture giờ bấm Execute cho mỗi tab, giữ assertions cũ và thêm SQL preservation/explicit Run sau restore đúng đích. Browser focused6/6 GREEN Chromium/Firefox; full82/82 PASS, không skip/flaky/retry hoặc thay budget.

GitNexus impact QueryEditor UID LOW/0 (dynamic MainContent caller được Codegraph xác nhận). openQueries lookup ban đầu UNKNOWN/CRITICAL với quan hệ sai; đã cảnh báo, full rebuild và UID LOW/1 direct/0 flow trước edit helper, source có3test caller. Final full index7243nodes/19137edges/424clusters/268flows, detect all/compare main CRITICAL58trackedfiles/254symbols/47flows của diff gộp R00–R07; untracked/source frozen19 được đối soát riêng. Codegraph còn đối chiếu execution helper/interface/PG/MySQL/MSSQL callers; Semble xác nhận registry cleanup/MySQL timeout/Cancel panel. Các MCP và skills đã chạy được ghi trong report/manifest, không coi tool count là tiêu chí nghiệm thu.

Final self-review tuần tự trên working tree, không reviewer độc lập mới: Important remount lịch sử đã đóng bằng fresh repro; không tìm thêm Critical/Important trong scope kiểm chứng. Ruling: không dispatch thêm agent trong lượt này, ghi rõ self-review và giữ verdict lịch sử riêng. OOP/SOLID giữ controller/service/strategy ownership; YAGNI/KISS/DRY reuse helper/React Query, không thêm lớp hoặc sửa dead hook; nesting giữ lifecycle finally/rollback, ngoại lệ COUNT/transaction kế thừa được giải thích trong report. C01–C08/C10 có evidence tương ứng; C09 N/A tối ưu, chưa load/throughput certification.

Full gates trên source cuối: server686/686 (91 files), client158/158 (49 files), API122/122 (12 suites, PG9/MySQL6 native), guards2/2; lint/build hai phía, prerender1/1, CI script tests8/8, final focused lint và Impeccable detector `[]` đều exit0. Client lint warning CommentComposer:17 kế thừa giữ ngoài scope. Số native là subset API, không cộng lặp hoặc suy coverage%.

Dependency gate **BASELINE_FAIL ở snapshot resume**: đúng CI allowlists vẫn chặn DOMPurify critical ở client và Azure/Nest/multer/body-parser/nodemailer/proxy-addr high/critical ở server. Lockfile/dependency không đổi; giữ remediation R10 theo ngoại lệ roadmap8.3. R07 VERIFIED_LOCAL, không gọi full release gate xanh hoặc production ready.

Hậu kiểm0 user/connection/org/payment/subscription,0 fixture table/constraint/client/statement PG/MySQL, Mongo DB và Redis key. Đã kiểm ownership và down riêng4containers/network; không còn listener15432/16379/17017/13306. Hash bảo vệ R00–R06 và frozen19 sources, không reset/stash/commit/push/deploy, `.zcode/` ngoài scope. [Report](quality/R07-REPORT.md), [manifest](quality/r07-verification.json), evidence mới `output/roadmap-r07/resume-2026-10-25/`. **Bước tiếp theo: R08**. Remote CI, bank live, browser-to-real-backend, SQLServer native, proxy/SSH/partition, multi-replica/load và release gates chưa kiểm.
