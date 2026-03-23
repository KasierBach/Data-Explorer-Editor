import { DocPageLayout, DocSection, Callout } from '../primitives';

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
                                { tech: 'Prisma ORM', ver: '5.x', role: t ? 'Type-safe ORM kết nối với PostgreSQL/Supabase (quản lý users & connections bền vững)' : 'Type-safe ORM for PostgreSQL/Supabase database (persistently manages users & connections)' },
                                { tech: 'Passport.js', ver: '0.7+', role: t ? 'Xác thực người dùng với chiến lược JWT (JSON Web Token)' : 'User authentication with JWT (JSON Web Token) strategy' },
                                { tech: 'pg (node-postgres)', ver: '8.x', role: t ? 'Driver PostgreSQL native cho Node.js' : 'Native PostgreSQL driver for Node.js' },
                                { tech: 'mysql2', ver: '3.x', role: t ? 'Driver MySQL/MariaDB with promise support' : 'MySQL/MariaDB driver with promise support' },
                                { tech: 'mssql (tedious)', ver: '10.x', role: t ? 'Driver SQL Server chính thức cho Node.js' : 'Official SQL Server driver for Node.js' },

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

            {/* Testing */}
            <DocSection title={t ? 'Kiểm thử & Chất lượng' : 'Testing & Quality'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-amber-500/10">
                                <th className="text-left p-4 font-bold">{t ? 'Công cụ' : 'Tool'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản' : 'Version'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Vai trò' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { tech: 'Vitest', ver: '1.x', role: t ? 'Test runner hiện đại, nhanh và tương thích với Vite' : 'Modern, fast test runner fully compatible with Vite' },
                                { tech: 'React Testing Library', ver: '14.x', role: t ? 'Kiểm thử component theo hành vi người dùng' : 'Testing components based on user behavior' },
                                { tech: 'JSDOM', ver: 'Latest', role: t ? 'Mô phỏng môi trường trình duyệt cho unit tests' : 'Browser environment simulation for unit tests' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
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
            {/* Technical Rationale */}
            <DocSection title={t ? 'Lý do chúng tôi chọn bộ Stack này' : 'Technical Rationale & Deep Dive'}>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {[
                        {
                            title: t ? 'Gemini 3.1 Flash-Lite: Low Latency' : 'Gemini 3.1 Flash-Lite: Low Latency',
                            desc: t ? 'Chúng tôi chọn Flash-Lite thay vì Pro cho các tính năng soạn thảo vì tốc độ phản hồi < 1 giây, điều cốt yếu để không làm gián đoạn luồng suy nghĩ của developer.' : 'We chose Flash-Lite over Pro for editor features because of sub-second response times, crucial for not breaking the developer\'s flow.'
                        },
                        {
                            title: t ? 'Hexagonal + NestJS: Driver Agnostic' : 'Hexagonal + NestJS: Driver Agnostic',
                            desc: t ? 'Sự kết hợp này cho phép Data Explorer hỗ trợ PostgreSQL, MySQL, MSSQL chỉ bằng cách đổi Adapter mà không chạm vào Domain logic.' : 'This combo allows Data Explorer to support PostgreSQL, MySQL, and MSSQL just by switching Adapters without touching Domain logic.'
                        },
                        {
                            title: t ? 'Zustand Slices: State Scalability' : 'Zustand Slices: State Scalability',
                            desc: t ? 'Kiến trúc Slice giúp cô lập trạng thái của Tab, Connection và UI, ngăn chặn việc re-render toàn bộ ứng dụng khi chỉ có 1 ký tự được gõ.' : 'Slice architecture isolates Tab, Connection, and UI states, preventing full-app re-renders when only 1 character is typed.'
                        },
                        {
                            title: t ? 'Prisma: Schema-First Safety' : 'Prisma: Schema-First Safety',
                            desc: t ? 'Tự động sinh Types cho DB giúp loại bỏ 90% lỗi runtime. Mọi thay đổi schema đều được TypeScript kiểm tra ngay lập tức.' : 'Auto-generated DB types eliminate 90% of runtime errors. Any schema changes are immediately validated by TypeScript.'
                        },
                        {
                            title: t ? 'Web Workers: Thread Isolation' : 'Web Workers: Thread Isolation',
                            desc: t ? 'Việc đưa Monaco Language Client vào Web Worker giúp duy trì 60fps ngay cả khi xử lý các tệp SQL hàng chục nghìn dòng.' : 'Moving Monaco Language Client to a Web Worker maintains 60fps even when handling ten-thousand-line SQL files.'
                        },
                        {
                            title: t ? 'SSE: Real-time SQL Streaming' : 'SSE: Real-time SQL Streaming',
                            desc: t ? 'Server-Sent Events cho phép hiển thị kết quả AI ngay khi server nhận được những token đầu tiên, giảm rào cản tâm lý về độ trễ.' : 'Server-Sent Events allow displaying AI results as soon as the first tokens are received, reducing the psychological barrier of latency.'
                        }
                    ].map((reason, i) => (
                        <div key={i} className="p-5 border rounded-2xl bg-muted/5 space-y-2 hover:bg-muted/10 transition-colors">
                            <h5 className="font-bold text-xs text-primary">{reason.title}</h5>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{reason.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
