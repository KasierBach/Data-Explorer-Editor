import { Layers, ArrowRight, ShieldCheck } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';
import { cn } from '@/lib/utils';
import { publicPath } from '@/core/seo/publicRoutes';

interface Props { lang: 'vi' | 'en'; }

export function ArchitectureSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Kiến trúc & Thiết kế Hệ thống' : 'System Architecture & Design'}
            subtitle={t
                ? 'Các ranh giới hiện có trong repo: backend NestJS dạng modular monolith, factory chọn database strategy và các adapter/service phía client.'
                : 'The boundaries present in the repo: a modular NestJS monolith, a database strategy factory, and client adapters and services.'}
            gradient
        >
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                {[
                    {
                        icon: <Layers className="w-6 h-6 text-indigo-500" />,
                        title: t ? 'Adapter phía client' : 'Client adapters',
                        desc: t ? 'IDatabaseAdapter và ApiDatabaseAdapter nối workspace với API backend.' : 'IDatabaseAdapter and ApiDatabaseAdapter connect the workspace to the backend API.'
                    },
                    {
                        icon: <ArrowRight className="w-6 h-6 text-blue-500" />,
                        title: t ? 'Chọn strategy theo engine' : 'Engine strategy selection',
                        desc: t ? 'DatabaseStrategyFactory ánh xạ loại connection sang IDatabaseStrategy.' : 'DatabaseStrategyFactory maps connection types to IDatabaseStrategy implementations.'
                    },
                    {
                        icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
                        title: t ? 'Module NestJS' : 'NestJS modules',
                        desc: t ? 'Controller, service và DI tổ chức các miền chức năng trong cùng backend.' : 'Controllers, services, and DI organize functional domains within one backend.'
                    }
                ].map((item, id) => (
                    <div key={id} className="p-6 border rounded-2xl bg-card/50 hover:bg-card transition-colors">
                        <div className="mb-4">{item.icon}</div>
                        <h4 className="font-bold text-sm mb-2">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>

            <DocSection title={t ? 'Ranh giới thực tế, không phải mô hình bốn lớp tuyệt đối' : 'Actual boundaries, not a strict four-layer model'}>
                <Prose>
                    {t
                        ? 'Server là modular monolith NestJS: các module như connections, query, metadata, nosql và ai sử dụng controller/service, DI và driver cụ thể. Prisma quản lý PostgreSQL metadata của app, không thay thế driver của database đích. Client có core/domain, core/adapters, core/services và presentation; repo không có bộ Use Case hay thư mục infrastructure độc lập như một sơ đồ Clean Architecture lý tưởng.'
                        : 'The server is a modular NestJS monolith: modules such as connections, query, metadata, nosql, and ai use controllers, services, DI, and concrete drivers. Prisma manages the app metadata PostgreSQL database, not the target database drivers. The client has core/domain, core/adapters, core/services, and presentation; it does not contain a separate Use Case layer or infrastructure directory matching an idealized Clean Architecture diagram.'}
                </Prose>
                <div className="mt-10 space-y-8">
                    {[
                        {
                            layer: 'client/src/core/domain + core/adapters',
                            color: 'bg-indigo-500',
                            title: t ? 'Hợp đồng và adapter' : 'Contracts and adapters',
                            details: t
                                ? 'database-adapter.interface.ts định nghĩa IDatabaseAdapter; entities.ts chứa kiểu dữ liệu dùng chung. ApiDatabaseAdapter triển khai hợp đồng bằng lời gọi HTTP đến backend. Adapter này không mở kết nối TCP trực tiếp từ trình duyệt tới database.'
                                : 'database-adapter.interface.ts defines IDatabaseAdapter; entities.ts holds shared data types. ApiDatabaseAdapter implements the contract through HTTP calls to the backend. It does not open direct TCP database connections from the browser.'
                        },
                        {
                            layer: 'client/src/core/services',
                            color: 'bg-blue-500',
                            title: t ? 'Service và trạng thái ứng dụng' : 'Application services and state',
                            details: t
                                ? 'ConnectionService chọn adapter; apiService tập trung auth header, refresh và retry. Các service chuyên biệt và useAppStore phối hợp state với request. Đây là ranh giới tổ chức hiện tại, không phải cam kết mọi phụ thuộc đều chỉ hướng vào domain.'
                                : 'ConnectionService selects the adapter; apiService centralizes auth headers, refresh, and retry. Feature services and useAppStore coordinate state and requests. These are current organizational boundaries, not a guarantee that every dependency points only toward the domain.'
                        },
                        {
                            layer: 'client/src/presentation',
                            color: 'bg-emerald-500',
                            title: t ? 'Module, hook và giao diện' : 'Modules, hooks, and UI',
                            details: t
                                ? 'Các page, module và hook dựng SQL workspace, MongoDB workspace, AI assistant và các trang public. Hook và component vẫn có logic điều phối; mô tả kiến trúc nên phản ánh code hiện tại thay vì khẳng định UI hoàn toàn không chứa logic.'
                                : 'Pages, modules, and hooks compose the SQL workspace, MongoDB workspace, AI assistant, and public pages. Hooks and components still contain orchestration logic; the architecture description should reflect the code rather than claim a logic-free UI.'
                        }
                    ].map((item, i) => (
                        <div key={i} className="flex gap-6 group">
                            <div className={cn('w-1 items-stretch rounded-full', item.color)} />
                            <div className="py-2">
                                <span className={cn('text-[10px] font-black uppercase tracking-widest leading-none', item.color.replace('bg-', 'text-'))}>{item.layer}</span>
                                <h5 className="font-bold text-sm mt-1">{item.title}</h5>
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{item.details}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Luồng client → backend → database đích' : 'Client → backend → target database flow'}>
                <Prose>
                    {t
                        ? 'Workspace dùng ApiDatabaseAdapter cho query và metadata. Backend kiểm tra tài khoản, quyền connection và policy trước khi dùng pool/strategy tương ứng. Dữ liệu nội bộ như user, saved query và dashboard đi qua Prisma, tách biệt với database mà người dùng đang khám phá.'
                        : 'The workspace uses ApiDatabaseAdapter for queries and metadata. The backend checks the account, connection access, and policy before using the relevant pool and strategy. Internal data such as users, saved queries, and dashboards goes through Prisma, separately from the database the user is exploring.'}
                </Prose>
                <div className="mt-8">
                    <CodeBlock title={t ? 'Sơ đồ luồng theo các symbol hiện có' : 'Flow using existing symbols'}>
                        <CodeLine>Workspace / hooks → ConnectionService → ApiDatabaseAdapter</CodeLine>
                        <CodeLine>ApiDatabaseAdapter → apiService → /api/query or /api/metadata</CodeLine>
                        <CodeLine>Controller → service → ConnectionsService / DatabaseStrategyFactory</CodeLine>
                        <CodeLine>IDatabaseStrategy → native driver → target database</CodeLine>
                        <CodeComment>{t ? 'PrismaService là nhánh riêng cho PostgreSQL metadata của app.' : 'PrismaService is the separate branch for app metadata PostgreSQL.'}</CodeComment>
                    </CodeBlock>
                </div>
            </DocSection>

            <DocSection title={t ? 'Strategy Pattern: ánh xạ tập trung, capability khác nhau' : 'Strategy pattern: centralized mapping, different capabilities'}>
                <Prose>
                    {t
                        ? 'DatabaseStrategyFactory nhận các strategy qua constructor và xây Map trong instance. MariaDB dùng alias của MysqlStrategy; MongoDB và mongodb+srv dùng MongoDbStrategy; CockroachDbStrategy kế thừa PostgresStrategy. PostgreSQL, SQL Server, SQLite, ClickHouse và Redis cũng có ánh xạ riêng. Thêm engine vẫn cần cập nhật factory, DI, kiểu connection, UI và tests; không có cơ chế đăng ký plugin tĩnh tự động.'
                        : 'DatabaseStrategyFactory receives strategies through its constructor and builds an instance Map. MariaDB aliases MysqlStrategy; MongoDB and mongodb+srv share MongoDbStrategy; CockroachDbStrategy extends PostgresStrategy. PostgreSQL, SQL Server, SQLite, ClickHouse, and Redis also have mappings. Adding an engine still requires factory, DI, connection type, UI, and test updates; there is no automatic static plugin registry.'}
                </Prose>
                <div className="mt-8">
                    <CodeBlock title={t ? 'Ví dụ sử dụng hợp đồng thật (đặt trong server/src)' : 'Real contract usage example (under server/src)'}>
                        <CodeLine>{"import { DatabaseStrategyFactory } from './database-strategies/strategy.factory';"}</CodeLine>
                        <CodeLine>{'export function quoteTable('}</CodeLine>
                        <CodeLine>{'  factory: DatabaseStrategyFactory, type: string,'}</CodeLine>
                        <CodeLine>{'  schema: string | undefined, table: string,'}</CodeLine>
                        <CodeLine>{') {'}</CodeLine>
                        <CodeLine>{'  return factory.getStrategy(type).quoteTable(schema, table);'}</CodeLine>
                        <CodeLine>{'}'}</CodeLine>
                        <CodeComment>{t ? 'Factory được NestJS khởi tạo/inject; type không hỗ trợ sẽ ném BadRequestException.' : 'NestJS constructs/injects the factory; an unsupported type throws BadRequestException.'}</CodeComment>
                    </CodeBlock>
                </div>
                <Callout type="info">
                    <p className="text-xs">
                        {t
                            ? 'Cùng triển khai IDatabaseStrategy không có nghĩa mọi engine có đầy đủ SQL, transaction, schema edit hoặc cancellation. Redis đã có strategy và có thể chọn trong connection UI, nhưng NoSqlMainContent hiện từ chối connection không phải MongoDB; chưa có Redis workspace hoàn chỉnh. Xem '
                            : 'Implementing IDatabaseStrategy does not mean every engine supports all SQL, transaction, schema editing, or cancellation operations. Redis has a strategy and is selectable in the connection UI, but NoSqlMainContent currently rejects non-MongoDB connections; there is no complete Redis workspace. See '}
                        <a className="text-primary hover:underline" href={publicPath(lang, '/docs/database-capabilities')}>{t ? 'ma trận capability database' : 'the database capability matrix'}</a>.
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Trạng thái Zustand và phạm vi lưu trữ' : 'Zustand state and persistence scope'}>
                <Prose>
                    {t
                        ? 'useAppStore ghép các slice UI, auth, connection, tab, query, AI chat và NoSQL. persist chỉ lưu các trường đã chọn vào data-explorer-storage: cấu hình connection đã bỏ credential, tab/draft và lựa chọn UI/NoSQL/AI. Access token và user không được persist; tin nhắn AI, saved query và query history là dữ liệu server-backed, không phải toàn bộ root store được lưu local.'
                        : 'useAppStore composes UI, auth, connection, tab, query, AI chat, and NoSQL slices. persist writes selected fields to data-explorer-storage: connection metadata without credentials, tabs and drafts, and UI/NoSQL/AI selections. Access tokens and users are not persisted; AI messages, saved queries, and query history are server-backed rather than a complete local copy of the root store.'}
                </Prose>
                <div className="mt-8 grid sm:grid-cols-3 gap-4">
                    {[
                        { t: t ? 'Connection slice' : 'Connection slice', d: t ? 'Danh sách connection và database đang chọn; credential không lưu trong root persistence.' : 'Connection list and selected database; credentials are excluded from root persistence.' },
                        { t: t ? 'Tab & query slice' : 'Tab & query slices', d: t ? 'Editor state và tab; saved query/history được đồng bộ qua backend.' : 'Editor state and tabs; saved queries and history synchronize through the backend.' },
                        { t: t ? 'UI, AI & NoSQL slice' : 'UI, AI & NoSQL slices', d: t ? 'Panel, draft và lựa chọn workspace; không persist token hoặc toàn bộ tin nhắn AI.' : 'Panels, drafts, and workspace selections; no persisted tokens or complete AI messages.' }
                    ].map((item, i) => (
                        <div key={i} className="p-5 border rounded-2xl bg-muted/20 border-border/50 hover:bg-muted/30 transition-all">
                            <h5 className="font-bold text-xs mb-2 tracking-tight flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                {item.t}
                            </h5>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{item.d}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Những miền chức năng trong repo' : 'Functional domains in the repo'}>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h4 className="text-sm font-bold">{t ? 'Miền backend' : 'Backend domains'}</h4>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'query, metadata, nosql, ai, auth, otp, billing, collaboration, organizations, permissions, teamspaces, notifications, presence, redis, migration và database-strategies phối hợp trong cùng ứng dụng NestJS.'
                                : 'query, metadata, nosql, ai, auth, otp, billing, collaboration, organizations, permissions, teamspaces, notifications, presence, redis, migration, and database-strategies work together within the same NestJS application.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h4 className="text-sm font-bold">{t ? 'Bề mặt client' : 'Client surfaces'}</h4>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Query, NoSqlExplorer, Visualization, Explorer, Dashboard, Connection và Layout dựng workspace. presentation/public chứa các trang marketing/docs public; presentation/pages chứa các page ứng dụng.'
                                : 'Query, NoSqlExplorer, Visualization, Explorer, Dashboard, Connection, and Layout compose the workspace. presentation/public contains public marketing/docs views; presentation/pages contains application pages.'}
                        </p>
                    </div>
                </div>
                <Callout type="info">
                    <p className="text-sm">
                        {t
                            ? 'Đọc kiến trúc theo flow chức năng và kiểm tra caller trước khi đổi shared service. Ranh giới module giúp định hướng, không đảm bảo một thay đổi AI routing hoặc permission chỉ ảnh hưởng một folder.'
                            : 'Read the architecture by functional flow and inspect callers before changing shared services. Module boundaries help navigation but do not guarantee that an AI routing or permission change affects only one folder.'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Các thư mục có thật để bắt đầu đọc code' : 'Existing directories for code navigation'}>
                <CodeBlock title={t ? 'Cây thư mục rút gọn' : 'Abbreviated directory tree'}>
                    <CodeLine>server/src/</CodeLine>
                    <CodeLine> ├── connections/        # {t ? 'Credential, pool và policy connection' : 'Credentials, pools, and connection policies'}</CodeLine>
                    <CodeLine> ├── database-strategies/# {t ? 'IDatabaseStrategy, factory và driver engine' : 'IDatabaseStrategy, factory, and engine drivers'}</CodeLine>
                    <CodeLine> ├── query/ + metadata/ # {t ? 'SQL execution và schema context' : 'SQL execution and schema context'}</CodeLine>
                    <CodeLine> ├── nosql/ + ai/       # {t ? 'MongoDB flow và AI orchestration' : 'MongoDB flows and AI orchestration'}</CodeLine>
                    <CodeLine> ├── prisma/            # {t ? 'PostgreSQL metadata của app' : 'App metadata PostgreSQL'}</CodeLine>
                    <CodeLine> └── redis/ + migration/# {t ? 'Hạ tầng Redis và migration queue' : 'Redis infrastructure and migration queues'}</CodeLine>
                    <CodeLine>client/src/</CodeLine>
                    <CodeLine> ├── core/domain/       # {t ? 'Hợp đồng và kiểu dữ liệu' : 'Contracts and data types'}</CodeLine>
                    <CodeLine> ├── core/adapters/     # ApiDatabaseAdapter</CodeLine>
                    <CodeLine> ├── core/services/     # {t ? 'Service API, feature và Zustand store' : 'API/feature services and Zustand store'}</CodeLine>
                    <CodeLine> ├── presentation/      # {t ? 'Module, page, hook, component và public view' : 'Modules, pages, hooks, components, and public views'}</CodeLine>
                    <CodeLine> └── test/              # {t ? 'Thiết lập test frontend' : 'Frontend test setup'}</CodeLine>
                </CodeBlock>
            </DocSection>
        </DocPageLayout>
    );
}
