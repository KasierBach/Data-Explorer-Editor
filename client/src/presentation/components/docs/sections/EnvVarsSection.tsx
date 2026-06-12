import { Key, Server, Globe, Database, Mail, Shield } from 'lucide-react';
import { Callout, DocPageLayout, DocSection, Prose } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function EnvVarsSection({ lang }: Props) {
    const t = lang === 'vi';

    const categories = [
        {
            title: t ? 'Cơ sở hạ tầng (Infrastructure)' : 'Infrastructure',
            icon: <Server className="w-5 h-5 text-blue-500" />,
            vars: [
                { name: 'PORT', desc: t ? 'Cổng server backend chạy (mặc định 3001)' : 'Backend server port (default 3001)', example: '3001' },
                { name: 'NODE_ENV', desc: t ? 'Môi trường chạy app' : 'App environment', example: 'development | production' },
                { name: 'REDIS_URL', desc: t ? 'URL kết nối tới Redis cho caching, presence và notification flows' : 'Redis connection URL for caching, presence, and notification flows', example: 'redis://localhost:6379' },
            ]
        },
        {
            title: t ? 'Bảo mật & Quản trị (Security & Admin)' : 'Security & Admin',
            icon: <Shield className="w-5 h-5 text-red-500" />,
            vars: [
                { name: 'JWT_SECRET', desc: t ? 'Secret mạnh để ký access token; backend sẽ từ chối placeholder yếu' : 'Strong secret for access-token signing; weak placeholder values are rejected by the backend', example: 'replace-with-a-random-secret-at-least-32-bytes-long' },
                { name: 'REFRESH_TOKEN_SECRET', desc: t ? 'Secret riêng cho refresh token; nếu để trống app có thể fallback về JWT_SECRET' : 'Separate secret for refresh tokens; if omitted the app may fall back to JWT_SECRET', example: 'another-very-long-secret' },
                { name: 'ENCRYPTION_KEY', desc: t ? 'Khóa đúng 32 ký tự để mã hóa saved connection passwords (AES-256)' : 'Exactly 32 characters for encrypting saved connection passwords (AES-256)', example: '12345678901234567890123456789012' },
                { name: 'LEGACY_ENCRYPTION_KEYS', desc: t ? 'Danh sách khóa cũ để đọc lại dữ liệu đã mã hóa từ các phiên bản trước' : 'Legacy keys used to read connection data encrypted by older versions', example: '' },
                { name: 'ALLOW_INTERNAL_IPS', desc: t ? 'Cho phép kết nối tới IP nội bộ/localhost; mặc định false để giảm rủi ro SSRF' : 'Allow connections to internal IPs/localhost; defaults to false to reduce SSRF risk', example: 'true | false' },
                { name: 'ADMIN_EMAIL', desc: t ? 'Email khởi tạo cho tài khoản admin đầu tiên' : 'Initial email for the first admin account', example: 'admin@example.com' },
                { name: 'ADMIN_PASSWORD', desc: t ? 'Mật khẩu admin khởi tạo' : 'Initial admin password', example: 'strong-password' },
            ]
        },
        {
            title: t ? 'Metastore & URL nội bộ' : 'Metastore & Internal URLs',
            icon: <Database className="w-5 h-5 text-emerald-500" />,
            vars: [
                { name: 'DATABASE_URL', desc: t ? 'Connection URL cho PostgreSQL metastore của app' : 'Connection URL for the app metadata PostgreSQL store', example: 'postgresql://postgres:postgres@localhost:5435/data_explorer' },
                { name: 'FRONTEND_URL', desc: t ? 'Origin thật của frontend, dùng cho CORS, cookie và redirect flows' : 'Real frontend origin used for CORS, cookies, and redirect flows', example: 'http://localhost:5173' },
                { name: 'API_PUBLIC_URL', desc: t ? 'Public API base URL, hiện được dùng bởi các billing return/webhook flows' : 'Public API base URL currently used by billing return/webhook flows', example: 'http://localhost:3001/api' },
                { name: 'VITE_API_URL', desc: t ? 'API base URL mà frontend Vite sẽ gọi tới' : 'API base URL the Vite frontend should call', example: 'http://localhost:3001/api' },
            ]
        },
        {
            title: t ? 'AI Providers & LLM' : 'AI Providers & LLM',
            icon: <Key className="w-5 h-5 text-amber-500" />,
            vars: [
                { name: 'GEMINI_API_KEY', desc: t ? 'Google Gemini key cho lane chất lượng cao và vision' : 'Google Gemini key for the higher-quality and vision lane', example: 'AIzaSy...' },
                { name: 'AI_PROVIDER_TIMEOUT_MS', desc: t ? 'Timeout tổng cho provider requests. Code fallback hiện tại là 60000ms, còn file example trong repo đang đặt 15000ms để fail nhanh hơn khi local/dev' : 'Overall timeout for provider requests. The code fallback is currently 60000ms, while the repo example files use 15000ms to fail faster in local/dev', example: '15000' },
                { name: 'AI_STREAM_IDLE_TIMEOUT_MS', desc: t ? 'Timeout khi stream bị stall. Nếu không đặt riêng, service sẽ fallback về AI_PROVIDER_TIMEOUT_MS; code mặc định hiện tại là 60000ms' : 'Timeout for stalled streams. If omitted, the service falls back to AI_PROVIDER_TIMEOUT_MS; the code default is currently 60000ms', example: '15000' },
                { name: 'CEREBRAS_API_KEY', desc: t ? 'Cerebras key cho lane chi phí thấp hơn' : 'Cerebras key for a lower-cost lane', example: 'cbr-...' },
                { name: 'CEREBRAS_BASE_URL', desc: t ? 'Base URL của Cerebras OpenAI-compatible endpoint' : 'Base URL for the Cerebras OpenAI-compatible endpoint', example: 'https://api.cerebras.ai/v1' },
                { name: 'CEREBRAS_CHAT_MODEL', desc: t ? 'Model mặc định của lane Cerebras' : 'Default model for the Cerebras lane', example: 'llama3.1-8b' },
                { name: 'OPENROUTER_API_KEY', desc: t ? 'OpenRouter key cho default auto chain, fallback đa model, và một số lane vision hoặc web-backed search tùy model' : 'OpenRouter key for the default auto chain, multi-model fallback, and some vision or web-backed search lanes depending on the chosen model', example: 'sk-or-...' },
                { name: 'OPENROUTER_BASE_URL', desc: t ? 'Base URL của OpenRouter' : 'Base URL for OpenRouter', example: 'https://openrouter.ai/api/v1' },
                { name: 'OPENROUTER_CHAT_MODEL', desc: t ? 'Model mặc định của lane OpenRouter' : 'Default model for the OpenRouter lane', example: '' },
                { name: 'GROQ_API_KEY', desc: t ? 'Groq key cho lane phản hồi nhanh' : 'Groq key for the low-latency lane', example: 'gsk-...' },
                { name: 'GROQ_BASE_URL', desc: t ? 'Base URL của Groq OpenAI-compatible endpoint' : 'Base URL for the Groq OpenAI-compatible endpoint', example: 'https://api.groq.com/openai/v1' },
                { name: 'GROQ_CHAT_MODEL', desc: t ? 'Model mặc định của lane Groq' : 'Default model for the Groq lane', example: 'meta-llama/llama-4-scout-17b-16e-instruct' },
                { name: 'BEEKNOEE_API_KEY', desc: t ? 'Beeknoee key để bật explicit provider routing trong model catalog' : 'Beeknoee key that enables explicit provider routing from the model catalog', example: 'sk-bee-...' },
                { name: 'BEEKNOEE_BASE_URL', desc: t ? 'Base URL của Beeknoee API' : 'Base URL for the Beeknoee API', example: 'https://platform.beeknoee.com/api/v1' },
                { name: 'BEEKNOEE_CHAT_MODEL', desc: t ? 'Fallback model mặc định của Beeknoee khi bạn không khóa model cụ thể' : 'Default Beeknoee fallback model when no explicit model is locked', example: 'glm-4.7-flash' },
                { name: 'TOKENROUTER_API_KEY', desc: t ? 'TokenRouter key để bật explicit provider routing cho các model như `tokenrouter:MiniMax-M3`' : 'TokenRouter key that enables explicit provider routing for models such as `tokenrouter:MiniMax-M3`', example: 'sk-tr-...' },
                { name: 'TOKENROUTER_BASE_URL', desc: t ? 'Base URL của TokenRouter OpenAI-compatible endpoint' : 'Base URL for the TokenRouter OpenAI-compatible endpoint', example: 'https://api.tokenrouter.com/v1' },
                { name: 'TOKENROUTER_CHAT_MODEL', desc: t ? 'Model mặc định của lane TokenRouter khi bạn chọn explicit provider mà không override model khác' : 'Default model for the TokenRouter lane when you choose the explicit provider without overriding it further', example: 'MiniMax-M3' },
            ]
        },
        {
            title: t ? 'Social Login (OAuth)' : 'Social Login (OAuth)',
            icon: <Globe className="w-5 h-5 text-indigo-500" />,
            vars: [
                { name: 'GOOGLE_CLIENT_ID', desc: t ? 'Google OAuth Client ID' : 'Google OAuth Client ID', example: 'xxx.apps.googleusercontent.com' },
                { name: 'GOOGLE_CLIENT_SECRET', desc: t ? 'Google OAuth Client Secret' : 'Google OAuth Client Secret', example: 'GOCSPX-...' },
                { name: 'GOOGLE_CALLBACK_URL', desc: t ? 'Google callback URL trỏ về backend thật' : 'Google callback URL pointing to the real backend', example: 'http://localhost:3001/api/auth/google/callback' },
                { name: 'GITHUB_CLIENT_ID', desc: t ? 'GitHub OAuth Client ID' : 'GitHub OAuth Client ID', example: 'Ov23...' },
                { name: 'GITHUB_CLIENT_SECRET', desc: t ? 'GitHub OAuth Client Secret' : 'GitHub OAuth Client Secret', example: 'git-...' },
                { name: 'GITHUB_CALLBACK_URL', desc: t ? 'GitHub callback URL trỏ về backend thật' : 'GitHub callback URL pointing to the real backend', example: 'http://localhost:3001/api/auth/github/callback' },
            ]
        },
        {
            title: t ? 'Email (Brevo/Auth)' : 'Email (Brevo/Auth)',
            icon: <Mail className="w-5 h-5 text-cyan-500" />,
            vars: [
                { name: 'MAIL_USER', desc: t ? 'Email sender dùng cho Brevo REST API và auth notifications' : 'Sender email used by the Brevo REST API and auth notifications', example: 'your-email@gmail.com' },
                { name: 'MAIL_PASS', desc: t ? 'Brevo API key hoặc mail service key; nếu thiếu app sẽ log email ra console' : 'Brevo API key or mail service key; if missing, the app logs emails to the console', example: 'xkeysib-...' },
            ]
        },
        {
            title: t ? 'Billing providers' : 'Billing providers',
            icon: <Key className="w-5 h-5 text-rose-500" />,
            vars: [
                { name: 'MOMO_PARTNER_CODE', desc: t ? 'Partner code cho MoMo checkout' : 'Partner code for MoMo checkout', example: '' },
                { name: 'MOMO_ACCESS_KEY', desc: t ? 'Access key cho MoMo' : 'Access key for MoMo', example: '' },
                { name: 'MOMO_SECRET_KEY', desc: t ? 'Secret key cho MoMo signature' : 'Secret key for MoMo signatures', example: '' },
                { name: 'MOMO_CREATE_URL', desc: t ? 'Endpoint tạo payment của MoMo (sandbox/local nên dùng test URL)' : 'MoMo payment creation endpoint (use the sandbox URL locally)', example: 'https://test-payment.momo.vn/v2/gateway/api/create' },
                { name: 'ZALOPAY_APP_ID', desc: t ? 'App ID cho ZaloPay' : 'App ID for ZaloPay', example: '' },
                { name: 'ZALOPAY_KEY1', desc: t ? 'Primary signing key cho ZaloPay' : 'Primary signing key for ZaloPay', example: '' },
                { name: 'ZALOPAY_KEY2', desc: t ? 'Secondary verification key cho ZaloPay' : 'Secondary verification key for ZaloPay', example: '' },
                { name: 'ZALOPAY_CREATE_URL', desc: t ? 'Endpoint tạo payment của ZaloPay sandbox' : 'Sandbox payment creation endpoint for ZaloPay', example: 'https://sb-openapi.zalopay.vn/v2/create' },
            ]
        }
    ];

    return (
        <DocPageLayout
            title={t ? 'Biến môi trường' : 'Environment Variables'}
            subtitle={t
                ? 'Danh sách đầy đủ các cấu hình trong tệp .env để vận hành toàn bộ hệ thống Data Explorer.'
                : 'A comprehensive list of all .env configurations required to operate the Data Explorer ecosystem.'}
        >
            <div className="space-y-12">
                <DocSection title={t ? 'Cách đọc phần env này' : 'How to read this env reference'}>
                    <Prose>
                        {t
                            ? 'Data Explorer hiện có hai lớp tài liệu env đáng chú ý trong repo: `.env.example` ở root để nhìn toàn hệ thống theo kiểu Docker-friendly, và `server/.env.example` để nhìn backend runtime trực tiếp. Bảng dưới đây gộp cả hai góc nhìn để bạn không phải nhảy qua lại giữa nhiều file khi cấu hình local, staging, hoặc production.'
                            : 'Data Explorer currently exposes two important env references in the repo: the root `.env.example` for a Docker-friendly full-system view, and `server/.env.example` for the direct backend runtime view. The tables below combine those perspectives so you do not have to jump between multiple files when configuring local, staging, or production environments.'}
                    </Prose>
                    <Callout type="info">
                        <p className="text-sm">
                            {t
                                ? 'Lưu ý thực tế: một số giá trị trong example file được chọn để thuận tiện cho local/dev, còn code fallback trong service có thể khác. Ví dụ, timeout AI trong code mặc định là 60000ms nhưng example file hiện đang để 15000ms để fail sớm và dễ debug hơn.'
                                : 'Practical note: some example values are tuned for local/dev convenience, while code-level fallbacks can differ. For example, the AI service defaults to 60000ms in code, but the example env files currently use 15000ms to fail sooner and stay easier to debug.'}
                        </p>
                    </Callout>
                </DocSection>
                {categories.map((cat, i) => (
                    <DocSection key={i} title={cat.title} icon={cat.icon}>
                        <div className="overflow-x-auto overflow-y-visible">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        <th className="py-4 px-4">{t ? 'Biến' : 'Variable'}</th>
                                        <th className="py-4 px-4">{t ? 'Mô tả' : 'Description'}</th>
                                        <th className="py-4 px-4">{t ? 'Ví dụ' : 'Example'}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {cat.vars.map((v, j) => (
                                        <tr key={j} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors group">
                                            <td className="py-4 px-4 font-mono font-bold text-primary group-hover:text-blue-400 transition-colors">{v.name}</td>
                                            <td className="py-4 px-4 text-muted-foreground leading-relaxed">{v.desc}</td>
                                            <td className="py-4 px-4">
                                                <code className="bg-white/5 px-2 py-1 rounded border border-white/10 text-[11px] font-mono whitespace-nowrap">
                                                    {v.example}
                                                </code>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </DocSection>
                ))}
            </div>
        </DocPageLayout>
    );
}
