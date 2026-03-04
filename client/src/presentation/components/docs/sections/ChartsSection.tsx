import { Activity, PieChart, Layers, Zap } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, Callout, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ChartsSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Biểu đồ Tương tác' : 'Interactive Charts'}
            subtitle={t
                ? 'Biến kết quả truy vấn thô thành báo cáo trực quan chuyên nghiệp chỉ trong vài giây — với 15+ loại biểu đồ hiện đại.'
                : 'Turn raw query results into professional visual reports in seconds — with 15+ modern chart types.'}
        >
            {/* Chart Types */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { name: t ? 'Biểu đồ Đường' : 'Line Chart', icon: <Activity className="w-5 h-5" />, desc: t ? 'Xu hướng theo thời gian' : 'Time series trends' },
                    { name: t ? 'Biểu đồ Cột' : 'Bar Chart', icon: <PieChart className="w-5 h-5" />, desc: t ? 'So sánh giá trị' : 'Value comparison' },
                    { name: t ? 'Biểu đồ Radar' : 'Radar Chart', icon: <Layers className="w-5 h-5" />, desc: t ? 'Phân tích đa chiều' : 'Multi-dimensional' },
                    { name: t ? 'Phễu dữ liệu' : 'Data Funnel', icon: <Zap className="w-5 h-5" />, desc: t ? 'Quy trình chuyển đổi' : 'Conversion pipeline' },
                ].map((c, i) => (
                    <div key={i} className="flex flex-col items-center justify-center p-6 border rounded-3xl bg-card hover:bg-primary/10 hover:border-primary transition-all group">
                        <div className="mb-3 text-primary group-hover:scale-125 transition-transform">{c.icon}</div>
                        <span className="text-[10px] font-extrabold uppercase text-center block leading-tight">{c.name}</span>
                        <span className="text-[9px] text-muted-foreground mt-1">{c.desc}</span>
                    </div>
                ))}
            </div>

            {/* How to Create Charts */}
            <DocSection title={t ? 'Cách tạo biểu đồ' : 'How to Create Charts'}>
                <Prose>{t
                    ? 'Sau khi chạy truy vấn SQL và nhận kết quả trong Result Grid, bạn có thể chuyển đổi dữ liệu thành biểu đồ theo các bước sau:'
                    : 'After running a SQL query and receiving results in the Result Grid, you can convert data into charts with these steps:'}</Prose>
                <div className="space-y-3">
                    {[
                        { step: '1', desc: t ? 'Chạy truy vấn SQL có dữ liệu phù hợp cho biểu đồ (ít nhất 1 cột số và 1 cột category/thời gian).' : 'Run a SQL query with chart-suitable data (at least 1 numeric column and 1 category/time column).' },
                        { step: '2', desc: t ? 'Click vào tab "Visualize" (biểu tượng biểu đồ) phía trên Result Grid hoặc điều hướng tới trang /app/visualize.' : 'Click the "Visualize" tab (chart icon) above the Result Grid or navigate to /app/visualize.' },
                        { step: '3', desc: t ? 'Chọn loại biểu đồ từ danh sách (Line, Bar, Pie, Area, Scatter, Radar, Funnel, etc.).' : 'Select a chart type from the list (Line, Bar, Pie, Area, Scatter, Radar, Funnel, etc.).' },
                        { step: '4', desc: t ? 'Cấu hình trục X (Axis X) và trục Y (Axis Y) bằng cách kéo thả tên cột vào các vùng tương ứng.' : 'Configure X-axis and Y-axis by dragging column names into the corresponding areas.' },
                        { step: '5', desc: t ? 'Tùy chỉnh màu sắc, chú giải (legend), và các thông số khác. Biểu đồ cập nhật real-time khi bạn thay đổi.' : 'Customize colors, legend, and other parameters. The chart updates in real-time as you make changes.' },
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 items-start p-4 border rounded-xl bg-muted/20">
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">{item.step}</div>
                            <p className="text-sm text-muted-foreground leading-relaxed pt-1">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* SQL Examples for Charts */}
            <DocSection title={t ? 'SQL mẫu cho biểu đồ' : 'Sample SQL for Charts'}>
                <Prose>{t
                    ? 'Dưới đây là các truy vấn mẫu tạo ra dữ liệu phù hợp cho từng loại biểu đồ:'
                    : 'Below are sample queries that produce data suitable for each chart type:'}</Prose>
                <div className="space-y-4">
                    <CodeBlock title={t ? 'Line Chart — Doanh thu theo tháng' : 'Line Chart — Revenue by Month'}>
                        <CodeLine>{'SELECT'}</CodeLine>
                        <CodeLine>{"  DATE_TRUNC('month', created_at) AS month,"}</CodeLine>
                        <CodeLine>{'  SUM(total_amount) AS revenue'}</CodeLine>
                        <CodeLine>{'FROM orders'}</CodeLine>
                        <CodeLine>{"WHERE status = 'completed'"}</CodeLine>
                        <CodeLine>{'GROUP BY 1'}</CodeLine>
                        <CodeLine>{'ORDER BY 1;'}</CodeLine>
                    </CodeBlock>
                    <CodeBlock title={t ? 'Pie Chart — Phân bổ theo danh mục' : 'Pie Chart — Distribution by Category'}>
                        <CodeLine>{'SELECT'}</CodeLine>
                        <CodeLine>{'  category,'}</CodeLine>
                        <CodeLine>{'  COUNT(*) AS product_count'}</CodeLine>
                        <CodeLine>{'FROM products'}</CodeLine>
                        <CodeLine>{'GROUP BY category'}</CodeLine>
                        <CodeLine>{'ORDER BY product_count DESC;'}</CodeLine>
                    </CodeBlock>
                    <CodeBlock title={t ? 'Bar Chart — Top 10 khách hàng' : 'Bar Chart — Top 10 Customers'}>
                        <CodeLine>{'SELECT'}</CodeLine>
                        <CodeLine>{'  u.name,'}</CodeLine>
                        <CodeLine>{'  SUM(o.total_amount) AS total_spent'}</CodeLine>
                        <CodeLine>{'FROM users u'}</CodeLine>
                        <CodeLine>{'JOIN orders o ON u.id = o.user_id'}</CodeLine>
                        <CodeLine>{'GROUP BY u.name'}</CodeLine>
                        <CodeLine>{'ORDER BY total_spent DESC'}</CodeLine>
                        <CodeLine>{'LIMIT 10;'}</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            {/* Customization */}
            <section className="space-y-6 p-10 border rounded-[40px] bg-slate-950 text-slate-50 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
                <div className="relative space-y-4">
                    <h4 className="font-bold text-2xl">{t ? 'Cá nhân hóa Giao diện' : 'UI Personalization'}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-xl">{t
                        ? 'Mọi biểu đồ đều hỗ trợ tùy chỉnh sâu: vị trí trục tọa độ, chú giải (legend), bảng màu tùy chỉnh, và kế thừa màu sắc từ theme chính của ứng dụng (tự động thay đổi giữa Light và Dark mode). Bạn có thể xuất biểu đồ dưới dạng hình ảnh PNG/SVG chất lượng cao để đính kèm vào báo cáo hoặc trình bày.'
                        : 'All charts support deep customization: axis positioning, legend placement, custom color palettes, and color inheritance from the main app theme (auto-switches between Light and Dark mode). You can export charts as high-quality PNG/SVG images for attaching to reports or presentations.'}</p>
                    <ul className="text-sm text-slate-400 space-y-2 list-disc pl-5">
                        <li>{t ? 'Tùy chỉnh title, subtitle và tooltip cho biểu đồ' : 'Custom title, subtitle, and tooltips for charts'}</li>
                        <li>{t ? 'Chọn giữa 6 bảng màu preset hoặc tạo bảng màu riêng' : 'Choose from 6 preset color palettes or create custom ones'}</li>
                        <li>{t ? 'Bật/tắt grid lines, data labels, và animation' : 'Toggle grid lines, data labels, and animations'}</li>
                        <li>{t ? 'Responsive layout — biểu đồ tự co giãn theo kích thước container' : 'Responsive layout — charts auto-resize to container dimensions'}</li>
                    </ul>
                </div>
            </section>
        </DocPageLayout>
    );
}
