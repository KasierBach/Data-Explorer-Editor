import { Cpu, Database, AlertCircle } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, Callout, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function PrerequisitesSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Điều kiện tiên quyết' : 'Prerequisites'}
            subtitle={t
                ? 'Đảm bảo môi trường phát triển của bạn đã được thiết lập đầy đủ trước khi bắt đầu cài đặt Data Explorer.'
                : 'Ensure your development environment is fully set up before installing Data Explorer.'}
        >
            {/* System Requirements */}
            <FeatureGrid>
                <InfoCard icon={<Cpu className="w-6 h-6 text-orange-500" />} title="Node.js" color="orange">
                    <p>{t
                        ? 'Yêu cầu phiên bản 18.x trở lên (khuyên dùng bản LTS 20.x). Node.js cung cấp runtime cho cả backend NestJS và build tool Vite phía frontend. Kiểm tra phiên bản hiện tại bằng lệnh:'
                        : 'Requires version 18.x or higher (LTS 20.x recommended). Node.js provides the runtime for both the NestJS backend and the Vite build tool on the frontend. Check your current version:'}</p>
                    <code className="bg-muted px-3 py-1 rounded text-xs font-mono mt-2 block">node --version</code>
                </InfoCard>
                <InfoCard icon={<Database className="w-6 h-6 text-blue-500" />} title={t ? 'Cơ sở dữ liệu' : 'Database'} color="blue">
                    <p>{t
                        ? 'Một instance database đang hoạt động và có quyền truy cập. Data Explorer hỗ trợ PostgreSQL (≥ 12), MySQL (≥ 5.7), SQL Server (≥ 2017), và ClickHouse (≥ 21.x).'
                        : 'A running database instance with access permissions. Data Explorer supports PostgreSQL (≥ 12), MySQL (≥ 5.7), SQL Server (≥ 2017), and ClickHouse (≥ 21.x).'}</p>
                </InfoCard>
            </FeatureGrid>

            {/* Version Compatibility Table */}
            <DocSection title={t ? 'Bảng tương thích phiên bản' : 'Version Compatibility Matrix'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">{t ? 'Công cụ' : 'Tool'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản tối thiểu' : 'Minimum'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Khuyến nghị' : 'Recommended'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Ghi chú' : 'Notes'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { tool: 'Node.js', min: '18.0.0', rec: '20.x LTS', note: t ? 'Dùng nvm để quản lý' : 'Use nvm to manage' },
                                { tool: 'npm', min: '9.0.0', rec: '10.x', note: t ? 'Đi kèm với Node.js' : 'Bundled with Node.js' },
                                { tool: 'Git', min: '2.30', rec: '2.40+', note: t ? 'Để clone repository' : 'For cloning repo' },
                                { tool: 'Docker', min: '20.10', rec: '24.x', note: t ? 'Tùy chọn, cho DB test' : 'Optional, for test DB' },
                                { tool: t ? 'Trình duyệt' : 'Browser', min: 'Chrome 90+', rec: 'Chrome/Edge', note: t ? 'Cần hỗ trợ ES2022' : 'ES2022 support needed' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-medium">{row.tool}</td>
                                    <td className="p-4"><code className="text-xs bg-muted px-2 py-0.5 rounded">{row.min}</code></td>
                                    <td className="p-4"><code className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded">{row.rec}</code></td>
                                    <td className="p-4 text-muted-foreground">{row.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Verification Commands */}
            <DocSection title={t ? 'Kiểm tra môi trường' : 'Environment Verification'}>
                <Prose>{t
                    ? 'Chạy các lệnh sau để xác nhận rằng tất cả công cụ cần thiết đã được cài đặt chính xác trên máy của bạn:'
                    : 'Run the following commands to verify that all required tools are properly installed on your machine:'}</Prose>
                <CodeBlock title="Terminal">
                    <CodeComment>{t ? 'Kiểm tra Node.js' : 'Check Node.js'}</CodeComment>
                    <CodeLine>node --version    # {t ? 'Kỳ vọng: v18.x.x hoặc cao hơn' : 'Expected: v18.x.x or higher'}</CodeLine>
                    <p className="mt-2" />
                    <CodeComment>{t ? 'Kiểm tra npm' : 'Check npm'}</CodeComment>
                    <CodeLine>npm --version     # {t ? 'Kỳ vọng: 9.x.x hoặc cao hơn' : 'Expected: 9.x.x or higher'}</CodeLine>
                    <p className="mt-2" />
                    <CodeComment>{t ? 'Kiểm tra Git' : 'Check Git'}</CodeComment>
                    <CodeLine>git --version     # {t ? 'Kỳ vọng: git version 2.30+' : 'Expected: git version 2.30+'}</CodeLine>
                    <p className="mt-2" />
                    <CodeComment>{t ? 'Kiểm tra Docker (tùy chọn)' : 'Check Docker (optional)'}</CodeComment>
                    <CodeLine>docker --version  # {t ? 'Kỳ vọng: Docker version 20.10+' : 'Expected: Docker version 20.10+'}</CodeLine>
                </CodeBlock>
            </DocSection>

            {/* Additional Tools */}
            <DocSection title={t ? 'Công cụ bổ trợ khuyên dùng' : 'Recommended Additional Tools'}>
                <ul className="space-y-3">
                    {[
                        { label: 'Git', desc: t ? 'Cần thiết để clone mã nguồn từ GitHub repository. Trên Windows, cài đặt Git for Windows; trên macOS, dùng brew install git.' : 'Required to clone source code from the GitHub repository. On Windows, install Git for Windows; on macOS, use brew install git.' },
                        { label: 'Docker (Optional)', desc: t ? 'Nếu bạn muốn chạy database qua container mà không cần cài đặt trực tiếp. Rất tiện cho việc test với PostgreSQL, MySQL hoặc ClickHouse.' : 'If you want to run databases via containers without direct installation. Great for testing with PostgreSQL, MySQL, or ClickHouse.' },
                        { label: 'VS Code', desc: t ? 'Trình soạn thảo mã nguồn được khuyên dùng. Cài thêm các extension: ESLint, Prettier, Tailwind IntelliSense, và Prisma để tăng hiệu quả phát triển.' : 'Recommended code editor. Install extensions: ESLint, Prettier, Tailwind IntelliSense, and Prisma for improved development efficiency.' },
                        { label: 'Postman / Thunder Client', desc: t ? 'Công cụ test API endpoint. Giúp kiểm tra các endpoint backend trước khi tích hợp với frontend.' : 'API endpoint testing tool. Helps verify backend endpoints before frontend integration.' }
                    ].map((tool, i) => (
                        <li key={i} className="flex items-start gap-4 p-4 border rounded-2xl bg-muted/20">
                            <div className="mt-1"><AlertCircle className="w-4 h-4 text-primary" /></div>
                            <div>
                                <span className="font-bold block">{tool.label}</span>
                                <span className="text-sm text-muted-foreground">{tool.desc}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </DocSection>

            {/* OS-Specific Notes */}
            <DocSection title={t ? 'Ghi chú theo Hệ điều hành' : 'OS-Specific Notes'}>
                <div className="grid md:grid-cols-3 gap-4">
                    {[
                        { os: 'Windows', notes: t ? 'Sử dụng PowerShell hoặc Git Bash. Đảm bảo đường dẫn không chứa ký tự đặc biệt hoặc dấu cách. Cài nvm-windows để quản lý phiên bản Node.js.' : 'Use PowerShell or Git Bash. Ensure paths don\'t contain special characters or spaces. Install nvm-windows for Node.js version management.' },
                        { os: 'macOS', notes: t ? 'Cài Homebrew (brew.sh) trước. Dùng brew install node@20 hoặc nvm. Nếu dùng M1/M2 chip, mọi tool đều tương thích Apple Silicon.' : 'Install Homebrew (brew.sh) first. Use brew install node@20 or nvm. For M1/M2 chips, all tools are Apple Silicon compatible.' },
                        { os: 'Linux', notes: t ? 'Dùng nvm (github.com/nvm-sh/nvm) để cài Node.js. Đảm bảo có quyền trên thư mục dự án. Ubuntu/Debian: sudo apt install build-essential cho native modules.' : 'Use nvm (github.com/nvm-sh/nvm) to install Node.js. Ensure proper directory permissions. Ubuntu/Debian: sudo apt install build-essential for native modules.' },
                    ].map((item, i) => (
                        <div key={i} className="p-5 border rounded-2xl bg-card space-y-2">
                            <h4 className="font-bold text-primary">{item.os}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.notes}</p>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
