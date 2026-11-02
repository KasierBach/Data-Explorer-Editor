# R06 — Entitlement giao dịch đồng thời

Kiểm tra từ 23 đến **24/10/2026**, Asia/Saigon. Trạng thái: **VERIFIED_LOCAL**, có một Minor fixture được ghi để xử lý sau. Branch `codex/roadmap-r00`, HEAD nền `3d7ec60845ddc2a07284c2873d9d3727acd30744`. Kế thừa R00–R05 chưa commit; không commit/push/deploy. [Manifest SHA/exit/evidence](r06-verification.json), [roadmap](../ROADMAP.md), [progress ledger](../ROADMAP-PROGRESS.md).

## Contract và tác động với người dùng

Mỗi payment hợp lệ được credit một lần. Nhiều order khác nhau của cùng user phải cộng đủ thời hạn, kể cả subscription chưa tồn tại. Payment, subscription và trường entitlement trên User cùng commit hoặc cùng rollback. Một user đang chờ khóa không khóa toàn bộ người dùng khác. Provider verification diễn ra trước transaction; không gọi mạng tới provider trong transaction.

Catalog giữ **monthly 30 ngày/yearly 365 ngày**. Không đổi giá, cấu trúc API, cơ chế checkout, schema hoặc dependency. Các callback trong kiểm thử dùng chữ ký fixture cục bộ qua verifier MoMo/ZaloPay thật; không gọi bank/live payment.

## Nguyên nhân đã xác minh và sửa đổi

### Nhiều order cộng thiếu thời hạn

Code cũ claim có điều kiện trên từng Payment nên duplicate cùng order được chặn. Nhưng hai payment khác nhau không tranh cùng hàng: cả hai có thể đọc cùng expiresAt trước khi một transaction ghi subscription, rồi ghi cùng ngày mới và làm mất credit. Với subscription chưa có, việc chỉ khóa subscription cũng không tạo được hàng ổn định để serialize.

`handleProviderWebhook` khóa **hàng User theo primary key** trong transaction trước claim payment, đọc subscription và tính ngày mới. Lock order: User → Payment claim → BillingSubscription → User mirror. User đã tồn tại theo FK của Payment; không dùng mutex trong memory hoặc global advisory lock. Đường expiry cập nhật User trước subscription theo cùng thứ tự. Bốn monthly phải credit đúng 120 ngày; monthly/yearly/monthly cộng 425 ngày.

Native barrier giữ một User row lock và chờ các transaction thực sự có `wait_event_type=Lock` trước khi thả; không dựa vào sleep để hy vọng race xảy ra. Bốn Prisma client độc lập kiểm cùng database PostgreSQL 16. Assertions kiểm paid count, expiry chính xác, lastPaymentId thuộc payment đã paid và User/Sub cùng trạng thái/ngày.

### Provider hợp lệ nhưng sai order

Một signed ZaloPay callback dùng orderId của payment MoMo từng được nhận (HTTP 201). Bổ sung kiểm `payment.provider` khớp adapter đã verify, trước amount check và idempotent path. Regression yêu cầu HTTP 400 và Payment pending/User Free/no subscription. Sai chữ ký và sai amount cũng phải deny trước cấp quyền.

### Profile expiry ghi đè quyền vừa mua

`UsersService.findById` đọc User hết hạn rồi chờ update. Khi payment renew thắng trước, code cũ vẫn update vô điều kiện theo id và chuyển user mới trả tiền về Free/expired, trong khi subscription đã active.

Đường expiry dùng conditional User update trong transaction: vẫn Pro và vẫn hết hạn ở thời điểm cutoff mới được expire. PostgreSQL kiểm lại predicate sau khi chờ row lock; sau đó update subscription đã hết hạn và đọc profile mới. Native regression buộc payment xếp trước stale profile update ở lock queue; trước sửa trả Free/expired, sau sửa giữ Pro/active và expiry nhất quán.

Tham khảo [PostgreSQL 16 row locks](https://www.postgresql.org/docs/16/explicit-locking.html#LOCKING-ROWS). Prisma `$queryRaw` dùng tagged template bind userId; API được đối chiếu type của **Prisma 6.19.3 đang cài**, không dùng tài liệu ORM mới để suy hỗ trợ phiên bản này.

## Bằng chứng nghiệm thu

| Kiểm tra | Kết quả hiện có |
|---|---|
| Baseline server | 678/678, 89 suites, exit 0 |
| Native RED ban đầu | 4 fail/6 pass: concurrent monthly có/chưa subscription, mixed plans và provider mismatch |
| Native GREEN sau billing fix | 10/10, exit 0 |
| Native expiry RED | 1 fail/10 filtered: profile trả Free/expired sau credit thành công |
| Native GREEN sau expiry fix | 11/11, exit 0 |
| Billing unit | 5/5, exit 0 |
| Full server sau hai sửa | 678/678, 89 suites, exit 0 |
| TypeScript gồm specs | Exit 0 sau sửa kiểu fixture |
| Full API/integration | **107/107**, 10 suites, exit 0, `--detectOpenHandles`, không force-exit |
| Environment guards | **2/2**, exit 0 |
| Client full unit | **156/156**, 48 files, exit 0; không đổi source client |
| Server build | Exit 0; giữ safe Prisma generation và Nest build |
| Static cuối | TypeScript gồm specs, ESLint/Prettier **5 file TS**; exit trong manifest |
| Final review | **0 Critical, 0 Important production, 1 Minor fixture deferred** |
| Cleanup | 0 User/Connection/Organization/Payment/Subscription, không fixture constraint/client còn lại; 4 owned containers/network down, không listener ở cổng fixture |

11 case native: bốn monthly khi có/chưa subscription; mixed plans hai provider; concurrent và sequential duplicate; signature/amount/provider mismatch; delayed failed sau paid; rollback khi final User update bị constraint từ chối rồi retry; stale profile expiry sau renew; user B hoàn tất trong lúc User A bị khóa. HTTP cases chạy AppModule và các interceptor/filter thật với adapter ký local, không override verification thành `isValid=true`.

Rollback fixture chỉ thêm constraint có tên/điều kiện gắn synthetic user và gỡ trong finally; không ảnh hưởng user khác. Test không thay production transaction timeout/retries hoặc thêm schema migration. Case filtered của RED expiry không phải skip trong source; gate nghiệm thu phải chạy full suite không filter.

## Follow-up 01/11 — Minor drain cleanup đã đóng

[Residual manifest](r00-r06-residual-verification-2026-11-01.json) đóng Minor deferred của snapshot bên dưới. Tại mốc01/11, regression inject observation failure, trì hoãn rồi gọi webhook ký local thật và kiểm payment đã `paid` trước khi helper trả đúng error ban đầu. RED1fail/11pass; helper khi đó drain `pending` sau rollback/release; normal fulfilled-result assertion giữ nguyên. Nested cleanup trong regression bảo đảm restore cả hai spies khi worker thật lỗi.

Mock đầu trả `void` bị full test-source TypeScript bắt TS2345; đã thay bằng real webhook wrapper, không cast/loại file khỏi typecheck. Reconfirmed RED với drain line tạm bỏ, sau đó restore trước final gate. Focused native GREEN 22/22 auth+billing + guards 2/2; full backend cuối 781/781 unit, native trực tiếp 186/186 và typecheck/lint/build exit 0. Browser 230/230, clean full-stack 3/3, đều exit 0. Không đổi timeout/retry/skip/assertion/coverage scope hoặc production billing semantics.

Giới hạn rollback/release failure thay observation error ở snapshot01/11 đã `CLOSED_LATER` trong final-goal02/11: helper hiện bắt primary error, thử rollback/release, await toàn bộ pending rồi ưu tiên primary error; regression focused R06 đạt13/13. Provider protocol/live settlement, refund/cancel/chargeback/stacking policy và capacity vẫn giữ nguyên. Minor cleanup ở phần review lịch sử không bị xóa hoặc đổi severity; trạng thái hiện tại được ghi bằng follow-up này.

## Scope, quy tắc và giới hạn

Phạm vi code: BillingService, billing unit fixture, UsersService, users unit fixture và native R06 integration spec. Snapshot trước R06 bảo vệ 98 file dirty/untracked; nguồn R00–R05 ngoài phạm vi được giữ nguyên. Static failure ban đầu là kiểu Supertest payload và assertion TypeScript thừa trong fixture, không phải lý do nới budget hoặc giảm assertion nghiệp vụ.

Áp dụng strategy/OOP hiện có, SOLID/DRY ở boundary transaction, YAGNI/KISS bằng row lock và conditional update; không thêm payment framework, lock service hay abstraction để dự phòng. C01/C02 giữ provider/signature/amount/owner boundary, C03 giữ duration và timestamp contract, C04/C05/C08 kiểm concurrency/failure/rollback, C07 dùng error primitives hiện có, C10 giữ diff nhỏ và dependency pin. C06 không React change; C09 chưa benchmark, không tuyên bố nhanh hơn.

Ruling: tiếp tục checkout và ledger Rxx để giữ các dependencies chưa commit; chi phí là khi tích hợp cần tách concern. Ruling: mở scope tới profile expiry vì đây là writer có thể xóa hiệu lực payment vừa thành công; chi phí là cần thêm profile/auth regression. Tất cả quyết định reviewer đặt ngoài phạm vi được xử lý bên dưới.

## Final review và các quyết định còn giới hạn

Một review độc lập trên 5 file và các writer/provider/schema lân cận kết luận không có Critical/Important production. Review bị usage limit ngắt trước verdict đầy đủ; đã resume cùng reviewer để hoàn tất, không có lượt re-review hay thay reviewer. Không có production finding cần fix pass sau final review.

**Minor lịch sử, `CLOSED_LATER` 02/11:** tại snapshot24/10, helper `concurrentCredits` unlock trong `finally` nhưng await pending ở sau `finally`; barrier timeout có thể bỏ qua await và để worker test còn chạy. Finding được giữ đúng severity/lịch sử theo policy executing-plans lúc review, không phải link máy cá nhân portable. Current helper đã đóng cả drain và rollback/release failure precedence như follow-up phía trên; provider/capacity limits vẫn giữ.

| Hành vi reviewer đặt ngoài phán quyết | Quyết định của parent | Chi phí/giới hạn |
|---|---|---|
| Live delivery/settlement và callback acknowledgement | Chỉ chứng nhận chữ ký/local application boundary | Chưa bank live, retry hoặc response-envelope compatibility |
| Timestamp cũ/tương lai/malformed | Giữ paidAt và duration-start policy hiện có | Timestamp lạ có thể cho ngày bất ngờ; không ngầm đổi credit lịch sử |
| Merchant/app id và signed payload shape khác thường | Giữ verifier contract; R06 thêm provider equality | Chưa chứng nhận toàn bộ protocol |
| Checkout network fail/callback trước lưu order-id | Giữ checkout ngoài scope, bắt đầu từ payment đã persist | Recovery/race của checkout còn mở |
| Status reader nhiều query | Giữ reader/API; writer atomic đã kiểm | Một poll có thể ghép snapshot, cần refresh |
| Concurrent failed callback response | Giữ DB paid predicate và response theo notification vào | Ack có thể báo failed dù DB paid; live retry chưa kiểm |
| Contention, timeout, pool exhaustion, throughput | Giữ budget mặc định, không thêm retry framework | Test bốn client không là capacity guarantee |
| Manual edits, dữ liệu lịch sử sai, refund/cancel và writer mới | Chứng nhận writer hiện có; writer mới phải giữ User trước subscription | Các business workflow khác chưa được chứng nhận |
| Intentional account deletion | Giữ cascade delete hiện có | Xóa account cũng xóa billing record; refund/retention riêng |
| Frontend cache/token và enforcement rộng | Giữ shape, kiểm stored/current profile | Consumer khác có thể stale theo refresh path hiện có |
| Inherited scope/index/release | Parent đối soát baseline/SHA/detect/cleanup, reviewer chỉ R06 | Diff cộng dồn vẫn cần tách concern và release gate |

## Khả năng đối soát và bước tiếp theo

Manifest giữ hash 5 file source/test, gate outputs, review, RED/GREEN và cleanup. Protected baseline 98 file phải không có thay đổi ngoài phạm vi. Source hashes R00–R05 vẫn là lịch sử; chỉ refresh hash các tài liệu canonical trong artifact manifest cũ. Không xóa `.zcode`, global config/history hoặc log bằng chứng. Thư mục R03 từng bị policy chặn xóa vẫn giữ nguyên.

GitNexus cuối **7118 nodes/18885 edges/411 clusters/268 flows**. Detect all và compare `main` đều **CRITICAL: 56 tracked files/209 symbols/46 processes** cho diff gộp R00–R06, đã cảnh báo người dùng. Không gán cả diff là R06; untracked test được kiểm qua snapshot riêng. Flow count của index không phải số workflow đã test. Impact trước sửa: webhook LOW/2 controller callers, profile findById LOW/1 getProfile, createPrisma LOW/1, users spec LOW/0. Helper mới concurrentCredits từng trả UNKNOWN do chưa index; đối chiếu 3 call sites và giữ nguyên scope, không coi not-found là zero risk.

Client build và browser của R05/R04 là snapshot lịch sử, không chạy mới trong R06; client unit 156 test được chạy lại. Không đổi timeout/retry/skip/assertion để vượt gate. Filter trong expiry RED chỉ phục vụ tái hiện; full API cuối không filter và không pending/skipped.

**Bước triển khai tiếp theo: R07 — query execution handle, Cancel và timeout.** R07–R14 và release gate toàn sản phẩm còn mở; R06 VERIFIED_LOCAL không phải kết luận hết lỗi project.

Chưa chứng nhận bank/provider live, refund/chargeback/cancel, calendar-month proration, mọi retry/outage/provider clock edge, payment traffic tải cao, transaction timeout stress hoặc release gate. Không đo lại coverage %. Native concurrency ở PostgreSQL, không suy ra các database khác. UI/browser/a11y không có thay đổi mới trong R06; các kết quả gói trước là snapshot lịch sử.
