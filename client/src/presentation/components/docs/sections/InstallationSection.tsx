import { Terminal, Box, Globe, Database } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, StepBlock, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function InstallationSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Cài đặt & chạy local' : 'Installation & local setup'}
            subtitle={t
                ? 'Thiết lập Data Explorer đúng với repo hiện tại: Prisma sync bằng db push, backend NestJS, frontend Vite, và các biến môi trường cần thiết.'
                : 'Set up Data Explorer the way the current repo actually works: Prisma sync via db push, NestJS backend, Vite frontend, and the required environment variables.'}
        >
            <div className="grid md:grid-cols-2 gap-4 mb-12">
                <div className="p-6 border rounded-3xl bg-muted/20">
                    <h4 className="font-bold flex items-center gap-2 mb-2"><Terminal className="w-4 h-4 text-primary" /> {t ? 'Dev setup khuyên dùng' : 'Recommended dev setup'}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {t
                            ? 'Phù hợp nhất cho phát triển hằng ngày: chạy app metadata database, backend, và frontend riêng để debug nhanh hơn.'
                            : 'Best for day-to-day development: run the app metadata database, backend, and frontend separately for faster debugging.'}
                    </p>
                </div>
                <div className="p-6 border rounded-3xl bg-primary/5 border-primary/20">
                    <h4 className="font-bold flex items-center gap-2 mb-2"><Box className="w-4 h-4 text-primary" /> {t ? 'Docker là tùy chọn' : 'Docker is optional'}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {t
                            ? 'Docker hữu ích khi bạn muốn có PostgreSQL local ổn định cho metadata app. Với repo hiện tại, manual setup vẫn là đường dễ nhất.'
                            : 'Docker is useful if you want a stable local PostgreSQL instance for app metadata. For the current repo, manual setup is still the simplest path.'}
                    </p>
                </div>
            </div>

            <DocSection title={t ? 'Local setup chuẩn' : 'Standard local setup'}>
                <StepBlock step={1} title={t ? 'Clone repo và cài dependencies' : 'Clone the repo and install dependencies'}>
                    <CodeBlock title="Terminal">
                        <CodeLine>git clone https://github.com/KasierBach/Data-Explorer-Editor.git</CodeLine>
                        <CodeLine>cd Data-Explorer-Editor</CodeLine>
                        <CodeLine>npm install</CodeLine>
                    </CodeBlock>
                </StepBlock>

                <StepBlock step={2} title={t ? 'Tạo file server/.env' : 'Create server/.env'}>
                    <Prose>
                        {t
                            ? 'Local run cần app metadata database, JWT secret đủ mạnh, encryption key đúng 32 ký tự, và FRONTEND_URL. OAuth và AI provider là tùy chọn.'
                            : 'A local run needs an app metadata database, a strong JWT secret, an encryption key with exactly 32 characters, and FRONTEND_URL. OAuth and AI providers are optional.'}
                    </Prose>
                    <CodeBlock title="server/.env">
                        <CodeComment>{t ? 'Bắt buộc' : 'Required'}</CodeComment>
                        <CodeLine>DATABASE_URL=postgresql://postgres:postgres@localhost:5432/data_explorer_dev?schema=public</CodeLine>
                        <CodeLine>JWT_SECRET=replace-with-a-strong-secret-at-least-32-chars</CodeLine>
                        <CodeLine>ENCRYPTION_KEY=replace-with-exactly-32-characters</CodeLine>
                        <CodeLine>FRONTEND_URL=http://localhost:5173</CodeLine>
                        <p className="mt-3" />
                        <CodeComment>{t ? 'Tùy chọn cho compatibility / local rules' : 'Optional compatibility / local rules'}</CodeComment>
                        <CodeLine>LEGACY_ENCRYPTION_KEYS=</CodeLine>
                        <CodeLine>ALLOW_INTERNAL_IPS=false</CodeLine>
                        <CodeLine>ADMIN_EMAIL=admin@example.com</CodeLine>
                        <CodeLine>ADMIN_PASSWORD=your-secure-password</CodeLine>
                        <p className="mt-3" />
                        <CodeComment>{t ? 'Tùy chọn cho AI routing' : 'Optional for AI routing'}</CodeComment>
                        <CodeLine>GEMINI_API_KEY=...</CodeLine>
                        <CodeLine>CEREBRAS_API_KEY=...</CodeLine>
                        <CodeLine>CEREBRAS_BASE_URL=https://api.cerebras.ai/v1</CodeLine>
                        <CodeLine>CEREBRAS_CHAT_MODEL=llama3.1-8b</CodeLine>
                        <CodeLine>OPENROUTER_API_KEY=...</CodeLine>
                        <CodeLine>OPENROUTER_BASE_URL=https://openrouter.ai/api/v1</CodeLine>
                        <CodeLine>OPENROUTER_CHAT_MODEL=openrouter/auto</CodeLine>
                    </CodeBlock>
                </StepBlock>

                <StepBlock step={3} title={t ? 'Đồng bộ schema app' : 'Sync the app schema'}>
                    <Prose>
                        {t
                            ? 'Repo hiện tại dùng Prisma `db push` cho metadata schema. Đây cũng là lệnh nên dùng trên production build hiện nay.'
                            : 'The current repo uses Prisma `db push` for the metadata schema. This is also the command you should use in the current production build flow.'}
                    </Prose>
                    <CodeBlock title="Terminal">
                        <CodeLine>cd server</CodeLine>
                        <CodeLine>npx prisma db push</CodeLine>
                    </CodeBlock>
                </StepBlock>

                <StepBlock step={4} title={t ? 'Chạy backend và frontend' : 'Run the backend and frontend'}>
                    <CodeBlock title="Backend">
                        <CodeLine>cd server</CodeLine>
                        <CodeLine>npm run start:dev</CodeLine>
                    </CodeBlock>
                    <div className="h-4" />
                    <CodeBlock title="Frontend">
                        <CodeLine>cd client</CodeLine>
                        <CodeLine>npm run dev</CodeLine>
                    </CodeBlock>
                </StepBlock>
            </DocSection>

            <DocSection title={t ? 'Chạy từ root repo' : 'Run from the repo root'}>
                <Prose>
                    {t
                        ? 'Nếu bạn muốn bật toàn bộ stack development bằng một lệnh, root repo đã có script `npm run dev`.'
                        : 'If you want to boot the whole development stack with one command, the repo root already provides `npm run dev`.'}
                </Prose>
                <CodeBlock title="Terminal">
                    <CodeLine>npm run dev</CodeLine>
                </CodeBlock>
            </DocSection>

            <DocSection title={t ? 'Docker notes' : 'Docker notes'}>
                <Prose>
                    {t
                        ? 'Docker phù hợp khi bạn muốn metadata database cục bộ ổn định hoặc không muốn cài PostgreSQL trực tiếp trên máy. Với code hiện tại, đường manual setup + `prisma db push` vẫn là lối dev đơn giản nhất.'
                        : 'Docker is a good fit if you want a stable local metadata database or do not want to install PostgreSQL directly on your machine. With the current codebase, manual setup + `prisma db push` is still the easiest development path.'}
                </Prose>
                <CodeBlock title="Docker">
                    <CodeLine>docker-compose up --build -d</CodeLine>
                </CodeBlock>
            </DocSection>

            <DocSection title={t ? 'Các địa chỉ local quan trọng' : 'Important local URLs'}>
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
                        <div className="flex items-center gap-2 text-sm font-bold"><Globe className="w-4 h-4 text-blue-500" />Frontend</div>
                        <div className="mt-2 text-xs font-mono text-muted-foreground">http://localhost:5173</div>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
                        <div className="flex items-center gap-2 text-sm font-bold"><Terminal className="w-4 h-4 text-emerald-500" />API</div>
                        <div className="mt-2 text-xs font-mono text-muted-foreground">http://localhost:3001/api</div>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
                        <div className="flex items-center gap-2 text-sm font-bold"><Database className="w-4 h-4 text-amber-500" />Health</div>
                        <div className="mt-2 text-xs font-mono text-muted-foreground">http://localhost:3001/api/health</div>
                    </div>
                </div>
            </DocSection>

            <Callout type="warning">
                <p className="text-sm">
                    {t
                        ? 'Nếu backend không khởi động được sau khi sửa env, hãy kiểm tra `JWT_SECRET` và `ENCRYPTION_KEY` trước. Backend hiện fail closed nếu secret yếu hoặc sai format. Nếu bạn đang dùng DB cloud, hãy nhớ local/network có thể chặn các cổng database như 5432, 3306 hoặc 27017.'
                        : 'If the backend refuses to start after env changes, check `JWT_SECRET` and `ENCRYPTION_KEY` first. The backend now fails closed when secrets are weak or wrongly formatted. If you use a cloud database, remember that local networks can block database ports such as 5432, 3306, or 27017.'}
                </p>
            </Callout>

            <Callout type="info">
                <p className="text-sm">
                    {t
                        ? 'Production hiện nên build backend bằng `npx prisma db push && npm run build` thay vì `prisma migrate deploy`, vì migration history hiện tại của repo chưa sẵn sàng cho PostgreSQL deploy flow chuẩn.'
                        : 'Production should currently build the backend with `npx prisma db push && npm run build` instead of `prisma migrate deploy`, because the repo’s migration history is not yet aligned with a clean PostgreSQL deploy flow.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
