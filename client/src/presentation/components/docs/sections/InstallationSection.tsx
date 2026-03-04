import { Cpu, Layout, Code, AlertCircle } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, StepBlock, CodeBlock, CodeComment, CodeLine, CodeWarning, Callout, InfoCard, FeatureGrid } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function InstallationSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Hướng dẫn Cài đặt' : 'Installation Guide'}
            subtitle={t
                ? 'Hướng dẫn từng bước để thiết lập Data Explorer trên máy của bạn. Tổng thời gian ước tính: khoảng 5 phút.'
                : 'Step-by-step guide to set up Data Explorer on your machine. Estimated total time: about 5 minutes.'}
        >
            <Callout type="tip">
                <p className="font-bold">{t ? '💡 Kiến trúc Client-Server' : '💡 Client-Server Architecture'}</p>
                <p className="mt-1 text-muted-foreground">
                    {t
                        ? 'Data Explorer sử dụng kiến trúc tách biệt: Frontend (React/Vite) chạy trên cổng 5173, Backend (NestJS) chạy trên cổng 3000. Bạn cần cài đặt và khởi động cả hai để ứng dụng hoạt động đầy đủ.'
                        : 'Data Explorer uses a decoupled architecture: Frontend (React/Vite) runs on port 5173, Backend (NestJS) runs on port 3000. You need to install and start both for full functionality.'}
                </p>
            </Callout>

            <div className="space-y-8">
                <StepBlock step={1} title={t ? 'Tải mã nguồn (Clone)' : 'Clone Source Code'}>
                    <Prose>{t
                        ? 'Sử dụng Git để clone repository từ GitHub. Đảm bảo bạn đã cài đặt Git trước đó (kiểm tra bằng lệnh git --version).'
                        : 'Use Git to clone the repository from GitHub. Make sure Git is installed beforehand (check with git --version).'}</Prose>
                    <CodeBlock title="Terminal">
                        <CodeComment>{t ? 'Sao chép repository từ GitHub' : 'Clone repository from GitHub'}</CodeComment>
                        <CodeLine>git clone https://github.com/KasierBach/Data-Explorer-Editor.git</CodeLine>
                        <p className="mt-3" />
                        <CodeComment>{t ? 'Truy cập vào thư mục dự án' : 'Navigate into project directory'}</CodeComment>
                        <CodeLine>cd Data-Explorer-Editor</CodeLine>
                    </CodeBlock>
                    <Prose>{t
                        ? 'Sau khi clone, bạn sẽ thấy hai thư mục chính: client/ (Frontend React) và server/ (Backend NestJS). Cả hai đều sử dụng TypeScript.'
                        : 'After cloning, you\'ll see two main directories: client/ (React Frontend) and server/ (NestJS Backend). Both use TypeScript.'}</Prose>
                </StepBlock>

                <StepBlock step={2} title={t ? 'Cài đặt Phụ thuộc' : 'Install Dependencies'}>
                    <Prose>{t
                        ? 'Cài đặt tất cả các packages cần thiết cho cả frontend và backend. Quá trình này sẽ tải về khoảng 200+ packages từ npm registry.'
                        : 'Install all necessary packages for both frontend and backend. This process will download around 200+ packages from the npm registry.'}</Prose>
                    <CodeBlock title="Terminal">
                        <CodeComment>{t ? 'Cài đặt cho Backend Server (NestJS)' : 'Install for Backend Server (NestJS)'}</CodeComment>
                        <CodeLine>cd server && npm install</CodeLine>
                        <p className="mt-3" />
                        <CodeComment>{t ? 'Cài đặt cho Frontend Client (React + Vite)' : 'Install for Frontend Client (React + Vite)'}</CodeComment>
                        <CodeLine>cd ../client && npm install</CodeLine>
                    </CodeBlock>
                    <Callout type="warning">
                        <p className="text-amber-600 font-bold">{t ? '⚠️ Lưu ý về phiên bản Node.js' : '⚠️ Node.js Version Note'}</p>
                        <p className="mt-1 text-muted-foreground">{t
                            ? 'Nếu bạn gặp lỗi trong quá trình cài đặt, hãy kiểm tra phiên bản Node.js (yêu cầu ≥ 18.x). Sử dụng nvm để quản lý phiên bản: nvm install 20 && nvm use 20'
                            : 'If you encounter errors during installation, check your Node.js version (requires ≥ 18.x). Use nvm to manage versions: nvm install 20 && nvm use 20'}</p>
                    </Callout>
                </StepBlock>

                <StepBlock step={3} title={t ? 'Cấu hình Môi trường' : 'Environment Configuration'}>
                    <Prose>{t
                        ? <>Tạo file <code className="bg-muted px-2 py-0.5 rounded font-bold text-primary">.env</code> trong thư mục <code className="font-mono text-primary">server/</code>. File này chứa các biến cấu hình quan trọng cho backend.</>
                        : <>Create a <code className="bg-muted px-2 py-0.5 rounded font-bold text-primary">.env</code> file in the <code className="font-mono text-primary">server/</code> directory. This file contains important backend configuration variables.</>}</Prose>
                    <CodeBlock title=".env">
                        <CodeWarning>{t ? 'API Key cho Google Gemini AI (Bắt buộc cho tính năng AI)' : 'Google Gemini AI API Key (Required for AI features)'}</CodeWarning>
                        <CodeWarning>{t ? 'Lấy miễn phí tại: https://aistudio.google.com/apikey' : 'Get free at: https://aistudio.google.com/apikey'}</CodeWarning>
                        <CodeLine>GEMINI_API_KEY=your_google_ai_studio_key</CodeLine>
                        <p className="mt-3" />
                        <CodeWarning>{t ? 'Chuỗi bí mật cho JWT Authentication' : 'JWT Authentication Secret String'}</CodeWarning>
                        <CodeWarning>{t ? 'Nên dùng chuỗi ngẫu nhiên dài ≥ 32 ký tự để bảo mật' : 'Use a random string ≥ 32 characters for security'}</CodeWarning>
                        <CodeLine>JWT_SECRET=any_long_random_string_at_least_32_chars</CodeLine>
                        <p className="mt-3" />
                        <CodeWarning>{t ? 'Đường dẫn database SQLite nội bộ (lưu users, connections)' : 'Internal SQLite database path (stores users, connections)'}</CodeWarning>
                        <CodeLine>DATABASE_URL="file:./dev.db"</CodeLine>
                        <p className="mt-3" />
                        <CodeWarning>{t ? 'Cổng Backend Server (mặc định: 3000)' : 'Backend Server Port (default: 3000)'}</CodeWarning>
                        <CodeLine>PORT=3000</CodeLine>
                    </CodeBlock>

                    <DocSubSection title={t ? 'Giải thích chi tiết từng biến' : 'Detailed Variable Explanation'}>
                        <div className="space-y-3">
                            {[
                                {
                                    name: 'GEMINI_API_KEY',
                                    desc: t
                                        ? 'Key xác thực để gọi Google Gemini API. Cần thiết cho tất cả tính năng AI: tạo SQL, Vision (phân tích hình ảnh), và giải thích truy vấn. Nếu để trống, tính năng AI sẽ bị vô hiệu hóa nhưng ứng dụng vẫn hoạt động bình thường.'
                                        : 'Authentication key for Google Gemini API calls. Required for all AI features: SQL generation, Vision (image analysis), and query explanation. If left empty, AI features are disabled but the app still works normally.'
                                },
                                {
                                    name: 'JWT_SECRET',
                                    desc: t
                                        ? 'Chuỗi bí mật dùng để ký và xác thực JSON Web Tokens. Mỗi lần người dùng đăng nhập, server tạo JWT token được ký bằng secret này. Nếu để trống, server sẽ tự tạo một chuỗi ngẫu nhiên mỗi lần khởi động (phiên đăng nhập sẽ bị mất khi restart).'
                                        : 'Secret string for signing and verifying JSON Web Tokens. Each time a user logs in, the server creates a JWT signed with this secret. If left empty, the server auto-generates a random string on each startup (login sessions are lost on restart).'
                                },
                                {
                                    name: 'DATABASE_URL',
                                    desc: t
                                        ? 'Đường dẫn tới file SQLite nội bộ, được Prisma ORM sử dụng để lưu trữ thông tin người dùng và cấu hình kết nối. Đây KHÔNG phải database bạn muốn quản lý, mà là database nội bộ của ứng dụng.'
                                        : 'Path to the internal SQLite file, used by Prisma ORM to store user info and connection configurations. This is NOT the database you want to manage, but the app\'s internal database.'
                                },
                            ].map((v, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 border rounded-xl bg-muted/20">
                                    <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono text-xs font-bold whitespace-nowrap">{v.name}</code>
                                    <span className="text-sm text-muted-foreground leading-relaxed">{v.desc}</span>
                                </div>
                            ))}
                        </div>
                    </DocSubSection>
                </StepBlock>

                <StepBlock step={4} title={t ? 'Khởi tạo Database nội bộ' : 'Initialize Internal Database'}>
                    <Prose>{t
                        ? 'Trước khi chạy ứng dụng lần đầu, bạn cần khởi tạo database SQLite nội bộ thông qua Prisma ORM. Bước này tạo các bảng cần thiết để lưu trữ thông tin người dùng và kết nối.'
                        : 'Before running the app for the first time, you need to initialize the internal SQLite database through Prisma ORM. This step creates the necessary tables for storing user and connection information.'}</Prose>
                    <CodeBlock title="Terminal">
                        <CodeComment>{t ? 'Di chuyển vào thư mục server' : 'Navigate to server directory'}</CodeComment>
                        <CodeLine>cd server</CodeLine>
                        <p className="mt-3" />
                        <CodeComment>{t ? 'Tạo database và áp dụng schema' : 'Create database and apply schema'}</CodeComment>
                        <CodeLine>npx prisma db push</CodeLine>
                        <p className="mt-3" />
                        <CodeComment>{t ? 'Tạo Prisma Client (TypeScript types)' : 'Generate Prisma Client (TypeScript types)'}</CodeComment>
                        <CodeLine>npx prisma generate</CodeLine>
                    </CodeBlock>
                </StepBlock>

                <StepBlock step={5} title={t ? 'Khởi động ứng dụng' : 'Start the Application'}>
                    <Prose>{t
                        ? 'Mở hai terminal riêng biệt: một cho server và một cho client. Cả hai cần chạy đồng thời.'
                        : 'Open two separate terminals: one for the server and one for the client. Both need to run simultaneously.'}</Prose>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="p-5 border rounded-xl bg-card space-y-3">
                            <p className="font-bold text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-emerald-500" /> Backend Server</p>
                            <code className="text-xs font-mono text-emerald-600 block">cd server && npm run start:dev</code>
                            <p className="text-[10px] text-muted-foreground">{t ? 'Chạy trên http://localhost:3000' : 'Runs on http://localhost:3000'}</p>
                        </div>
                        <div className="p-5 border rounded-xl bg-card space-y-3">
                            <p className="font-bold text-sm flex items-center gap-2"><Layout className="w-4 h-4 text-blue-500" /> Frontend Client</p>
                            <code className="text-xs font-mono text-blue-600 block">cd client && npm run dev</code>
                            <p className="text-[10px] text-muted-foreground">{t ? 'Chạy trên http://localhost:5173' : 'Runs on http://localhost:5173'}</p>
                        </div>
                    </div>
                    <Callout type="tip">
                        <p className="text-muted-foreground">{t
                            ? '💡 Mẹo: Bạn cũng có thể chạy cả hai cùng lúc từ thư mục gốc bằng lệnh npm run dev nếu script đã được cấu hình trong package.json gốc.'
                            : '💡 Tip: You can also run both simultaneously from the root directory using npm run dev if the script is configured in the root package.json.'}</p>
                    </Callout>
                </StepBlock>
            </div>

            {/* Docker Setup */}
            <DocSection title={t ? 'Cài đặt với Docker (Tùy chọn)' : 'Docker Setup (Optional)'}>
                <Prose>{t
                    ? 'Nếu bạn muốn chạy database thử nghiệm cùng ứng dụng, Docker là cách nhanh nhất để khởi tạo một instance PostgreSQL hoặc MySQL mà không cần cài đặt trực tiếp.'
                    : 'If you want to run a test database alongside the app, Docker is the fastest way to spin up a PostgreSQL or MySQL instance without direct installation.'}</Prose>
                <CodeBlock title="docker-compose.yml">
                    <CodeComment>{t ? 'Ví dụ: PostgreSQL cho phát triển' : 'Example: PostgreSQL for development'}</CodeComment>
                    <CodeLine>docker run -d \</CodeLine>
                    <CodeLine>{"  --name data-explorer-pg \\"}</CodeLine>
                    <CodeLine>{"  -e POSTGRES_USER=admin \\"}</CodeLine>
                    <CodeLine>{"  -e POSTGRES_PASSWORD=secret123 \\"}</CodeLine>
                    <CodeLine>{"  -e POSTGRES_DB=dev_database \\"}</CodeLine>
                    <CodeLine>{"  -p 5432:5432 \\"}</CodeLine>
                    <CodeLine>{"  postgres:16-alpine"}</CodeLine>
                    <p className="mt-4" />
                    <CodeComment>{t ? 'Kết nối từ Data Explorer:' : 'Connect from Data Explorer:'}</CodeComment>
                    <CodeComment>{t ? 'Host: localhost | Port: 5432 | User: admin | Pass: secret123' : 'Host: localhost | Port: 5432 | User: admin | Pass: secret123'}</CodeComment>
                </CodeBlock>
            </DocSection>
        </DocPageLayout>
    );
}
