import { Lock, ShieldCheck, KeyRound, Database, AlertTriangle } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function SecuritySection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Bảo mật & Quyền riêng tư' : 'Security & Privacy'}
            subtitle={t
                ? 'Những lớp bảo vệ hiện có trong Data Explorer, cách chúng hoạt động, và những giới hạn bạn vẫn cần hiểu trước khi dùng app với dữ liệu thật.'
                : 'The security layers currently present in Data Explorer, how they work, and the limits you should still understand before using the app with real data.'}
        >
            <FeatureGrid>
                <InfoCard icon={<Lock className="w-6 h-6 text-blue-500" />} title="AES-256-GCM" color="blue">
                    <p>
                        {t
                            ? 'Saved connection passwords được mã hóa bằng AES-256-GCM trước khi lưu. Đây là lớp bảo vệ chính cho credential ở phía backend.'
                            : 'Saved connection passwords are encrypted with AES-256-GCM before persistence. This is the primary backend protection layer for stored credentials.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<ShieldCheck className="w-6 h-6 text-emerald-500" />} title={t ? 'Connection guardrails' : 'Connection guardrails'} color="emerald">
                    <p>
                        {t
                            ? 'Mỗi connection có thể được cấu hình read-only, cấm schema changes, cấm import/export, hoặc cấm query execution hoàn toàn.'
                            : 'Each connection can be configured as read-only, block schema changes, block import/export, or disable query execution entirely.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<KeyRound className="w-6 h-6 text-amber-500" />} title={t ? 'Secret enforcement' : 'Secret enforcement'} color="amber">
                    <p>
                        {t
                            ? 'Backend từ chối khởi động nếu JWT secret quá yếu hoặc đang dùng placeholder. Điều này giúp tránh deploy production với config mặc định nguy hiểm.'
                            : 'The backend refuses to boot if the JWT secret is too weak or still using a placeholder. This helps prevent dangerous default production deployments.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Những gì app đang bảo vệ tốt' : 'What the app protects well today'}>
                <ul className="grid gap-3 mt-2">
                    {[
                        t ? 'Credential lưu trong app database được mã hóa thay vì để plain text.' : 'Credentials stored in the app database are encrypted instead of kept in plaintext.',
                        t ? 'OAuth login không còn trả bearer token trực tiếp trên URL query string.' : 'OAuth login no longer returns bearer tokens directly in the URL query string.',
                        t ? 'Host validation và SSRF guard chặn tốt hơn các target nội bộ/nguy hiểm, kể cả MongoDB Atlas SRV flows.' : 'Host validation and SSRF guards better block dangerous/internal targets, including MongoDB Atlas SRV flows.',
                        t ? 'Connection health checks giúp phát hiện credential hỏng hoặc endpoint bị degrade sớm hơn.' : 'Connection health checks help surface broken credentials or degraded endpoints earlier.'
                    ].map((item) => (
                        <li key={item} className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
            </DocSection>

            <DocSection title={t ? 'Session và đăng nhập hiện tại' : 'Current session and sign-in behavior'}>
                <Prose>
                    {t
                        ? 'Hiện tại app vẫn dùng JWT access token ở phía client để giữ trải nghiệm refresh mượt hơn. Điều này tiện cho UX, nhưng chưa phải mô hình production-hardening mạnh nhất.'
                        : 'The app currently still uses a client-side JWT access token to keep refresh behavior smoother. This is convenient for UX, but it is not the strongest possible production-hardening model yet.'}
                </Prose>
                <Callout type="warning">
                    <p className="text-sm">
                        {t
                            ? 'Nếu bạn cần mô hình an toàn hơn cho production, hướng tiếp theo nên là httpOnly cookie + refresh token thay vì chỉ dựa vào persisted client token.'
                            : 'If you need a stronger production model, the next step should be httpOnly cookies plus refresh tokens instead of relying only on a persisted client token.'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Read-only và policy theo connection' : 'Read-only and connection policy controls'}>
                <div className="grid md:grid-cols-2 gap-4">
                    <InfoCard icon={<Database className="w-5 h-5 text-cyan-500" />} title={t ? 'Server-side enforcement' : 'Server-side enforcement'} color="blue">
                        <p className="text-xs">
                            {t
                                ? 'Các thao tác bị cấm như UPDATE, DELETE, DROP, schema edits, import, hoặc mutation NoSQL sẽ bị chặn ở backend, không chỉ ẩn ở UI.'
                                : 'Blocked operations such as UPDATE, DELETE, DROP, schema edits, import flows, or NoSQL mutations are rejected in the backend, not merely hidden in the UI.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} title={t ? 'AI actions vẫn cần kiểm tra' : 'AI actions still require review'} color="amber">
                        <p className="text-xs">
                            {t
                                ? 'Ngay cả khi AI gợi ý SQL hợp lý, bạn vẫn nên kiểm tra lại trước khi chạy, đặc biệt với index creation, schema changes, và các truy vấn ghi dữ liệu.'
                                : 'Even when AI suggestions look reasonable, you should still review them before execution, especially for index creation, schema changes, and write queries.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Best practices khuyến nghị' : 'Recommended best practices'}>
                <ul className="grid gap-3">
                    {[
                        t ? 'Dùng JWT_SECRET mạnh ít nhất 32 bytes và ENCRYPTION_KEY đúng 32 ký tự.' : 'Use a strong JWT_SECRET of at least 32 bytes and an ENCRYPTION_KEY that is exactly 32 characters.',
                        t ? 'Ưu tiên read-only connection cho production analytics hoặc tài khoản chỉ xem dữ liệu.' : 'Prefer read-only connections for production analytics or accounts that only need to inspect data.',
                        t ? 'Bật SSL/TLS với database cloud và xác nhận callback URL thật kỹ nếu dùng Google/GitHub login.' : 'Enable SSL/TLS for cloud databases and verify callback URLs carefully when using Google/GitHub login.',
                        t ? 'Không commit file .env và luôn rotate secret nếu chúng từng bị lộ trong git history hoặc logs.' : 'Never commit your .env file and always rotate secrets if they were ever exposed in git history or logs.'
                    ].map((item) => (
                        <li key={item} className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-xs text-muted-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
            </DocSection>
        </DocPageLayout>
    );
}
