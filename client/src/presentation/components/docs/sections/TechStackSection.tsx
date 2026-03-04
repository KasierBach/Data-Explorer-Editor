import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function TechStackSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Công nghệ Sử dụng' : 'Technology Stack'}
            subtitle={t
                ? 'Tổng quan chi tiết về toàn bộ các công nghệ, thư viện và framework được sử dụng trong Data Explorer.'
                : 'Detailed overview of all technologies, libraries, and frameworks used in Data Explorer.'}
        >
            {/* Frontend */}
            <DocSection title={t ? 'Frontend' : 'Frontend'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-blue-500/10">
                                <th className="text-left p-4 font-bold">{t ? 'Công nghệ' : 'Technology'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản' : 'Version'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Vai trò' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { tech: 'React', ver: '18.x', role: t ? 'Thư viện xây dựng giao diện với component-based architecture' : 'UI library with component-based architecture' },
                                { tech: 'Vite', ver: '5.x', role: t ? 'Build tool siêu nhanh với HMR (Hot Module Replacement)' : 'Ultra-fast build tool with HMR (Hot Module Replacement)' },
                                { tech: 'TypeScript', ver: '5.x', role: t ? 'Type safety cho cả frontend và backend' : 'Type safety for both frontend and backend' },
                                { tech: 'Tailwind CSS', ver: '3.x', role: t ? 'Utility-first CSS framework cho styling nhanh và nhất quán' : 'Utility-first CSS framework for fast, consistent styling' },
                                { tech: 'Zustand', ver: '4.x', role: t ? 'Quản lý state toàn cục nhẹ hơn Redux rất nhiều (chỉ ~1KB)' : 'Global state management much lighter than Redux (only ~1KB)' },
                                { tech: 'Monaco Editor', ver: '0.44+', role: t ? 'Code editor engine (giống VS Code) cho trải nghiệm soạn SQL' : 'Code editor engine (VS Code-like) for SQL editing experience' },
                                { tech: 'React Flow', ver: '11.x', role: t ? 'Render sơ đồ ERD tương tác với nút và cạnh kéo thả được' : 'Render interactive ERD diagrams with draggable nodes and edges' },
                                { tech: 'TanStack Query', ver: '5.x', role: t ? 'Quản lý async data fetching, caching, và synchronization' : 'Async data fetching, caching, and synchronization management' },
                                { tech: 'Radix UI', ver: 'Latest', role: t ? 'Headless UI primitives accessible (Dialog, Dropdown, Tooltip...)' : 'Accessible headless UI primitives (Dialog, Dropdown, Tooltip...)' },
                                { tech: 'Lucide React', ver: 'Latest', role: t ? 'Bộ icon SVG 800+ icons, nhẹ và tùy biến cao' : '800+ SVG icon set, lightweight and highly customizable' },
                                { tech: 'Recharts', ver: '2.x', role: t ? 'Thư viện biểu đồ React cho visualization dữ liệu' : 'React charting library for data visualization' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-bold text-primary">{row.tech}</td>
                                    <td className="p-4 font-mono text-xs">{row.ver}</td>
                                    <td className="p-4 text-muted-foreground">{row.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Backend */}
            <DocSection title={t ? 'Backend' : 'Backend'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-emerald-500/10">
                                <th className="text-left p-4 font-bold">{t ? 'Công nghệ' : 'Technology'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản' : 'Version'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Vai trò' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { tech: 'NestJS', ver: '10.x', role: t ? 'Enterprise Node.js framework với dependency injection và modular architecture' : 'Enterprise Node.js framework with dependency injection and modular architecture' },
                                { tech: 'Prisma ORM', ver: '5.x', role: t ? 'Type-safe ORM cho database SQLite nội bộ (quản lý users & connections)' : 'Type-safe ORM for internal SQLite database (manages users & connections)' },
                                { tech: 'Passport.js', ver: '0.7+', role: t ? 'Xác thực người dùng với chiến lược JWT (JSON Web Token)' : 'User authentication with JWT (JSON Web Token) strategy' },
                                { tech: 'pg (node-postgres)', ver: '8.x', role: t ? 'Driver PostgreSQL native cho Node.js' : 'Native PostgreSQL driver for Node.js' },
                                { tech: 'mysql2', ver: '3.x', role: t ? 'Driver MySQL/MariaDB with promise support' : 'MySQL/MariaDB driver with promise support' },
                                { tech: 'mssql (tedious)', ver: '10.x', role: t ? 'Driver SQL Server chính thức cho Node.js' : 'Official SQL Server driver for Node.js' },
                                { tech: '@clickhouse/client', ver: '0.2+', role: t ? 'Client HTTP chính thức từ ClickHouse Inc.' : 'Official HTTP client from ClickHouse Inc.' },
                                { tech: 'RxJS', ver: '7.x', role: t ? 'Reactive programming cho SSE streaming và event handling' : 'Reactive programming for SSE streaming and event handling' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-bold text-primary">{row.tech}</td>
                                    <td className="p-4 font-mono text-xs">{row.ver}</td>
                                    <td className="p-4 text-muted-foreground">{row.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* AI */}
            <DocSection title={t ? 'Trí tuệ Nhân tạo' : 'Artificial Intelligence'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-purple-500/10">
                                <th className="text-left p-4 font-bold">{t ? 'Dịch vụ' : 'Service'}</th>
                                <th className="text-left p-4 font-bold">Model</th>
                                <th className="text-left p-4 font-bold">{t ? 'Vai trò' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { service: 'Google AI Studio', model: 'gemini-2.0-flash', role: t ? 'Tạo SQL từ ngôn ngữ tự nhiên, giải thích truy vấn, phân tích lược đồ' : 'Natural language to SQL, query explanation, schema analysis' },
                                { service: 'Google AI Studio', model: 'gemini-1.5-pro-vision', role: t ? 'Phân tích hình ảnh sơ đồ ERD vẽ tay → tạo CREATE TABLE SQL' : 'Analyze hand-drawn ERD diagram images → generate CREATE TABLE SQL' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-bold">{row.service}</td>
                                    <td className="p-4 font-mono text-primary font-bold text-xs">{row.model}</td>
                                    <td className="p-4 text-muted-foreground">{row.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Callout type="info">
                    <p className="text-muted-foreground">{t
                        ? '📌 GEMINI_API_KEY có thể được lấy miễn phí tại Google AI Studio (aistudio.google.com). Free tier cho phép ~60 requests/phút — đủ dùng cho phát triển và team nhỏ.'
                        : '📌 GEMINI_API_KEY can be obtained free at Google AI Studio (aistudio.google.com). Free tier allows ~60 requests/minute — sufficient for development and small teams.'}</p>
                </Callout>
            </DocSection>
        </DocPageLayout>
    );
}
