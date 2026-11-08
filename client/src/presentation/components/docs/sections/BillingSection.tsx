import {
    BadgeCheck,
    CreditCard,
    RefreshCw,
    ShieldCheck,
    Wallet,
} from 'lucide-react';
import {
    Callout,
    CodeBlock,
    CodeComment,
    CodeLine,
    DocPageLayout,
    DocSection,
    DocSubSection,
    FeatureGrid,
    InfoCard,
    Prose,
} from '../primitives';
import { publicPath } from '@/core/seo/publicRoutes';

interface Props { lang: 'vi' | 'en'; }

export function BillingSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Thanh toán & Trạng thái Pro' : 'Billing & Pro Status'}
            subtitle={t
                ? 'Giá VND và kỳ hạn Pro hiện tại, checkout MoMo/ZaloPay, webhook đã xác thực, lịch sử giao dịch và giới hạn kiểm tra trạng thái sau thanh toán.'
                : 'Current VND prices and Pro durations, MoMo/ZaloPay checkout, verified webhooks, payment history, and post-payment status-check limits.'}
            gradient
        >
            <FeatureGrid columns={3}>
                <InfoCard icon={<Wallet className="w-6 h-6 text-emerald-500" />} title={t ? 'Gói Free và Pro' : 'Free and Pro plans'} color="emerald">
                    <p>
                        {t
                            ? 'Billing ghi nhận trạng thái Pro theo thời gian và ngày hết hạn trên hồ sơ. Hiện chưa có danh sách quyền/tính năng Pro được phê duyệt hoặc feature gating theo gói để tài liệu cam kết; không hiểu thanh toán là tự mở khóa AI, team, export hay engine.'
                            : 'Billing records time-based Pro status and an expiration date on the profile. There is currently no approved Pro feature-entitlement list or plan-based feature gating to promise here; payment does not automatically unlock AI, team tools, exports, or engines.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<CreditCard className="w-6 h-6 text-blue-500" />} title={t ? 'Checkout thật qua provider' : 'Real provider checkout'} color="blue">
                    <p>
                        {t
                            ? 'MoMo/ZaloPay tạo checkout qua adapter phía backend nếu deployment đã cấu hình provider. Mở ví hoặc quay về app không phải bằng chứng thanh toán; trạng thái Pro chỉ cập nhật từ webhook thành công đã xác thực.'
                            : 'MoMo/ZaloPay checkout is created through backend adapters when the deployment configures a provider. Opening a wallet or returning to the app is not proof of payment; Pro status updates only from a verified successful webhook.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<ShieldCheck className="w-6 h-6 text-purple-500" />} title={t ? 'Kích hoạt sau webhook' : 'Activation after webhook'} color="purple">
                    <p>
                        {t
                            ? 'Backend xác thực webhook của provider trước khi ghi giao dịch paid và cộng kỳ hạn Pro. Return URL và endpoint status không cấp quyền hoặc tự hỏi provider xem đã trả tiền chưa.'
                            : 'The backend verifies the provider webhook before recording a paid transaction and adding Pro duration. The return URL and status endpoint neither grant access nor query the provider to determine whether payment succeeded.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Người dùng sẽ thấy gì trong UI?' : 'What users see in the UI'}>
                <Prose>
                    {t
                        ? 'Profile dialog hiển thị gói/trạng thái và ngày hết hạn. Hai lựa chọn hiện tại là 149.000 VND cho 30 ngày và 1.490.000 VND cho 365 ngày; đây là kỳ hạn cố định theo ngày, không phải tháng/năm lịch. VND là số tiền tính phí; USD trong UI chỉ là tham chiếu, không phải mức giá checkout khác.'
                        : 'The profile dialog shows plan/status and expiration. Current options are 149,000 VND for 30 days and 1,490,000 VND for 365 days; these are fixed day durations, not calendar months/years. VND is the charge amount; USD UI copy is reference only, not another checkout price.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <div className="flex items-center gap-3">
                            <BadgeCheck className="h-5 w-5 text-emerald-400" />
                            <h3 className="text-sm font-bold">{t ? 'Current plan card' : 'Current plan card'}</h3>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Card này cho người dùng biết họ đang Free hay Pro, còn active hay chưa, và mốc thời gian nào là lần kiểm tra quan trọng tiếp theo.'
                                : 'This card tells the user whether they are on Free or Pro, whether the subscription is active, and which date matters next.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <div className="flex items-center gap-3">
                            <RefreshCw className="h-5 w-5 text-blue-400" />
                            <h3 className="text-sm font-bold">{t ? 'Refresh billing state' : 'Refresh billing state'}</h3>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Refresh đọc lại billing/profile từ dữ liệu đã lưu ở backend. Nó không gọi API provider để reconcile giao dịch và không bảo đảm trạng thái pending đổi ngay; chờ webhook rồi refresh lại sau.'
                                : 'Refresh reloads backend-stored billing/profile data. It does not call the payment provider to reconcile the transaction and cannot guarantee that pending changes immediately; wait for the webhook and refresh again later.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Checkout từ chọn gói đến cập nhật trạng thái' : 'Checkout from plan selection to status update'}>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            title: t ? '1. Chọn gói và provider' : '1. Choose a plan and provider',
                            desc: t
                                ? 'Người dùng chọn kỳ hạn Pro và một provider như MoMo hoặc ZaloPay. App tạo checkout request với plan code và provider rõ ràng.'
                                : 'The user selects a Pro duration and a provider such as MoMo or ZaloPay. The app creates a checkout request with an explicit plan code and provider.',
                        },
                        {
                            title: t ? '2. Backend tạo payment session' : '2. The backend creates a payment session',
                            desc: t
                                ? 'Backend dùng provider adapter tương ứng để tạo request chuẩn theo từng cổng thanh toán, rồi trả thông tin redirect/session về client.'
                                : 'The backend uses the appropriate provider adapter to build a payment request in the format expected by that gateway, then returns the redirect/session data to the client.',
                        },
                        {
                            title: t ? '3. Provider xử lý thanh toán' : '3. The provider handles payment',
                            desc: t
                                ? 'Người dùng đi qua flow của MoMo hoặc ZaloPay. Đây là nơi xác thực ví, quét mã, hoặc xác nhận giao dịch thật sự diễn ra.'
                                : 'The user completes the MoMo or ZaloPay flow. This is where wallet auth, QR confirmation, or the real payment step actually happens.',
                        },
                        {
                            title: t ? '4. Webhook xác thực cập nhật Pro' : '4. A verified webhook updates Pro',
                            desc: t
                                ? 'Chỉ webhook thành công được backend xác thực mới ghi paid và cộng thời hạn Pro. Không có đường kiểm tra trạng thái provider tự động thay thế webhook; trạng thái Pro là metadata theo thời gian, không phải cam kết quyền tính năng.'
                                : 'Only a successful webhook verified by the backend records paid and adds Pro time. There is no automatic provider-status query that substitutes for the webhook; Pro is time-based metadata, not a feature-entitlement promise.',
                        }
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                            <h3 className="text-sm font-bold">{item.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Billing return page và trạng thái sau thanh toán' : 'Billing return page and post-payment status'}>
                <Prose>
                    {t
                        ? 'Billing return page đọc trạng thái giao dịch local từ backend một lần sau khi mở bằng payment ID. Trang không tự polling định kỳ và endpoint status không hỏi provider. Nếu vẫn pending, điều đó chỉ cho biết backend chưa ghi nhận paid; chờ rồi dùng refresh sau, không tự thanh toán lần nữa chỉ vì return page chưa cập nhật.'
                        : 'The billing return page reads the backend’s locally stored transaction once when opened with a payment ID. It does not automatically poll, and the status endpoint does not query the provider. Pending only means the backend has not recorded paid yet; wait and refresh later rather than paying again just because the return page has not updated.'}
                </Prose>

                <DocSubSection title={t ? 'Vì sao bước này quan trọng?' : 'Why this matters'}>
                    <Prose>
                        {t
                            ? 'Bạn có thể trở về app trước webhook. Nguồn trạng thái là payment record backend đã cập nhật từ webhook hợp lệ, không phải nội dung query string hoặc lời báo thành công trên ví. Nếu pending kéo dài, liên hệ hỗ trợ bằng payment ID và thời điểm/số tiền, không gửi credential hoặc token.'
                            : 'You can return before the webhook arrives. Status comes from the backend payment record updated by a valid webhook, not return query strings or a wallet success message. If pending persists, contact support with the payment ID and time/amount, never credentials or tokens.'}
                    </Prose>
                </DocSubSection>
            </DocSection>

            <DocSection title={t ? 'Lịch sử, hết hạn và mua thêm kỳ hạn' : 'History, expiration, and additional duration'}>
                <Prose>
                    {t
                        ? 'Profile billing có lịch sử giao dịch và ngày hết hạn. Thanh toán mới đã xác thực cộng 30 hoặc 365 ngày từ mốc muộn hơn giữa thời điểm hiện tại và ngày hết hạn còn hiệu lực; mua khi đang active không bắt đầu lại kỳ cũ. Đây là cộng kỳ hạn từ giao dịch mới, không phải cam kết tự động gia hạn/khấu trừ định kỳ.'
                        : 'Profile billing includes transaction history and expiration. A newly verified payment adds 30 or 365 days from the later of now and the still-active expiry; purchasing while active does not restart the existing period. This is additive duration from a new transaction, not a promise of automatic renewal or recurring debits.'}
                </Prose>
                <Callout type="info">
                    <p className="text-sm">
                        {t
                            ? 'UI/API hiện không cung cấp flow tự phục vụ refund hoặc cancel subscription; tài liệu này không đặt chính sách hoàn tiền/hủy mới. Nếu cần xử lý giao dịch, liên hệ kênh hỗ trợ riêng với payment ID, provider, số tiền/thời điểm và trạng thái. Không đăng công khai dữ liệu thanh toán cá nhân, OTP, token, API key hoặc bí mật ví.'
                            : 'The current UI/API does not offer a self-service refund or subscription-cancel flow; this documentation does not establish a new refund/cancellation policy. For a transaction issue, use a private support channel with the payment ID, provider, amount/time, and status. Do not post personal payment details, OTPs, tokens, API keys, or wallet secrets publicly.'}
                    </p>
                </Callout>
                <Prose>
                    <a href={publicPath(lang, '/docs/data-handling')}>
                        {t ? 'Đọc cách xử lý dữ liệu thanh toán và lưu trữ' : 'Read about payment data handling and retention'}
                    </a>
                </Prose>
            </DocSection>

            <DocSection title={t ? 'Biến môi trường cần cho billing thật' : 'Environment variables for real billing'}>
                <CodeBlock title={t ? 'Billing provider envs' : 'Billing provider envs'}>
                    <CodeComment>{t ? 'Ví dụ sandbox/local; dùng endpoint và credential production của deployment khi vận hành thật' : 'Sandbox/local examples; use the deployment’s production endpoints and credentials for live payments'}</CodeComment>
                    <CodeComment>{t ? 'MoMo' : 'MoMo'}</CodeComment>
                    <CodeLine>MOMO_PARTNER_CODE=...</CodeLine>
                    <CodeLine>MOMO_ACCESS_KEY=...</CodeLine>
                    <CodeLine>MOMO_SECRET_KEY=...</CodeLine>
                    <CodeLine>MOMO_CREATE_URL=https://test-payment.momo.vn/v2/gateway/api/create</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'ZaloPay' : 'ZaloPay'}</CodeComment>
                    <CodeLine>ZALOPAY_APP_ID=...</CodeLine>
                    <CodeLine>ZALOPAY_KEY1=...</CodeLine>
                    <CodeLine>ZALOPAY_KEY2=...</CodeLine>
                    <CodeLine>ZALOPAY_CREATE_URL=https://sb-openapi.zalopay.vn/v2/create</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Public return / webhook context' : 'Public return / webhook context'}</CodeComment>
                    <CodeLine>FRONTEND_URL=http://localhost:5173</CodeLine>
                    <CodeLine>API_PUBLIC_URL=http://localhost:3001/api</CodeLine>
                </CodeBlock>
            </DocSection>

            <Callout type="warning">
                <p className="text-sm">
                    {t
                        ? 'Khi kiểm tra billing public, xác nhận đủ checkout, webhook hợp lệ/không hợp lệ, record paid, profile refresh, lịch sử và ngày hết hạn. Return URL không phải nguồn kích hoạt. Các URL test/sandbox ở ví dụ không chứng minh thanh toán production hoạt động; webhook cần backend có thể nhận request từ provider.'
                        : 'For public billing validation, cover checkout, valid/invalid webhooks, paid records, profile refresh, history, and expiration. The return URL is not the activation source. Test/sandbox URLs in the example do not establish production payment readiness; the provider must be able to reach the backend webhook.'}
                </p>
            </Callout>

            <Callout type="info">
                <p className="text-sm font-medium">
                    {t
                        ? 'Pro hiện là trạng thái theo thời gian trên user profile. Tài liệu này không hứa tính năng trả phí, quota mới, hoặc bỏ qua quyền truy cập database/team. Chỉ coi ngày hết hạn là cập nhật sau khi backend đã xử lý webhook thành công và profile đã được tải lại.'
                        : 'Pro is currently a time-based status on the user profile. This page does not promise paid features, new quotas, or bypasses of database/team permissions. Treat expiration as updated only after the backend handles a successful webhook and the profile reloads.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
