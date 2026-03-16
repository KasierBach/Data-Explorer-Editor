import { Server, Globe, Shield, Container, Cpu } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine, Callout, InfoCard } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function DeploymentSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Triển khai Production' : 'Production Deployment'}
            subtitle={t
                ? 'Hướng dẫn chi tiết cách đưa Data Explorer lên môi trường server thực tế, sử dụng Docker, PM2 và cấu hình Nginx SSL.'
                : 'Detailed guide on deploying Data Explorer to real-world server environments using Docker, PM2, and Nginx SSL configuration.'}
            gradient
        >
            {/* Deployment Strategies */}
            <div className="grid md:grid-cols-2 gap-6 mb-16">
                <div className="p-8 border rounded-3xl bg-gradient-to-br from-blue-500/10 via-background to-background">
                    <Container className="w-10 h-10 text-blue-500 mb-6" />
                    <h3 className="text-xl font-bold mb-3">{t ? 'Cơ bản (Docker)' : 'Standard (Docker)'}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t
                            ? 'Cách tiếp cận hiện đại và cô lập nhất. Chạy toàn bộ stack (FE, BE, DB) chỉ với một file docker-compose.'
                            : 'The most modern and isolated approach. Run the entire stack (FE, BE, DB) with a single docker-compose file.'}
                    </p>
                </div>
                <div className="p-8 border rounded-3xl bg-gradient-to-br from-emerald-500/10 via-background to-background">
                    <Cpu className="w-10 h-10 text-emerald-500 mb-6" />
                    <h3 className="text-xl font-bold mb-3">{t ? 'Nâng cao (PM2 + Nginx)' : 'Bare Metal (PM2 + Nginx)'}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t
                            ? 'Dành cho các server Linux truyền thống. Tận dụng tối đa tài nguyên phần cứng và linh hoạt cấu hình proxy.'
                            : 'For traditional Linux servers. Maximize hardware resources and flexible proxy configuration.'}
                    </p>
                </div>
            </div>

            {/* Docker Compose Section */}
            <DocSection title={t ? '1. Triển khai bằng Docker Compose' : '1. Deploy with Docker Compose'}>
                <Prose>
                    {t
                        ? 'Đây là cách nhanh nhất để deploy Data Explorer. File docker-compose.yml sẽ tự động build image và thiết lập mạng nội bộ.'
                        : 'The fastest way to deploy Data Explorer. The docker-compose.yml file will automatically build images and set up internal networking.'}
                </Prose>
                <CodeBlock title="docker-compose.yml">
                    <CodeComment># {t ? 'Cấu hình Production Stack' : 'Production Stack Configuration'}</CodeComment>
                    <CodeLine>services:</CodeLine>
                    <CodeLine>  server:</CodeLine>
                    <CodeLine>    build: ./server</CodeLine>
                    <CodeLine>    ports: ["3001:3001"]</CodeLine>
                    <CodeLine>    env_file: .env.production</CodeLine>
                    <CodeLine>  client:</CodeLine>
                    <CodeLine>    build: ./client</CodeLine>
                    <CodeLine>    ports: ["80:80"]</CodeLine>
                    <CodeLine>    depends_on: [server]</CodeLine>
                </CodeBlock>
                <CodeBlock title={t ? 'Lệnh thực thi' : 'Command'}>
                    <CodeLine>docker-compose up -d --build</CodeLine>
                </CodeBlock>
            </DocSection>

            {/* Environment Variables */}
            <DocSection title={t ? '2. Biến môi trường (Environment)' : '2. Environment Variables'}>
                <Prose>
                    {t
                        ? 'Đảm bảo tệp .env của bạn chứa các thông tin bảo mật cho môi trường Production.'
                        : 'Ensure your .env file contains secure information for the Production environment.'}
                </Prose>
                <div className="grid gap-4 mt-6">
                    {[
                        { k: 'JWT_SECRET', d: t ? 'Khóa bảo mật phiên làm việc (Cực kỳ quan trọng)' : 'Session security key (Extremely Important)' },
                        { k: 'ENCRYPTION_KEY', d: t ? 'Khóa mã hóa mật khẩu Database (32 bytes)' : 'Database password encryption key (32 bytes)' },
                        { k: 'CORS_ORIGIN', d: t ? 'Domain frontend chính thức của bạn' : 'Your official frontend domain' }
                    ].map((env, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-xl bg-muted/5">
                            <code className="text-xs font-bold text-blue-500">{env.k}</code>
                            <span className="text-xs text-muted-foreground">{env.d}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Nginx & SSL */}
            <DocSection title={t ? '3. Cấu hình Reverse Proxy & SSL' : '3. Reverse Proxy & SSL Configuration'}>
                <div className="space-y-6">
                    <DocSubSection title="Nginx Virtual Host">
                        <Prose>{t ? 'Sử dụng Nginx để xử lý HTTPS và forward request tới backend/frontend.' : 'Use Nginx to handle HTTPS and forward requests to backend/frontend.'}</Prose>
                        <CodeBlock title="/etc/nginx/sites-available/data-explorer">
                            <CodeLine>server {'{'}</CodeLine>
                            <CodeLine>  listen 443 ssl;</CodeLine>
                            <CodeLine>  server_name yourdomain.com;</CodeLine>
                            <p className="mt-2" />
                            <CodeComment># Frontend</CodeComment>
                            <CodeLine>  location / {'{'}</CodeLine>
                            <CodeLine>    proxy_pass http://localhost:5173;</CodeLine>
                            <CodeLine>  {'}'}</CodeLine>
                            <p className="mt-2" />
                            <CodeComment># Backend API</CodeComment>
                            <CodeLine>  location /api {'{'}</CodeLine>
                            <CodeLine>    proxy_pass http://localhost:3001;</CodeLine>
                            <CodeLine>    proxy_set_header Upgrade $http_upgrade;</CodeLine>
                            <CodeLine>  {'}'}</CodeLine>
                            <CodeLine>{'}'}</CodeLine>
                        </CodeBlock>
                    </DocSubSection>
                    
                    <Callout type="warning">
                        <p className="text-xs">
                          {t 
                            ? 'Luôn sử dụng Certbot hoặc các giải pháp SSL khác để kích hoạt HTTPS. Backend sẽ chặn các connection nếu không chạy trên giao thức an toàn trong mode Production.' 
                            : 'Always use Certbot or other SSL solutions to enable HTTPS. The backend will block connections if not running on a secure protocol in Production mode.'}
                        </p>
                    </Callout>
                </div>
            </DocSection>

            {/* Health Checks */}
            <DocSection title={t ? 'Kiểm tra trạng thái (Health Checks)' : 'Status & Health Checks'}>
                <div className="grid md:grid-cols-3 gap-4">
                    <InfoCard icon={<Server className="w-4 h-4" />} title="Backend" color="blue">
                        <p className="text-[10px]">{t ? 'Check endpoint /api/health' : 'Check endpoint /api/health'}</p>
                    </InfoCard>
                    <InfoCard icon={<Globe className="w-4 h-4" />} title="Frontend" color="emerald">
                        <p className="text-[10px]">{t ? 'Kiểm tra tệp build trong dist/' : 'Check build files in dist/'}</p>
                    </InfoCard>
                    <InfoCard icon={<Shield className="w-4 h-4" />} title="Database" color="amber">
                        <p className="text-[10px]">{t ? 'Kiểm tra Prisma connection pool' : 'Check Prisma connection pool'}</p>
                    </InfoCard>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
