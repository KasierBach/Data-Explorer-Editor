import { Server, Globe, Shield, Rocket, Database, KeyRound } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, CodeBlock, CodeComment, CodeLine, Callout, InfoCard } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function DeploymentSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Triển khai Production' : 'Production Deployment'}
            subtitle={t
                ? 'Checklist thực dụng để đưa Data Explorer lên web thật, gồm Render/Vercel, env bắt buộc, db push, OAuth callback, và những lỗi deploy hay gặp nhất.'
                : 'A practical checklist for shipping Data Explorer to production, including Render/Vercel, required envs, db push, OAuth callbacks, and the most common deployment pitfalls.'}
            gradient
        >
            <div className="grid md:grid-cols-2 gap-6 mb-12">
                <div className="p-8 border rounded-3xl bg-gradient-to-br from-blue-500/10 via-background to-background">
                    <Rocket className="w-10 h-10 text-blue-500 mb-6" />
                    <h3 className="text-xl font-bold mb-3">{t ? 'Frontend: Vercel' : 'Frontend: Vercel'}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t
                            ? 'Phù hợp để deploy client nhanh, CDN tốt, và chỉ cần trỏ VITE_API_URL về backend.'
                            : 'Great for shipping the client quickly, with strong CDN behavior and only one required API URL to point to the backend.'}
                    </p>
                </div>
                <div className="p-8 border rounded-3xl bg-gradient-to-br from-emerald-500/10 via-background to-background">
                    <Server className="w-10 h-10 text-emerald-500 mb-6" />
                    <h3 className="text-xl font-bold mb-3">{t ? 'Backend: Render' : 'Backend: Render'}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t
                            ? 'Phù hợp để chạy NestJS backend và Prisma, miễn là build command có bước sync schema trước khi boot.'
                            : 'A solid fit for the NestJS backend and Prisma, as long as your build command syncs the schema before boot.'}
                    </p>
                </div>
            </div>

            <DocSection title={t ? '1. Build commands khuyên dùng' : '1. Recommended build commands'}>
                <DocSubSection title={t ? 'Backend service (Render)' : 'Backend service (Render)'}>
                    <CodeBlock title={t ? 'Build command' : 'Build command'}>
                        <CodeLine>npx prisma db push && npm run build</CodeLine>
                    </CodeBlock>
                    <CodeBlock title={t ? 'Start command' : 'Start command'}>
                        <CodeLine>npm run start:prod</CodeLine>
                    </CodeBlock>
                    <Callout type="warning">
                        <p className="text-sm">
                            {t
                                ? 'Repo hiện tại chưa sẵn sàng cho prisma migrate deploy xuyên suốt mọi môi trường. Nếu bạn đang deploy bản app này, hãy dùng db push để đồng bộ schema production.'
                                : 'The current repo is not yet fully aligned for prisma migrate deploy across every environment. For this app version, use db push to sync production schema.'}
                        </p>
                    </Callout>
                </DocSubSection>

                <DocSubSection title={t ? 'Frontend service (Vercel)' : 'Frontend service (Vercel)'}>
                    <CodeBlock title={t ? 'Frontend env' : 'Frontend env'}>
                        <CodeLine>VITE_API_URL=https://your-backend-domain.com/api</CodeLine>
                    </CodeBlock>
                </DocSubSection>
            </DocSection>

            <DocSection title={t ? '2. Biến môi trường bắt buộc' : '2. Required environment variables'}>
                <div className="grid gap-4 mt-4">
                    {[
                        { icon: <Database className="w-4 h-4" />, key: 'DATABASE_URL', descVi: 'Database trung tâm của ứng dụng.', descEn: 'The central database for the application.' },
                        { icon: <KeyRound className="w-4 h-4" />, key: 'JWT_SECRET', descVi: 'Secret mạnh để ký access token. Placeholder sẽ bị backend từ chối.', descEn: 'A strong secret used to sign access tokens. Placeholder values will be rejected by the backend.' },
                        { icon: <Shield className="w-4 h-4" />, key: 'REFRESH_TOKEN_SECRET', descVi: 'Khuyến nghị dùng secret riêng cho refresh token cookie. Nếu để trống, app sẽ fallback về JWT_SECRET.', descEn: 'Recommended separate secret for the refresh-token cookie. If omitted, the app falls back to JWT_SECRET.' },
                        { icon: <Shield className="w-4 h-4" />, key: 'ENCRYPTION_KEY', descVi: 'Phải đúng 32 ký tự để mã hóa saved connection passwords.', descEn: 'Must be exactly 32 characters to encrypt saved connection passwords.' },
                        { icon: <Globe className="w-4 h-4" />, key: 'FRONTEND_URL', descVi: 'Origin frontend thật dùng cho CORS và OAuth redirects.', descEn: 'The real frontend origin used for CORS and OAuth redirects.' }
                    ].map((env) => (
                        <div key={env.key} className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/10 px-4 py-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-primary/10 p-2 text-primary">{env.icon}</div>
                                <code className="text-xs font-bold text-primary">{env.key}</code>
                            </div>
                            <span className="text-xs text-muted-foreground text-right max-w-[34rem]">
                                {t ? env.descVi : env.descEn}
                            </span>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? '3. OAuth checklist' : '3. OAuth checklist'}>
                <ul className="grid gap-3">
                    {[
                        t ? 'GOOGLE_CALLBACK_URL và GITHUB_CALLBACK_URL phải trỏ về backend thật, ví dụ https://your-backend.onrender.com/api/auth/google/callback.' : 'GOOGLE_CALLBACK_URL and GITHUB_CALLBACK_URL must point to the real backend, for example https://your-backend.onrender.com/api/auth/google/callback.',
                        t ? 'FRONTEND_URL phải khớp origin thực tế của client, nếu không exchange flow sau /login#code=... sẽ fail.' : 'FRONTEND_URL must match the real client origin, otherwise the exchange flow after /login#code=... will fail.',
                        t ? 'Với frontend và backend khác domain ở production, hãy dùng HTTPS để refresh-token cookie có thể chạy với secure + sameSite phù hợp.' : 'When the frontend and backend live on different production domains, use HTTPS so the refresh-token cookie can work with the correct secure + sameSite policy.',
                        t ? 'Sau mỗi lần đổi env OAuth, redeploy backend để callback/controller nạp cấu hình mới.' : 'After changing any OAuth env, redeploy the backend so the callback/controller loads the new configuration.'
                    ].map((item) => (
                        <li key={item} className="rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-xs text-muted-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
            </DocSection>

            <DocSection title={t ? '4. AI provider envs' : '4. AI provider envs'}>
                <CodeBlock title={t ? 'Optional AI lanes' : 'Optional AI lanes'}>
                    <CodeComment>{t ? 'Premium lane' : 'Premium lane'}</CodeComment>
                    <CodeLine>GEMINI_API_KEY=...</CodeLine>
                    <CodeLine>AI_PROVIDER_TIMEOUT_MS=15000</CodeLine>
                    <CodeLine>AI_STREAM_IDLE_TIMEOUT_MS=15000</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Lower-cost lane' : 'Lower-cost lane'}</CodeComment>
                    <CodeLine>CEREBRAS_API_KEY=...</CodeLine>
                    <CodeLine>CEREBRAS_BASE_URL=https://api.cerebras.ai/v1</CodeLine>
                    <CodeLine>CEREBRAS_CHAT_MODEL=llama3.1-8b</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Fallback lane' : 'Fallback lane'}</CodeComment>
                    <CodeLine>OPENROUTER_API_KEY=...</CodeLine>
                    <CodeLine>OPENROUTER_BASE_URL=https://openrouter.ai/api/v1</CodeLine>
                    <CodeLine>OPENROUTER_CHAT_MODEL=openrouter/auto</CodeLine>
                </CodeBlock>
            </DocSection>

            <DocSection title={t ? '5. Những lỗi deploy hay gặp' : '5. Common deployment failures'}>
                <div className="grid md:grid-cols-3 gap-4">
                    <InfoCard icon={<Database className="w-4 h-4" />} title={t ? 'Schema lệch' : 'Schema drift'} color="amber">
                        <p className="text-[10px]">
                            {t ? 'Backend lên code mới nhưng DB chưa db push, gây lỗi 500 ở login hoặc dashboard APIs.' : 'The backend ships new code but the database has not been db pushed yet, causing 500 errors in login or dashboard APIs.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Shield className="w-4 h-4" />} title={t ? 'Secret yếu' : 'Weak secret'} color="red">
                        <p className="text-[10px]">
                            {t ? 'JWT_SECRET placeholder sẽ làm backend không khởi động được.' : 'A placeholder JWT_SECRET will prevent the backend from booting.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Globe className="w-4 h-4" />} title={t ? 'Callback sai domain' : 'Wrong callback domain'} color="blue">
                        <p className="text-[10px]">
                            {t ? 'Google/GitHub login fail nếu callback URL hoặc FRONTEND_URL không khớp deployment thật.' : 'Google/GitHub login will fail if callback URLs or FRONTEND_URL do not match the real deployment.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <Callout type="tip">
                <p className="text-sm">
                    {t
                        ? 'Nếu bạn chỉ muốn ship nhanh: Vercel cho client, Render cho backend, set env chuẩn, chạy db push trong build command, rồi test login + health check + 1 query thật trước khi public.'
                        : 'If you just want to ship quickly: use Vercel for the client, Render for the backend, set the envs correctly, run db push in the build command, then test login + health check + one real query before going public.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
