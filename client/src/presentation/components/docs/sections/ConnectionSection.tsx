import { Shield, Database, Zap, Lock } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props {
    lang: 'vi' | 'en';
    engine: 'postgres' | 'mysql' | 'mssql';
}

const ENGINE_CONFIG: Record<string, any> = {
    postgres: {
        name: 'PostgreSQL',
        port: '5432',
        icon: '🐘',
        uriScheme: 'postgresql',
        uriExample: 'postgresql://admin:password@localhost:5432/mydb?sslmode=require',
        dockerImage: 'postgres:16-alpine',
        dockerEnv: [
            '-e POSTGRES_USER=admin',
            '-e POSTGRES_PASSWORD=secret123',
            '-e POSTGRES_DB=dev_database',
        ],
        features: {
            en: ['Full schema introspection with pg_catalog', 'Foreign key relationship detection', 'Index analysis and optimization hints', 'JSONB column support', 'Materialized view listing', 'ENUM type discovery', 'PostGIS spatial data support'],
            vi: ['Phân tích lược đồ đầy đủ qua pg_catalog', 'Phát hiện quan hệ khóa ngoại', 'Phân tích index và gợi ý tối ưu', 'Hỗ trợ cột JSONB', 'Liệt kê materialized views', 'Phát hiện kiểu ENUM', 'Hỗ trợ dữ liệu không gian PostGIS'],
        },
        sslNote: {
            en: 'For cloud providers like Neon, Supabase, or AWS RDS, SSL is required. Add ?sslmode=require to your connection string or enable the SSL toggle in the connection form.',
            vi: 'Với các nhà cung cấp cloud như Neon, Supabase hoặc AWS RDS, SSL là bắt buộc. Thêm ?sslmode=require vào chuỗi kết nối hoặc bật toggle SSL trong form kết nối.',
        },
        introspectQuery: `SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;`,
    },
    mysql: {
        name: 'MySQL',
        port: '3306',
        icon: '🐬',
        uriScheme: 'mysql',
        uriExample: 'mysql://root:password@localhost:3306/mydb',
        dockerImage: 'mysql:8.0',
        dockerEnv: [
            '-e MYSQL_ROOT_PASSWORD=secret123',
            '-e MYSQL_DATABASE=dev_database',
        ],
        features: {
            en: ['Full INFORMATION_SCHEMA introspection', 'Foreign key detection across InnoDB tables', 'Index analysis and cardinality stats', 'JSON column type support', 'Stored procedure and function listing', 'Trigger introspection', 'Charset/collation information'],
            vi: ['Phân tích INFORMATION_SCHEMA đầy đủ', 'Phát hiện khóa ngoại giữa các bảng InnoDB', 'Phân tích index và thống kê cardinality', 'Hỗ trợ kiểu cột JSON', 'Liệt kê stored procedures và functions', 'Phân tích triggers', 'Thông tin charset/collation'],
        },
        sslNote: {
            en: 'For PlanetScale or similar providers, SSL is mandatory. Use the provided connection string directly from the dashboard.',
            vi: 'Với PlanetScale hoặc các nhà cung cấp tương tự, SSL là bắt buộc. Sử dụng chuỗi kết nối trực tiếp từ dashboard.',
        },
        introspectQuery: `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;`,
    },
    mssql: {
        name: 'SQL Server',
        port: '1433',
        icon: '🏢',
        uriScheme: 'mssql',
        uriExample: 'Server=localhost,1433;Database=mydb;User Id=sa;Password=password;Encrypt=true;TrustServerCertificate=true;',
        dockerImage: 'mcr.microsoft.com/mssql/server:2022-latest',
        dockerEnv: [
            '-e ACCEPT_EULA=Y',
            '-e SA_PASSWORD=YourStrong@Passw0rd',
            '-e MSSQL_PID=Developer',
        ],
        features: {
            en: ['sys.tables and sys.columns introspection', 'Foreign key constraint mapping', 'Execution plan analysis', 'Stored procedure support', 'View and synonym listing', 'Schema-separated object browsing', 'Windows and SQL Authentication'],
            vi: ['Phân tích qua sys.tables và sys.columns', 'Ánh xạ ràng buộc khóa ngoại', 'Phân tích execution plan', 'Hỗ trợ stored procedures', 'Liệt kê views và synonyms', 'Duyệt đối tượng theo schema', 'Xác thực Windows và SQL'],
        },
        sslNote: {
            en: 'For Azure SQL Database, encryption is required. Add Encrypt=true;TrustServerCertificate=false to your connection string.',
            vi: 'Với Azure SQL Database, mã hóa là bắt buộc. Thêm Encrypt=true;TrustServerCertificate=false vào chuỗi kết nối.',
        },
        introspectQuery: `SELECT t.name AS table_name, c.name AS column_name,
       ty.name AS data_type, c.is_nullable
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.system_type_id = ty.system_type_id
ORDER BY t.name, c.column_id;`,
    }
};

export function ConnectionSection({ lang, engine }: Props) {
    const t = lang === 'vi';
    const cfg = ENGINE_CONFIG[engine] || ENGINE_CONFIG.postgres;

    return (
        <DocPageLayout
            title={`${t ? 'Kết nối' : 'Connect'} ${cfg.name}`}
            subtitle={t
                ? `Hướng dẫn chi tiết kết nối ${cfg.name} với Data Explorer, bao gồm cấu hình SSL, Docker và cách khắc phục lỗi thường gặp.`
                : `Detailed guide for connecting ${cfg.name} to Data Explorer, including SSL configuration, Docker setup, and common troubleshooting.`}
        >
            {/* Quick Reference */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-3xl block mb-1">{cfg.icon}</span>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Engine</span>
                    <p className="font-bold text-primary">{cfg.name}</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t ? 'Cổng mặc định' : 'Default Port'}</span>
                    <p className="font-mono text-primary font-bold text-xl">{cfg.port}</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t ? 'Giao thức' : 'Protocol'}</span>
                    <p className="font-mono text-primary font-bold">{cfg.uriScheme}://</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t ? 'Chiến lược' : 'Strategy'}</span>
                    <p className="font-mono text-primary font-bold">Pooled Adapter</p>
                </div>
            </div>

            {/* How to Connect */}
            <DocSection title={t ? 'Cách kết nối' : 'How to Connect'}>
                <Prose>{t
                    ? `Để kết nối với ${cfg.name}, bạn có hai cách: sử dụng Connection URI hoặc điền vào form kết nối có cấu trúc.`
                    : `To connect to ${cfg.name}, you have two options: use a Connection URI or fill in the structured connection form.`}</Prose>

                <DocSubSection title={t ? 'Cách 1: Connection URI' : 'Method 1: Connection URI'}>
                    <Prose>{t
                        ? 'Cách nhanh nhất là dán trực tiếp chuỗi URI kết nối. Data Explorer sẽ tự động phân tích host, port, username, password và database name từ URI.'
                        : 'The fastest way is to paste the connection URI directly. Data Explorer will automatically parse the host, port, username, password, and database name from the URI.'}</Prose>
                    <CodeBlock title={t ? 'Định dạng URI' : 'URI Format'}>
                        <CodeComment>{t ? 'Cấu trúc chung' : 'General format'}</CodeComment>
                        <CodeLine>{cfg.uriExample}</CodeLine>
                    </CodeBlock>
                </DocSubSection>

                <DocSubSection title={t ? 'Cách 2: Form kết nối' : 'Method 2: Connection Form'}>
                    <Prose>{t
                        ? `Mở sidebar Connection Explorer (thanh bên trái), nhấn biểu tượng dấu cộng (+), chọn ${cfg.name}. Điền các trường sau:`
                        : `Open the Connection Explorer sidebar (left panel), click the plus (+) icon, select ${cfg.name}. Fill in the following fields:`}</Prose>
                    <div className="space-y-2 mt-4">
                        {[
                            { field: 'Host', example: 'localhost', desc: t ? 'Địa chỉ IP hoặc hostname của server database' : 'IP address or hostname of the database server' },
                            { field: 'Port', example: cfg.port, desc: t ? `Cổng mặc định: ${cfg.port}` : `Default port: ${cfg.port}` },
                            { field: 'Username', example: engine === 'postgres' ? 'admin' : engine === 'mssql' ? 'sa' : 'root', desc: t ? 'Tên đăng nhập với quyền truy cập database' : 'Login user with database access' },
                            { field: 'Password', example: '••••••', desc: t ? 'Mật khẩu (được mã hóa AES-256 trước khi lưu)' : 'Password (AES-256 encrypted before storage)' },
                            { field: 'Database', example: 'mydb', desc: t ? 'Tên database bạn muốn khám phá' : 'Database name you want to explore' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                                <code className="bg-primary/10 text-primary px-3 py-1 rounded text-[10px] font-mono font-bold min-w-[100px] text-center">{item.field}</code>
                                <code className="text-xs text-muted-foreground font-mono min-w-[100px]">{item.example}</code>
                                <span className="text-xs text-muted-foreground">{item.desc}</span>
                            </div>
                        ))}
                    </div>
                </DocSubSection>
            </DocSection>

            {/* Supported Features */}
            <DocSection title={t ? 'Tính năng được hỗ trợ' : 'Supported Features'}>
                <Prose>{t
                    ? `Dưới đây là danh sách đầy đủ các tính năng introspection mà Data Explorer hỗ trợ cho ${cfg.name}:`
                    : `Here is the complete list of introspection features Data Explorer supports for ${cfg.name}:`}</Prose>
                <ul className="grid sm:grid-cols-2 gap-3 mt-6">
                    {cfg.features[lang].map((feat: string, i: number) => (
                        <li key={i} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-sm">{feat}</span>
                        </li>
                    ))}
                </ul>
            </DocSection>

            {/* Introspection Query */}
            <DocSection title={t ? 'Truy vấn Introspection nội bộ' : 'Internal Introspection Query'}>
                <Prose>{t
                    ? `Khi bạn kết nối thành công, Data Explorer tự động chạy các truy vấn introspection để phân tích cấu trúc database. Dưới đây là truy vấn cơ bản mà hệ thống thực thi phía sau cho ${cfg.name}:`
                    : `When you successfully connect, Data Explorer automatically runs introspection queries to analyze the database structure. Here's the basic query the system runs behind the scenes for ${cfg.name}:`}</Prose>
                <CodeBlock title={`${cfg.name} Introspection`}>
                    <CodeComment>{t ? 'Truy vấn phân tích cấu trúc bảng' : 'Table structure analysis query'}</CodeComment>
                    {cfg.introspectQuery.split('\n').map((line: string, i: number) => (
                        <CodeLine key={i}>{line}</CodeLine>
                    ))}
                </CodeBlock>
            </DocSection>

            {/* Docker Quick Start */}
            <DocSection title={t ? 'Docker Quick Start' : 'Docker Quick Start'}>
                <Prose>{t
                    ? `Nếu bạn chưa có ${cfg.name} trên máy, cách nhanh nhất là dùng Docker để tạo một instance thử nghiệm:`
                    : `If you don't have ${cfg.name} on your machine yet, the fastest way is to use Docker to create a test instance:`}</Prose>
                <CodeBlock title="Terminal">
                    <CodeComment>{t ? `Khởi tạo ${cfg.name} container` : `Start ${cfg.name} container`}</CodeComment>
                    <CodeLine>docker run -d \</CodeLine>
                    <CodeLine>{`  --name data-explorer-${engine} \\`}</CodeLine>
                    {cfg.dockerEnv.map((env: string, i: number) => (
                        <CodeLine key={i}>{`  ${env} \\`}</CodeLine>
                    ))}
                    <CodeLine>{`  -p ${cfg.port}:${cfg.port} \\`}</CodeLine>
                    <CodeLine>{`  ${cfg.dockerImage}`}</CodeLine>
                </CodeBlock>
            </DocSection>

            {/* Advanced Tuning */}
            <DocSection title={t ? 'Cấu hình Nâng cao (Advanced Tuning)' : 'Advanced Tuning'}>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 border-l-4 border-l-blue-500 space-y-3">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-500" />
                            Connection Pooling
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t
                                ? 'Mặc định, hệ thống duy trì bộ đệm kết nối để tối ưu tốc độ phản hồi. Đối với các database có giới hạn session (như Supabase Free Tier), hãy cân nhắc giảm thời gian chờ timeout để giải phóng kết nối nhanh hơn.'
                                : 'By default, the system maintains a connection pool to optimize response speed. For databases with limited sessions (like Supabase Free Tier), consider reducing the timeout to free up connections faster.'}
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10 border-l-4 border-l-purple-500 space-y-3">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Lock className="w-4 h-4 text-purple-500" />
                            SSL/TLS Handshake
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t
                                ? 'Hệ thống hỗ trợ SSL Mode "prefer" và "require". Đối với các kết nối yêu cầu chứng chỉ CA tùy chỉnh, bạn cần mount file certificate vào thư mục /certs của backend server.'
                                : 'The system supports SSL Modes "prefer" and "require". For connections requiring custom CA certificates, you need to mount the certificate file into the /certs directory of the backend server.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            {/* SSL Note */}
            <div className="mt-8 p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                <h4 className="font-bold flex items-center gap-2 text-emerald-600 uppercase text-[10px] tracking-widest">
                    <Shield className="w-4 h-4" /> {t ? 'Ghi chú Bảo mật' : 'Security Note'}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {cfg.sslNote[lang]}
                </p>
            </div>

        </DocPageLayout>
    );
}
