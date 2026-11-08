import { Shield, Zap, Lock } from 'lucide-react';
import { publicPath } from '@/core/seo/publicRoutes';
import { Callout, DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props {
    lang: 'vi' | 'en';
    engine:
    | 'postgres'
    | 'mysql'
    | 'mariadb'
    | 'cockroach'
    | 'mssql'
    | 'mongodb';
}

interface EngineConfig {
    name: string;
    port: string;
    icon: string;
    uriScheme: string;
    uriExample: string;
    dockerImage: string;
    dockerEnv: string[];
    features: Record<Props['lang'], string[]>;
    sslNote: Record<Props['lang'], string>;
    introspectQuery: string;
}

const ENGINE_CONFIG: Record<Props['engine'], EngineConfig> = {
    postgres: {
        name: 'PostgreSQL',
        port: '5432',
        icon: 'PG',
        uriScheme: 'postgresql',
        uriExample: 'postgresql://user:password@localhost:5432/mydb',
        dockerImage: 'postgres:16-alpine',
        dockerEnv: ['-e POSTGRES_USER=admin', '-e POSTGRES_PASSWORD', '-e POSTGRES_DB=dev_database'],
        features: {
            en: ['Schema, table and column browsing', 'Primary and foreign key metadata', 'Index metadata', 'Views and function metadata', 'SQL queries and guarded row changes'],
            vi: ['Duyệt schema, bảng và cột', 'Metadata khóa chính và khóa ngoại', 'Metadata index', 'Metadata view và function', 'Query SQL và sửa dòng có kiểm tra quyền'],
        },
        sslNote: {
            en: 'Remote PostgreSQL connections automatically use TLS. Explicitly set ALLOW_INSECURE_DATABASE_TLS=false on the backend to verify certificates. The form has no PostgreSQL-specific TLS toggle; sslmode and custom CA query parameters are not imported.',
            vi: 'PostgreSQL remote tự dùng TLS. Đặt ALLOW_INSECURE_DATABASE_TLS=false rõ ràng ở backend để verify certificate. Form không có toggle TLS riêng PostgreSQL; sslmode và tham số CA trong URI không được import.',
        },
        introspectQuery: `SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;`,
    },
    mysql: {
        name: 'MySQL',
        port: '3306',
        icon: 'MY',
        uriScheme: 'mysql',
        uriExample: 'mysql://user:password@localhost:3306/mydb',
        dockerImage: 'mysql:8.4',
        dockerEnv: ['-e MYSQL_ROOT_PASSWORD', '-e MYSQL_DATABASE=dev_database'],
        features: {
            en: ['Table and column metadata via INFORMATION_SCHEMA', 'Primary and foreign key metadata', 'Index metadata', 'Views and function browsing', 'SQL queries and guarded row changes'],
            vi: ['Metadata bảng và cột qua INFORMATION_SCHEMA', 'Metadata khóa chính và khóa ngoại', 'Metadata index', 'Duyệt view và function', 'Query SQL và sửa dòng có kiểm tra quyền'],
        },
        sslNote: {
            en: 'After importing a MySQL URI, explicitly check the TLS setting in the form. URI query parameters do not enable it. tls=false disables TLS transport; when enabled, backend ALLOW_INSECURE_DATABASE_TLS=false enforces certificate verification.',
            vi: 'Sau khi import URI MySQL, kiểm tra và bật TLS rõ ràng trong form. Query parameter của URI không bật TLS. tls=false tắt transport TLS; khi bật, ALLOW_INSECURE_DATABASE_TLS=false ở backend ép verify certificate.',
        },
        introspectQuery: `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;`,
    },
    mariadb: {
        name: 'MariaDB',
        port: '3306',
        icon: 'MA',
        uriScheme: 'mariadb',
        uriExample: 'mariadb://user:password@localhost:3306/mydb',
        dockerImage: 'mariadb:11',
        dockerEnv: ['-e MARIADB_ROOT_PASSWORD', '-e MARIADB_DATABASE=dev_database'],
        features: {
            en: ['MySQL-compatible adapter and connection pool', 'Tables, columns and key metadata', 'Views, functions and function parameter browsing', 'Explicit connection TLS setting', 'SQL queries and guarded row changes'],
            vi: ['Adapter và pool tương thích MySQL', 'Metadata bảng, cột và khóa', 'Duyệt view, function và tham số function', 'Thiết lập TLS rõ ràng theo connection', 'Query SQL và sửa dòng có kiểm tra quyền'],
        },
        sslNote: {
            en: 'Explicitly enable TLS in the MariaDB form after importing a URI when the server requires it. Turning TLS off sends plaintext; it is not merely a certificate-verification bypass. Use a secure server configuration rather than disabling TLS to silence handshake errors.',
            vi: 'Bật TLS rõ ràng trong form MariaDB sau khi import URI nếu server yêu cầu. Tắt TLS gửi plaintext, không chỉ bỏ verify certificate. Sửa cấu hình server an toàn thay vì tắt TLS chỉ để hết lỗi handshake.',
        },
        introspectQuery: `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;`,
    },
    cockroach: {
        name: 'CockroachDB',
        port: '26257',
        icon: 'CR',
        uriScheme: 'cockroachdb',
        uriExample: 'cockroachdb://root@localhost:26257/defaultdb',
        dockerImage: 'cockroachdb/cockroach:latest-v24.3',
        dockerEnv: [],
        features: {
            en: ['PostgreSQL-wire adapter with port 26257', 'Schema, table and column metadata', 'Views and key metadata where available', 'Metrics through crdb_internal where permitted', 'SQL queries with engine-specific limitations'],
            vi: ['Adapter giao thức PostgreSQL với cổng 26257', 'Metadata schema, bảng và cột', 'Metadata view và khóa khi khả dụng', 'Metrics qua crdb_internal khi được cấp quyền', 'Query SQL với giới hạn riêng của engine'],
        },
        sslNote: {
            en: 'Remote CockroachDB uses the PostgreSQL-wire TLS path. A provider URL beginning postgresql:// is parsed as PostgreSQL; select CockroachDB in the form after import. Certificate verification depends on explicitly setting ALLOW_INSECURE_DATABASE_TLS=false; URI sslmode options are not imported.',
            vi: 'CockroachDB remote dùng đường TLS giao thức PostgreSQL. URL provider bắt đầu postgresql:// được parse thành PostgreSQL; chọn lại CockroachDB trong form sau import. Verify certificate cần đặt rõ ALLOW_INSECURE_DATABASE_TLS=false; sslmode trong URI không được import.',
        },
        introspectQuery: `SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;`,
    },
    mssql: {
        name: 'SQL Server',
        port: '1433',
        icon: 'MS',
        uriScheme: 'mssql',
        uriExample: 'mssql://user:password@localhost:1433/mydb',
        dockerImage: 'mcr.microsoft.com/mssql/server:2022-latest',
        dockerEnv: ['-e ACCEPT_EULA=Y', '-e MSSQL_SA_PASSWORD', '-e MSSQL_PID=Developer'],
        features: {
            en: ['Table and column metadata through sys catalogs', 'Primary and foreign key metadata', 'Index metadata', 'Schema-separated table/view browsing', 'SQL authentication using username and password'],
            vi: ['Metadata bảng và cột qua sys catalogs', 'Metadata khóa chính và khóa ngoại', 'Metadata index', 'Duyệt bảng/view theo schema', 'SQL authentication bằng username và password'],
        },
        sslNote: {
            en: 'Use a URL such as mssql://user:password@host:1433/database, not Server=...;Database=... strings. Windows/integrated authentication is not exposed by this form. URI Encrypt or TrustServerCertificate parameters are not imported; remote TLS verification follows the backend-wide policy.',
            vi: 'Dùng URL mssql://user:password@host:1433/database, không dùng chuỗi Server=...;Database=.... Form không cung cấp Windows/integrated authentication. Encrypt hoặc TrustServerCertificate trong URI không được import; verify TLS remote theo chính sách toàn backend.',
        },
        introspectQuery: `SELECT t.name AS table_name, c.name AS column_name,
       ty.name AS data_type, c.is_nullable
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
ORDER BY t.name, c.column_id;`,
    },
    mongodb: {
        name: 'MongoDB / Atlas',
        port: '27017',
        icon: 'MO',
        uriScheme: 'mongodb',
        uriExample: 'mongodb+srv://user:password@cluster.example.mongodb.net/mydb',
        dockerImage: 'mongo:7',
        dockerEnv: [],
        features: {
            en: ['Database and collection browsing', 'Single-host MongoDB and Atlas SRV URI field parsing', 'Document tree and grid views', 'Validated JSON MQL execution', 'Sample-based schema analysis'],
            vi: ['Duyệt database và collection', 'Parse trường URI MongoDB một host và Atlas SRV', 'Xem document dạng tree và grid', 'Thực thi JSON MQL có validation', 'Phân tích schema dựa trên mẫu'],
        },
        sslNote: {
            en: 'Atlas SRV selects the mongodb+srv connection type and does not use an explicit port. The parser imports credentials, hostname and database, not the original full URI: authSource, retryWrites, replica-set and other query options are not preserved. Confirm that the reconstructed connection meets your deployment requirements.',
            vi: 'Atlas SRV chọn loại mongodb+srv và không dùng port tường minh. Parser import thông tin đăng nhập, hostname và database, không giữ nguyên URI đầy đủ: authSource, retryWrites, replica-set và các query option khác không được lưu lại. Kiểm tra connection dựng lại có phù hợp triển khai của bạn không.',
        },
        introspectQuery: `// MongoDB metadata is not SQL.
// Collection browsing and schema sampling are separate operations.
// Schema Analysis examines a bounded sample, not every document.`,
    },
};

export function ConnectionSection({ lang, engine }: Props) {
    const t = lang === 'vi';
    const cfg = ENGINE_CONFIG[engine] || ENGINE_CONFIG.postgres;
    const passwordEnv = engine === 'postgres' ? 'POSTGRES_PASSWORD'
        : engine === 'mysql' ? 'MYSQL_ROOT_PASSWORD'
        : engine === 'mariadb' ? 'MARIADB_ROOT_PASSWORD'
        : engine === 'mssql' ? 'MSSQL_SA_PASSWORD' : null;

    return (
        <DocPageLayout
            title={`${t ? 'Kết nối' : 'Connect'} ${cfg.name}`}
            subtitle={t
                ? `Cấu hình ${cfg.name}, kiểm tra trường URI/TLS và hiểu phạm vi quyền trước khi chạy query.`
                : `Configure ${cfg.name}, check URI/TLS fields and understand permission scope before running queries.`}
        >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-3xl block mb-1">{cfg.icon}</span>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Engine</span>
                    <p className="font-bold text-primary">{cfg.name}</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t ? 'Cổng mặc định' : 'Default port'}</span>
                    <p className="font-mono text-primary font-bold text-xl">{cfg.port}</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t ? 'URI' : 'URI'}</span>
                    <p className="font-mono text-primary font-bold">{cfg.uriScheme}://</p>
                </div>
                <div className="p-5 border rounded-2xl bg-muted/20 text-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t ? 'Đích kết nối' : 'Connection target'}</span>
                    <p className="font-mono text-primary font-bold">{t ? 'Từ backend' : 'From backend'}</p>
                </div>
            </div>

            <DocSection title={t ? 'Cách kết nối' : 'How to connect'}>
                <Prose>{t
                    ? 'Mở Connection Explorer, nhấn dấu cộng, chọn engine và nhập thông tin hoặc dùng URI để điền form. Test kiểm tra khả năng kết nối; lưu thành công không chứng nhận mọi tính năng của engine.'
                    : 'Open Connection Explorer, press plus, select the engine and enter details or import a URI into the form. Test checks connectivity; saving successfully does not certify every engine feature.'}</Prose>
                <DocSubSection title={t ? 'Cách 1: Import trường từ URI' : 'Method 1: Import URI fields'}>
                    <Prose>{t
                        ? 'Parser dựa trên URL: lấy loại engine, host, port, username, password và database path từ URI tương thích. Đây không phải truyền nguyên connection string tới driver; các query parameter không được áp dụng tự động. Dùng URL một host và percent-encode ký tự đặc biệt trong username/password.'
                        : 'The URL-based parser reads the engine type, host, port, username, password and database path from a supported URI. It does not pass the original connection string through to the driver; query parameters are not automatically applied. Use a single-host URL and percent-encode special characters in credentials.'}</Prose>
                    <CodeBlock title={t ? 'Ví dụ cấu trúc — thay thông tin bằng giá trị của bạn' : 'Format example — substitute your own details'}>
                        <CodeLine>{cfg.uriExample}</CodeLine>
                    </CodeBlock>
                    <Callout type="warning"><p className="text-sm">{cfg.sslNote[lang]}</p></Callout>
                </DocSubSection>
                <DocSubSection title={t ? 'Cách 2: Form kết nối' : 'Method 2: Connection form'}>
                    <div className="space-y-2 mt-4">
                        {[
                            { field: 'Host', example: 'localhost', desc: t ? 'Hostname/IP mà máy chạy backend truy cập được; localhost không phải trình duyệt người dùng' : 'Hostname/IP reachable from the backend; localhost is not the user browser' },
                            { field: 'Port', example: cfg.port, desc: t ? 'Port server thực tế; Atlas SRV không cần port' : 'Actual server port; Atlas SRV needs no explicit port' },
                            { field: 'Username', example: engine === 'mssql' ? 'sa' : 'user', desc: t ? 'Tài khoản có quyền tối thiểu cần thiết' : 'Account with the minimum required permissions' },
                            { field: 'Password', example: '••••••', desc: t ? 'Mật khẩu được mã hóa AES-256-GCM trước khi server lưu' : 'Password is AES-256-GCM encrypted before server storage' },
                            { field: 'Database', example: 'mydb', desc: t ? 'Database đích, không phải metadata database của app' : 'Target database, not the app metadata database' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                                <code className="bg-primary/10 text-primary px-3 py-1 rounded text-[10px] font-mono font-bold min-w-[100px] text-center">{item.field}</code>
                                <code className="text-xs text-muted-foreground font-mono min-w-[100px]">{item.example}</code>
                                <span className="text-xs text-muted-foreground">{item.desc}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8">
                        <h5 className="font-bold text-xs mb-3 text-foreground uppercase tracking-widest">{t ? 'Connection guardrails — phạm vi thực tế' : 'Connection guardrails — actual scope'}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            {[
                                { title: 'readOnly', desc: t ? 'Chặn mutation ở backend; cho phép các query được phân loại đọc, không chỉ SELECT đơn giản. Không thay thế quyền read-only trên database thật.' : 'Blocks mutations at the backend; permits read-classified queries, not only simple SELECT. It is not a substitute for a read-only database account.' },
                                { title: 'allowQueryExecution', desc: t ? 'false chặn query đọc/ghi, tải data window và sửa dữ liệu; schema sampling NoSQL cũng bị chặn. Soạn query không đồng nghĩa được chạy.' : 'false blocks read/write queries, data windows and row edits; NoSQL schema sampling is also blocked. Authoring a query does not grant execution.' },
                                { title: 'allowSchemaChanges', desc: t ? 'Bảo vệ endpoint đổi schema có cấu trúc. Không phải bộ chặn mọi DDL trong raw SQL nếu allowQueryExecution vẫn bật; dùng quyền database/readOnly để hạn chế rộng hơn.' : 'Guards structured schema-change endpoints. It does not block every DDL statement in raw SQL while allowQueryExecution remains enabled; use database permissions/readOnly for broader restrictions.' },
                                { title: 'allowImportExport', desc: t ? 'Bảo vệ đường import ghi dữ liệu ở server và điều khiển UI import. Không chặn tải CSV/JSON/SQL từ dữ liệu đã nằm trong trình duyệt; không phải egress guard.' : 'Guards server-side data-writing imports and controls import UI. It does not block CSV/JSON/SQL downloads of data already in the browser; it is not an egress guard.' },
                            ].map((g, i) => (
                                <div key={i} className="p-3 border rounded-xl bg-blue-500/5 group hover:bg-blue-500/10 transition-colors">
                                    <div className="text-xs font-bold text-blue-600 mb-1">{g.title}</div>
                                    <div className="text-[10px] text-muted-foreground">{g.desc}</div>
                                </div>
                            ))}
                        </div>
                        <Prose>{t
                            ? 'Query SQL rủi ro có luồng xác nhận riêng sau kiểm tra quyền. MongoDB mutation trên connection writable không có bước xác nhận phá hủy tự động tương đương; luôn review filter trước khi chạy.'
                            : 'High-impact SQL has a separate confirmation flow after permission checks. MongoDB mutations on writable connections do not have an equivalent automatic destructive confirmation; always review filters before running.'}</Prose>
                    </div>
                    <div className="mt-8">
                        <h5 className="font-bold text-xs mb-3 text-foreground uppercase tracking-widest">{t ? 'SSH tunneling — giới hạn hiện tại' : 'SSH tunneling — current limitation'}</h5>
                        <Callout type="warning">
                            <p className="text-sm">{t
                                ? 'Form có trường SSH nhưng đường xác thực mật khẩu/raw private key hiện chưa được xác minh chạy xuyên suốt và có vấn đề tích hợp. Không coi đây là hỗ trợ SSH hoạt động đầy đủ; không dựa vào nó cho kết nối production. Nếu cần tunnel, vận hành/kiểm chứng tunnel bên ngoài app và kiểm tra host đích từ backend.'
                                : 'The form exposes SSH fields, but end-to-end password/raw private-key authentication is unverified and has integration issues. Do not treat this as fully working SSH support or rely on it for production connections. If needed, operate and verify a tunnel outside the app and check the target from the backend.'}</p>
                        </Callout>
                    </div>
                </DocSubSection>
            </DocSection>

            <DocSection title={t ? 'Phạm vi tính năng' : 'Feature scope'}>
                <Prose>{t
                    ? `Các khả năng hiện có cho ${cfg.name} phụ thuộc quyền database và phiên bản server; danh sách này không phải chứng nhận tương thích.`
                    : `Capabilities for ${cfg.name} depend on database permissions and server behavior; this is not compatibility certification.`}</Prose>
                <ul className="grid sm:grid-cols-2 gap-3 mt-6">
                    {cfg.features[lang].map((feat: string, i: number) => (
                        <li key={i} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-sm">{feat}</span>
                        </li>
                    ))}
                </ul>
            </DocSection>

            <DocSection title={t ? 'Ví dụ kiểm tra metadata' : 'Metadata inspection example'}>
                <Prose>{t
                    ? 'Ví dụ sau minh họa cách đọc cấu trúc, không phải bản chép mọi truy vấn nội bộ hoặc lời hứa UI hỗ trợ mọi loại object.'
                    : 'This illustrates metadata inspection, not a verbatim list of internal queries or a promise that the UI handles every object type.'}</Prose>
                <CodeBlock title={`${cfg.name} metadata`}>
                    {cfg.introspectQuery.split('\n').map((line: string, i: number) => <CodeLine key={i}>{line}</CodeLine>)}
                </CodeBlock>
            </DocSection>

            <DocSection title={t ? 'Container thử nghiệm local' : 'Local test container'}>
                <Prose>{t
                    ? 'Đây là ví dụ tạo database đích thử nghiệm, không phải metadata app hoặc ma trận phiên bản tối thiểu. Các port chỉ bind loopback. Đợi database sẵn sàng trước Test; mật khẩu/root account chỉ dùng cho thử nghiệm local.'
                    : 'This creates a disposable target database, not app metadata or a minimum-version matrix. Ports bind only to loopback. Wait for database readiness before Test; root accounts are for local testing only.'}</Prose>
                {passwordEnv && <>
                    <CodeBlock title="Bash">
                        <CodeComment>{t ? 'Sinh mật khẩu mới vào environment trước khi chạy docker' : 'Generate a new environment password before running docker'}</CodeComment>
                        <CodeLine>{`export ${passwordEnv}=$(node -e "console.log('LocalA1!' + require('node:crypto').randomBytes(16).toString('hex'))")`}</CodeLine>
                    </CodeBlock>
                    <CodeBlock title="PowerShell">
                        <CodeLine>{`$env:${passwordEnv} = node -e "console.log('LocalA1!' + require('node:crypto').randomBytes(16).toString('hex'))"`}</CodeLine>
                    </CodeBlock>
                </>}
                <CodeBlock title="Docker">
                    <CodeLine>{`docker run -d --name data-explorer-${engine} -p 127.0.0.1:${cfg.port}:${cfg.port} ${cfg.dockerEnv.join(' ')} ${cfg.dockerImage}${engine === 'cockroach' ? ' start-single-node --insecure' : ''}`}</CodeLine>
                </CodeBlock>
                {(engine === 'cockroach' || engine === 'mongodb') && <Callout type="warning"><p className="text-sm">{t
                    ? 'Ví dụ này không bật authentication/TLS và chỉ dành cho loopback local; không dùng trên mạng công khai hoặc dữ liệu thật.'
                    : 'This example has no authentication/TLS and is only for local loopback; never use it on a public network or with real data.'}</p></Callout>}
            </DocSection>

            <DocSection title={t ? 'Kết nối và TLS' : 'Connections and TLS'}>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 border-l-4 border-l-blue-500 space-y-3">
                        <h4 className="text-sm font-bold flex items-center gap-2"><Zap className="w-4 h-4 text-blue-500" />{t ? 'Pool và giới hạn engine' : 'Pools and engine limits'}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t
                            ? 'Adapter có thể tái sử dụng pool, nhưng session, timeout, cancel và transaction không giống nhau trên mọi engine. Đăng ký Redis/SQLite không đồng nghĩa đã có workspace người dùng hoàn chỉnh.'
                            : 'Adapters can reuse pools, but sessions, timeouts, cancellation and transactions differ by engine. Redis/SQLite registration does not mean a complete user workspace exists.'}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10 border-l-4 border-l-purple-500 space-y-3">
                        <h4 className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-purple-500" />TLS</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t
                            ? "Đặt ALLOW_INSECURE_DATABASE_TLS=false rõ ràng: template dùng false nhưng code bỏ trống là permissive. Không có SSL mode prefer/require hay cơ chế mount /certs/custom CA theo connection được tài liệu này cam kết."
                            : "Explicitly set ALLOW_INSECURE_DATABASE_TLS=false: templates use false but the code is permissive when omitted. No per-connection prefer/require SSL modes or /certs/custom-CA mounting mechanism is promised here."}</p>
                    </div>
                </div>
            </DocSection>
            <div className="mt-8 p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                <h4 className="font-bold flex items-center gap-2 text-emerald-600 uppercase text-[10px] tracking-widest"><Shield className="w-4 h-4" />{t ? 'Kiểm tra trước khi dùng dữ liệu thật' : 'Check before using real data'}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{cfg.sslNote[lang]}</p>
            </div>
            <Prose>
                <a href={publicPath(lang, '/docs/database-capabilities')}>{t ? 'Khả năng theo engine' : 'Capabilities by engine'}</a>{' · '}
                <a href={publicPath(lang, '/docs/sqlite')}>SQLite</a>{' · '}
                <a href={publicPath(lang, '/docs/clickhouse')}>ClickHouse</a>{' · '}
                <a href={publicPath(lang, '/docs/operational-limits')}>{t ? 'Giới hạn vận hành' : 'Operational limits'}</a>
            </Prose>
        </DocPageLayout>
    );
}
