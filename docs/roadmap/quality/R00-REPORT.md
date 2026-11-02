# R00 — Harness đáng tin và baseline portable

**Ngày:** 22/10/2026 (Asia/Saigon). **Trạng thái:** `VERIFIED_LOCAL`.
**Branch:** `codex/roadmap-r00`. **Base HEAD:** `3d7ec60845ddc2a07284c2873d9d3727acd30744`, v1.6.7. Thay đổi chưa commit/push/deploy.

## Follow-up 01/11 — A01 login-locale đã đóng

[Residual manifest](r00-r06-residual-verification-2026-11-01.json) supersede riêng trạng thái A01 ở phần lịch sử bên dưới. Request VI với account EN từng trả English, tạo tín hiệu email tồn tại. RED unit 1 fail/5 pass, mở rộng EN/VI + local thiếu hash 4 fail/4 pass; native HTTP 1 fail/9 pass. `AuthService.login` nay dùng request locale cho hai generic lỗi local; provider guidance và các trường audit/success giữ nguyên. GREEN unit 8/8; native auth+billing 22/22 + guards 2/2. Full backend hiện tại 781/781 unit và native trực tiếp 186/186, typecheck/lint/build exit 0; browser 230/230 và clean full-stack 3/3, đều exit 0.

A02 legacy cache và AI context denial 500/null trong R01 đã CLOSED_LATER bởi R10 (`stores`, shared database exception và regressions thường/stream). R07 remount cũng đã đóng ở 25/10. Không đổi limiter, quota, DTO hoặc billing/product semantics; không gọi provider thật. Các đoạn ngày 22/10 còn ghi A01/A02 mở là snapshot lịch sử, không phải trạng thái hiện tại.

## Kết quả cho người dùng

Hai test bảo mật trước đây có thể pass sau khi return với 0 assertion. Hiện chúng dùng user A/B và connection SQLite thật của B, kiểm tra đường truy cập hợp lệ trước khi yêu cầu A bị deny. Login/fixture sai sẽ fail suite. Token tampering yêu cầu đúng bốn assertion, ownership yêu cầu sáu assertion.

Giới hạn login giữ nguyên 5/min. Enumeration test dùng cùng Accept-Language, đòi 401 và thông báo giống nhau; brute-force kiểm tra chính xác năm lần 401 rồi hai lần 429. Chỉ reset key limiter trong Redis fixture giữa các test, không chỉnh production limiter.

Test app cần hai URL E2E explicit, local và đúng tên DB fixture; không fallback sang URL app thường. Harness loại cấu hình thừa kế, chặn cả Nest và Prisma tự đọc `.env`. Đã kiểm tra bằng canary mail/AI giả được truyền vào môi trường: chúng không xuất hiện trong ConfigService. Database, Redis, auth và query vẫn dùng implementation thật; không gọi ngân hàng/mail/AI thật.

Các fixture browser auth/workspace/mobile/billing không còn trả `[]` cho API bất kỳ. Endpoint phụ được khai báo rõ method/path và response, gồm object chat có ID. Test contract chứng minh unknown endpoint, sai method và health-check sai connection sẽ throw. Web server test có API URL cố định và không reuse server cũ.

Teardown không còn nuốt lỗi cleanup, không dùng force-exit. Sau API suite trên fixture mới: user/connection còn lại bằng 0, app session PostgreSQL bằng 0, Redis không còn app connection/subscriber. Hậu kiểm này chứng minh lifecycle của harness trong lượt chạy; không chứng minh mọi lifecycle production.

## Kiểm chứng

| Phạm vi | Lệnh | Kết quả |
|---|---|---|
| Guard + API full-stack | `cd server; npm run test:e2e -- --detectOpenHandles` với URL fixture explicit | 2 Node guard + 23 API tests pass; exit 0, tự thoát |
| Server unit | `cd server; jest --runInBand` | 563/563, 82 suites, exit 0 |
| Client unit | `cd client; npm run test:ci` | 142/142, 46 suites, exit 0 ở lần chạy lại |
| Browser mock | `cd client; npm run test:e2e` | 58/58 trên Chromium, Firefox, mobile Chrome/WebKit; exit 0 |
| TypeScript | Server `tsc --noEmit --incremental false`; explicit TS check cho e2e fixtures/config client | exit 0 cả hai |
| Focused lint | ESLint các file test/helper/config TS thay đổi ở server/client | exit 0 cả hai |
| Diff / tài liệu | `git diff --check`; self-check links và case summary | exit 0; 70 link roadmap lúc đối soát, 20 mục M và 63 case baseline |

Client unit từng có một timeout 5s tại AiConfigTab khi nhiều gate chạy đồng thời: 141 pass/1 fail. Lần chạy lại nguyên lệnh pass 142/142; không đổi timeout/retry/assertion. Đây là lịch sử cần giữ khi theo dõi flakiness, không phải bằng chứng đã sửa nguyên nhân của timeout đó.

58 browser runs bao gồm kiểm tra contract fixture mới; không diễn giải thành 58 workflow người dùng độc lập hoặc full-stack UI. Coverage lines/branches chưa đo lại; snapshot cũ trong roadmap không thay đổi.

## Phạm vi file và evidence

- [API security suite](../../../server/test/auth-security.e2e-spec.ts), [app suite](../../../server/test/app.e2e-spec.ts), [bootstrap/teardown](../../../server/test/e2e-app.ts).
- [Environment guard](../../../server/test/e2e-environment.cjs), [guard tests](../../../server/test/e2e-environment.test.cjs), [setup](../../../server/test/setup-env.cjs), [Compose fixture](../../../server/test/compose.e2e.yml), [Jest config](../../../server/jest-e2e.json), [npm script](../../../server/package.json).
- [Shared browser mock](../../../client/e2e/support/authenticated-api.ts), [auxiliary contract](../../../client/e2e/support/auxiliary-api.ts), [fixture guard test](../../../client/e2e/api-fixture-contract.spec.ts), hai fixture cục bộ auth/workspace và [Playwright config](../../../client/playwright.config.ts).
- [Historical summary](audit-baseline-2026-10-20.json) giữ 63 case = 51 PASS/12 FAIL và SHA tài liệu nguồn; không đổi FAIL lịch sử sau fix. Full report/log gốc vẫn là local artifact bị ignore.
- [Verification manifest](r00-verification.json) ghi scope, command/result và hash các file của gói. [Hướng dẫn tái lập](README.md).

Không thay đổi file dưới `server/src`/`client/src`, dependency/lockfile, schema/migration hay config production. `.zcode/` giữ nguyên. Đã dùng Codegraph/Semble/GitNexus; Agentmemory recall không có kết quả phù hợp, không lưu memory mới.

GitNexus incremental refresh phát hiện FTS inconsistency; full rebuild thành công. Context/impact sau rebuild nhận đúng UID `mockAuthApi`: LOW, một caller cùng test file. `detect_changes` cuối LOW, không có production flow ảnh hưởng. Kết quả CRITICAL trước rebuild được giữ trong ledger, không dùng làm phạm vi cuối. Không tự nâng tool toàn máy.

## Giới hạn và bước tiếp theo

Review độc lập không chạy được do model reviewer báo usage limit; đã self-review riêng diff, contract, caller, setup và cleanup. Chưa chạy remote CI, dependency/container gate, live external providers hay toàn bộ release gate. R00 chưa được gọi DONE ở mức release.

A01 còn mở: ngôn ngữ thông báo login lỗi có thể phụ thuộc user.language khi tài khoản tồn tại nhưng dùng locale request/default nếu email thiếu; cần triage enumeration. A02 còn mở: wiring cache `store` legacy với cache-manager v6 cần kiểm tra cache Redis nhiều replica và lifecycle. Helper test đóng client legacy để harness dọn sạch; không sửa wiring production trong gói này.

**Gói kế tiếp: R01 — authorize trước cache và thống nhất role/database policy.** Các lỗi P0/P1 trong audit và các gói R01–R14 vẫn chưa được remediation ở lượt này.
