import { Layers, ArrowRight } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout, InfoCard, FeatureGrid } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ArchitectureSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Kiến trúc Hệ thống' : 'System Architecture'}
            subtitle={t
                ? 'Data Explorer áp dụng Hexagonal Architecture (Clean Architecture) với Strategy Pattern — tách biệt hoàn toàn logic nghiệp vụ khỏi chi tiết triển khai.'
                : 'Data Explorer applies Hexagonal Architecture (Clean Architecture) with Strategy Pattern — completely separating business logic from implementation details.'}
        >
            {/* Architecture Layers */}
            <FeatureGrid>
                <InfoCard icon={<Layers className="w-6 h-6 text-purple-500" />} title={t ? 'Lớp Miền (Domain Layer)' : 'Domain Layer'} color="purple">
                    <p>{t
                        ? 'Lõi nghiệp vụ thuần túy — không phụ thuộc vào bất kỳ framework nào. Chứa các entities (Connection, QueryResult, Schema), value objects, và business rules. Lớp này có thể test 100% mà không cần database, HTTP server hay UI.'
                        : 'Pure business core — no dependency on any framework. Contains entities (Connection, QueryResult, Schema), value objects, and business rules. This layer is 100% testable without database, HTTP server, or UI.'}</p>
                </InfoCard>
                <InfoCard icon={<ArrowRight className="w-6 h-6 text-blue-500" />} title={t ? 'Lớp Cổng (Ports & Adapters)' : 'Ports & Adapters'} color="blue">
                    <p>{t
                        ? 'Interfaces (Ports) định nghĩa cách Domain giao tiếp với thế giới bên ngoài. Adapters triển khai các interfaces này cho từng công nghệ cụ thể: PostgreAdapter, MySQLAdapter, GeminiAIAdapter, etc.'
                        : 'Interfaces (Ports) define how the Domain communicates with the external world. Adapters implement these interfaces for specific technologies: PostgreAdapter, MySQLAdapter, GeminiAIAdapter, etc.'}</p>
                </InfoCard>
            </FeatureGrid>

            {/* Strategy Pattern */}
            <DocSection title={t ? 'Strategy Pattern cho Đa Engine' : 'Strategy Pattern for Multi-Engine'}>
                <Prose>{t
                    ? 'Để hỗ trợ 3 database engines (PostgreSQL, MySQL, SQL Server) mà không lặp code, chúng tôi sử dụng Strategy Pattern. Mỗi engine là một "chiến lược" (strategy) triển khai chung một interface DatabaseAdapter.'
                    : 'To support 3 database engines (PostgreSQL, MySQL, SQL Server) without code duplication, we use the Strategy Pattern. Each engine is a "strategy" implementing a common DatabaseAdapter interface.'}</Prose>
                <CodeBlock title={t ? 'Interface Adapter (TypeScript)' : 'Adapter Interface (TypeScript)'}>
                    <CodeComment>{t ? 'Interface chung cho mọi database engine' : 'Common interface for all database engines'}</CodeComment>
                    <CodeLine>{'interface IDatabaseAdapter {'}</CodeLine>
                    <CodeLine>{'  connect(config: ConnectionConfig): Promise<void>;'}</CodeLine>
                    <CodeLine>{'  disconnect(): Promise<void>;'}</CodeLine>
                    <CodeLine>{'  executeQuery(sql: string): Promise<QueryResult>;'}</CodeLine>
                    <CodeLine>{'  introspect(): Promise<SchemaInfo>;'}</CodeLine>
                    <CodeLine>{'  getTableColumns(table: string): Promise<Column[]>;'}</CodeLine>
                    <CodeLine>{'  getForeignKeys(): Promise<ForeignKey[]>;'}</CodeLine>
                    <CodeLine>{'}'}</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Factory chọn adapter phù hợp dựa trên engine type' : 'Factory selects appropriate adapter based on engine type'}</CodeComment>
                    <CodeLine>{'class AdapterFactory {'}</CodeLine>
                    <CodeLine>{'  static create(engine: EngineType): IDatabaseAdapter {'}</CodeLine>
                    <CodeLine>{'    switch (engine) {'}</CodeLine>
                    <CodeLine>{"      case 'postgres':    return new PostgresAdapter();"}</CodeLine>
                    <CodeLine>{"      case 'mysql':       return new MySQLAdapter();"}</CodeLine>
                    <CodeLine>{"      case 'mssql':       return new MSSQLAdapter();"}</CodeLine>
                    <CodeLine>{'    }'}</CodeLine>
                    <CodeLine>{'  }'}</CodeLine>
                    <CodeLine>{'}'}</CodeLine>
                </CodeBlock>
                <Callout type="tip">
                    <p className="text-muted-foreground">{t
                        ? '💡 Để thêm một engine mới (ví dụ: SQLite), bạn chỉ cần tạo một class SQLiteAdapter implements IDatabaseAdapter — không cần sửa bất kỳ code nào ở Domain Layer.'
                        : '💡 To add a new engine (e.g., SQLite), you only need to create a class SQLiteAdapter implements IDatabaseAdapter — no changes needed in the Domain Layer.'}</p>
                </Callout>
            </DocSection>

            {/* AI Data Flow */}
            <DocSection title={t ? 'Luồng dữ liệu AI' : 'AI Data Flow'}>
                <Prose>{t
                    ? 'Khi người dùng yêu cầu AI tạo SQL, dữ liệu đi qua pipeline gồm 5 bước. Hiểu rõ luồng này giúp bạn debug và tối ưu kết quả AI hiệu quả hơn:'
                    : 'When a user requests AI to generate SQL, data flows through a 5-step pipeline. Understanding this flow helps you debug and optimize AI results more effectively:'}</Prose>
                <div className="space-y-2">
                    {[
                        { step: '1', title: t ? 'Schema Extraction' : 'Schema Extraction', desc: t ? 'Backend gọi introspect() trên adapter hiện tại → lấy metadata (bảng, cột, FK, indexes).' : 'Backend calls introspect() on current adapter → retrieves metadata (tables, columns, FKs, indexes).' },
                        { step: '2', title: t ? 'Metadata Compression' : 'Metadata Compression', desc: t ? 'Metadata được nén thành format tối thiểu token-count: "users(id:int4,name:varchar,email:varchar)|orders(id:int4,user_id→users.id,total:numeric)"' : 'Metadata is compressed into minimal token-count format: "users(id:int4,name:varchar,email:varchar)|orders(id:int4,user_id→users.id,total:numeric)"' },
                        { step: '3', title: t ? 'Prompt Assembly' : 'Prompt Assembly', desc: t ? 'System prompt + compressed metadata + user message + dialect instructions → tạo thành full prompt gửi tới Gemini API.' : 'System prompt + compressed metadata + user message + dialect instructions → forms full prompt sent to Gemini API.' },
                        { step: '4', title: t ? 'SSE Streaming' : 'SSE Streaming', desc: t ? 'Backend nhận response từ Gemini và forward từng chunk qua Server-Sent Events tới frontend.' : 'Backend receives response from Gemini and forwards each chunk via Server-Sent Events to frontend.' },
                        { step: '5', title: t ? 'Editor Insertion' : 'Editor Insertion', desc: t ? 'Frontend nhận chunks và chèn vào Monaco Editor theo kiểu "typing animation", tạo trải nghiệm AI đang viết code trực tiếp.' : 'Frontend receives chunks and inserts into Monaco Editor with "typing animation" effect, creating the experience of AI writing code directly.' },
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 items-start p-4 border rounded-xl bg-muted/10">
                            <div className="bg-primary/20 w-8 h-8 rounded-full flex items-center justify-center text-primary font-bold text-sm shrink-0">{item.step}</div>
                            <div>
                                <span className="font-bold block text-sm">{item.title}</span>
                                <span className="text-xs text-muted-foreground">{item.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Folder Structure */}
            <DocSection title={t ? 'Cấu trúc thư mục dự án' : 'Project Folder Structure'}>
                <CodeBlock title={t ? 'Cấu trúc chính' : 'Main Structure'}>
                    <CodeLine>{'Data-Explorer-Editor/'}</CodeLine>
                    <CodeLine>{'├── client/                  # Frontend (React + Vite + TypeScript)'}</CodeLine>
                    <CodeLine>{'│   ├── src/'}</CodeLine>
                    <CodeLine>{'│   │   ├── domain/          # Domain entities, interfaces'}</CodeLine>
                    <CodeLine>{'│   │   ├── application/     # Use cases, stores (Zustand)'}</CodeLine>
                    <CodeLine>{'│   │   ├── infrastructure/  # API clients, adapters'}</CodeLine>
                    <CodeLine>{'│   │   └── presentation/    # React components, pages'}</CodeLine>
                    <CodeLine>{'│   │       ├── components/  # Reusable UI components'}</CodeLine>
                    <CodeLine>{'│   │       ├── modules/     # Feature modules'}</CodeLine>
                    <CodeLine>{'│   │       └── pages/       # Route pages'}</CodeLine>
                    <CodeLine>{'│   └── public/              # Static assets'}</CodeLine>
                    <CodeLine>{'├── server/                  # Backend (NestJS + TypeScript)'}</CodeLine>
                    <CodeLine>{'│   ├── src/'}</CodeLine>
                    <CodeLine>{'│   │   ├── modules/         # NestJS feature modules'}</CodeLine>
                    <CodeLine>{'│   │   ├── adapters/        # Database engine adapters'}</CodeLine>
                    <CodeLine>{'│   │   ├── guards/          # Auth guards (JWT)'}</CodeLine>
                    <CodeLine>{'│   │   └── services/        # Business logic services'}</CodeLine>
                    <CodeLine>{'│   └── prisma/              # Prisma schema (PostgreSQL) & migrations'}</CodeLine>
                    <CodeLine>{'└── package.json             # Root workspace config'}</CodeLine>
                </CodeBlock>

                <div className="mt-8 space-y-4">
                    <h4 className="font-bold text-sm text-blue-500">{t ? 'Lợi ích của Strategy Pattern trong Data Explorer' : 'Benefits of Strategy Pattern in Data Explorer'}</h4>
                    <ul className="grid md:grid-cols-2 gap-4">
                        {[
                            {
                                title: t ? 'Tính Đóng gói (Encapsulation)' : 'Encapsulation',
                                desc: t ? 'Logic truy vấn của từng database (ví dụ: cách lấy danh sách table trong MSSQL khác MySQL) được đóng gói hoàn toàn trong Adapter tương ứng.' : 'Specific database query logic (e.g., fetching table lists) is fully encapsulated within its corresponding adapter.'
                            },
                            {
                                title: t ? 'Nguyên tắc Mở/Đóng (Open/Closed)' : 'Open/Closed Principle',
                                desc: t ? 'Chúng ta có thể thêm hỗ trợ cho DuckDB hoặc Oracle chỉ bằng cách thêm file mới, không cần sửa đổi logic cốt lõi.' : 'Support for DuckDB or Oracle can be added by simply creating a new file, without modifying core logic.'
                            },
                            {
                                title: t ? 'Dễ dàng Kiểm thử (Testability)' : 'Testability',
                                desc: t ? 'Mỗi Adapter được unit test riêng biệt với database engine thật mà không làm ảnh hưởng đến luồng giao diện.' : 'Each adapter is unit-tested independently against real database engines without affecting the UI layer.'
                            },
                            {
                                title: t ? 'Hoán đổi linh hoạt (Swappability)' : 'Swappability',
                                desc: t ? 'Hệ thống có thể chuyển đổi giữa các engine khác nhau trong thời gian thực dựa trên cấu hình kết nối của người dùng.' : 'The system can switch between different engines in real-time based on the user\'s connection configuration.'
                            }
                        ].map((item, i) => (
                            <li key={i} className="p-4 rounded-xl border border-border/50 bg-muted/5 space-y-2">
                                <span className="text-xs font-black uppercase tracking-widest text-foreground/70">{item.title}</span>
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </DocSection>

            {/* Design Philosophy */}
            <DocSection title={t ? 'Triết lý Thiết kế: Clean Architecture' : 'Design Philosophy: Clean Architecture'}>
                <Prose>
                    {t
                        ? 'Data Explorer được xây dựng trên nền tảng của Sự rõ ràng (Clarity) và Sự bền vững (Sustainability). Chúng tôi áp dụng kiến trúc Hexagonal (Ports & Adapters) để giải quyết các vấn đề phổ biến trong phát triển phần mềm.'
                        : 'Data Explorer is built on the pillars of Clarity and Sustainability. We apply Hexagonal Architecture (Ports & Adapters) to solve common software development challenges.'}
                </Prose>

                <div className="mt-6 p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 border-l-4 border-l-blue-500">
                    <h5 className="font-bold text-sm mb-3">{t ? '1. Độc lập với Framework' : '1. Framework Independence'}</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {t
                            ? 'Lớp Domain và Application không phụ thuộc vào React hay NestJS. Điều này đảm bảo rằng nếu chúng ta muốn chuyển từ React sang Vue, hoặc NestJS sang Go, logic nghiệp vụ vẫn được giữ nguyên.'
                            : 'The Domain and Application layers do not depend on React or NestJS. This ensures that if we want to switch from React to Vue, or NestJS to Go, the business logic remains intact.'}
                    </p>
                </div>

                <div className="mt-4 p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10 border-l-4 border-l-purple-500">
                    <h5 className="font-bold text-sm mb-3">{t ? '2. Separations of Concerns (SoC)' : '2. Separations of Concerns (SoC)'}</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {t
                            ? 'Mỗi module có một trách nhiệm duy nhất (SRP). Module "Query" chỉ lo về việc thực thi lệnh SQL, trong khi module "Visualization" chỉ lo về việc vẽ biểu đồ. Chúng giao tiếp với nhau qua các interface và event.'
                            : 'Each module has a single responsibility (SRP). The "Query" module only handles SQL execution, while the "Visualization" module only handles charting. They communicate via interfaces and events.'}
                    </p>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
