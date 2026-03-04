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
                    ? 'Để hỗ trợ 4 database engines (PostgreSQL, MySQL, SQL Server, ClickHouse) mà không lặp code, chúng tôi sử dụng Strategy Pattern. Mỗi engine là một "chiến lược" (strategy) triển khai chung một interface DatabaseAdapter.'
                    : 'To support 4 database engines (PostgreSQL, MySQL, SQL Server, ClickHouse) without code duplication, we use the Strategy Pattern. Each engine is a "strategy" implementing a common DatabaseAdapter interface.'}</Prose>
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
                    <CodeLine>{"      case 'clickhouse':  return new ClickHouseAdapter();"}</CodeLine>
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
                    <CodeLine>{'│   └── prisma/              # Prisma schema & migrations'}</CodeLine>
                    <CodeLine>{'└── package.json             # Root workspace config'}</CodeLine>
                </CodeBlock>
            </DocSection>
        </DocPageLayout>
    );
}
