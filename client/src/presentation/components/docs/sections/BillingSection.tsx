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

interface Props { lang: 'vi' | 'en'; }

export function BillingSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Billing & Subscription' : 'Billing & Subscription'}
            subtitle={t
                ? 'Tài liệu cho phần thanh toán thật của Data Explorer: gói Pro, flow checkout, trạng thái subscription, MoMo/ZaloPay, webhook xác nhận, và các lưu ý deploy cho môi trường thật.'
                : 'Documentation for Data Explorer’s real billing layer: Pro plans, checkout flow, subscription states, MoMo/ZaloPay, webhook confirmation, and production deployment notes.'}
            gradient
        >
            <FeatureGrid columns={3}>
                <InfoCard icon={<Wallet className="w-6 h-6 text-emerald-500" />} title={t ? 'Gói Free và Pro' : 'Free and Pro plans'} color="emerald">
                    <p>
                        {t
                            ? 'Billing hiện không còn là mock. Người dùng có thể giữ trạng thái Free hoặc mua Pro theo kỳ hạn rõ ràng, với thời gian hiệu lực được phản ánh lại lên hồ sơ.'
                            : 'Billing is no longer mocked. Users can stay on Free or purchase time-based Pro access, and that state flows back into the user profile.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<CreditCard className="w-6 h-6 text-blue-500" />} title={t ? 'Checkout thật qua provider' : 'Real provider checkout'} color="blue">
                    <p>
                        {t
                            ? 'MoMo và ZaloPay không chỉ là nút UI. Mỗi lần checkout tạo payment flow thật, trả về provider session, rồi chờ webhook xác nhận trước khi cấp Pro.'
                            : 'MoMo and ZaloPay are not cosmetic buttons. Each checkout creates a real provider flow, returns a payment session, and waits for webhook confirmation before Pro access is granted.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<ShieldCheck className="w-6 h-6 text-purple-500" />} title={t ? 'Kích hoạt sau webhook' : 'Activation after webhook'} color="purple">
                    <p>
                        {t
                            ? 'App không nên bật Pro chỉ vì người dùng vừa bấm thanh toán. Quyền truy cập được nâng cấp sau khi backend nhận và xác thực tín hiệu hoàn tất từ provider.'
                            : 'The app should not activate Pro just because the user clicked pay. Access is upgraded only after the backend receives and validates the completion signal from the provider.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Người dùng sẽ thấy gì trong UI?' : 'What users see in the UI'}>
                <Prose>
                    {t
                        ? 'Trong profile dialog, người dùng thấy gói hiện tại, trạng thái subscription, ngày hết hạn nếu đang active, và các lựa chọn checkout theo kỳ. Bản copy hiện tại hiển thị VND là giá thực tế, còn USD chỉ là tham chiếu để người đọc quốc tế dễ hiểu hơn.'
                        : 'Inside the profile dialog, users see the current plan, subscription state, expiration date when active, and checkout options by cadence. The current copy treats VND as the real charge currency, while USD remains reference copy only.'}
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
                                ? 'Nút refresh cho phép người dùng kéo lại trạng thái billing sau khi vừa thanh toán hoặc vừa quay từ provider về, thay vì phải đăng xuất/đăng nhập lại.'
                                : 'The refresh action lets the user pull billing state again after payment or after returning from a provider, without needing to sign out and back in.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Checkout lifecycle từ lúc bấm mua đến lúc có Pro' : 'The checkout lifecycle from click to activation'}>
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
                            title: t ? '4. Webhook xác nhận và app nâng quyền' : '4. Webhook confirms and the app upgrades access',
                            desc: t
                                ? 'Chỉ sau khi backend nhận webhook hợp lệ hoặc kiểm tra trạng thái thành công thì tài khoản mới được chuyển sang Pro active. Đây là khác biệt quan trọng giữa billing thật và billing demo.'
                                : 'Only after the backend receives a valid webhook or verifies a successful payment state does the account move into active Pro. That is the critical difference between real billing and a demo checkout.',
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
                        ? 'Client có một billing return page để đón người dùng sau khi provider trả họ về app. Trang này không nên tự ý tuyên bố “đã thành công” nếu webhook hoặc lần kiểm tra trạng thái cuối chưa xác nhận xong.'
                        : 'The client includes a billing return page to receive users after the provider redirects them back. That page should not declare victory on its own if the webhook or final status check has not completed yet.'}
                </Prose>

                <DocSubSection title={t ? 'Vì sao bước này quan trọng?' : 'Why this matters'}>
                    <Prose>
                        {t
                            ? 'Trong billing thật, người dùng có thể quay lại app trước khi hệ thống hậu trường xử lý xong. Return page là lớp UX để nối lại trải nghiệm, nhưng nguồn chân lý cuối cùng vẫn phải là backend và trạng thái giao dịch đã xác thực.'
                            : 'In real billing, a user can return to the app before the background system has finished processing everything. The return page is a UX bridge, but the final source of truth must still be the backend and the verified payment state.'}
                    </Prose>
                </DocSubSection>
            </DocSection>

            <DocSection title={t ? 'Biến môi trường cần cho billing thật' : 'Environment variables for real billing'}>
                <CodeBlock title={t ? 'Billing provider envs' : 'Billing provider envs'}>
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
                        ? 'Nếu bạn test billing ở môi trường public, đừng chỉ kiểm tra “nút bấm có mở được provider không”. Hãy test đủ cả vòng: tạo checkout, redirect về app, webhook xác nhận, refresh trạng thái user, và hiển thị ngày hết hạn sau khi Pro active.'
                        : 'When testing billing on a public environment, do not stop at “the payment button opens the provider.” Test the whole loop: create checkout, return to the app, webhook confirmation, user-state refresh, and the final expiration date once Pro is active.'}
                </p>
            </Callout>

            <Callout type="info">
                <p className="text-sm font-medium">
                    {t
                        ? 'Billing trong Data Explorer không phải một module tách rời khỏi auth. Quyền truy cập Pro cuối cùng vẫn đi về user profile, nên auth, billing, webhook, và profile refresh luôn là một chuỗi liên thông.'
                        : 'Billing in Data Explorer is not isolated from auth. Pro access eventually lands back on the user profile, so auth, billing, webhook handling, and profile refresh form one connected chain.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
