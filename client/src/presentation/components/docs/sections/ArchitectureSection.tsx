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

            <DocSection title={t ? 'Cấu trúc Lớp (Layered Architecture)' : 'Layered Architecture'}>
                <Prose>
                    {t
                        ? 'Data Explorer tuân thủ nghiêm ngặt mô hình 4 lớp của Clean Architecture. Mỗi lớp có một ranh giới rõ ràng và quy tắc phụ thuộc một chiều:'
                        : 'Data Explorer strictly adheres to the 4-layer model of Clean Architecture. Each layer has clear boundaries and a one-way dependency rule:'}
                </Prose>

                <div className="mt-10 space-y-8">
                    {[
                        {
                            layer: "Domain Layer",
                            color: "bg-indigo-500",
                            title: t ? "Lõi Nghiệp vụ (Enterprise Rules)" : "Enterprise Business Rules",
                            details: t
                                ? "Chứa các Entities (Connection, User, Table) và các Logic không thay đổi. Đây là lớp 'tinh khiết' nhất, không biết đến sự tồn tại của NestJS hay PostgreSQL."
                                : "Contains Entities (Connection, User, Table) and invariant logic. This is the 'purest' layer, unaware of NestJS or PostgreSQL."
                        },
                        {
                            layer: "Application Layer",
                            color: "bg-blue-500",
                            title: t ? "Logic Ứng dụng (Use Cases)" : "Application Use Cases",
                            details: t
                                ? "Điều phối luồng dữ liệu. Ví dụ: 'ExecuteQueryUseCase' sẽ gọi Interface DatabasePort mà không cần biết adapter nào đang chạy."
                                : "Orchestrates data flow. For example: 'ExecuteQueryUseCase' calls DatabasePort Interface without knowing which adapter is running."
                        },
                        {
                            layer: "Infrastructure Layer",
                            color: "bg-emerald-500",
                            title: t ? "Hạ tầng (Adapters)" : "Infrastructure Adapters",
                            details: t
                                ? "Nơi triển khai các công nghệ cụ thể. Chứa PostgreSQL driver, Gemini API implementation, và xác thực JWT."
                                : "Where specific technologies are implemented. Contains PostgreSQL drivers, Gemini API implementation, and JWT authentication."
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

            <DocSection title={t ? 'Đồng bộ trạng thái (UI State Sync)' : 'UI State & Real-time Synchronization'}>
                <div className="grid sm:grid-cols-2 gap-4">
                    {[
                        {
                            t: t ? 'Zustand State Store' : 'Zustand State Store',
                            d: t ? 'Quản lý tập trung toàn bộ connections và kết quả truy vấn, đảm bảo UI reactivity cực nhanh.' : 'Centralized management of all connections and query results, ensuring ultra-fast UI reactivity.'
                        },
                        {
                            t: t ? 'Optimistic Updates' : 'Optimistic Updates',
                            d: t ? 'Hiển thị kết quả dự kiến ngay lập tức khi lưu connection, tạo cảm giác app "không có độ trễ".' : 'Immediately displays expected results when saving connections, creating a "zero-latency" feel.'
                        }
                    ].map((item, i) => (
                        <div key={i} className="p-5 border rounded-2xl bg-muted/20">
                            <h5 className="font-bold text-xs mb-2 tracking-tight">{item.t}</h5>
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
