import { Shield, Database } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props {
    lang: 'vi' | 'en';
    engine: 'postgres' | 'mysql' | 'mssql' | 'clickhouse';
}

const ENGINE_CONFIG = {
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
    },
    clickhouse: {
        name: 'ClickHouse',
        port: '8123',
        icon: '⚡',
        uriScheme: 'clickhouse',
        uriExample: 'http://localhost:8123?user=default&password=&database=default',
        dockerImage: 'clickhouse/clickhouse-server:latest',
        dockerEnv: [
            '-e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1',
        ],
        features: {
            en: ['system.tables and system.columns introspection', 'MergeTree engine family detection', 'Partition key analysis', 'Data compression ratio display', 'Materialized view listing', 'Distributed table topology', 'Query performance profiling'],
            vi: ['Phân tích qua system.tables và system.columns', 'Phát hiện engine family MergeTree', 'Phân tích partition keys', 'Hiển thị tỷ lệ nén dữ liệu', 'Liệt kê materialized views', 'Topology bảng phân tán', 'Profiling hiệu năng truy vấn'],
        },
        sslNote: {
            en: 'ClickHouse Cloud requires HTTPS on port 8443. Use the connection details from your cloud dashboard.',
            vi: 'ClickHouse Cloud yêu cầu HTTPS trên cổng 8443. Sử dụng thông tin kết nối từ cloud dashboard.',
        },
        introspectQuery: `SELECT table, name, type, default_kind
FROM system.columns
WHERE database = currentDatabase()
ORDER BY table, position;`,
    },
};

export function ConnectionSection({ lang, engine }: Props) {
    const t = lang === 'vi';
    const cfg = ENGINE_CONFIG[engine];

    return (
        <DocPageLayout
            title={`${t ? 'Kết nối' : 'Connect'} ${cfg.name}`}
            subtitle={t
                ? `Hướng dẫn chi tiết kết nối ${cfg.name} với Data Explorer, bao gồm cấu hình SSL, Docker và cách khắc phục lỗi thường gặp.`
                : `Detailed guide for connecting ${cfg.name} to Data Explorer, including SSL configuration, Docker setup, and common troubleshooting.`}
        >
            {/* Quick Reference */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-3xl block mb-1">{cfg.icon}</span>
                    <span className="text-xs font-bold uppercase text-muted-foreground">Engine</span>
                    <p className="font-bold text-primary">{cfg.name}</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-xs font-bold uppercase text-muted-foreground">{t ? 'Cổng mặc định' : 'Default Port'}</span>
                    <p className="font-mono text-primary font-bold text-xl">{cfg.port}</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-xs font-bold uppercase text-muted-foreground">{t ? 'Giao thức' : 'Protocol'}</span>
                    <p className="font-mono text-primary font-bold">{cfg.uriScheme}://</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-xs font-bold uppercase text-muted-foreground">{t ? 'Chiến lược' : 'Strategy'}</span>
                    <p className="font-mono text-primary font-bold text-sm">Pooled Adapter</p>
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
                    <div className="space-y-2">
                        {[
                            { field: 'Host', example: 'localhost', desc: t ? 'Địa chỉ IP hoặc hostname của server database' : 'IP address or hostname of the database server' },
                            { field: 'Port', example: cfg.port, desc: t ? `Cổng mặc định: ${cfg.port}` : `Default port: ${cfg.port}` },
                            { field: 'Username', example: engine === 'postgres' ? 'admin' : engine === 'mssql' ? 'sa' : 'root', desc: t ? 'Tên đăng nhập với quyền truy cập database' : 'Login user with database access' },
                            { field: 'Password', example: '••••••', desc: t ? 'Mật khẩu (được mã hóa AES-256 trước khi lưu)' : 'Password (AES-256 encrypted before storage)' },
                            { field: 'Database', example: 'mydb', desc: t ? 'Tên database bạn muốn khám phá' : 'Database name you want to explore' },
                            { field: 'SSL', example: t ? 'Bật/Tắt' : 'On/Off', desc: t ? 'Bật nếu kết nối qua cloud hoặc mạng công cộng' : 'Enable for cloud or public network connections' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                                <code className="bg-primary/10 text-primary px-3 py-1 rounded text-xs font-mono font-bold min-w-[100px] text-center">{item.field}</code>
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
                <ul className="grid sm:grid-cols-2 gap-2">
                    {cfg.features[lang].map((feat, i) => (
                        <li key={i} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
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
                    {cfg.introspectQuery.split('\n').map((line, i) => (
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
                    {cfg.dockerEnv.map((env, i) => (
                        <CodeLine key={i}>{`  ${env} \\`}</CodeLine>
                    ))}
                    <CodeLine>{`  -p ${cfg.port}:${cfg.port} \\`}</CodeLine>
                    <CodeLine>{`  ${cfg.dockerImage}`}</CodeLine>
                </CodeBlock>
            </DocSection>

            {/* SSL Note */}
            <div className="p-8 rounded-3xl bg-blue-500/5 border border-blue-500/20 space-y-3 shadow-sm">
                <h4 className="font-bold flex items-center gap-2 text-blue-600 uppercase text-xs tracking-widest">
                    <Shield className="w-4 h-4" /> {t ? 'Ghi chú Bảo mật & SSL' : 'Security & SSL Note'}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {cfg.sslNote[lang]}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                    {t
                        ? 'Mọi thông tin xác thực kết nối của bạn đều được mã hóa AES-256 và lưu trữ nội bộ trong SQLite. Chúng tôi cam kết không bao giờ gửi mật khẩu thô ra ngoài hệ thống.'
                        : 'All your connection credentials are AES-256 encrypted and stored internally in SQLite. We guarantee your raw passwords are never transmitted outside the system.'}
                </p>
            </div>

            {/* Troubleshooting */}
            <DocSection title={t ? 'Khắc phục lỗi thường gặp' : 'Common Troubleshooting'}>
                <div className="space-y-3">
                    {[
                        {
                            q: t ? `Không thể kết nối tới ${cfg.name} trên localhost` : `Cannot connect to ${cfg.name} on localhost`,
                            a: t
                                ? `Kiểm tra xem ${cfg.name} có đang chạy không (systemctl status hoặc docker ps). Đảm bảo port ${cfg.port} đang mở và chấp nhận kết nối từ 127.0.0.1.`
                                : `Check if ${cfg.name} is running (systemctl status or docker ps). Ensure port ${cfg.port} is open and accepting connections from 127.0.0.1.`
                        },
                        {
                            q: t ? 'Lỗi "Connection refused" hoặc "Timeout"' : '"Connection refused" or "Timeout" error',
                            a: t
                                ? 'Kiểm tra firewall, security groups (nếu dùng cloud), và cấu hình listen_addresses trong config file của database. Đảm bảo không có VPN nào chặn kết nối.'
                                : 'Check firewall rules, security groups (for cloud), and listen_addresses in the database config file. Ensure no VPN is blocking the connection.'
                        },
                        {
                            q: t ? 'Lỗi "Authentication failed"' : '"Authentication failed" error',
                            a: t
                                ? 'Xác nhận username và password chính xác. Với PostgreSQL, kiểm tra file pg_hba.conf cho phương thức xác thực. Với MySQL, đảm bảo user có quyền truy cập từ host hiện tại.'
                                : 'Verify the username and password are correct. For PostgreSQL, check pg_hba.conf for authentication methods. For MySQL, ensure the user has access from the current host.'
                        },
                    ].map((item, i) => (
                        <div key={i} className="p-5 border rounded-2xl bg-card space-y-2">
                            <h4 className="font-bold flex items-center gap-2 text-sm">
                                <Database className="w-4 h-4 text-primary" /> {item.q}
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-muted pl-4 italic">{item.a}</p>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
