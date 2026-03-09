import { Zap, Database, BookOpen } from 'lucide-react';
import { Badge } from '@/presentation/components/ui/badge';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, Callout, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function IntroductionSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Giới thiệu về Data Explorer' : 'Introduction to Data Explorer'}
            subtitle={t
                ? 'Chào mừng bạn đến với tài liệu chính thức của Data Explorer — công cụ quản lý và trực quan hóa cơ sở dữ liệu hiệu năng cao, được thiết kế cho các nhóm kỹ thuật yêu cầu sự chính xác, tốc độ và khả năng phân tích sâu sắc.'
                : 'Welcome to the official Data Explorer documentation — a high-performance database management and visualization tool designed for technical teams requiring precision, speed, and deep analytical capabilities.'}
            gradient
        >
            {/* Overview Cards */}
            <FeatureGrid>
                <InfoCard icon={<Database className="w-6 h-6 text-blue-500" />} title={t ? 'Hỗ trợ Đa Engine' : 'Multi-Engine Support'} color="blue">
                    <p>{t
                        ? 'Kết nối bản địa tới PostgreSQL, MySQL và SQL Server thông qua một giao diện thống nhất. Mỗi engine sử dụng driver riêng biệt được tối ưu hóa cho hiệu suất tốt nhất — không chỉ là một wrapper chung chung.'
                        : 'Native connections to PostgreSQL, MySQL and SQL Server through a unified interface. Each engine uses its own optimized driver for maximum performance — not just a generic wrapper.'}</p>
                </InfoCard>
                <InfoCard icon={<BookOpen className="w-6 h-6 text-purple-500" />} title={t ? 'Trợ lý AI Gemini' : 'Gemini AI Assistant'} color="purple">
                    <p>{t
                        ? 'Tích hợp sâu với Google Gemini để tạo mã SQL từ ngôn ngữ tự nhiên, phân tích lược đồ thông minh, và thậm chí tái cấu trúc database schema từ hình ảnh chụp sơ đồ vẽ tay (Vision API).'
                        : 'Deeply integrated with Google Gemini for natural language to SQL generation, intelligent schema analysis, and even reconstructing database schemas from hand-drawn diagram images (Vision API).'}</p>
                </InfoCard>
            </FeatureGrid>

            {/* Why Data Explorer */}
            <DocSection title={t ? 'Tại sao chọn Data Explorer?' : 'Why Data Explorer?'}>
                <Prose>
                    {t
                        ? 'Hầu hết các công cụ quản trị database hiện nay đều quá đơn sơ hoặc bị sa lầy trong các thiết kế cũ kỹ từ những thập kỷ trước. Data Explorer tập trung vào ba trụ cột cốt lõi: Mật độ thông tin, Tốc độ thực thi, và Trí tuệ nhân tạo. Chúng tôi mang đến trải nghiệm "Monaco-first" — biến việc quản trị dữ liệu trở nên thoải mái như đang lập trình trên VS Code.'
                        : 'Most database management tools today are either too simplistic or bogged down in legacy designs from decades ago. Data Explorer focuses on three core pillars: Information Density, Execution Speed, and Artificial Intelligence. We bring a "Monaco-first" experience — making data management as comfortable as coding in VS Code.'}
                </Prose>
                <Prose>
                    {t
                        ? 'Khác với các GUI database truyền thống như pgAdmin hay DBeaver, Data Explorer được xây dựng hoàn toàn trên nền web hiện đại (React + Vite) với kiến trúc Hexagonal (Clean Architecture). Điều này cho phép bạn truy cập từ bất kỳ trình duyệt nào, trên bất kỳ thiết bị nào, mà vẫn giữ được hiệu năng ngang ngửa ứng dụng desktop.'
                        : 'Unlike traditional database GUIs like pgAdmin or DBeaver, Data Explorer is built entirely on modern web technologies (React + Vite) with Hexagonal (Clean) Architecture. This allows access from any browser, on any device, while maintaining desktop-class performance.'}
                </Prose>
                <Callout type="info">
                    <p className="italic text-lg text-foreground">
                        {t
                            ? '"Sứ mệnh của chúng tôi là biến việc khám phá dữ liệu trở nên trực quan và liền mạch như cách bạn viết mã nguồn hàng ngày."'
                            : '"Our mission is to make data exploration as intuitive and seamless as the way you write source code every day."'}
                    </p>
                </Callout>
            </DocSection>

            {/* Quick Start Example */}
            <DocSection title={t ? 'Bắt đầu nhanh trong 60 giây' : 'Quick Start in 60 Seconds'}>
                <Prose>
                    {t
                        ? 'Dưới đây là cách nhanh nhất để chạy Data Explorer trên máy của bạn. Chỉ cần 3 lệnh terminal:'
                        : 'Here\'s the fastest way to run Data Explorer on your machine. Just 3 terminal commands:'}
                </Prose>
                <CodeBlock title={t ? 'Khởi động nhanh' : 'Quick Start'}>
                    <CodeComment>{t ? 'Clone và cài đặt' : 'Clone and install'}</CodeComment>
                    <CodeLine>git clone https://github.com/KasierBach/Data-Explorer-Editor.git</CodeLine>
                    <CodeLine>cd Data-Explorer-Editor</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Cài đặt dependencies cho cả client và server' : 'Install dependencies for both client and server'}</CodeComment>
                    <CodeLine>npm run install:all</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Khởi động toàn bộ dự án (server + client)' : 'Start the entire project (server + client)'}</CodeComment>
                    <CodeLine>npm run dev</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Mở trình duyệt tại http://localhost:5173' : 'Open browser at http://localhost:5173'}</CodeComment>
                </CodeBlock>
            </DocSection>

            {/* Core Values */}
            <DocSection title={t ? 'Giá trị cốt lõi' : 'Core Values'}>
                <Prose>
                    {t
                        ? 'Data Explorer được xây dựng dựa trên bốn giá trị cốt lõi. Mỗi tính năng, mỗi dòng code đều phản ánh cam kết của chúng tôi với những nguyên tắc này:'
                        : 'Data Explorer is built on four core values. Every feature, every line of code reflects our commitment to these principles:'}
                </Prose>
                <ul className="grid sm:grid-cols-2 gap-4">
                    {[
                        {
                            title: t ? "Hiệu năng cực đỉnh" : "Extreme Performance",
                            desc: t
                                ? "Xử lý hàng triệu bản ghi trực tiếp trên trình duyệt mà không lag. Monaco Editor được tối ưu để xử lý file SQL hàng chục nghìn dòng. Kết quả truy vấn được phân trang phía client với virtual scrolling."
                                : "Handle millions of records directly in the browser without lag. Monaco Editor is optimized to handle SQL files with tens of thousands of lines. Query results use client-side pagination with virtual scrolling."
                        },
                        {
                            title: t ? "Bảo mật tuyệt đối" : "Absolute Security",
                            desc: t
                                ? "Kiến trúc Multi-Tier đảm bảo thông tin kết nối chỉ lưu trên server PostgreSQL của bạn. Mật khẩu được mã hóa AES-256-GCM trước khi lưu. JWT tokens sử dụng HttpOnly cookies để ngăn chặn XSS."
                                : "Multi-Tier architecture ensures all connection data stays on your PostgreSQL server. Passwords are AES-256-GCM encrypted before storage. JWT tokens use HttpOnly cookies to prevent XSS attacks."
                        },
                        {
                            title: t ? "Trải nghiệm lập trình viên" : "Developer Experience",
                            desc: t
                                ? "Hỗ trợ đầy đủ phím tắt (Ctrl+Enter để thực thi, Shift+Alt+F để format), linting SQL theo từng dialect, đa con trỏ, tìm kiếm và thay thế regex, và auto-complete thông minh."
                                : "Full shortcut support (Ctrl+Enter to execute, Shift+Alt+F to format), SQL linting per dialect, multi-cursor editing, regex find & replace, and intelligent auto-complete."
                        },
                        {
                            title: t ? "Trực quan hóa tức thời" : "Instant Visualization",
                            desc: t
                                ? "Chuyển đổi kết quả truy vấn sang biểu đồ chuyên nghiệp chỉ với một cú click. Hỗ trợ 15+ loại biểu đồ. Sơ đồ ERD tương tác với auto-layout dựa trên thuật toán Dagre."
                                : "Convert query results into professional charts with a single click. 15+ chart types supported. Interactive ERD diagrams with Dagre-based auto-layout."
                        }
                    ].map((item, id) => (
                        <li key={id} className="flex gap-4 p-5 rounded-xl hover:bg-muted/30 transition-colors border">
                            <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                            <div>
                                <span className="font-bold block text-base">{item.title}</span>
                                <span className="text-sm text-muted-foreground leading-relaxed">{item.desc}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </DocSection>

            {/* Feature Overview Table */}
            <DocSection title={t ? 'Tổng quan tính năng' : 'Feature Overview'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">{t ? 'Tính năng' : 'Feature'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Mô tả' : 'Description'}</th>
                                <th className="text-center p-4 font-bold">{t ? 'Trạng thái' : 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { feature: 'Monaco SQL Editor', desc: t ? 'Trình soạn thảo VS Code-grade với IntelliSense' : 'VS Code-grade editor with IntelliSense', status: '✅' },
                                { feature: t ? 'Đa kết nối DB' : 'Multi-DB Connections', desc: t ? 'PostgreSQL, MySQL, MSSQL, ClickHouse' : 'PostgreSQL, MySQL, MSSQL, ClickHouse', status: '✅' },
                                { feature: 'AI SQL Generation', desc: t ? 'Gemini Flash + Vision API' : 'Gemini Flash + Vision API', status: '✅' },
                                { feature: t ? 'Sơ đồ ERD' : 'ERD Diagrams', desc: t ? 'Tương tác, auto-layout, xuất SQL' : 'Interactive, auto-layout, SQL export', status: '✅' },
                                { feature: t ? 'Biểu đồ tương tác' : 'Interactive Charts', desc: t ? '15+ loại biểu đồ từ kết quả truy vấn' : '15+ chart types from query results', status: '✅' },
                                { feature: t ? 'Xuất dữ liệu' : 'Data Export', desc: 'CSV, Excel (XLSX), JSON, SQL INSERT', status: '✅' },
                                { feature: t ? 'Xác thực JWT' : 'JWT Authentication', desc: t ? 'HttpOnly cookies, AES-256 encryption' : 'HttpOnly cookies, AES-256 encryption', status: '✅' },
                                { feature: t ? 'Chế độ tối/sáng' : 'Dark/Light Mode', desc: t ? 'Tự động theo hệ thống hoặc thủ công' : 'Auto-detect system or manual toggle', status: '✅' },
                                { feature: t ? 'Đa ngôn ngữ' : 'Internationalization', desc: t ? 'Tiếng Việt và Tiếng Anh' : 'Vietnamese and English', status: '✅' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
                                    <td className="py-3 px-2 font-medium text-xs text-foreground/80">{row.feature}</td>
                                    <td className="py-3 px-2 text-xs text-muted-foreground">{row.desc}</td>
                                    <td className="py-3 px-2 text-center">{row.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Mission & Vision */}
            <DocSection title={t ? 'Sứ mệnh & Tầm nhìn' : 'Mission & Vision'}>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-500" />
                            {t ? 'Sứ mệnh' : 'Mission'}
                        </h4>
                        <Prose>
                            {t
                                ? 'Chúng tôi tin rằng việc tương tác với dữ liệu không nên là một cực hình kỹ thuật. Sứ mệnh của Data Explorer là dân chủ hóa quyền truy cập dữ liệu thông qua AI, giúp các kỹ sư và nhà phân tích tập trung vào "Tại sao" thay vì "Làm thế nào" khi viết SQL.'
                                : 'We believe that interacting with data should not be a technical ordeal. Data Explorer\'s mission is to democratize data access through AI, helping engineers and analysts focus on the "Why" rather than the "How" when writing SQL.'}
                        </Prose>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <Database className="w-4 h-4 text-purple-500" />
                            {t ? 'Tầm nhìn' : 'Vision'}
                        </h4>
                        <Prose>
                            {t
                                ? 'Trở thành trung tâm chỉ huy dữ liệu (Data Command Center) mã nguồn mở hàng đầu, nơi AI không chỉ tạo query mà còn hiểu được bối cảnh kinh doanh, dự báo xu hướng và tự động hóa các tác vụ bảo trì database phức tạp.'
                                : 'To become the leading open-source Data Command Center, where AI not only generates queries but also understands business context, predicts trends, and automates complex database maintenance tasks.'}
                        </Prose>
                    </div>
                </div>
            </DocSection>

            {/* Product Roadmap */}
            <DocSection title={t ? 'Lộ trình Phát triển (Roadmap)' : 'Product Roadmap'}>
                <div className="space-y-6">
                    <Prose>
                        {t
                            ? 'Chúng tôi không ngừng cải tiến Data Explorer. Dưới đây là những gì chúng tôi đang phát triển cho các phiên bản tiếp theo:'
                            : 'We are constantly improving Data Explorer. Here is what we are building for the upcoming versions:'}
                    </Prose>

                    <div className="grid gap-4">
                        {[
                            {
                                quarter: 'Q2 2026',
                                title: t ? 'Tìm kiếm Toàn cục (Global Search)' : 'Global Search (Ctrl+P)',
                                desc: t ? 'Truy cập nhanh vào bảng, file, lịch sử và câu lệnh AI từ một thanh bar duy nhất.' : 'Instant access to tables, files, history, and AI commands from a single command palette.'
                            },
                            {
                                quarter: 'Q3 2026',
                                title: t ? 'Thống kê Hiệu năng (Performance Profiler)' : 'Performance Profiler',
                                desc: t ? 'Phân tích trực quan EXPLAIN ANALYZE và gợi ý index tự động dựa trên tần suất truy vấn.' : 'Visual breakdown of EXPLAIN ANALYZE and automated index suggestions based on query frequency.'
                            },
                            {
                                quarter: 'Q4 2026',
                                title: t ? 'Cộng tác Nhóm (Team Collaboration)' : 'Team Collaboration',
                                desc: t ? 'Chia sẻ query, dashboard và sơ đồ ERD trực tiếp trong không gian làm việc chung.' : 'Share queries, dashboards, and ERD diagrams directly within a shared workspace.'
                            }
                        ].map((item, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-xl border bg-muted/20 border-border/50">
                                <Badge variant="outline" className="h-fit py-1 px-3 bg-blue-500/5 text-blue-500 border-blue-500/20 font-black text-[10px] shrink-0">
                                    {item.quarter}
                                </Badge>
                                <div className="space-y-1">
                                    <h5 className="font-bold text-sm">{item.title}</h5>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
