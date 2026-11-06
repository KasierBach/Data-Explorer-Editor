import React from 'react';
import { ArrowRight, BarChart3, GitGraph, Terminal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { LandingScreenshot } from './LandingScreenshot';
import { publicPath } from '@/core/seo/publicRoutes';

interface WorkflowSectionProps {
    lang: string;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({ lang }) => {
    const images = getWorkspaceText(lang).landingImages;
    const rows = lang === 'vi'
        ? [
            {
                id: 'query', label: 'Query', hint: 'Soạn, chạy và lưu câu lệnh',
                title: 'Từ ý tưởng tới một query rõ ràng',
                description: 'Soạn SQL trong Monaco, xem gợi ý schema và chia script thành các bước. Chọn lúc chạy, xem lại lịch sử và lưu query để quay lại mà không phải bắt đầu từ đầu.',
                link: 'Xem hướng dẫn query', image: '/images/landing/query.webp', alt: images.queryEditor, icon: Terminal,
            },
            {
                id: 'schema', label: 'Schema-ERD', hint: 'Hiểu cấu trúc và quan hệ',
                title: 'Nhìn được các bảng kết nối với nhau',
                description: 'Đi từ cây schema tới sơ đồ quan hệ. Chọn bảng cần xem, kéo bố cục và lưu ERD workspace; hình bên dưới là giao diện thật, không phải sơ đồ minh họa.',
                link: 'Xem hướng dẫn ERD', image: '/images/landing/schema-erd.webp', alt: images.schemaErd, icon: GitGraph,
            },
            {
                id: 'results', label: 'Kết quả', hint: 'Đọc dữ liệu, không đổi công cụ',
                title: 'Đưa kết quả vào đúng ngữ cảnh',
                description: 'Đọc các dòng trả về trên grid có phân trang, xem số lượng và thời gian thực thi. Dùng kết quả để xuất dữ liệu hoặc mở công cụ trực quan hóa khi cần.',
                link: 'Xem hướng dẫn kết quả', image: '/images/landing/results.webp', alt: images.resultsGrid, icon: BarChart3,
            },
        ]
        : [
            {
                id: 'query', label: 'Query', hint: 'Write, run, and save statements',
                title: 'Turn an idea into a clear query',
                description: 'Write SQL in Monaco, inspect schema suggestions, and organize a script into steps. Decide when to run it, review history, and save your query without starting from scratch.',
                link: 'Read the query guide', image: '/images/landing/query.webp', alt: images.queryEditor, icon: Terminal,
            },
            {
                id: 'schema', label: 'Schema-ERD', hint: 'Explore structure and relations',
                title: 'See how your tables connect',
                description: 'Move from the schema tree to a relationship diagram. Select the tables that matter, arrange the layout, and save the ERD workspace. The capture below shows the actual interface.',
                link: 'Read the ERD guide', image: '/images/landing/schema-erd.webp', alt: images.schemaErd, icon: GitGraph,
            },
            {
                id: 'results', label: 'Results', hint: 'Read data without switching tools',
                title: 'Put your results in context',
                description: 'Inspect returned rows in a paginated grid alongside counts and execution timing. Export the data or open visualization tools when the result needs another perspective.',
                link: 'Read the results guide', image: '/images/landing/results.webp', alt: images.resultsGrid, icon: BarChart3,
            },
        ];

    return (
        <section id="workflows" className="lp-section">
            <div className="lp-container">
                <div className="lp-section-heading">
                    <span className="lp-eyebrow">{lang === 'vi' ? 'Một workspace, ba cách khám phá' : 'One workspace, three ways to explore'}</span>
                    <h2 className="lp-h2 mt-4">{lang === 'vi' ? 'Viết. Khám phá. Đọc kết quả.' : 'Write. Explore. Read the results.'}</h2>
                    <p className="lp-body mt-4">{lang === 'vi' ? 'Chọn một công việc để xem đúng giao diện của nó.' : 'Choose a workflow to see its actual interface.'}</p>
                </div>
                <Tabs defaultValue="query">
                    <TabsList className="lp-showcase-tabs" aria-label={lang === 'vi' ? 'Các công việc dữ liệu' : 'Data workflows'}>
                        {rows.map(row => (
                            <TabsTrigger key={row.id} value={row.id} className="lp-showcase-trigger">
                                <span className="lp-showcase-icon"><row.icon className="h-5 w-5" aria-hidden="true" /></span>
                                <span><strong>{row.label}</strong><small>{row.hint}</small></span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {rows.map(row => (
                        <TabsContent key={row.id} value={row.id} className="lp-tabpanel m-0">
                            <div className="lp-showcase-layout">
                                <div className="lp-showcase-copy">
                                    <span className="lp-kicker">{row.label}</span>
                                    <h3>{row.title}</h3>
                                    <p className="lp-body">{row.description}</p>
                                    <a href={publicPath(lang === 'en' ? 'en' : 'vi', `/docs/${row.id === 'query' ? 'editor' : row.id === 'schema' ? 'erd' : 'results'}`)} className="lp-inline-link">{row.link}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
                                </div>
                                <LandingScreenshot src={row.image} alt={row.alt} lang={lang} />
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </section>
    );
};
