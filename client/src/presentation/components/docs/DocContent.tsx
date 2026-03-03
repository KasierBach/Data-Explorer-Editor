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
    AlertCircle
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

interface DocContentProps {
    sectionId: string;
}

export function DocContent({ sectionId }: DocContentProps) {
    const renderContent = () => {
        switch (sectionId) {
            case 'introduction':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-6">
                            <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                                Giới thiệu về Data Explorer
                            </h1>
                            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                                CHÀO MỪNG bạn đến với tài liệu chính thức của Data Explorer. Đây là một công cụ quản lý và trực quan hóa cơ sở dữ liệu hiệu năng cao, được thiết kế cho các nhóm kỹ thuật yêu cầu sự chính xác, tốc độ và khả năng phân tích sâu sắc.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mt-12">
                            <div className="p-8 rounded-3xl border bg-card/50 space-y-4 shadow-sm hover:shadow-xl transition-all border-primary/10 group">
                                <div className="bg-blue-500/10 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Database className="w-6 h-6 text-blue-500" />
                                </div>
                                <h3 className="font-bold text-xl">Hỗ trợ Đa Engine</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">Kết nối bản địa tới PostgreSQL, MySQL, SQL Server và ClickHouse thông qua một giao diện thống nhất, tối ưu hóa cho từng loại driver.</p>
                            </div>
                            <div className="p-8 rounded-3xl border bg-card/50 space-y-4 shadow-sm hover:shadow-xl transition-all border-purple-500/10 group">
                                <div className="bg-purple-500/10 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <BookOpen className="w-6 h-6 text-purple-500" />
                                </div>
                                <h3 className="font-bold text-xl">Trợ lý AI Gemini</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">Sử dụng sức mạnh của Google Gemini để tạo mã SQL, phân tích lược đồ và tái cấu trúc dữ liệu từ hình ảnh (Vision).</p>
                            </div>
                        </div>

                        <div className="space-y-6 pt-10 border-t">
                            <h2 className="text-3xl font-bold tracking-tight">Tại sao chọn Data Explorer?</h2>
                            <p className="text-muted-foreground leading-relaxed text-lg text-justify">
                                Hầu hết các công cụ quản trị database hiện nay đều quá đơn sơ hoặc bị sa lầy trong các thiết kế cũ kỹ từ những thập kỷ trước. Data Explorer tập trung vào ba trụ cột cốt lõi: **Mật độ thông tin**, **Tốc độ thực thi**, và **Trí tuệ nhân tạo**. Chúng tôi mang đến trải nghiệm "Monaco-first" - biến việc quản trị dữ liệu trở nên thoải mái như đang lập trình trên VS Code.
                            </p>
                            <div className="bg-primary/5 p-8 border-l-4 border-primary rounded-r-2xl italic text-lg text-foreground shadow-inner">
                                "Sứ mệnh của chúng tôi là biến việc khám phá dữ liệu trở nên trực quan và liền mạch như cách bạn viết mã nguồn hàng ngày."
                            </div>
                        </div>

                        <div className="pt-10 space-y-6">
                            <h3 className="text-2xl font-bold">Giá trị cốt lõi</h3>
                            <ul className="grid sm:grid-cols-2 gap-4">
                                {[
                                    { title: "Hiệu năng cực đỉnh", desc: "Xử lý hàng triệu bản ghi trực tiếp trên trình duyệt mà không lag." },
                                    { title: "Bảo mật tuyệt đối", desc: "Dữ liệu kết nối chỉ nằm tại máy chủ địa phương của bạn." },
                                    { title: "Trải nghiệm lập trình viên", desc: "Hỗ trợ phím tắt, linting và định dạng mã chuyên nghiệp." },
                                    { title: "Trực quan hóa tức thì", desc: "Chuyển đổi kết quả truy vấn sang biểu đồ chỉ với một cú click." }
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
                            <h1 className="text-4xl font-extrabold tracking-tight">Hướng dẫn Cài đặt</h1>
                            <p className="text-lg text-muted-foreground">Việc thiết lập Data Explorer cực kỳ đơn giản và nhanh chóng trên mọi nền tảng hỗ trợ Node.js.</p>
                        </div>

                        <div className="space-y-8">
                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                                    <h2 className="text-2xl font-bold">Tải mã nguồn (Clone)</h2>
                                </div>
                                <div className="bg-slate-950 p-6 rounded-2xl border shadow-2xl font-mono text-sm text-slate-300">
                                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                                        <span className="text-xs text-slate-500 uppercase tracking-widest">Terminal</span>
                                        <Code className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <p className="text-emerald-500"># Sao chép repository từ GitHub</p>
                                    <p>git clone https://github.com/KasierBach/Data-Explorer-Editor.git</p>
                                    <p className="mt-4 text-emerald-500"># Truy cập vào thư mục dự án</p>
                                    <p>cd Data-Explorer-Editor</p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                                    <h2 className="text-2xl font-bold">Cài đặt Phụ thuộc</h2>
                                </div>
                                <p className="text-sm text-muted-foreground">Chúng tôi sử dụng kiến trúc tách biệt giữa Client và Server. Bạn cần cài đặt cho cả hai:</p>
                                <div className="bg-slate-950 p-6 rounded-2xl border shadow-2xl font-mono text-sm text-slate-300">
                                    <p className="text-emerald-500"># Cài đặt cho Backend Server</p>
                                    <p>cd server && npm install</p>
                                    <p className="mt-4 text-emerald-500"># Cài đặt cho Frontend Client</p>
                                    <p>cd ../client && npm install</p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                                    <h2 className="text-2xl font-bold">Cấu hình Môi trường</h2>
                                </div>
                                <p className="text-sm text-muted-foreground">Tạo file <code className="bg-muted px-2 py-0.5 rounded font-bold text-primary">.env</code> trong thư mục <code className="italic">server/</code>:</p>
                                <div className="bg-slate-950 p-6 rounded-2xl border shadow-2xl font-mono text-sm text-slate-300 overflow-x-auto">
                                    <p className="text-orange-400"># API Key cho AI (Lấy tại Google AI Studio)</p>
                                    <p>GEMINI_API_KEY=your_google_ai_studio_key</p>
                                    <p className="mt-2 text-orange-400"># Chuỗi bí mật cho JWT (Để trống để tự tạo ngẫu nhiên)</p>
                                    <p>JWT_SECRET=any_long_random_string</p>
                                    <p className="mt-2 text-orange-400"># Đường dẫn DB lưu trữ cấu hình nội bộ</p>
                                    <p>DATABASE_URL="file:./dev.db"</p>
                                    <p className="mt-2 text-orange-400"># Cổng chạy ứng dụng</p>
                                    <p>PORT=3000</p>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</div>
                                    <h2 className="text-2xl font-bold">Khởi động</h2>
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

            case 'architecture':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">Kiến trúc Hệ thống</h1>
                            <p className="text-lg text-muted-foreground">Tìm hiểu sâu về cách Data Explorer được xây dựng để đạt được sự linh hoạt và khả năng mở rộng tối đa.</p>
                        </div>

                        <div className="space-y-12">
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    <Layers className="w-6 h-6 text-primary" /> Kiến trúc Hexagonal (Clean)
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    Chúng tôi áp dụng mô hình kiến trúc Hexagonal (hoặc Onion Architecture) để tách biệt hoàn toàn Logic Nghiệp vụ (Core Domain) khỏi Các Tác nhân Ngoài (Infrastructure).
                                </p>
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div className="p-5 border rounded-2xl bg-muted/20 space-y-2">
                                        <h4 className="font-bold text-sm text-primary uppercase">Domain Layer</h4>
                                        <p className="text-xs text-muted-foreground">Nơi chứa các interface và logic cốt lõi. Không phụ thuộc vào bất kỳ thư viện bên ngoài nào.</p>
                                    </div>
                                    <div className="p-5 border rounded-2xl bg-muted/20 space-y-2">
                                        <h4 className="font-bold text-sm text-primary uppercase">Application Layer</h4>
                                        <p className="text-xs text-muted-foreground">Điều phối dòng dữ liệu thông qua các Service. Thực hiện các Use Case của hệ thống.</p>
                                    </div>
                                    <div className="p-5 border rounded-2xl bg-muted/20 space-y-2">
                                        <h4 className="font-bold text-sm text-primary uppercase">Adapter Layer</h4>
                                        <p className="text-xs text-muted-foreground">Triển khai cụ thể cho từng DB, API hoặc UI. Có thể thay thế dễ dàng.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-6 pt-10 border-t">
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    <Workflow className="w-6 h-6 text-emerald-500" /> Strategy Pattern cho Đa Database
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    Làm thế nào để hỗ trợ cùng lúc 4 engine database khác nhau mà không làm code trở nên rối rắm? Câu trả lời là **Strategy Pattern**.
                                </p>
                                <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-sm text-slate-300">
                                    <p className="text-emerald-500 italic">// Interface chung cho mọi database</p>
                                    <p>interface IDatabaseStrategy {"{"}</p>
                                    <p className="pl-4">query(sql: string): Promise&lt;any&gt;;</p>
                                    <p className="pl-4">getTables(): Promise&lt;Table[]&gt;;</p>
                                    <p className="pl-4">introspect(db: string): Promise&lt;Schema&gt;;</p>
                                    <p>{"}"}</p>
                                </div>
                                <p className="text-sm text-muted-foreground italic">
                                    Hệ thống sẽ tự động chọn "Chiến lược" (PostgresStrategy, MySQLStrategy, ...) phù hợp dựa trên thông tin kết nối mà người dùng cung cấp.
                                </p>
                            </section>

                            <section className="space-y-6 pt-10 border-t">
                                <h2 className="text-2xl font-bold">Dòng chảy Dữ liệu AI</h2>
                                <p className="text-muted-foreground leading-relaxed italic">
                                    Schema Metadata → Gemini Flash → SSE Stream → Monaco Dynamic Update
                                </p>
                                <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20">
                                    <p className="text-sm leading-loose">
                                        Khi bạn yêu cầu AI viết code, dự án sẽ thực hiện:
                                        <br />1. **Quét nhanh** cấu trúc bảng liên quan.
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
                            <h1 className="text-4xl font-extrabold tracking-tight">Danh sách Công nghệ</h1>
                            <p className="text-lg text-muted-foreground">Tất cả các công cụ và thư viện làm nên linh hồn của dự án.</p>
                        </div>

                        <div className="space-y-12">
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold border-b pb-2">Frontend Stack</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {[
                                        { name: "React 18", desc: "Core Framework" },
                                        { name: "Vite", desc: "Build Tool" },
                                        { name: "Tailwind CSS", desc: "Styling" },
                                        { name: "Zustand", desc: "State Management" },
                                        { name: "Monaco Editor", desc: "The Code Engine" },
                                        { name: "React Flow", desc: "ERD Diagrams" },
                                        { name: "Lucide React", desc: "Icon set" },
                                        { name: "Radix UI", desc: "Primitive Components" },
                                        { name: "TanStack Query", desc: "Data Fetching" }
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
                                            <span className="text-xs text-muted-foreground">Model chính phục vụ việc tạo SQL tốc độ cao và cực kỳ chính xác.</span>
                                        </div>
                                    </li>
                                    <li className="flex items-center gap-4 p-4 border rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                                        <div className="p-2 bg-purple-500/20 rounded-xl"><Eye className="w-5 h-5 text-purple-600" /></div>
                                        <div>
                                            <span className="font-bold block text-sm italic">Gemini 1.5 Pro Vision</span>
                                            <span className="text-xs text-muted-foreground">Phân tích hình ảnh sơ đồ vẽ tay để thiết kế database schema.</span>
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
                            <h1 className="text-4xl font-extrabold tracking-tight">Bảo mật & Quyền riêng tư</h1>
                            <p className="text-lg text-muted-foreground">Chúng tôi coi trọng sự an toàn của dữ liệu của bạn hơn bất kỳ điều gì khác.</p>
                        </div>

                        <div className="space-y-8">
                            <div className="p-8 border rounded-3xl bg-blue-500/5 border-blue-500/20 flex gap-6 items-start">
                                <Lock className="w-12 h-12 text-blue-500 shrink-0 mt-1" />
                                <div className="space-y-3">
                                    <h3 className="font-bold text-xl">Dữ liệu của bạn thuộc về bạn</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Data Explorer là một công cụ **Local-First**. Điều này có nghĩa là mọi thông tin đăng nhập, tên người dùng, mật khẩu host đều được lưu trữ trực tiếp trên thiết bị của bạn hoặc server mà bạn cài đặt.
                                        Chúng tôi **không bao giờ** gửi thông tin xác thực database lên đám mây.
                                    </p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-6 border rounded-2xl space-y-3">
                                    <h4 className="font-bold flex items-center gap-2 text-emerald-600"><Shield className="w-4 h-4" /> Mã hóa Mật khẩu</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">Mọi chuỗi kết nối (Connection String) đều được mã hóa bằng thuật toán AES-256 trước khi lưu vào SQLite nội bộ.</p>
                                </div>
                                <div className="p-6 border rounded-2xl space-y-3">
                                    <h4 className="font-bold flex items-center gap-2 text-purple-600"><Search className="w-4 h-4" /> Ẩn Metadata AI</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">Chúng tôi chỉ gửi cấu trúc bảng (Table/Columns) lên AI để nhận diện, dữ liệu thực tế (Rows) của bảng không bao giờ được gửi đi trừ khi bạn yêu cầu giải thích dữ liệu cụ thể.</p>
                                </div>
                            </div>

                            <section className="space-y-4 pt-10 border-t">
                                <h3 className="text-2xl font-bold">Xác thực người dùng</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Data Explorer sử dụng **JWT (JSON Web Tokens)** để quản lý phiên làm việc. Tokens được lưu trong Cookies bảo mật với thuộc tính `HttpOnly` và `SameSite=Strict` để ngăn chặn các cuộc tấn công XSS và CSRF.
                                </p>
                            </section>
                        </div>
                    </div>
                );

            case 'lifecycle':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">Quy trình Phát triển</h1>
                            <p className="text-lg text-muted-foreground">Tìm hiểu cách tham gia đóng góp và vận hành dự án chuyên nghiệp.</p>
                        </div>

                        <div className="space-y-8">
                            <section className="space-y-4">
                                <h2 className="text-2xl font-bold">Cấu trúc Folder chính</h2>
                                <div className="space-y-2">
                                    {[
                                        { path: "client/src/domain", desc: "Interface và các thực thể nghiệp vụ." },
                                        { path: "client/src/presentation", desc: "Component UI, Page và Store (Zustand)." },
                                        { path: "server/src/infrastructure", desc: "Cài đặt cụ thể các Strategy cho Database." },
                                        { path: "server/src/application", desc: "Các Use Case xử lý logic phía backend." }
                                    ].map((dir, i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                                            <div className="bg-muted p-2 rounded-lg font-mono text-[10px] font-bold text-primary min-w-[180px] text-center">{dir.path}</div>
                                            <span className="text-xs text-muted-foreground">{dir.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-4 pt-10 border-t">
                                <h2 className="text-2xl font-bold">Lệnh phát triển (Scripts)</h2>
                                <div className="space-y-4">
                                    <div className="group">
                                        <code className="text-emerald-500 font-bold block mb-1">npm run build</code>
                                        <p className="text-xs text-muted-foreground">Tạo bản build sản xuất cho cả frontend và backend dự án.</p>
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
                            <h1 className="text-4xl font-extrabold tracking-tight">FAQ & Khắc phục lỗi</h1>
                            <p className="text-lg text-muted-foreground">Giải đáp những thắc mắc thường gặp và xử lý các sự cố cài đặt.</p>
                        </div>

                        <div className="space-y-6">
                            {[
                                { q: "Tại sao tôi không thể kết nối tới PostgreSQL/MySQL cục bộ?", a: "Hãy kiểm tra xem DB của bạn có đang mở port (5432/3306) và chấp nhận kết nối từ địa chỉ 127.0.0.1 hay không. Đôi khi bạn cần cấu hình listen_addresses trong config của chính DB đó." },
                                { q: "AI báo lỗi 'Quota exceeded'?", a: "Đây là giới hạn của tài khoản Gemini API miễn phí. Bạn có thể thay đổi API Key khác hoặc đợi sau vài phút để hệ thống reset định mức sử dụng." },
                                { q: "Làm sao để xuất kết quả query ra File?", a: "Trong lưới kết quả (Result Grid), bạn hãy nhấn vào icon 'Export' phía góc trên bên phải. Chúng tôi hỗ trợ CSV, JSON và INSERT SQL scripts." },
                                { q: "Ứng dụng bị trắng trang sau khi build?", a: "Vui lòng kiểm tra lại biến môi trường `BASE_URL` trong file định cấu hình frontend để đảm bảo nó trỏ đúng về địa chỉ backend đang chạy." }
                            ].map((item, i) => (
                                <div key={i} className="p-6 border rounded-2xl bg-card space-y-3 shadow-sm">
                                    <h4 className="font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4 text-primary" /> {item.q}</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-muted pl-4 py-1 italic">{item.a}</p>
                                </div>
                            ))}
                        </div>

                        <div className="bg-muted p-8 rounded-3xl border text-center space-y-4">
                            <h4 className="font-bold">Vẫn không tìm thấy câu trả lời?</h4>
                            <p className="text-sm text-muted-foreground">Mở một Issue trên GitHub hoặc tham gia thảo luận cùng cộng đồng.</p>
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
                            <h1 className="text-4xl font-extrabold tracking-tight">Kết nối {engineNames[sectionId as keyof typeof engineNames]}</h1>
                            <p className="text-lg text-muted-foreground">Hỗ trợ driver bản địa cho khả năng phân tích lược đồ {engineNames[sectionId as keyof typeof engineNames]} tốc độ cao.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 border rounded-2xl bg-muted/20 shadow-inner">
                                    <span className="text-xs font-bold uppercase text-muted-foreground">Cổng mặc định</span>
                                    <p className="font-mono text-primary font-bold text-xl">{enginePorts[sectionId as keyof typeof enginePorts]}</p>
                                </div>
                                <div className="p-6 border rounded-2xl bg-muted/20 shadow-inner">
                                    <span className="text-xs font-bold uppercase text-muted-foreground">Chiến lược</span>
                                    <p className="font-mono text-primary font-bold text-xl">Pooled Node Adapter</p>
                                </div>
                            </div>

                            <section className="space-y-4">
                                <h3 className="font-bold text-xl">Làm thế nào để kết nối?</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Chỉ cần mở sidebar **Connection Explorer**, nhấn vào biểu tượng **dấu cộng (+)**, và chọn **{engineNames[sectionId as keyof typeof engineNames]}**.
                                    Bạn có thể cung cấp chuỗi URI thô (ví dụ: `postgresql://user:pass@host:port/db`) hoặc điền vào form có cấu trúc.
                                </p>
                            </section>

                            <div className="p-8 rounded-3xl bg-blue-500/5 border border-blue-500/20 space-y-3 shadow-sm">
                                <h4 className="font-bold flex items-center gap-2 text-blue-600 uppercase text-xs tracking-widest">
                                    <Shield className="w-4 h-4" /> Ghi chú Bảo mật
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed italic">
                                    Mọi thông tin xác thực kết nối của bạn đều được mã hóa và lưu trữ **nội bộ** trong cơ sở dữ liệu SQLite của máy chủ lưu trữ. Chúng tôi cam kết không bao giờ gửi mật khẩu thô của bạn ra khỏi hệ thống.
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'editor':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">Trình soạn thảo Monaco SQL</h1>
                            <p className="text-lg text-muted-foreground">Trải nghiệm soạn thảo tiêu chuẩn công nghiệp, được tối ưu riêng cho việc phát triển SQL.</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-6 border rounded-3xl bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-default group">
                                <Zap className="w-10 h-10 text-yellow-500 mb-4 group-hover:scale-110 transition-transform" />
                                <h4 className="font-bold text-lg">Tốc độ Ánh sáng</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">Soạn thảo không độ trễ ngay cả với các stored procedure dài hàng chục nghìn dòng. Được tối ưu hóa cho khối lượng code lớn.</p>
                            </div>
                            <div className="p-6 border rounded-3xl bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-default group">
                                <Activity className="w-10 h-10 text-emerald-500 mb-4 group-hover:scale-110 transition-transform" />
                                <h4 className="font-bold text-lg">Linting Thời gian thực</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">Xác thực cú pháp tức thì dựa trên từng phương ngữ SQL cụ thể (PostgreSQL, MySQL, hoặc MSSQL).</p>
                            </div>
                        </div>

                        <section className="space-y-6">
                            <h3 className="text-2xl font-bold">Phím tắt cho Power Users</h3>
                            <div className="space-y-2">
                                {[
                                    { label: 'Thực thi Toàn bộ', key: 'Ctrl + Enter' },
                                    { label: 'Thực thi Vùng chọn', key: 'Cmd/Ctrl + Shift + Enter' },
                                    { label: 'Định dạng mã SQL', key: 'Shift + Alt + F' },
                                    { label: 'Bật/Tắt Chú thích', key: 'Ctrl + /' },
                                    { label: 'Tìm kiếm Toàn cục', key: 'Ctrl + F' }
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
                            <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl">Tạo mã SQL bằng AI</h1>
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                Data Explorer tích hợp các model Gemini của Google để chuyển đổi ngôn ngữ tự nhiên thành các truy vấn SQL tối ưu, dựa sát trên ngữ cảnh thực tế của database của bạn.
                            </p>
                        </div>

                        <div className="space-y-8">
                            <h2 className="text-3xl font-bold border-b pb-4 text-primary">Kỹ thuật Độ chính xác cao</h2>
                            <div className="space-y-6">
                                <div className="flex gap-6 items-start p-6 border rounded-2xl bg-muted/10">
                                    <div className="bg-primary/20 p-3 rounded-2xl text-primary font-bold text-sm shrink-0">01</div>
                                    <div className="space-y-2">
                                        <span className="text-foreground font-bold text-lg block">Phân tích Lược đồ sâu</span>
                                        <p className="text-sm text-muted-foreground">Chúng tôi tự động trích xuất tên bảng, kiểu dữ liệu cột và các mối quan hệ khóa ngoại (Foreign Keys).</p>
                                    </div>
                                </div>
                                <div className="flex gap-6 items-start p-6 border rounded-2xl bg-muted/10">
                                    <div className="bg-primary/20 p-3 rounded-2xl text-primary font-bold text-sm shrink-0">02</div>
                                    <div className="space-y-2">
                                        <span className="text-foreground font-bold text-lg block">Prompting Contextual</span>
                                        <p className="text-sm text-muted-foreground">Chúng tôi cung cấp cho AI danh sách metadata thu gọn để nó không bao giờ "ảo tưởng" (hallucinate) về những bảng không tồn tại.</p>
                                    </div>
                                </div>
                                <div className="flex gap-6 items-start p-6 border rounded-2xl bg-muted/10">
                                    <div className="bg-primary/20 p-3 rounded-2xl text-primary font-bold text-sm shrink-0">03</div>
                                    <div className="space-y-2">
                                        <span className="text-foreground font-bold text-lg block">SSE Streaming</span>
                                        <p className="text-sm text-muted-foreground">Mã SQL được tạo ra sẽ hiển thị ngay lập tức trong editor theo phong cách "typing" như thể bạn đang xem AI gõ trực tiếp.</p>
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
                                <div className="text-emerald-400"># Người dùng: "Liệt kê các đơn hàng giá trị cao từ năm 2024"</div>
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
                            <h1 className="text-4xl font-extrabold tracking-tight">Tích hợp Gemini Vision</h1>
                            <p className="text-lg text-muted-foreground">Chuyển đổi sơ đồ vẽ tay trên bảng trắng thành bảng dữ liệu thực thi trong tích tắc.</p>
                        </div>

                        <div className="relative group rounded-[32px] overflow-hidden border-2 border-dashed border-primary/20 hover:border-primary/50 transition-all bg-card/50">
                            <div className="absolute inset-0 bg-primary/5 transition-colors group-hover:bg-primary/10" />
                            <div className="p-16 flex flex-col items-center text-center space-y-6">
                                <div className="bg-background p-6 rounded-[24px] shadow-2xl border border-primary/10">
                                    <Eye className="w-16 h-16 text-primary animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold italic tracking-tighter">Image-to-Schema</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">Chỉ cần kéo và thả hình ảnh sơ đồ ER hoặc ảnh chụp màn hình ứng dụng vào khung chat AI.</p>
                                </div>
                                <Button variant="outline" className="rounded-full px-8">Thử ngay</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {['Vẽ Tay', 'Sơ đồ ER', 'Giao diện mẫu'].map((t, i) => (
                                <div key={i} className="text-center p-4 border rounded-2xl bg-card text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">{t}</div>
                            ))}
                        </div>
                    </div>
                );

            case 'erd':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">Sơ đồ Thực thể Quan hệ (ERD)</h1>
                            <p className="text-lg text-muted-foreground">Quan sát và thay đổi cấu trúc database thông qua các đồ thị tương tác mạnh mẽ.</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="p-8 border rounded-3xl bg-card space-y-4 hover:shadow-xl transition-all group">
                                <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                    <Layout className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-xl">Auto-Layout</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">Tự động sắp xếp các bảng dựa trên mối liên hệ khóa ngoại bằng engine Dagre thông minh, giúp bản vẽ luôn gọn gàng.</p>
                            </div>
                            <div className="p-8 border rounded-3xl bg-card space-y-4 hover:shadow-xl transition-all group">
                                <div className="bg-blue-500/10 w-fit p-3 rounded-2xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <Database className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-xl">Đột biến Lược đồ</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">Kéo thả các đường nối để tạo khóa ngoại hoặc xóa chúng để thực hiện lệnh DROP CONSTRAINT ngay trong môi trường đồ họa.</p>
                            </div>
                        </div>

                        <div className="space-y-6 p-8 bg-muted/20 border rounded-3xl shadow-inner">
                            <h3 className="font-bold text-xl flex items-center gap-3"><Activity className="w-5 h-5" /> Hướng dẫn Tương tác</h3>
                            <ul className="space-y-4 text-sm text-muted-foreground">
                                <li className="flex items-center gap-4">
                                    <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm">Chuột trái</kbd>
                                    <span>Chọn bảng hoặc quan hệ để xem chi tiết.</span>
                                </li>
                                <li className="flex items-center gap-4">
                                    <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm">Chuột phải</kbd>
                                    <span>Menu ngữ cảnh cho các tùy chọn xuất SQL hoặc copy JSON.</span>
                                </li>
                                <li className="flex items-center gap-4">
                                    <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm">Icon Cộng (+)</kbd>
                                    <span>Thêm bảng vào canvas từ danh sách sidebar bên trái.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                );

            case 'charts':
                return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-extrabold tracking-tight">Biểu đồ Tương tác</h1>
                            <p className="text-lg text-muted-foreground">Biến kết quả truy vấn thô thành các báo cáo trực quan chuyên nghiệp chỉ trong vài giây.</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { name: 'Biểu đồ Đường', icon: <Activity className="w-5 h-5" /> },
                                { name: 'Biểu đồ Cột', icon: <PieChart className="w-5 h-5" /> },
                                { name: 'Biểu đồ Radar', icon: <Layers className="w-5 h-5" /> },
                                { name: 'Phễu dữ liệu', icon: <Zap className="w-5 h-5" /> }
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
                                <h4 className="font-bold text-2xl">Cá nhân hóa Giao diện</h4>
                                <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                                    Mọi biểu đồ đều hỗ trợ tùy chỉnh trục tọa độ, vị trí chú giải, và kế thừa bộ lọc màu sắc đồng nhất từ chủ đề chính của ứng dụng. Bạn có thể xuất biểu đồ dưới dạng hình ảnh chất lượng cao để đính kèm vào báo cáo.
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
                            <h2 className="text-3xl font-extrabold tracking-tight">Đang hoàn thiện nội dung chuyên sâu...</h2>
                            <p className="text-muted-foreground max-w-md mx-auto text-lg leading-relaxed">
                                Đội ngũ kỹ thuật đang biên soạn tài liệu cặn kẽ cho mục <span className="font-mono text-primary font-bold underline decoration-primary/30 decoration-4 underline-offset-8">"{sectionId}"</span>.
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-3 h-3 bg-primary/30 rounded-full animate-bounce" />
                        </div>
                        <Button variant="ghost" className="text-sm font-bold text-muted-foreground hover:text-primary transition-all">
                            Nhận thông báo khi có bản cập nhật
                        </Button>
                    </div>
                );
        }
    };

    return renderContent();
}
