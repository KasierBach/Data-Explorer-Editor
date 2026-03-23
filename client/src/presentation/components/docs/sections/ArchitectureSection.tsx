import { Layers, ArrowRight, ShieldCheck } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';
import { cn } from '@/lib/utils';

interface Props { lang: 'vi' | 'en'; }

export function ArchitectureSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Kiến trúc & Thiết kế Hệ thống' : 'System Architecture & Design'}
            subtitle={t
                ? 'Khám phá triết lý thiết kế đằng sau Data Explorer — từ Clean Architecture đến các Design Patterns cấp cao giúp hệ thống mở rộng và bảo mật.'
                : 'Explore the design philosophy behind Data Explorer — from Clean Architecture to high-level Design Patterns for scalability and security.'}
            gradient
        >
            {/* Core Pillars */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                {[
                    {
                        icon: <Layers className="w-6 h-6 text-indigo-500" />,
                        title: t ? 'Hexagonal Architecture' : 'Hexagonal Architecture',
                        desc: t ? 'Tách biệt Domain logic khỏi Database và UI thông qua Ports & Adapters.' : 'Separates Domain logic from Database and UI via Ports & Adapters.'
                    },
                    {
                        icon: <ArrowRight className="w-6 h-6 text-blue-500" />,
                        title: t ? 'Strategy Pattern' : 'Strategy Pattern',
                        desc: t ? 'Hỗ trợ đa Database Engines mà không làm phình to bộ mã nguồn cốt lõi.' : 'Supports multiple DB Engines without bloating the core codebase.'
                    },
                    {
                        icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
                        title: t ? 'Dependency Rule' : 'Dependency Rule',
                        desc: t ? 'Sự phụ thuộc chỉ hướng vào bên trong (Lõi Domain), đảm bảo tính bền vững.' : 'Dependencies only point inward (Domain Core), ensuring sustainability.'
                    }
                ].map((item, id) => (
                    <div key={id} className="p-6 border rounded-2xl bg-card/50 hover:bg-card transition-colors">
                        <div className="mb-4">{item.icon}</div>
                        <h4 className="font-bold text-sm mb-2">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>

            <DocSection title={t ? 'Cấu trúc Lớp (Deep Clean Architecture)' : 'Deep Clean Architecture'}>
                <Prose>
                    {t
                        ? 'Data Explorer tuân thủ nghiêm ngặt mô hình 4 lớp của Clean Architecture. Chúng tôi áp dụng nguyên tắc "Dependency Rule": Sự phụ thuộc chỉ được phép hướng vào bên trong, đảm bảo Domain Core không bao giờ bị ảnh hưởng bởi các thay đổi ở hạ tầng.'
                        : 'Data Explorer strictly adheres to the 4-layer model of Clean Architecture. We apply the "Dependency Rule": Dependencies only point inward, ensuring that the Domain Core is never affected by infrastructure changes.'}
                </Prose>

                <div className="mt-10 space-y-8">
                    {[
                        {
                            layer: "Domain Layer (Core)",
                            color: "bg-indigo-500",
                            title: t ? "Luật Nghiệp vụ Tinh khiết" : "Pure Business Rules",
                            details: t
                                ? "Chứa các Entities (Connection, User, Table) và POJO (Plain Old Java/TS Objects). Lớp này hoàn toàn không có sự phụ thuộc vào các thư viện bên ngoài như NestJS hay TypeORM. Đây là 'Trái tim' của hệ thống, nơi lưu giữ logic cốt lõi về cách một truy vấn được cấu trúc."
                                : "Contains Entities (Connection, User, Table) and POJOs. This layer has zero dependencies on external libraries like NestJS or TypeORM. It is the 'Heart' of the system, preserving the core logic of how queries are structured."
                        },
                        {
                            layer: "Application Layer (Use Cases)",
                            color: "bg-blue-500",
                            title: t ? "Điều phối Luồng (Orchestration)" : "Flow Orchestration",
                            details: t
                                ? "Chứa các Use Cases (vd: ExecuteQueryUseCase, GetSchemaUseCase). Lớp này định nghĩa các 'Interface' (Ports) mà hạ tầng phải tuân theo. Nó đóng vai trò như một nhạc trưởng, điều phối dữ liệu đi qua các Ports mà không cần biết Adapter cụ thể phía sau là gì."
                                : "Contains Use Cases (e.g., ExecuteQueryUseCase, GetSchemaUseCase). This layer defines 'Interfaces' (Ports) that infrastructure must follow. It acts as a conductor, orchestrating data through Ports without knowing the specific Adapter behind them."
                        },
                        {
                            layer: "Infrastructure Layer (Adapters)",
                            color: "bg-emerald-500",
                            title: t ? "Chi tiết Triển khai (Details)" : "Implementation Details",
                            details: t
                                ? "Nơi các công nghệ cụ thể 'cắm' vào hệ thống. Bao gồm PostgreSQL Drivers, Gemini AI API, và các Interceptor của NestJS. Nếu chúng ta muốn đổi từ Postgres sang MongoDB, chỉ cần viết một Adapter mới ở lớp này mà không chạm vào Domain Core."
                                : "Where specific technologies 'plug' into the system. Includes PostgreSQL Drivers, Gemini AI API, and NestJS Interceptors. If we want to switch from Postgres to MongoDB, we only need to write a new Adapter in this layer without touching the Domain Core."
                        }
                    ].map((item, i) => (
                        <div key={i} className="flex gap-6 group">
                            <div className={cn("w-1 items-stretch rounded-full", item.color)} />
                            <div className="py-2">
                                <span className={cn("text-[10px] font-black uppercase tracking-widest leading-none", item.color.replace('bg-', 'text-'))}>{item.layer}</span>
                                <h5 className="font-bold text-sm mt-1">{item.title}</h5>
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{item.details}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Dependency Inversion In Action */}
            <DocSection title={t ? 'Nghịch đảo Phụ thuộc (Dependency Inversion)' : 'Dependency Inversion In Action'}>
                <Prose>
                    {t
                        ? 'Để đạt được sự linh hoạt, chúng tôi không để Application Layer phụ thuộc vào Infrastructure. Thay vào đó, cả hai đều phụ thuộc vào một abstractions chung.'
                        : 'To achieve flexibility, we don\'t let the Application Layer depend on Infrastructure. Instead, both depend on shared abstractions.'}
                </Prose>
                <div className="mt-8">
                    <CodeBlock title="The Power of Ports & Adapters">
                        <CodeComment>{t ? '// Lớp Application định nghĩa "Port"' : '// Application layer defines the "Port"'}</CodeComment>
                        <CodeLine>{'interface DatabasePort {'}</CodeLine>
                        <CodeLine>{'  execute(query: string): Promise<Result>;'}</CodeLine>
                        <CodeLine>{'}'}</CodeLine>
                        <p className="mt-4" />
                        <CodeComment>{t ? '// Lớp Infrastructure triển khai "Adapter"' : '// Infrastructure layer implements the "Adapter"'}</CodeComment>
                        <CodeLine>{'@Injectable()'}</CodeLine>
                        <CodeLine>{'class PostgresAdapter implements DatabasePort {'}</CodeLine>
                        <CodeLine>{'  async execute(query: string) { /* pg driver logic */ }'}</CodeLine>
                        <CodeLine>{'}'}</CodeLine>
                        <p className="mt-4" />
                        <CodeComment>{t ? '// Dependency Injection lo việc "cắm" Adapter vào' : '// Dependency Injection handles the "plugging"'}</CodeComment>
                        <CodeLine>{'providers: [{ provide: DatabasePort, useClass: PostgresAdapter }]'}</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            <DocSection title={t ? 'Strategy Pattern: Đa cơ sở dữ liệu' : 'Strategy Pattern: Multi-Engine Support'}>
                <Prose>
                    {t
                        ? 'Thử thách lớn nhất của Data Explorer là hỗ trợ nhiều loại SQL Dialects (Postgres vs MySQL vs MSSQL) nhưng vẫn giữ được code sạch. Chúng tôi giải quyết bằng Strategy Pattern kết hợp với Dependency Injection.'
                        : 'The biggest challenge for Data Explorer is supporting multiple SQL Dialects (Postgres vs MySQL vs MSSQL) while maintaining clean code. We solve this using the Strategy Pattern combined with Dependency Injection.'}
                </Prose>
                <div className="mt-8">
                    <CodeBlock title="Database Strategy Interface">
                        <CodeComment>{t ? '// Định nghĩa bản hợp đồng cho mọi Database Engine' : '// Defines the contract for all Database Engines'}</CodeComment>
                        <CodeLine>{'abstract class DatabaseStrategy {'}</CodeLine>
                        <CodeLine>{'  abstract connect(id: string): Promise<Client>;'}</CodeLine>
                        <CodeLine>{'  abstract getMetadata(schema: string): Promise<TableMetadata[]>;'}</CodeLine>
                        <CodeLine>{'  abstract generateExplain(sql: string): Promise<string>;'}</CodeLine>
                        <CodeLine>{'}'}</CodeLine>
                        <p className="mt-4" />
                        <CodeComment>{t ? '// Triển khai cụ thể' : '// Concrete Implementations'}</CodeComment>
                        <CodeLine>{'class PostgresStrategy extends DatabaseStrategy { ... }'}</CodeLine>
                        <CodeLine>{'class MySqlStrategy extends DatabaseStrategy { ... }'}</CodeLine>
                    </CodeBlock>
                </div>
                <Callout type="info">
                    <p className="text-xs italic">
                        {t
                            ? '"Strategy Pattern cho phép chúng tôi thêm hỗ trợ cho Oracle hay ClickHouse chỉ trong vài giờ bằng cách tạo adapter mới mà không cần chạm vào logic giao diện."'
                            : '"The Strategy Pattern allows us to add support for Oracle or ClickHouse in hours by creating a new adapter without touching the UI logic."'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Đồng bộ trạng thái (Zustand Topology)' : 'Zustand State Topology'}>
                <Prose>
                    {t
                        ? 'Tại client, chúng tôi quản lý trạng thái bằng Zustand với kiến trúc Slice-based. Mỗi module có một "Lát cắt" (Slice) riêng biệt nhưng vẫn có thể tương tác với nhau thông qua Root Store.'
                        : 'On the client, we manage state using Zustand with a Slice-based architecture. Each module has its own "Slice" but remains interoperable through the Root Store.'}
                </Prose>
                <div className="mt-8 grid sm:grid-cols-3 gap-4">
                    {[
                        {
                            t: 'Connection Slice',
                            d: t ? 'Quản lý danh sách DB và trạng thái kết nối active.' : 'Manages DB list and active connection state.'
                        },
                        {
                            t: 'Tab Slice',
                            d: t ? 'Luồng điều phối các cửa sổ làm việc SQL độc lập.' : 'Orchestrates independent SQL working windows.'
                        },
                        {
                            t: 'UI/UX Slice',
                            d: t ? 'Toàn bộ trạng thái hiển thị (Sidebar, Panels, Modals).' : 'Whole purely UI-related state (Sidebar, Panels, Modals).'
                        }
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

            <DocSection title={t ? 'Cấu trúc Thư mục (Pro-level Setup)' : 'Project Structure (Pro-level Setup)'}>
                <CodeBlock title="Directory Tree">
                    <CodeLine>server/</CodeLine>
                    <CodeLine> ├── src/</CodeLine>
                    <CodeLine> │    ├── auth/           # {t ? 'Xác thực & Phân quyền' : 'Auth & RBAC'}</CodeLine>
                    <CodeLine> │    ├── connections/    # {t ? 'Quản lý DB Connections' : 'DB Connection Management'}</CodeLine>
                    <CodeLine> │    ├── strategies/     # {t ? 'Cài đặt Database Engines' : 'DB Engine Implementations'}</CodeLine>
                    <CodeLine> │    └── metadata/       # {t ? 'Xử lý lược đồ AI' : 'AI Schema Processing'}</CodeLine>
                    <CodeLine>client/</CodeLine>
                    <CodeLine> ├── src/</CodeLine>
                    <CodeLine> │    ├── core/           # {t ? 'Logic nghiệp vụ (Domain)' : 'Business Logic (Domain)'}</CodeLine>
                    <CodeLine> │    ├── presentation/   # {t ? 'Giao diện hạt nhân (Atom UI)' : 'Atomic UI Components'}</CodeLine>
                    <CodeLine> │    └── modules/        # {t ? 'Tính năng (Editor, Charts, ERD)' : 'Feature Modules (Editor, Charts, ERD)'}</CodeLine>
                </CodeBlock>
            </DocSection>
        </DocPageLayout>
    );
}
