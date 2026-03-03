import React from 'react';
import { cn } from '@/lib/utils';
import {
    ChevronRight,
    Terminal,
    Database,
    Code,
    Layers,
    BookOpen,
    Activity,
    Settings,
    HelpCircle
} from 'lucide-react';

export interface DocItem {
    id: string;
    title: string;
}

export interface DocSection {
    id: string;
    title: string;
    icon?: React.ReactNode;
    items?: DocItem[];
}

export const DOCS_STRUCTURE: DocSection[] = [
    {
        id: 'getting-started',
        title: 'Bắt đầu',
        icon: <Terminal className="w-4 h-4" />,
        items: [
            { id: 'introduction', title: 'Giới thiệu' },
            { id: 'installation', title: 'Cài đặt' },
            { id: 'prerequisites', title: 'Điều kiện tiên quyết' },
        ]
    },
    {
        id: 'connections',
        title: 'Kết nối',
        icon: <Database className="w-4 h-4" />,
        items: [
            { id: 'postgres', title: 'PostgreSQL' },
            { id: 'mysql', title: 'MySQL' },
            { id: 'mssql', title: 'SQL Server' },
            { id: 'clickhouse', title: 'ClickHouse' },
        ]
    },
    {
        id: 'sql-workspace',
        title: 'Không gian SQL',
        icon: <Code className="w-4 h-4" />,
        items: [
            { id: 'editor', title: 'Trình soạn thảo Monaco' },
            { id: 'tabs', title: 'Quản lý Tab' },
            { id: 'results', title: 'Lưới kết quả' },
            { id: 'export', title: 'Xuất dữ liệu' },
        ]
    },
    {
        id: 'ai-assistant',
        title: 'Trí tuệ nhân tạo (AI)',
        icon: <BookOpen className="w-4 h-4" />,
        items: [
            { id: 'sql-generation', title: 'Tạo mã SQL' },
            { id: 'vision', title: 'Thị giác Gemini' },
            { id: 'explain', title: 'Giải thích truy vấn' },
        ]
    },
    {
        id: 'visualization',
        title: 'Trực quan hóa',
        icon: <Layers className="w-4 h-4" />,
        items: [
            { id: 'erd', title: 'Sơ đồ ERD' },
            { id: 'charts', title: 'Biểu đồ tương tác' },
        ]
    },
    {
        id: 'architecture-tech',
        title: 'Kiến trúc & Công nghệ',
        icon: <Activity className="w-4 h-4" />,
        items: [
            { id: 'architecture', title: 'Kiến trúc hệ thống' },
            { id: 'tech-stack', title: 'Danh sách công nghệ' },
            { id: 'security', title: 'Bảo mật & Quyền riêng tư' },
            { id: 'lifecycle', title: 'Quy trình phát triển' },
            { id: 'faq', title: 'FAQ & Khắc phục lỗi' },
        ]
    }
];

interface DocSidebarProps {
    activeId: string;
    onSelect: (id: string) => void;
    className?: string;
}

export function DocSidebar({ activeId, onSelect, className }: DocSidebarProps) {
    return (
        <aside className={cn("w-64 border-r bg-card/30 backdrop-blur-md flex flex-col h-full overflow-hidden", className)}>
            <div className="flex-1 flex flex-col min-h-0">
                <div className="p-6 pb-0">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="bg-primary/10 p-1.5 rounded-lg">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Documentation</span>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar space-y-6">
                    {DOCS_STRUCTURE.map((section) => (
                        <div key={section.id} className="space-y-2">
                            <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                                {section.icon}
                                {section.title}
                            </h4>
                            <div className="space-y-1">
                                {section.items?.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => onSelect(item.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all group",
                                            activeId === item.id
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        )}
                                    >
                                        <span>{item.title}</span>
                                        <ChevronRight className={cn(
                                            "w-3 h-3 transition-transform duration-200",
                                            activeId === item.id ? "rotate-90 opacity-100" : "opacity-0 group-hover:opacity-100"
                                        )} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

            <div className="mt-auto p-4 border-t border-border/50 bg-muted/20">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="w-4 h-4" />
                    <span>Support</span>
                </button>
            </div>
        </aside>
    );
}
