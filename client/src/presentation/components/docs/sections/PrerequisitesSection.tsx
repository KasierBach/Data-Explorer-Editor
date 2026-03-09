import { Cpu, Database, AlertCircle, Shield, Code, Terminal } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, CodeBlock, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function PrerequisitesSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Điều kiện tiên quyết' : 'Prerequisites & Environmental Setup'}
            subtitle={t
                ? 'Phân tích các yêu cầu về hạ tầng, thư viện và môi trường trước khi triển khai hệ thống.'
                : 'Analysis of infrastructure, library, and environment requirements before system deployment.'}
        >
            <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="p-6 border rounded-3xl bg-blue-500/5 border-blue-500/10">
                    <Cpu className="w-6 h-6 text-blue-500 mb-4" />
                    <h4 className="font-bold text-sm mb-2">Runtime</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Node.js 18.x+ (ES2022 Support). Frontend build qua Vite 5.x.</p>
                </div>
                <div className="p-6 border rounded-3xl bg-emerald-500/5 border-emerald-500/10">
                    <Database className="w-6 h-6 text-emerald-500 mb-4" />
                    <h4 className="font-bold text-sm mb-2">Persistence</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">PostgreSQL 14+ cho quản lý metadata. Prisma 5+ as ORM layer.</p>
                </div>
                <div className="p-6 border rounded-3xl bg-violet-500/5 border-violet-500/10">
                    <Shield className="w-6 h-6 text-violet-500 mb-4" />
                    <h4 className="font-bold text-sm mb-2">Security</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">OpenSSL cho mã hóa AES. JWT cho stateless authentication.</p>
                </div>
            </div>

            <DocSection title={t ? 'Yêu cầu Hệ thống (Technical Stack)' : 'System Requirements'}>
                <div className="space-y-6">
                    <Prose>
                        {t ? 'Dự án được xây dựng trên nền tảng TypeScript toàn diện (Full-stack TypeScript), yêu cầu các công cụ sau:' : 'The project is built on a comprehensive Full-stack TypeScript foundation, requiring the following tools:'}
                    </Prose>
                    <FeatureGrid>
                        <InfoCard icon={<Code className="w-5 h-5" />} title="Node.js Engine" color="orange">
                            <p className="text-xs">{t ? 'Phiên bản 20.x LTS được khuyên dùng để đảm bảo hiệu suất xử lý stream dữ liệu tốt nhất.' : 'Version 20.x LTS is recommended for optimal data streaming performance.'}</p>
                        </InfoCard>
                        <InfoCard icon={<Terminal className="w-5 h-5" />} title="Package Manager" color="blue">
                            <p className="text-xs">{t ? 'Sử dụng npm hoặc pnpm. Lưu ý không nên trộn lẫn các package manager để tránh lỗi lockfile.' : 'Use npm or pnpm. Avoid mixing package managers to prevent lockfile conflicts.'}</p>
                        </InfoCard>
                    </FeatureGrid>
                </div>
            </DocSection>

            <DocSection title={t ? 'Ma trận Tương thích CSDL' : 'Database Compatibility Matrix'}>
                <div className="border rounded-2xl overflow-hidden bg-card/30">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">{t ? 'Hệ quản trị' : 'Engine'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản' : 'Version'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Tính năng' : 'Features'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y border-t">
                            {[
                                { engine: 'PostgreSQL', ver: '12 - 16+', feat: t ? 'Full Support, SSL, Tunneling' : 'Full Support, SSL, Tunneling' },
                                { engine: 'MySQL', ver: '5.7, 8.0+', feat: t ? 'Full Support, MariaDB compatible' : 'Full Support, MariaDB compatible' },
                                { engine: 'SQL Server', ver: '2017 - 2022', feat: t ? 'Schema Explorer, T-SQL support' : 'Schema Explorer, T-SQL support' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-4 font-bold">{row.engine}</td>
                                    <td className="p-4">{row.ver}</td>
                                    <td className="p-4 text-muted-foreground">{row.feat}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            <DocSection title={t ? 'Quyền truy cập Mạng' : 'Network Prerequisites'}>
                <ul className="space-y-4">
                    {[
                        { label: 'Outbound Traffic', desc: t ? 'Backend cần quyền truy cập HTTPS (Port 443) tới *.google.com để sử dụng Gemini AI.' : 'Backend needs HTTPS (Port 443) outbound access to *.google.com for Gemini AI.' },
                        { label: 'Inbound Traffic', desc: t ? 'Cổng 3000 (Backend) và 5173 (Frontend) cần được mở nếu bạn muốn truy cập từ xa.' : 'Ports 3000 (Backend) and 5173 (Frontend) must be open for remote access.' },
                        { label: 'Database Access', desc: t ? 'Đảm bảo máy chủ chạy Data Explorer đã được Whitelist IP tại Firewall của Database đích.' : 'Ensure the Data Explorer host IP is Whitelisted in the target Database firewall.' }
                    ].map((item, i) => (
                        <li key={i} className="flex gap-4 p-5 border rounded-2xl items-start bg-muted/5">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h5 className="font-bold text-sm">{item.label}</h5>
                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </DocSection>
        </DocPageLayout>
    );
}
