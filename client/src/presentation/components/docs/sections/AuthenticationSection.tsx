import {
    KeyRound,
    MailCheck,
    Shield,
    UserCheck,
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

export function AuthenticationSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Authentication & Onboarding' : 'Authentication & Onboarding'}
            subtitle={t
                ? 'Tổng hợp toàn bộ luồng truy cập của người dùng: đăng ký bằng email, OTP xác minh, đăng nhập, OAuth, onboarding sau lần vào đầu tiên, và các lưu ý bảo mật/đa ngôn ngữ liên quan.'
                : 'A complete guide to user access flows: email registration, OTP verification, sign-in, OAuth, first-time onboarding, and the related security and localization behavior.'}
            gradient
        >
            <FeatureGrid columns={3}>
                <InfoCard icon={<KeyRound className="w-6 h-6 text-blue-500" />} title={t ? 'Email + password' : 'Email and password'} color="blue">
                    <p>
                        {t
                            ? 'App hỗ trợ đăng ký và đăng nhập nội bộ với flow xác minh email rõ ràng, thay vì coi tài khoản local là “hạng hai” so với social login.'
                            : 'The app supports first-class local registration and sign-in with a clear email-verification flow rather than treating local accounts as second-class citizens.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<MailCheck className="w-6 h-6 text-emerald-500" />} title={t ? 'OTP xác minh' : 'OTP verification'} color="emerald">
                    <p>
                        {t
                            ? 'Người dùng mới phải xác minh email bằng mã OTP trước khi đi tiếp. Điều này giảm tài khoản rác và giúp luồng mời/invite đáng tin hơn.'
                            : 'New users verify their email with an OTP before continuing. That reduces junk accounts and makes invitation flows more trustworthy.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<UserCheck className="w-6 h-6 text-purple-500" />} title={t ? 'Social login + onboarding' : 'Social login and onboarding'} color="purple">
                    <p>
                        {t
                            ? 'Google/GitHub có thể đưa người dùng vào app nhanh hơn, nhưng app vẫn giữ bước onboarding để quyết định người dùng nên vào workspace chính hay hoàn tất thiết lập ban đầu trước.'
                            : 'Google/GitHub can bring users into the product faster, but the app still keeps onboarding as a gate to decide whether they should enter the main workspace or complete first-time setup first.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Luồng đăng ký và xác minh email' : 'Email registration and verification'}>
                <Prose>
                    {t
                        ? 'Local auth của Data Explorer được thiết kế để có thể đứng độc lập, không phụ thuộc vào OAuth. Người dùng mới đăng ký bằng tên, email, mật khẩu; nếu tài khoản chưa xác minh, UI chuyển ngay sang màn hình OTP thay vì để họ “đăng nhập nửa chừng” rồi mới vấp lỗi ở sâu bên trong.'
                        : 'Data Explorer’s local auth is designed to stand on its own rather than depend on OAuth. New users register with a name, email, and password; if the account is still unverified, the UI switches immediately into OTP verification instead of letting them stumble into deeper flows first.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Đăng ký thành công nhưng chưa vào app ngay' : 'Successful registration does not mean immediate access'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Sau khi đăng ký, app có thể trả trạng thái “unverified” để ép đi qua bước OTP. Đây là hành vi chủ động, không phải lỗi.'
                                : 'After registration, the app may return an “unverified” state to force the OTP step. This is intentional behavior, not a failure.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Resend OTP là đường lui hợp lệ' : 'Resend OTP is a supported recovery path'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Người dùng có thể yêu cầu gửi lại mã mà không phải tạo tài khoản lại từ đầu. Điều này đặc biệt quan trọng trong môi trường email chậm hoặc mail vào spam.'
                                : 'Users can request a new code without recreating the account. This matters in real-world mail delays and spam-folder scenarios.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Google, GitHub, và callback flows' : 'Google, GitHub, and callback flows'}>
                <Prose>
                    {t
                        ? 'Social login không chỉ là nút “đăng nhập cho đẹp”. Nó là một route thật đi qua backend, trao đổi code lấy token, rồi mới hydrate user state về client. Sau khi hoàn tất, app còn kiểm tra onboarding để quyết định route cuối cùng.'
                        : 'Social login is not just a decorative button. It is a real backend route that exchanges an OAuth code for tokens and only then hydrates user state on the client. After that, the app still checks onboarding before deciding the final route.'}
                </Prose>

                <DocSubSection title={t ? 'Điểm cần nhớ khi cấu hình callback URL' : 'What matters when configuring callback URLs'}>
                    <Prose>
                        {t
                            ? 'Callback URL phải trỏ về backend thật, không phải frontend route giả. Đây là nơi provider trả code về để backend đổi lấy token và tạo phiên đăng nhập hợp lệ cho app.'
                            : 'The callback URL must point to the real backend, not a fake frontend route. That is where the provider returns the code so the backend can exchange it for tokens and create a valid app session.'}
                    </Prose>
                </DocSubSection>
            </DocSection>

            <DocSection title={t ? 'Session, onboarding, và trạng thái người dùng' : 'Session, onboarding, and user state'}>
                <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard icon={<Shield className="w-5 h-5 text-emerald-500" />} title={t ? 'Token chỉ là điểm bắt đầu' : 'Tokens are only the starting point'} color="emerald">
                        <p className="text-xs">
                            {t
                                ? 'Sau khi login thành công, app còn nạp dữ liệu người dùng và trạng thái quan trọng khác như connections để người dùng vào workspace với ngữ cảnh hoàn chỉnh hơn.'
                                : 'After a successful login, the app still hydrates the user and supporting state such as connections so the workspace opens with meaningful context.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<UserCheck className="w-5 h-5 text-blue-500" />} title={t ? 'Onboarding tách riêng khỏi auth' : 'Onboarding is separate from auth'} color="blue">
                        <p className="text-xs">
                            {t
                                ? 'Đăng nhập thành công không đồng nghĩa người dùng đã sẵn sàng vào trang chính. Nếu `isOnboarded` chưa hoàn tất, app điều hướng sang onboarding để hoàn thành bước thiết lập ban đầu.'
                                : 'A successful login does not automatically mean the user should land on the main workspace. If `isOnboarded` is still incomplete, the app redirects into onboarding first.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Đa ngôn ngữ và email hệ thống' : 'Localization and system emails'}>
                <Prose>
                    {t
                        ? 'Phần auth không chỉ dịch giao diện. Hệ thống còn có i18n đi xuyên server-side error messages, email xác minh, email reset mật khẩu, cảnh báo bảo mật, và các template thư khác. Điều này rất quan trọng nếu app chạy cho nhiều team có ngôn ngữ mặc định khác nhau.'
                        : 'Authentication is not only localized in the UI. The system also localizes server-side error messages, verification mail, password-reset mail, security alerts, and other templates. That matters when the product serves teams with different default languages.'}
                </Prose>
            </DocSection>

            <DocSection title={t ? 'Biến môi trường auth thường phải kiểm tra' : 'Auth environment variables you should verify'}>
                <CodeBlock title={t ? 'Core auth envs' : 'Core auth envs'}>
                    <CodeComment>{t ? 'Bảo mật cốt lõi' : 'Core security'}</CodeComment>
                    <CodeLine>JWT_SECRET=replace-with-a-random-secret-at-least-32-bytes-long</CodeLine>
                    <CodeLine>REFRESH_TOKEN_SECRET=another-very-long-secret</CodeLine>
                    <CodeLine>ENCRYPTION_KEY=12345678901234567890123456789012</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'OAuth providers' : 'OAuth providers'}</CodeComment>
                    <CodeLine>GOOGLE_CLIENT_ID=...</CodeLine>
                    <CodeLine>GOOGLE_CLIENT_SECRET=...</CodeLine>
                    <CodeLine>GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback</CodeLine>
                    <CodeLine>GITHUB_CLIENT_ID=...</CodeLine>
                    <CodeLine>GITHUB_CLIENT_SECRET=...</CodeLine>
                    <CodeLine>GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Mail dùng cho OTP / reset / verify' : 'Mail used for OTP / reset / verify'}</CodeComment>
                    <CodeLine>MAIL_USER=your-email@example.com</CodeLine>
                    <CodeLine>MAIL_PASS=your-provider-key</CodeLine>
                </CodeBlock>
            </DocSection>

            <Callout type="warning">
                <p className="text-sm">
                    {t
                        ? 'Auth là lớp cực nhạy cảm: callback URL sai, JWT secret yếu, hoặc mail config thiếu đều có thể biến trải nghiệm người dùng thành “đăng ký được nhưng không vào được app”. Khi deploy thật, hãy verify trọn vẹn cả local auth lẫn social auth bằng end-to-end flow.'
                        : 'Authentication is a sensitive layer: a bad callback URL, weak JWT secret, or missing mail configuration can turn the experience into “registration works, but nobody can actually enter the app.” In production, verify both local and social auth end-to-end.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
