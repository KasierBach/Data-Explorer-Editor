import {
    Database,
    Layers,
    BookOpen,
    Github,
    Activity,
    Layout,
    Zap,
    Shield,
    PieChart,
    Eye,
    Code,
    Search,
    Lock,
    Cpu,
    Workflow,
    AlertCircle,
    HelpCircle
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

interface DocContentProps {
    sectionId: string;
    lang: 'vi' | 'en';
}

export function DocContent({ sectionId, lang }: DocContentProps) {
    const renderContent = () => {
        switch (sectionId) {
            case 'introduction':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-6">
                            <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                                {lang === 'vi' ? 'Giới thiệu về Data Explorer' : 'Introduction to Data Explorer'}
                            </h1>
                            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                                {lang === 'vi'
                                    ? 'CHÀO MỪNG bạn đến với tài liệu chính thức của Data Explorer. Đây là một công cụ quản lý và trực quan hóa cơ sở dữ liệu hiệu năng cao, được thiết kế cho các nhóm kỹ thuật yêu cầu sự chính xác, tốc độ và khả năng phân tích sâu sắc.'
                                    : 'WELCOME to the official Data Explorer documentation. This is a high-performance database management and visualization tool designed for technical teams requiring precision, speed, and deep analytical capabilities.'}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mt-12">
                            <div className="p-8 rounded-3xl border bg-card/50 space-y-4 shadow-sm hover:shadow-xl transition-all border-primary/10 group">
                                <div className="bg-blue-500/10 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Database className="w-6 h-6 text-blue-500" />
                                </div>
                                <h3 className="font-bold text-xl">
                                    {lang === 'vi' ? 'Hỗ trợ Đa Engine' : 'Multi-Engine Support'}
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Kết nối bản địa tới PostgreSQL, MySQL, SQL Server và ClickHouse thông qua một giao diện thống nhất, tối ưu hóa cho từng loại driver.'
                                        : 'Native connections to PostgreSQL, MySQL, SQL Server, and ClickHouse through a unified interface, optimized for each driver type.'}
                                </p>
                            </div>
                            <div className="p-8 rounded-3xl border bg-card/50 space-y-4 shadow-sm hover:shadow-xl transition-all border-purple-500/10 group">
                                <div className="bg-purple-500/10 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <BookOpen className="w-6 h-6 text-purple-500" />
                                </div>
                                <h3 className="font-bold text-xl">
                                    {lang === 'vi' ? 'Trợ lý AI Gemini' : 'Gemini AI Assistant'}
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Sử dụng sức mạnh của Google Gemini để tạo mã SQL, phân tích lược đồ và tái cấu trúc dữ liệu từ hình ảnh (Vision).'
                                        : 'Harness the power of Google Gemini to generate SQL code, analyze schemas, and reconstruct data from images (Vision).'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6 pt-10 border-t">
                            <h2 className="text-3xl font-bold tracking-tight">
                                {lang === 'vi' ? 'Tại sao chọn Data Explorer?' : 'Why Data Explorer?'}
                            </h2>
                            <p className="text-muted-foreground leading-relaxed text-lg text-justify">
                                {lang === 'vi'
                                    ? 'Hầu hết các công cụ quản trị database hiện nay đều quá đơn sơ hoặc bị sa lầy trong các thiết kế cũ kỹ từ những thập kỷ trước. Data Explorer tập trung vào ba trụ cột cốt lõi: **Mật độ thông tin**, **Tốc độ thực thi**, và **Trí tuệ nhân tạo**. Chúng tôi mang đến trải nghiệm "Monaco-first" - biến việc quản trị dữ liệu trở nên thoải mái như đang lập trình trên VS Code.'
                                    : 'Most database management tools today are either too simplistic or bogged down in legacy designs from decades ago. Data Explorer focuses on three core pillars: **Information Density**, **Execution Speed**, and **Artificial Intelligence**. We bring a "Monaco-first" experience - making data management as comfortable as coding in VS Code.'}
                            </p>
                            <div className="bg-primary/5 p-8 border-l-4 border-primary rounded-r-2xl italic text-lg text-foreground shadow-inner">
                                {lang === 'vi'
                                    ? '"Sứ mệnh của chúng tôi là biến việc khám phá dữ liệu trở nên trực quan và liền mạch như cách bạn viết mã nguồn hàng ngày."'
                                    : '"Our mission is to make data exploration as intuitive and seamless as the way you write source code every day."'}
                            </div>
                        </div>

                        <div className="pt-10 space-y-6">
                            <h3 className="text-2xl font-bold">
                                {lang === 'vi' ? 'Giá trị cốt lõi' : 'Core Values'}
                            </h3>
                            <ul className="grid sm:grid-cols-2 gap-4">
                                {[
                                    { title: lang === 'vi' ? "Hiệu năng cực đỉnh" : "Extreme Performance", desc: lang === 'vi' ? "Xử lý hàng triệu bản ghi trực tiếp trên trình duyệt mà không lag." : "Handle millions of records directly in the browser without lag." },
                                    { title: lang === 'vi' ? "Bảo mật tuyệt đối" : "Absolute Security", desc: lang === 'vi' ? "Dữ liệu kết nối chỉ nằm tại máy chủ địa phương của bạn." : "Connection data remains only on your local server." },
                                    { title: lang === 'vi' ? "Trải nghiệm lập trình viên" : "Developer Experience", desc: lang === 'vi' ? "Hỗ trợ phím tắt, linting và định dạng mã chuyên nghiệp." : "Supports shortcuts, linting, and professional code formatting." },
                                    { title: lang === 'vi' ? "Trực quan hóa tức thời" : "Instant Visualization", desc: lang === 'vi' ? "Chuyển đổi kết quả truy vấn sang biểu đồ chỉ với một cú click." : "Convert query results into charts with just one click." }
                                ].map((item, id) => (
                                    <li key={id} className="flex gap-4 p-4 rounded-xl hover:bg-muted/30 transition-colors">
                                        <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                                        <div>
                                            <span className="font-bold block">{item.title}</span>
                                            <span className="text-sm text-muted-foreground">{item.desc}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );

            case 'installation':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Hướng dẫn Cài đặt' : 'Installation Guide'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Việc thiết lập Data Explorer cực kỳ đơn giản và nhanh chóng trên mọi nền tảng hỗ trợ Node.js.'
                                    : 'Setting up Data Explorer is extremely simple and fast on any platform that supports Node.js.'}
                            </p>
                        </div>

                        <div className="space-y-8">
                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                                    <h2 className="text-2xl font-bold">
                                        {lang === 'vi' ? 'Tải mã nguồn (Clone)' : 'Clone Source Code'}
                                    </h2>
                                </div>
                                <div className="bg-slate-950 p-6 rounded-2xl border shadow-2xl font-mono text-sm text-slate-300">
                                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                                        <span className="text-xs text-slate-500 uppercase tracking-widest">Terminal</span>
                                        <Code className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <p className="text-emerald-500"># {lang === 'vi' ? 'Sao chép repository từ GitHub' : 'Clone repository from GitHub'}</p>
                                    <p>git clone https://github.com/KasierBach/Data-Explorer-Editor.git</p>
                                    <p className="mt-4 text-emerald-500"># {lang === 'vi' ? 'Truy cập vào thư mục dự án' : 'Navigate into project directory'}</p>
                                    <p>cd Data-Explorer-Editor</p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                                    <h2 className="text-2xl font-bold">
                                        {lang === 'vi' ? 'Cài đặt Phụ thuộc' : 'Install Dependencies'}
                                    </h2>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {lang === 'vi'
                                        ? 'Chúng tôi sử dụng kiến trúc tách biệt giữa Client và Server. Bạn cần cài đặt cho cả hai:'
                                        : 'We use a decoupled architecture between Client and Server. You need to install dependencies for both:'}
                                </p>
                                <div className="bg-slate-950 p-6 rounded-2xl border shadow-2xl font-mono text-sm text-slate-300">
                                    <p className="text-emerald-500"># {lang === 'vi' ? 'Cài đặt cho Backend Server' : 'Install for Backend Server'}</p>
                                    <p>cd server && npm install</p>
                                    <p className="mt-4 text-emerald-500"># {lang === 'vi' ? 'Cài đặt cho Frontend Client' : 'Install for Frontend Client'}</p>
                                    <p>cd ../client && npm install</p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                                    <h2 className="text-2xl font-bold">
                                        {lang === 'vi' ? 'Cấu hình Môi trường' : 'Environment Configuration'}
                                    </h2>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {lang === 'vi'
                                        ? <>Tạo file <code className="bg-muted px-2 py-0.5 rounded font-bold text-primary">.env</code> trong thư mục <code className="italic">server/</code>:</>
                                        : <>Create a <code className="bg-muted px-2 py-0.5 rounded font-bold text-primary">.env</code> file in the <code className="italic">server/</code> directory:</>}
                                </p>
                                <div className="bg-slate-950 p-6 rounded-2xl border shadow-2xl font-mono text-sm text-slate-300 overflow-x-auto">
                                    <p className="text-orange-400"># {lang === 'vi' ? 'API Key cho AI (Lấy tại Google AI Studio)' : 'AI API Key (Get at Google AI Studio)'}</p>
                                    <p>GEMINI_API_KEY=your_google_ai_studio_key</p>
                                    <p className="mt-2 text-orange-400"># {lang === 'vi' ? 'Chuỗi bí mật cho JWT (Để trống để tự tạo ngẫu nhiên)' : 'JWT Secret String (Leave empty to auto-generate)'}</p>
                                    <p>JWT_SECRET=any_long_random_string</p>
                                    <p className="mt-2 text-orange-400"># {lang === 'vi' ? 'Đường dẫn DB lưu trữ cấu hình nội bộ' : 'Internal configuration DB path'}</p>
                                    <p>DATABASE_URL="file:./dev.db"</p>
                                    <p className="mt-2 text-orange-400"># {lang === 'vi' ? 'Cổng chạy ứng dụng' : 'Application Port'}</p>
                                    <p>PORT=3000</p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</div>
                                    <h2 className="text-2xl font-bold">
                                        {lang === 'vi' ? 'Khởi động' : 'Quick Start'}
                                    </h2>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="p-4 border rounded-xl bg-card">
                                        <p className="font-bold text-sm mb-2 flex items-center gap-2"><Cpu className="w-4 h-4" /> Server</p>
                                        <code className="text-xs font-mono text-emerald-600">cd server && npm run start:dev</code>
                                    </div>
                                    <div className="p-4 border rounded-xl bg-card">
                                        <p className="font-bold text-sm mb-2 flex items-center gap-2"><Layout className="w-4 h-4" /> Client</p>
                                        <code className="text-xs font-mono text-emerald-600">cd client && npm run dev</code>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                );

            case 'prerequisites':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Điều kiện tiên quyết' : 'Prerequisites'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Đảm bảo môi trường của bạn đã sẵn sàng trước khi bắt đầu cài đặt.'
                                    : 'Ensure your environment is ready before starting the installation.'}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="p-8 border rounded-3xl bg-card space-y-4 shadow-sm hover:shadow-md transition-all">
                                <div className="bg-orange-500/10 w-fit p-3 rounded-2xl text-orange-500">
                                    <Cpu className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-xl">Node.js</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Yêu cầu phiên bản 18.x trở lên (khuyên dùng bản LTS) để đảm bảo tính tương thích với các API mới nhất.'
                                        : 'Requires version 18.x or higher (LTS recommended) to ensure compatibility with the latest APIs.'}
                                </p>
                            </div>
                            <div className="p-8 border rounded-3xl bg-card space-y-4 shadow-sm hover:shadow-md transition-all">
                                <div className="bg-blue-500/10 w-fit p-3 rounded-2xl text-blue-500">
                                    <Database className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-xl">{lang === 'vi' ? 'Cơ sở dữ liệu' : 'Database'}</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Một instance PostgreSQL, MySQL, SQL Server hoặc ClickHouse đang hoạt động và có quyền truy cập.'
                                        : 'A running instance of PostgreSQL, MySQL, SQL Server, or ClickHouse with access permissions.'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 border-t pt-10">
                            <h2 className="text-2xl font-bold">{lang === 'vi' ? 'Công cụ bổ trợ' : 'Additional Tools'}</h2>
                            <ul className="space-y-3">
                                {[
                                    { label: 'Git', desc: lang === 'vi' ? 'Để clone mã nguồn từ repository.' : 'To clone source code from the repository.' },
                                    { label: 'Docker (Optional)', desc: lang === 'vi' ? 'Nếu bạn muốn chạy DB qua container.' : 'If you prefer running your DB via containers.' },
                                    { label: 'VS Code', desc: lang === 'vi' ? 'Trình soạn thảo mã nguồn được khuyên dùng.' : 'The recommended source code editor.' }
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
                        </div>
                    </div>
                );

            case 'architecture':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Kiến trúc Hệ thống' : 'System Architecture'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Tìm hiểu sâu về cách Data Explorer được xây dựng để đạt được sự linh hoạt và khả năng mở rộng tối đa.'
                                    : 'Dive deep into how Data Explorer is built to achieve maximum flexibility and scalability.'}
                            </p>
                        </div>

                        <div className="space-y-12">
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    <Layers className="w-6 h-6 text-primary" /> {lang === 'vi' ? 'Kiến trúc Hexagonal (Clean)' : 'Hexagonal Architecture (Clean)'}
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Chúng tôi áp dụng mô hình kiến trúc Hexagonal (hoặc Onion Architecture) để tách biệt hoàn toàn Logic Nghiệp vụ (Core Domain) khỏi Các Tác nhân Ngoài (Infrastructure).'
                                        : 'We adopt the Hexagonal Architecture model (or Onion Architecture) to completely decouple Business Logic (Core Domain) from External Actors (Infrastructure).'}
                                </p>
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div className="p-5 border rounded-2xl bg-muted/20 space-y-2">
                                        <h4 className="font-bold text-sm text-primary uppercase">Domain Layer</h4>
                                        <p className="text-xs text-muted-foreground">
                                            {lang === 'vi' ? 'Nơi chứa các interface và logic cốt lõi. Không phụ thuộc vào bất kỳ thư viện bên ngoài nào.' : 'Contains core interfaces and logic. Zero dependencies on external libraries.'}
                                        </p>
                                    </div>
                                    <div className="p-5 border rounded-2xl bg-muted/20 space-y-2">
                                        <h4 className="font-bold text-sm text-primary uppercase">Application Layer</h4>
                                        <p className="text-xs text-muted-foreground">
                                            {lang === 'vi' ? 'Điều phối dòng dữ liệu thông qua các Service. Thực hiện các Use Case của hệ thống.' : 'Orchestrates data flow through Services. Implements system Use Cases.'}
                                        </p>
                                    </div>
                                    <div className="p-5 border rounded-2xl bg-muted/20 space-y-2">
                                        <h4 className="font-bold text-sm text-primary uppercase">Adapter Layer</h4>
                                        <p className="text-xs text-muted-foreground">
                                            {lang === 'vi' ? 'Triển khai cụ thể cho từng DB, API hoặc UI. Có thể thay thế dễ dàng.' : 'Concrete implementations for each DB, API, or UI. Easily swappable.'}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-6 pt-10 border-t">
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    <Workflow className="w-6 h-6 text-emerald-500" /> {lang === 'vi' ? 'Strategy Pattern cho Đa Database' : 'Strategy Pattern for Multi-Database'}
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Làm thế nào để hỗ trợ cùng lúc 4 engine database khác nhau mà không làm code trở nên rối rắm? Câu trả lời là **Strategy Pattern**.'
                                        : 'How do we support 4 different database engines simultaneously without creating messy code? The answer is the **Strategy Pattern**.'}
                                </p>
                                <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-sm text-slate-300">
                                    <p className="text-emerald-500 italic">// {lang === 'vi' ? 'Interface chung cho mọi database' : 'Common interface for all databases'}</p>
                                    <p>interface IDatabaseStrategy {"{"}</p>
                                    <p className="pl-4">query(sql: string): Promise&lt;any&gt;;</p>
                                    <p className="pl-4">getTables(): Promise&lt;Table[]&gt;;</p>
                                    <p className="pl-4">introspect(db: string): Promise&lt;Schema&gt;;</p>
                                    <p>{"}"}</p>
                                </div>
                                <p className="text-sm text-muted-foreground italic">
                                    {lang === 'vi'
                                        ? 'Hệ thống sẽ tự động chọn "Chiến lược" (PostgresStrategy, MySQLStrategy, ...) phù hợp dựa trên thông tin kết nối mà người dùng cung cấp.'
                                        : 'The system automatically selects the appropriate "Strategy" (PostgresStrategy, MySQLStrategy, ...) based on the connection info provided by the user.'}
                                </p>
                            </section>

                            <section className="space-y-6 pt-10 border-t">
                                <h2 className="text-2xl font-bold">
                                    {lang === 'vi' ? 'Dòng chảy Dữ liệu AI' : 'AI Data Flow'}
                                </h2>
                                <p className="text-muted-foreground leading-relaxed italic">
                                    Schema Metadata → Gemini Flash → SSE Stream → Monaco Dynamic Update
                                </p>
                                <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20">
                                    <p className="text-sm leading-loose">
                                        {lang === 'vi' ? 'Khi bạn yêu cầu AI viết code, dự án sẽ thực hiện:' : 'When you request AI code generation, the project performs:'}
                                        <br />{lang === 'vi' ? '1. **Quét nhanh** cấu trúc bảng liên quan.' : '1. **Fast scan** of relevant table structures.'}
                                        <br />2. **Nén schema** thành các định dạng Token-efficient.
                                        <br />3. **Gửi prompt** tối ưu tới Google API.
                                        <br />4. **Phản hồi thời gian thực** thông qua Server-Sent Events để hiển thị từng dòng code đang được tạo ra.
                                    </p>
                                </div>
                            </section>
                        </div>
                    </div>
                );

            case 'tech-stack':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Danh sách Công nghệ' : 'Technology Stack'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Tất cả các công cụ và thư viện làm nên linh hồn của dự án.'
                                    : 'All the tools and libraries that form the soul of the project.'}
                            </p>
                        </div>

                        <div className="space-y-12">
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold border-b pb-2">Frontend Stack</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {[
                                        { name: "React 18", desc: lang === 'vi' ? "Framework cốt lõi" : "Core Framework" },
                                        { name: "Vite", desc: lang === 'vi' ? "Công cụ Build" : "Build Tool" },
                                        { name: "Tailwind CSS", desc: lang === 'vi' ? "Định dạng giao diện" : "Styling" },
                                        { name: "Zustand", desc: lang === 'vi' ? "Quản lý trạng thái" : "State Management" },
                                        { name: "Monaco Editor", desc: lang === 'vi' ? "Trình chỉnh sửa mã" : "The Code Engine" },
                                        { name: "React Flow", desc: lang === 'vi' ? "Sơ đồ ERD" : "ERD Diagrams" },
                                        { name: "Lucide React", desc: lang === 'vi' ? "Bộ Icon" : "Icon set" },
                                        { name: "Radix UI", desc: lang === 'vi' ? "Thành phần nguyên tử" : "Primitive Components" },
                                        { name: "TanStack Query", desc: lang === 'vi' ? "Truy vấn dữ liệu" : "Data Fetching" }
                                    ].map((tech, i) => (
                                        <div key={i} className="p-4 border rounded-2xl bg-card hover:border-primary transition-colors">
                                            <span className="font-bold block text-sm">{tech.name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{tech.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold border-b pb-2">Backend Stack</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {[
                                        { name: "NestJS 10", desc: "Enterprise Framework" },
                                        { name: "Node.js", desc: "Runtime Environment" },
                                        { name: "TypeScript", desc: "Safety first" },
                                        { name: "Prisma ORM", desc: "Database access" },
                                        { name: "Passport.js", desc: "Authentication" },
                                        { name: "RxJS", desc: "Event handling" }
                                    ].map((tech, i) => (
                                        <div key={i} className="p-4 border rounded-2xl bg-card hover:border-emerald-500 transition-colors">
                                            <span className="font-bold block text-sm">{tech.name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{tech.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold border-b pb-2">AI & Intelligence</h2>
                                <ul className="space-y-4">
                                    <li className="flex items-center gap-4 p-4 border rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                                        <div className="p-2 bg-blue-500/20 rounded-xl"><Zap className="w-5 h-5 text-blue-600" /></div>
                                        <div>
                                            <span className="font-bold block text-sm italic">Gemini-2.0-flash</span>
                                            <span className="text-xs text-muted-foreground">
                                                {lang === 'vi'
                                                    ? 'Model chính phục vụ việc tạo SQL tốc độ cao và cực kỳ chính xác.'
                                                    : 'Main model serving high-speed and extremely accurate SQL generation.'}
                                            </span>
                                        </div>
                                    </li>
                                    <li className="flex items-center gap-4 p-4 border rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                                        <div className="p-2 bg-purple-500/20 rounded-xl"><Eye className="w-5 h-5 text-purple-600" /></div>
                                        <div>
                                            <span className="font-bold block text-sm italic">Gemini 1.5 Pro Vision</span>
                                            <span className="text-xs text-muted-foreground">
                                                {lang === 'vi'
                                                    ? 'Phân tích hình ảnh sơ đồ vẽ tay để thiết kế database schema.'
                                                    : 'Analyze hand-drawn diagram images to design database schemas.'}
                                            </span>
                                        </div>
                                    </li>
                                </ul>
                            </section>
                        </div>
                    </div>
                );

            case 'security':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Bảo mật & Quyền riêng tư' : 'Security & Privacy'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Chúng tôi coi trọng sự an toàn của dữ liệu của bạn hơn bất kỳ điều gì khác.'
                                    : 'We value the safety of your data above all else.'}
                            </p>
                        </div>

                        <div className="space-y-8">
                            <div className="p-8 border rounded-3xl bg-blue-500/5 border-blue-500/20 flex gap-6 items-start">
                                <Lock className="w-12 h-12 text-blue-500 shrink-0 mt-1" />
                                <div className="space-y-3">
                                    <h3 className="font-bold text-xl">
                                        {lang === 'vi' ? 'Dữ liệu của bạn thuộc về bạn' : 'Your data belongs to you'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {lang === 'vi'
                                            ? 'Data Explorer là một công cụ **Local-First**. Điều này có nghĩa là mọi thông tin đăng nhập, tên người dùng, mật khẩu host đều được lưu trữ trực tiếp trên thiết bị của bạn hoặc server mà bạn cài đặt.'
                                            : 'Data Explorer is a **Local-First** tool. This means all login information, usernames, and host passwords are stored directly on your device or the server you install it on.'}
                                        <br />
                                        {lang === 'vi'
                                            ? 'Chúng tôi **không bao giờ** gửi thông tin xác thực database lên đám mây.'
                                            : 'We **never** send database credentials to the cloud.'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-6 border rounded-2xl space-y-3">
                                    <h4 className="font-bold flex items-center gap-2 text-emerald-600"><Shield className="w-4 h-4" /> {lang === 'vi' ? 'Mã hóa Mật khẩu' : 'Password Encryption'}</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {lang === 'vi'
                                            ? 'Mọi chuỗi kết nối (Connection String) đều được mã hóa bằng thuật toán AES-256 trước khi lưu vào SQLite nội bộ.'
                                            : 'Every connection string is encrypted using the AES-256 algorithm before being saved to the internal SQLite.'}
                                    </p>
                                </div>
                                <div className="p-6 border rounded-2xl space-y-3">
                                    <h4 className="font-bold flex items-center gap-2 text-purple-600"><Search className="w-4 h-4" /> {lang === 'vi' ? 'Ẩn Metadata AI' : 'AI Metadata Anonymization'}</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {lang === 'vi'
                                            ? 'Chúng tôi chỉ gửi cấu trúc bảng (Table/Columns) lên AI để nhận diện, dữ liệu thực tế (Rows) của bảng không bao giờ được gửi đi trừ khi bạn yêu cầu giải thích dữ liệu cụ thể.'
                                            : 'We only send the table structure (Table/Columns) to the AI for recognition; actual table data (Rows) is never sent unless you specifically request data explanation.'}
                                    </p>
                                </div>
                            </div>

                            <section className="space-y-4 pt-10 border-t">
                                <h3 className="text-2xl font-bold">{lang === 'vi' ? 'Xác thực người dùng' : 'User Authentication'}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Data Explorer sử dụng **JWT (JSON Web Tokens)** để quản lý phiên làm việc. Tokens được lưu trong Cookies bảo mật với thuộc tính `HttpOnly` và `SameSite=Strict` để ngăn chặn các cuộc tấn công XSS và CSRF.'
                                        : 'Data Explorer uses **JWT (JSON Web Tokens)** to manage sessions. Tokens are stored in secure Cookies with `HttpOnly` and `SameSite=Strict` attributes to prevent XSS and CSRF attacks.'}
                                </p>
                            </section>
                        </div>
                    </div>
                );

            case 'lifecycle':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Quy trình Phát triển' : 'Development Lifecycle'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Tìm hiểu cách tham gia đóng góp và vận hành dự án chuyên nghiệp.'
                                    : 'Learn how to contribute and operate the project professionally.'}
                            </p>
                        </div>

                        <div className="space-y-8">
                            <section className="space-y-4">
                                <h2 className="text-2xl font-bold">
                                    {lang === 'vi' ? 'Cấu trúc Folder chính' : 'Main Folder Structure'}
                                </h2>
                                <div className="space-y-2">
                                    {[
                                        { path: "client/src/domain", desc: lang === 'vi' ? "Interface và các thực thể nghiệp vụ." : "Business entities and interfaces." },
                                        { path: "client/src/presentation", desc: lang === 'vi' ? "Component UI, Page và Store (Zustand)." : "UI Components, Pages, and Stores (Zustand)." },
                                        { path: "server/src/infrastructure", desc: lang === 'vi' ? "Cài đặt cụ thể các Strategy cho Database." : "Concrete Database Strategy implementations." },
                                        { path: "server/src/application", desc: lang === 'vi' ? "Các Use Case xử lý logic phía backend." : "Backend logic Use Case handlers." }
                                    ].map((dir, i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                                            <div className="bg-muted p-2 rounded-lg font-mono text-[10px] font-bold text-primary min-w-[180px] text-center">{dir.path}</div>
                                            <span className="text-xs text-muted-foreground">{dir.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-4 pt-10 border-t">
                                <h2 className="text-2xl font-bold">
                                    {lang === 'vi' ? 'Lệnh phát triển (Scripts)' : 'Development Scripts'}
                                </h2>
                                <div className="space-y-4">
                                    <div className="group">
                                        <code className="text-emerald-500 font-bold block mb-1">npm run build</code>
                                        <p className="text-xs text-muted-foreground">
                                            {lang === 'vi' ? 'Tạo bản build sản xuất cho cả frontend và backend dự án.' : 'Creates production builds for both frontend and backend.'}
                                        </p>
                                    </div>
                                    <div className="group">
                                        <code className="text-blue-500 font-bold block mb-1">npx prisma generate</code>
                                        <p className="text-xs text-muted-foreground">Tái tạo lại Prisma Client khi có thay đổi trong file `schema.prisma` nội bộ.</p>
                                    </div>
                                    <div className="group">
                                        <code className="text-purple-500 font-bold block mb-1">npm run lint</code>
                                        <p className="text-xs text-muted-foreground">Kiểm tra lỗi cú pháp và quy chuẩn code của toàn bộ dự án.</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                );

            case 'faq':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'FAQ & Khắc phục lỗi' : 'FAQ & Troubleshooting'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Giải đáp những thắc mắc thường gặp và xử lý các sự cố cài đặt.'
                                    : 'Answers to common questions and solutions for installation issues.'}
                            </p>
                        </div>

                        <div className="space-y-6">
                            {[
                                {
                                    q: lang === 'vi' ? "Tại sao tôi không thể kết nối tới PostgreSQL/MySQL cục bộ?" : "Why can't I connect to local PostgreSQL/MySQL?",
                                    a: lang === 'vi' ? "Hãy kiểm tra xem DB của bạn có đang mở port (5432/3306) và chấp nhận kết nối từ địa chỉ 127.0.0.1 hay không. Đôi khi bạn cần cấu hình listen_addresses trong config của chính DB đó." : "Please check if your DB is listening on the correct port (5432/3306) and accepting connections from 127.0.0.1. Sometimes you need to configure listen_addresses in the DB's own config file."
                                },
                                {
                                    q: lang === 'vi' ? "AI báo lỗi 'Quota exceeded'?" : "AI reports 'Quota exceeded' error?",
                                    a: lang === 'vi' ? "Đây là giới hạn của tài khoản Gemini API miễn phí. Bạn có thể thay đổi API Key khác hoặc đợi sau vài phút để hệ thống reset định mức sử dụng." : "This is a limitation of the free Gemini API tier. You can switch to a different API Key or wait a few minutes for the system to reset your quota."
                                },
                                {
                                    q: lang === 'vi' ? "Làm sao để xuất kết quả query ra File?" : "How do I export query results to a file?",
                                    a: lang === 'vi' ? "Trong lưới kết quả (Result Grid), bạn hãy nhấn vào icon 'Export' phía góc trên bên phải. Chúng tôi hỗ trợ CSV, JSON và INSERT SQL scripts." : "In the Result Grid, click the 'Export' icon in the top right corner. We support CSV, JSON, and INSERT SQL scripts."
                                },
                                {
                                    q: lang === 'vi' ? "Ứng dụng bị trắng trang sau khi build?" : "White screen after build?",
                                    a: lang === 'vi' ? "Vui lòng kiểm tra lại biến môi trường `BASE_URL` trong file định cấu hình frontend để đảm bảo nó trỏ đúng về địa chỉ backend đang chạy." : "Please check the `BASE_URL` environment variable in your frontend configuration file to ensure it points correctly to the running backend address."
                                }
                            ].map((item, i) => (
                                <div key={i} className="p-6 border rounded-2xl bg-card space-y-3 shadow-sm">
                                    <h4 className="font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4 text-primary" /> {item.q}</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-muted pl-4 py-1 italic">{item.a}</p>
                                </div>
                            ))}
                        </div>

                        <div className="bg-muted p-8 rounded-3xl border text-center space-y-4">
                            <h4 className="font-bold">{lang === 'vi' ? 'Vẫn không tìm thấy câu trả lời?' : 'Still can\'t find the answer?'}</h4>
                            <p className="text-sm text-muted-foreground">
                                {lang === 'vi' ? 'Mở một Issue trên GitHub hoặc tham gia thảo luận cùng cộng đồng.' : 'Open an issue on GitHub or join the community discussion.'}
                            </p>
                            <Button variant="default" onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor/issues', '_blank')}>
                                <Github className="w-4 h-4 mr-2" /> GitHub Issues
                            </Button>
                        </div>
                    </div>
                );

            case 'postgres':
            case 'mysql':
            case 'mssql':
            case 'clickhouse':
                const engineNames = {
                    postgres: 'PostgreSQL',
                    mysql: 'MySQL',
                    mssql: 'SQL Server',
                    clickhouse: 'ClickHouse'
                };
                const enginePorts = {
                    postgres: '5432',
                    mysql: '3306',
                    mssql: '1433',
                    clickhouse: '8123'
                };
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Kết nối' : 'Connect'} {engineNames[sectionId as keyof typeof engineNames]}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? `Hỗ trợ driver bản địa cho khả năng phân tích lược đồ ${engineNames[sectionId as keyof typeof engineNames]} tốc độ cao.`
                                    : `Native driver support for high-speed ${engineNames[sectionId as keyof typeof engineNames]} schema analysis.`}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 border rounded-2xl bg-muted/20 shadow-inner">
                                    <span className="text-xs font-bold uppercase text-muted-foreground">{lang === 'vi' ? 'Cổng mặc định' : 'Default Port'}</span>
                                    <p className="font-mono text-primary font-bold text-xl">{enginePorts[sectionId as keyof typeof enginePorts]}</p>
                                </div>
                                <div className="p-6 border rounded-2xl bg-muted/20 shadow-inner">
                                    <span className="text-xs font-bold uppercase text-muted-foreground">{lang === 'vi' ? 'Chiến lược' : 'Strategy'}</span>
                                    <p className="font-mono text-primary font-bold text-xl">Pooled Node Adapter</p>
                                </div>
                            </div>

                            <section className="space-y-4">
                                <h3 className="font-bold text-xl">{lang === 'vi' ? 'Làm thế nào để kết nối?' : 'How to connect?'}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? `Chỉ cần mở sidebar **Connection Explorer**, nhấn vào biểu tượng **dấu cộng (+)**, và chọn **${engineNames[sectionId as keyof typeof engineNames]}**.`
                                        : `Simply open the **Connection Explorer** sidebar, click the **plus (+) icon**, and select **${engineNames[sectionId as keyof typeof engineNames]}**.`}
                                    <br />
                                    {lang === 'vi'
                                        ? `Bạn có thể cung cấp chuỗi URI thô (ví dụ: \`postgresql://user:pass@host:port/db\`) hoặc điền vào form có cấu trúc.`
                                        : `You can provide a raw URI string (e.g., \`postgresql://user:pass@host:port/db\`) or fill in a structured form.`}
                                </p>
                            </section>

                            <div className="p-8 rounded-3xl bg-blue-500/5 border border-blue-500/20 space-y-3 shadow-sm">
                                <h4 className="font-bold flex items-center gap-2 text-blue-600 uppercase text-xs tracking-widest">
                                    <Shield className="w-4 h-4" /> {lang === 'vi' ? 'Ghi chú Bảo mật' : 'Security Note'}
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed italic">
                                    {lang === 'vi'
                                        ? 'Mọi thông tin xác thực kết nối của bạn đều được mã hóa và lưu trữ **nội bộ** trong cơ sở dữ liệu SQLite của máy chủ lưu trữ. Chúng tôi cam kết không bao giờ gửi mật khẩu thô của bạn ra khỏi hệ thống.'
                                        : 'All your connection credentials are encrypted and stored **internally** within the hosting server\'s SQLite database. We guarantee that your raw passwords are never sent outside of the system.'}
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'tabs':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Quản lý Tab' : 'Tab Management'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Đa nhiệm hiệu quả với hệ thống quản lý tab thông minh.'
                                    : 'Efficient multi-tasking with a smart tab management system.'}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="p-8 border rounded-3xl bg-card space-y-4">
                                <h3 className="font-bold text-xl">{lang === 'vi' ? 'Làm việc song song' : 'Work in Parallel'}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Bạn có thể mở đồng thời nhiều tab truy vấn từ các cơ sở dữ liệu khác nhau. Mỗi tab duy trì phiên làm việc, kết quả truy vấn và lịch sử soạn thảo riêng biệt.'
                                        : 'You can open multiple query tabs from different databases simultaneously. Each tab maintains its own session, query results, and editor history.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 border rounded-2xl bg-muted/20 space-y-2">
                                    <h4 className="font-bold">{lang === 'vi' ? 'Tự động Lưu' : 'Auto-Save'}</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {lang === 'vi'
                                            ? 'Nội dung tab được lưu tạm thời vào trình duyệt, giúp bạn không bị mất code khi vô tình tải lại trang.'
                                            : 'Tab content is temporarily saved in the browser, preventing code loss if the page is accidentally reloaded.'}
                                    </p>
                                </div>
                                <div className="p-6 border rounded-2xl bg-muted/20 space-y-2">
                                    <h4 className="font-bold">{lang === 'vi' ? 'Đổi tên linh hoạt' : 'Flexible Renaming'}</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {lang === 'vi'
                                            ? 'Nhấn đúp vào tên tab để đổi tên cho phù hợp với mục đích truy vấn của bạn.'
                                            : 'Double-click a tab name to rename it according to your query purpose.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'results':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Lưới kết quả' : 'Result Grid'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Tương tác với dữ liệu truy vấn một cách trực quan và mạnh mẽ.'
                                    : 'Interact with query data intuitively and powerfully.'}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            {[
                                { title: lang === 'vi' ? 'Sắp xếp' : 'Sorting', desc: lang === 'vi' ? 'Nhấn vào tiêu đề cột để sắp xếp dữ liệu tăng/giảm dần.' : 'Click column headers to sort data ascending/descending.' },
                                { title: lang === 'vi' ? 'Lọc nhanh' : 'Quick Filter', desc: lang === 'vi' ? 'Sử dụng thanh tìm kiếm trực tiếp trên lưới để lọc bản ghi.' : 'Use the search bar directly on the grid to filter records.' },
                                { title: lang === 'vi' ? 'Phân trang' : 'Pagination', desc: lang === 'vi' ? 'Hỗ trợ xử lý hàng triệu bản ghi nhờ cơ chế phân trang phía client.' : 'Supports millions of records through client-side pagination.' }
                            ].map((feature, i) => (
                                <div key={i} className="p-6 border rounded-2xl bg-card space-y-2 hover:border-primary/50 transition-colors">
                                    <h4 className="font-bold text-primary">{feature.title}</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'export':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Xuất dữ liệu' : 'Data Export'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Chia sẻ và lưu trữ kết quả phân tích của bạn dưới nhiều định dạng.'
                                    : 'Share and store your analysis results in multiple formats.'}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { format: 'CSV / Excel', desc: lang === 'vi' ? 'Phù hợp để xử lý tiếp bằng bảng tính.' : 'Suitable for further processing with spreadsheets.' },
                                { format: 'JSON', desc: lang === 'vi' ? 'Định dạng chuẩn để trao đổi giữa các ứng dụng.' : 'Standard format for data exchange between applications.' },
                                { format: 'SQL INSERT', desc: lang === 'vi' ? 'Tạo kịch bản để import dữ liệu sang database khác.' : 'Generate scripts to import data into another database.' }
                            ].map((style, i) => (
                                <div key={i} className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="font-bold">{style.format}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{style.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'editor':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Trình soạn thảo Monaco SQL' : 'Monaco SQL Editor'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Trải nghiệm soạn thảo tiêu chuẩn công nghiệp, được tối ưu riêng cho việc phát triển SQL.'
                                    : 'Industry-standard editing experience, specifically optimized for SQL development.'}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-6 border rounded-3xl bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-default group">
                                <Zap className="w-10 h-10 text-yellow-500 mb-4 group-hover:scale-110 transition-transform" />
                                <h4 className="font-bold text-lg">{lang === 'vi' ? 'Tốc độ Ánh sáng' : 'Lightning Fast'}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Soạn thảo không độ trễ ngay cả với các stored procedure dài hàng chục nghìn dòng. Được tối ưu hóa cho khối lượng code lớn.'
                                        : 'Zero-latency editing even with stored procedures tens of thousands of lines long. Optimized for large codebases.'}
                                </p>
                            </div>
                            <div className="p-6 border rounded-3xl bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-default group">
                                <Activity className="w-10 h-10 text-emerald-500 mb-4 group-hover:scale-110 transition-transform" />
                                <h4 className="font-bold text-lg">{lang === 'vi' ? 'Linting Thời gian thực' : 'Real-time Linting'}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Xác thực cú pháp tức thì dựa trên từng phương ngữ SQL cụ thể (PostgreSQL, MySQL, hoặc MSSQL).'
                                        : 'Instant syntax validation based on specific SQL dialects (PostgreSQL, MySQL, or MSSQL).'}
                                </p>
                            </div>
                        </div>

                        <section className="space-y-6">
                            <h3 className="text-2xl font-bold">{lang === 'vi' ? 'Phím tắt cho Power Users' : 'Shortcuts for Power Users'}</h3>
                            <div className="space-y-2">
                                {[
                                    { label: lang === 'vi' ? 'Thực thi Toàn bộ' : 'Execute All', key: 'Ctrl + Enter' },
                                    { label: lang === 'vi' ? 'Thực thi Vùng chọn' : 'Execute Selection', key: 'Cmd/Ctrl + Shift + Enter' },
                                    { label: lang === 'vi' ? 'Định dạng mã SQL' : 'Format SQL Code', key: 'Shift + Alt + F' },
                                    { label: lang === 'vi' ? 'Bật/Tắt Chú thích' : 'Toggle Comment', key: 'Ctrl + /' },
                                    { label: lang === 'vi' ? 'Tìm kiếm Toàn cục' : 'Global Search', key: 'Ctrl + F' }
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                                        <span className="text-sm font-medium">{s.label}</span>
                                        <kbd className="bg-muted border border-muted-foreground/30 px-3 py-1 rounded-md shadow-sm font-mono text-[11px] uppercase font-bold text-primary">{s.key}</kbd>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                );

            case 'sql-generation':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl">
                                {lang === 'vi' ? 'Tạo mã SQL bằng AI' : 'AI SQL Generation'}
                            </h1>
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                {lang === 'vi'
                                    ? 'Data Explorer tích hợp các model Gemini của Google để chuyển đổi ngôn ngữ tự nhiên thành các truy vấn SQL tối ưu, dựa sát trên ngữ cảnh thực tế của database của bạn.'
                                    : 'Data Explorer integrates Google\'s Gemini models to convert natural language into optimized SQL queries, closely based on the actual context of your database.'}
                            </p>
                        </div>

                        <div className="space-y-8">
                            <h2 className="text-3xl font-bold border-b pb-4 text-primary">
                                {lang === 'vi' ? 'Kỹ thuật Độ chính xác cao' : 'High-Precision Engineering'}
                            </h2>
                            <div className="space-y-6">
                                <div className="flex gap-6 items-start p-6 border rounded-2xl bg-muted/10">
                                    <div className="bg-primary/20 p-3 rounded-2xl text-primary font-bold text-sm shrink-0">01</div>
                                    <div className="space-y-2">
                                        <span className="text-foreground font-bold text-lg block">{lang === 'vi' ? 'Phân tích Lược đồ sâu' : 'Deep Schema Analysis'}</span>
                                        <p className="text-sm text-muted-foreground">
                                            {lang === 'vi' ? 'Chúng tôi tự động trích xuất tên bảng, kiểu dữ liệu cột và các mối quan hệ khóa ngoại (Foreign Keys).' : 'We automatically extract table names, column data types, and foreign key relationships.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-6 items-start p-6 border rounded-2xl bg-muted/10">
                                    <div className="bg-primary/20 p-3 rounded-2xl text-primary font-bold text-sm shrink-0">02</div>
                                    <div className="space-y-2">
                                        <span className="text-foreground font-bold text-lg block">{lang === 'vi' ? 'Prompting Contextual' : 'Contextual Prompting'}</span>
                                        <p className="text-sm text-muted-foreground">
                                            {lang === 'vi' ? 'Chúng tôi cung cấp cho AI danh sách metadata thu gọn để nó không bao giờ "ảo tưởng" (hallucinate) về những bảng không tồn tại.' : 'We provide the AI with a condensed metadata list so it never "hallucinates" non-existent tables.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-6 items-start p-6 border rounded-2xl bg-muted/10">
                                    <div className="bg-primary/20 p-3 rounded-2xl text-primary font-bold text-sm shrink-0">03</div>
                                    <div className="space-y-2">
                                        <span className="text-foreground font-bold text-lg block">SSE Streaming</span>
                                        <p className="text-sm text-muted-foreground">
                                            {lang === 'vi' ? 'Mã SQL được tạo ra sẽ hiển thị ngay lập tức trong editor theo phong cách "typing" như thể bạn đang xem AI gõ trực tiếp.' : 'Generated SQL code appears instantly in the editor in a "typing" style, as if you were watching the AI type live.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 rounded-3xl bg-slate-950 text-slate-50 font-mono text-sm border shadow-2xl relative group overflow-hidden">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                            <div className="relative bg-slate-950 p-4 rounded-xl">
                                <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span className="ml-2 text-slate-500 text-xs italic font-sans flex items-center gap-2">
                                        <Cpu className="w-3 h-3" /> model: gemini-2.0-flash
                                    </span>
                                </div>
                                <div className="text-emerald-400"># {lang === 'vi' ? "Người dùng: \"Liệt kê các đơn hàng giá trị cao từ năm 2024\"" : "User: \"List high-value orders from 2024\""}</div>
                                <div className="mt-4"><span className="text-blue-400 uppercase">SELECT</span> * <span className="text-blue-400 uppercase">FROM</span> <span className="text-purple-400">public.orders</span></div>
                                <div><span className="text-blue-400 uppercase">WHERE</span> total_amount &gt; <span className="text-orange-400">1000</span></div>
                                <div><span className="text-blue-400 uppercase">AND</span> created_at &gt;= <span className="text-emerald-300">'2024-01-01'</span></div>
                                <div><span className="text-blue-400 uppercase">ORDER BY</span> total_amount <span className="text-blue-400 uppercase">DESC</span>;</div>
                            </div>
                        </div>
                    </div>
                );

            case 'vision':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Tích hợp Gemini Vision' : 'Gemini Vision Integration'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Chuyển đổi sơ đồ vẽ tay trên bảng trắng thành bảng dữ liệu thực thi trong tích tắc.'
                                    : 'Convert hand-drawn diagrams on a whiteboard into executable database tables in an instant.'}
                            </p>
                        </div>

                        <div className="relative group rounded-[32px] overflow-hidden border-2 border-dashed border-primary/20 hover:border-primary/50 transition-all bg-card/50">
                            <div className="absolute inset-0 bg-primary/5 transition-colors group-hover:bg-primary/10" />
                            <div className="p-16 flex flex-col items-center text-center space-y-6">
                                <div className="bg-background p-6 rounded-[24px] shadow-2xl border border-primary/10">
                                    <Eye className="w-16 h-16 text-primary animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold italic tracking-tighter">Image-to-Schema</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                                        {lang === 'vi' ? 'Chỉ cần kéo và thả hình ảnh sơ đồ ER hoặc ảnh chụp màn hình ứng dụng vào khung chat AI.' : 'Simply drag and drop ER diagram images or app screenshots into the AI chat frame.'}
                                    </p>
                                </div>
                                <Button variant="outline" className="rounded-full px-8">{lang === 'vi' ? 'Thử ngay' : 'Try Now'}</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {[lang === 'vi' ? 'Vẽ Tay' : 'Hand-drawn', lang === 'vi' ? 'Sơ đồ ER' : 'ER Diagrams', lang === 'vi' ? 'Giao diện mẫu' : 'Sample UI'].map((t, i) => (
                                <div key={i} className="text-center p-4 border rounded-2xl bg-card text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">{t}</div>
                            ))}
                        </div>
                    </div>
                );

            case 'erd':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Sơ đồ Thực thể Quan hệ (ERD)' : 'Entity Relationship Diagram (ERD)'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Quan sát và thay đổi cấu trúc database thông qua các đồ thị tương tác mạnh mẽ.'
                                    : 'Visualize and modify database structure through powerful interactive graphs.'}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="p-8 border rounded-3xl bg-card space-y-4 hover:shadow-xl transition-all group">
                                <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                    <Layout className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-xl">Auto-Layout</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Tự động sắp xếp các bảng dựa trên mối liên hệ khóa ngoại bằng engine Dagre thông minh, giúp bản vẽ luôn gọn gàng.'
                                        : 'Automatically arrange tables based on foreign key relationships using the smart Dagre engine, keeping your diagrams neat.'}
                                </p>
                            </div>
                            <div className="p-8 border rounded-3xl bg-card space-y-4 hover:shadow-xl transition-all group">
                                <div className="bg-blue-500/10 w-fit p-3 rounded-2xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <Database className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-xl">{lang === 'vi' ? 'Đột biến Lược đồ' : 'Schema Mutations'}</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {lang === 'vi'
                                        ? 'Kéo thả các đường nối để tạo khóa ngoại hoặc xóa chúng để thực hiện lệnh DROP CONSTRAINT ngay trong môi trường đồ họa.'
                                        : 'Drag and drop connectors to create foreign keys or delete them to execute DROP CONSTRAINT commands directly within the graphical environment.'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6 p-8 bg-muted/20 border rounded-3xl shadow-inner">
                            <h3 className="font-bold text-xl flex items-center gap-3"><Activity className="w-5 h-5" /> {lang === 'vi' ? 'Hướng dẫn Tương tác' : 'Interaction Guide'}</h3>
                            <ul className="space-y-4 text-sm text-muted-foreground">
                                <li className="flex items-center gap-4">
                                    <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm">{lang === 'vi' ? 'Chuột trái' : 'Left Click'}</kbd>
                                    <span>{lang === 'vi' ? 'Chọn bảng hoặc quan hệ để xem chi tiết.' : 'Select a table or relationship to view details.'}</span>
                                </li>
                                <li className="flex items-center gap-4">
                                    <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm">{lang === 'vi' ? 'Chuột phải' : 'Right Click'}</kbd>
                                    <span>{lang === 'vi' ? 'Menu ngữ cảnh cho các tùy chọn xuất SQL hoặc copy JSON.' : 'Context menu for SQL export options or JSON copying.'}</span>
                                </li>
                                <li className="flex items-center gap-4">
                                    <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm">{lang === 'vi' ? 'Icon Cộng (+)' : 'Plus Icon (+)'}</kbd>
                                    <span>{lang === 'vi' ? 'Thêm bảng vào canvas từ danh sách sidebar bên trái.' : 'Add tables to the canvas from the left sidebar list.'}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                );

            case 'explain':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Giải thích truy vấn AI' : 'AI Query Explanation'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Hiểu rõ mọi câu lệnh SQL phức tạp chỉ với một cú click.'
                                    : 'Understand any complex SQL statement with just one click.'}
                            </p>
                        </div>

                        <div className="p-8 border rounded-3xl bg-card space-y-6">
                            <div className="flex gap-4 items-start">
                                <div className="bg-primary/10 p-3 rounded-full text-primary shrink-0">
                                    <HelpCircle className="w-6 h-6" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-bold text-xl">{lang === 'vi' ? 'Cách thức hoạt động' : 'How it works'}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {lang === 'vi'
                                            ? 'Khi bạn bôi đen một đoạn mã SQL và chọn "Explain", AI sẽ phân tích cấu trúc câu lệnh, giải thích ý nghĩa của các lệnh JOIN, các hàm điều kiện và dự đoán kết quả trả về.'
                                            : 'When you highlight a piece of SQL code and select "Explain", the AI analyzes the statement structure, explains the meaning of JOIN commands, conditional functions, and predicts the return results.'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 rounded-2xl bg-muted/30 border-l-4 border-primary">
                                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">{lang === 'vi' ? 'Lợi ích' : 'Benefits'}</p>
                                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                                    <li>{lang === 'vi' ? 'Học SQL nhanh hơn từ các ví dụ thực tế.' : 'Learn SQL faster from real-world examples.'}</li>
                                    <li>{lang === 'vi' ? 'Dễ dàng bảo trì mã của người khác để lại.' : 'Easily maintain code left by others.'}</li>
                                    <li>{lang === 'vi' ? 'Tối ưu hóa các truy vấn có hiệu năng kém.' : 'Optimize poor-performing queries.'}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                );

            case 'charts':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Biểu đồ Tương tác' : 'Interactive Charts'}
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {lang === 'vi'
                                    ? 'Biến kết quả truy vấn thô thành các báo cáo trực quan chuyên nghiệp chỉ trong vài giây.'
                                    : 'Turn raw query results into professional visual reports in seconds.'}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { name: lang === 'vi' ? 'Biểu đồ Đường' : 'Line Chart', icon: <Activity className="w-5 h-5" /> },
                                { name: lang === 'vi' ? 'Biểu đồ Cột' : 'Bar Chart', icon: <PieChart className="w-5 h-5" /> },
                                { name: lang === 'vi' ? 'Biểu đồ Radar' : 'Radar Chart', icon: <Layers className="w-5 h-5" /> },
                                { name: lang === 'vi' ? 'Phễu dữ liệu' : 'Data Funnel', icon: <Zap className="w-5 h-5" /> }
                            ].map((c, i) => (
                                <div key={i} className="flex flex-col items-center justify-center p-6 border rounded-3xl bg-card hover:bg-primary/10 hover:border-primary transition-all group">
                                    <div className="mb-3 text-primary group-hover:scale-125 transition-transform">{c.icon}</div>
                                    <span className="text-[10px] font-extrabold uppercase text-center block leading-tight">{c.name}</span>
                                </div>
                            ))}
                        </div>

                        <section className="space-y-6 p-10 border rounded-[40px] bg-slate-950 text-slate-50 relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
                            <div className="relative space-y-4">
                                <h4 className="font-bold text-2xl">{lang === 'vi' ? 'Cá nhân hóa Giao diện' : 'UI Personalization'}</h4>
                                <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                                    {lang === 'vi'
                                        ? 'Mọi biểu đồ đều hỗ trợ tùy chỉnh trục tọa độ, vị trí chú giải, và kế thừa bộ lọc màu sắc đồng nhất từ chủ đề chính của ứng dụng. Bạn có thể xuất biểu đồ dưới dạng hình ảnh chất lượng cao để đính kèm vào báo cáo.'
                                        : 'All charts support axis customization, legend positioning, and consistent color inheritance from the main app theme. You can export charts as high-quality images to attach to reports.'}
                                </p>
                            </div>
                        </section>
                    </div>
                );

            default:
                return (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 p-16 bg-muted/10 border-2 border-dashed border-muted rounded-[48px] animate-in zoom-in-95 duration-700">
                        <div className="relative">
                            <div className="absolute inset-0 blur-3xl bg-primary/30 rounded-full animate-pulse" />
                            <div className="relative bg-background p-10 rounded-full border shadow-2xl">
                                <Cpu className="w-16 h-16 text-primary animate-spin-[20s] linear infinite" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-3xl font-extrabold tracking-tight">
                                {lang === 'vi' ? 'Đang hoàn thiện nội dung chuyên sâu...' : 'Finalizing in-depth content...'}
                            </h2>
                            <p className="text-muted-foreground max-w-md mx-auto text-lg leading-relaxed">
                                {lang === 'vi'
                                    ? <>Đội ngũ kỹ thuật đang biên soạn tài liệu cặn kẽ cho mục <span className="font-mono text-primary font-bold underline decoration-primary/30 decoration-4 underline-offset-8">"{sectionId}"</span>.</>
                                    : <>The engineering team is composing detailed documentation for <span className="font-mono text-primary font-bold underline decoration-primary/30 decoration-4 underline-offset-8">"{sectionId}"</span>.</>}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-3 h-3 bg-primary/30 rounded-full animate-bounce" />
                        </div>
                        <Button variant="ghost" className="text-sm font-bold text-muted-foreground hover:text-primary transition-all">
                            {lang === 'vi' ? 'Nhận thông báo khi có bản cập nhật' : 'Get notified when updated'}
                        </Button>
                    </div>
                );
        }
    };

    return renderContent();
}
