import { Cpu, Layout, Globe, Terminal, Box } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, StepBlock, CodeBlock, CodeComment, CodeLine, CodeWarning } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function InstallationSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Hướng dẫn Cài đặt & Triển khai' : 'Installation & Deployment Guide'}
            subtitle={t
                ? 'Quy trình chuẩn để thiết lập Data Explorer từ môi trường phát triển (Development) đến sẵn sàng vận hành (Production).'
                : 'Standard process for setting up Data Explorer from development to production-ready environments.'}
        >
            <div className="grid md:grid-cols-2 gap-4 mb-12">
                <div className="p-6 border rounded-3xl bg-muted/20">
                    <h4 className="font-bold flex items-center gap-2 mb-2"><Terminal className="w-4 h-4 text-primary" /> {t ? 'Phương pháp Git' : 'Git-based Setup'}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Phù hợp cho lập trình viên muốn tùy chỉnh mã nguồn và đóng góp tính năng mới.' : 'Ideal for developers looking to customize source code and contribute new features.'}</p>
                </div>
                <div className="p-6 border rounded-3xl bg-primary/5 border-primary/20">
                    <h4 className="font-bold flex items-center gap-2 mb-2"><Box className="w-4 h-4 text-primary" /> {t ? 'Phương pháp Docker' : 'Docker-first Setup'}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Cách nhanh nhất để chạy ứng dụng trong môi trường cô lập, không lo xung đột dependency.' : 'The fastest way to run the app in an isolated environment without dependency conflicts.'}</p>
                </div>
            </div>

            <DocSection title={t ? 'Cài đặt Thủ công (Development)' : 'Manual Setup (Development)'}>
                <StepBlock step={1} title={t ? 'Tải mã nguồn & Cài đặt Dependency' : 'Clone & Install'}>
                    <CodeBlock title="Terminal">
                        <CodeLine>git clone https://github.com/KasierBach/Data-Explorer-Editor.git</CodeLine>
                        <CodeLine>cd Data-Explorer-Editor</CodeLine>
                        <p className="mt-3" />
                        <CodeComment>{t ? 'Cài đặt song song cho cả Client & Server' : 'Parallel installation for both Client & Server'}</CodeComment>
                        <CodeLine>cd server && npm install && cd ../client && npm install</CodeLine>
                    </CodeBlock>
                </StepBlock>

                <StepBlock step={2} title={t ? 'Cấu hình Biến môi trường (.env)' : 'Configure Environment (.env)'}>
                    <Prose>{t
                        ? 'Tạo file .env tại thư mục server/. Đây là bước quan trọng nhất để kích hoạt các dịch vụ AI và Database.'
                        : 'Create a .env file in the server/ directory. This is the most crucial step to activate AI services and databases.'}</Prose>
                    <CodeBlock title="server/.env">
                        <CodeWarning># Google AI API Key</CodeWarning>
                        <CodeLine>GEMINI_API_KEY=AIzaSy...</CodeLine>
                        <p className="mt-2" />
                        <CodeWarning># Primary Postgres for App Data</CodeWarning>
                        <CodeLine>DATABASE_URL="postgresql://user:pass@host:5432/data_explorer_meta"</CodeLine>
                        <p className="mt-2" />
                        <CodeWarning># Security Keys</CodeWarning>
                        <CodeLine>JWT_SECRET=any_long_random_string</CodeLine>
                        <CodeLine>ENCRYPTION_KEY=exactly_32_chars_long_string_123</CodeLine>
                    </CodeBlock>
                </StepBlock>

                <StepBlock step={3} title={t ? 'Đồng bộ Schema & Khởi động' : 'Sync Schema & Launch'}>
                    <CodeBlock title="Terminal">
                        <CodeComment>{t ? 'Terminal 1: Backend (NestJS)' : 'Terminal 1: Backend (NestJS)'}</CodeComment>
                        <CodeLine>cd server</CodeLine>
                        <CodeLine>npx prisma db push</CodeLine>
                        <CodeLine>npm run start:dev</CodeLine>
                        <p className="mt-3" />
                        <CodeComment>{t ? 'Terminal 2: Frontend (Vite)' : 'Terminal 2: Frontend (Vite)'}</CodeComment>
                        <CodeLine>cd client</CodeLine>
                        <CodeLine>npm run dev</CodeLine>
                    </CodeBlock>
                </StepBlock>
            </DocSection>

            <DocSection title={t ? 'Triển khai Docker Compose (Production-like)' : 'Docker Compose Deployment'}>
                <Prose>
                    {t
                        ? 'Để triển khai một bản stack hoàn chỉnh bao gồm App Server và Database nội bộ, hãy sử dụng Docker Compose:'
                        : 'To deploy a complete stack including the App Server and internal Database, use Docker Compose:'}
                </Prose>
                <CodeBlock title="docker-compose.yml">
                    <CodeLine>services:</CodeLine>
                    <CodeLine>  postgres-meta:</CodeLine>
                    <CodeLine>    image: postgres:16-alpine</CodeLine>
                    <CodeLine>    environment:</CodeLine>
                    <CodeLine>      POSTGRES_DB: data_explorer_meta</CodeLine>
                    <CodeLine>    ports: ["5433:5432"]</CodeLine>
                    <p className="mt-2" />
                    <CodeLine>  backend:</CodeLine>
                    <CodeLine>    build: ./server</CodeLine>
                    <CodeLine>    environment:</CodeLine>
                    <CodeLine>      DATABASE_URL: postgresql://...:5433/data_explorer_meta</CodeLine>
                    <CodeLine>    ports: ["3000:3000"]</CodeLine>
                </CodeBlock>
            </DocSection>

            <div className="mt-12 grid md:grid-cols-3 gap-6">
                <div className="p-5 border rounded-2xl bg-card border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                        <Layout className="w-4 h-4 text-blue-500" /> UI Access
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">http://localhost:5173</p>
                </div>
                <div className="p-5 border rounded-2xl bg-card border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                        <Cpu className="w-4 h-4 text-emerald-500" /> API Access
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">http://localhost:3000/api</p>
                </div>
                <div className="p-5 border rounded-2xl bg-card border-l-4 border-l-indigo-500">
                    <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                        <Globe className="w-4 h-4 text-indigo-500" /> Health Check
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">http://localhost:3000/health</p>
                </div>
            </div>

            <DocSection title={t ? 'Checklist Triển khai Production' : 'Production Hardening Checklist'}>
                <div className="grid sm:grid-cols-2 gap-4 mt-6">
                    {[
                        { t: t ? 'SSL/TLS Required' : 'SSL/TLS Required', d: t ? 'Luôn chạy đằng sau Reverse Proxy (Nginx/Traefik) với HTTPS.' : 'Always run behind a Reverse Proxy (Nginx/Traefik) with HTTPS.' },
                        { t: t ? 'CORS Strict' : 'Strict CORS', d: t ? 'Chỉ cho phép domain frontend của bạn truy cập vào API backend.' : 'Only allow your frontend domain to access the backend API.' },
                        { t: t ? 'Database Backup' : 'Database Backup', d: t ? 'Cấu hình auto-backup cho database metadata (data_explorer_meta).' : 'Configure auto-backups for the metadata database (data_explorer_meta).' },
                        { t: t ? 'Rate Limiting' : 'Rate Limiting', d: t ? 'Giới hạn số lượng request tới discovery/ai endpoints để tránh tốn phí Gemini.' : 'Limit requests to discovery/ai endpoints to avoid excessive Gemini costs.' },
                    ].map((item, i) => (
                        <div key={i} className="p-4 border rounded-xl bg-orange-500/5 border-orange-500/10">
                            <h6 className="font-bold text-xs mb-1 text-orange-600">{item.t}</h6>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{item.d}</p>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
