import { Key, Server, Globe, Database, Mail, Shield } from 'lucide-react';
import { DocPageLayout, DocSection } from '../primitives';

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
                { name: 'JWT_SECRET', desc: t ? 'Khóa bí mật để ký JWT access token (Min 32 chars)' : 'Secret key for signing JWT access tokens (Min 32 chars)', example: 'super-secret-long-string' },
                { name: 'REFRESH_TOKEN_SECRET', desc: t ? 'Khóa bí mật cho refresh token' : 'Secret key for refresh tokens', example: 'another-very-long-secret' },
                { name: 'ENCRYPTION_KEY', desc: t ? 'Khóa 32 ký tự để mã hóa mật khẩu DB (AES-256)' : '32-char key for DB password encryption (AES-256)', example: '12345678901234567890123456789012' },
                { name: 'REDIS_URL', desc: t ? 'URL kết nối tới Redis (Caching, Notifications, Jobs)' : 'Redis connection URL (Caching, Notifications, Jobs)', example: 'redis://localhost:6379' },
            ]
        },
        {
            title: t ? 'Bảo mật & Quản trị (Security & Admin)' : 'Security & Admin',
            icon: <Shield className="w-5 h-5 text-red-500" />,
            vars: [
                { name: 'ALLOW_INTERNAL_IPS', desc: t ? 'Cho phép kết nối tới IP nội bộ (localhost/private) - Mặc định false' : 'Allow connections to internal IPs (localhost/private) - Defaults to false', example: 'true | false' },
                { name: 'ADMIN_EMAIL', desc: t ? 'Email khởi tạo cho tài khoản admin đầu tiên' : 'Initial email for the first admin account', example: 'admin@example.com' },
                { name: 'ADMIN_PASSWORD', desc: t ? 'Mật khẩu admin (Nếu trống, hệ thống sẽ log mật khẩu ngẫu nhiên)' : 'Admin password (If empty, system logs a random one)', example: 'strong-password' },
            ]
        },
        {
            title: t ? 'Kết nối Cơ sở dữ liệu (Metastore)' : 'Database Metastore',
            icon: <Database className="w-5 h-5 text-emerald-500" />,
            vars: [
                { name: 'DATABASE_URL', desc: t ? 'Connection URL cho PostgreSQL Metastore của app' : 'Connection URL for the app metadata PostgreSQL', example: 'postgresql://user:pass@localhost:5432/metadata' },
                { name: 'DIRECT_URL', desc: t ? 'URL kết nối trực tiếp (dùng cho Prisma migrations)' : 'Direct connection URL (used for Prisma migrations)', example: 'postgresql://user:pass@localhost:5432/metadata' },
            ]
        },
        {
            title: t ? 'AI Providers & LLM' : 'AI Providers & LLM',
            icon: <Key className="w-5 h-5 text-amber-500" />,
            vars: [
                { name: 'GEMINI_API_KEY', desc: t ? 'Google Gemini AI Key (Required for AI features)' : 'Google Gemini AI Key (Required for AI features)', example: 'AIzaSy...' },
                { name: 'CEREBRAS_API_KEY', desc: t ? 'Cerebras Cloud Key (Fast lane)' : 'Cerebras Cloud Key (Fast lane)', example: 'cbr-...' },
                { name: 'OPENROUTER_API_KEY', desc: t ? 'OpenRouter Key (Fallback/Multi-model)' : 'OpenRouter Key (Fallback/Multi-model)', example: 'sk-or-...' },
            ]
        },
        {
            title: t ? 'Frontend & CORS' : 'Frontend & CORS',
            icon: <Globe className="w-5 h-5 text-indigo-500" />,
            vars: [
                { name: 'FRONTEND_URL', desc: t ? 'URL của frontend (Dùng cho CORS và Cookie domain)' : 'Frontend URL (Used for CORS and Cookie domains)', example: 'http://localhost:5173' },
            ]
        },
        {
            title: t ? 'Social Login (OAuth)' : 'Social Login (OAuth)',
            icon: <Shield className="w-5 h-5 text-rose-500" />,
            vars: [
                { name: 'GOOGLE_CLIENT_ID', desc: t ? 'Google OAuth Client ID' : 'Google OAuth Client ID', example: 'xxx.apps.googleusercontent.com' },
                { name: 'GOOGLE_CLIENT_SECRET', desc: t ? 'Google OAuth Client Secret' : 'Google OAuth Client Secret', example: 'GOCSPX-...' },
                { name: 'GITHUB_CLIENT_ID', desc: t ? 'GitHub OAuth Client ID' : 'GitHub OAuth Client ID', example: 'Ov23...' },
                { name: 'GITHUB_CLIENT_SECRET', desc: t ? 'GitHub OAuth Client Secret' : 'GitHub OAuth Client Secret', example: 'git-...' },
            ]
        },
        {
            title: t ? 'Email (Notifications/Auth)' : 'Email (Notifications/Auth)',
            icon: <Mail className="w-5 h-5 text-cyan-500" />,
            vars: [
                { name: 'SMTP_HOST', desc: t ? 'Địa chỉ mail server (SMTP)' : 'SMTP server host', example: 'smtp.gmail.com' },
                { name: 'SMTP_USER', desc: t ? 'Tài khoản gửi mail' : 'SMTP username', example: 'bot@myapp.com' },
                { name: 'SMTP_PASS', desc: t ? 'Mật khẩu app hoặc SMTP key' : 'SMTP password or App Password', example: 'abcd-efgh-ijkl' },
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
