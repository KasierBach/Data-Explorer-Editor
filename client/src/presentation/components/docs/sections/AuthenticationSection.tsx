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
            title={t ? 'Xác thực, đồng ý pháp lý & Onboarding' : 'Authentication, Legal Consent & Onboarding'}
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
                            ? 'Tài khoản đăng ký local xác minh email bằng OTP 6 chữ số có hiệu lực 15 phút. OAuth dùng email đã được provider xác minh thay vì bắt mọi người dùng social login qua cùng bước OTP local.'
                            : 'Locally registered accounts verify email with a 6-digit OTP valid for 15 minutes. OAuth relies on an email verified by the provider instead of sending every social-login user through the local OTP step.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<UserCheck className="w-6 h-6 text-purple-500" />} title={t ? 'Social login + onboarding' : 'Social login and onboarding'} color="purple">
                    <p>
                        {t
                            ? 'Google/GitHub cần trả email đã được xác minh. Sau đăng nhập, app kiểm tra đồng ý pháp lý trước, rồi onboarding nếu chưa hoàn tất; có token không đồng nghĩa đã vào workspace chính.'
                            : 'Google/GitHub must provide a verified email. After sign-in, the app checks legal consent first, then incomplete onboarding; having tokens does not mean the main workspace is ready.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Luồng đăng ký và xác minh email' : 'Email registration and verification'}>
                <Prose>
                    {t
                        ? 'Local auth đăng ký bằng tên, email và mật khẩu, rồi yêu cầu OTP xác minh 6 chữ số (15 phút). Sau xác minh/đăng nhập, điều hướng còn kiểm tra đồng ý các tài liệu pháp lý hiện hành và onboarding trước khi vào workspace. Đăng ký thành công không tự bỏ qua các bước này.'
                        : 'Local auth registers a name, email, and password, then requires a 6-digit verification OTP (15 minutes). After verification/sign-in, navigation still checks consent to the current legal documents and onboarding before the workspace. Successful registration does not bypass these gates.'}
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
                        ? 'Google/GitHub đi qua callback backend và chỉ chấp nhận email được provider xác minh; không bắt buộc OTP local cho OAuth. Backend đưa mã exchange ngắn hạn về client để lấy phiên app. Sau đó app kiểm tra legal consent, rồi onboarding trước route workspace.'
                        : 'Google/GitHub use a backend callback and require a provider-verified email; OAuth does not require the local OTP step. The backend returns a short-lived exchange code to the client for an app session. The app then checks legal consent, followed by onboarding before the workspace route.'}
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
                                ? 'Sau login, app nạp user và kiểm tra legal consent rồi onboarding. Access token có thời hạn 1 giờ, refresh token 7 ngày và OAuth exchange code 2 phút; các thời hạn này là riêng biệt, không phải thời gian hiệu lực OTP hoặc cam kết phiên luôn hoạt động.'
                                : 'After login, the app hydrates the user and checks legal consent, then onboarding. Access tokens last 1 hour, refresh tokens 7 days, and OAuth exchange codes 2 minutes; these are separate lifetimes, not OTP expiry or a guarantee that a session always remains usable.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<UserCheck className="w-5 h-5 text-blue-500" />} title={t ? 'Onboarding tách riêng khỏi auth' : 'Onboarding is separate from auth'} color="blue">
                        <p className="text-xs">
                            {t
                                ? 'Thứ tự điều hướng là đăng nhập → legal consent còn thiếu → onboarding chưa hoàn tất → workspace. Nếu isOnboarded chưa hoàn tất, người dùng vẫn phải làm onboarding sau khi đồng ý pháp lý; việc này không phải lỗi đăng nhập.'
                                : 'Navigation is sign-in → missing legal consent → incomplete onboarding → workspace. If isOnboarded is incomplete, the user still needs onboarding after legal consent; this is not a sign-in failure.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Khôi phục mật khẩu' : 'Password recovery'}>
                <Prose>
                    {t
                        ? 'Forgot password gửi OTP reset mật khẩu có hiệu lực 5 phút, khác OTP xác minh email 15 phút. Nhập mã và mật khẩu mới trong flow reset; mã hết hạn cần yêu cầu lại. Không gửi OTP, password hoặc token cho người hỗ trợ.'
                        : 'Forgot password sends a password-reset OTP valid for 5 minutes, separate from the 15-minute email-verification OTP. Enter the code and a new password in the reset flow; request another code if it expires. Never send an OTP, password, or token to support.'}
                </Prose>
            </DocSection>

            <DocSection title={t ? 'Đa ngôn ngữ và email hệ thống' : 'Localization and system emails'}>
                <Prose>
                    {t
                        ? 'Auth có bản dịch VI/EN cho nhiều màn hình, lỗi server và email, nhưng phần copy/locale của onboarding chưa đồng bộ đầy đủ; không giả định mọi bước luôn dùng đúng ngôn ngữ đã chọn. Khi dev thiếu cấu hình mail, đường debug có thể ghi OTP/nội dung mail vào log; đây không phải đảm bảo email được gửi thật trong production. Kiểm tra mail provider và delivery end-to-end, không chia sẻ log chứa mã.'
                        : 'Auth localizes many screens, server errors, and emails in VI/EN, but onboarding copy/locale is not fully aligned; do not assume every step follows the selected language. In development, missing mail configuration can use a debug path that logs OTP/mail content; it is not a production delivery guarantee. Verify the mail provider and end-to-end delivery, and do not share logs containing codes.'}
                </Prose>
            </DocSection>

            <DocSection title={t ? 'Biến môi trường auth thường phải kiểm tra' : 'Auth environment variables you should verify'}>
                <CodeBlock title={t ? 'Core auth envs' : 'Core auth envs'}>
                    <CodeComment>{t ? 'Sinh secret riêng cho mỗi deployment; chạy từng lệnh và đưa kết quả vào server/.env' : 'Generate independent deployment secrets; run each command and place its output in server/.env'}</CodeComment>
                    <CodeLine>{'node -e "console.log(\'JWT_SECRET=\' + require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"'}</CodeLine>
                    <CodeLine>{'node -e "console.log(\'REFRESH_TOKEN_SECRET=\' + require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"'}</CodeLine>
                    <CodeLine>{'node -e "console.log(\'ENCRYPTION_KEY=\' + require(\'node:crypto\').randomBytes(24).toString(\'base64url\'))"'}</CodeLine>
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
                <Prose>
                    {t
                        ? 'JWT_SECRET và REFRESH_TOKEN_SECRET cần ít nhất 32 byte UTF-8, không dùng lại cùng giá trị. ENCRYPTION_KEY phải đúng 32 byte UTF-8: lệnh base64url từ 24 byte ngẫu nhiên phía trên tạo 32 ký tự ASCII, được dùng như text chứ không decode base64. Không dùng 32 ký tự Unicode hoặc hex từ 32 byte (64 ký tự) làm key này. Thay key mà không có kế hoạch legacy-key/migration có thể khiến secret đã mã hóa không đọc được.'
                        : 'JWT_SECRET and REFRESH_TOKEN_SECRET need at least 32 UTF-8 bytes; do not reuse the same value. ENCRYPTION_KEY must be exactly 32 UTF-8 bytes: the 24-random-byte base64url command above produces 32 ASCII characters used as text, not decoded base64. Do not substitute 32 Unicode characters or 32-byte hex (64 characters) for this key. Changing it without a legacy-key/migration plan can make encrypted secrets unreadable.'}
                </Prose>
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
