import { BarChart3, LineChart, PieChart, LayoutDashboard, Save, MousePointerClick } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, Callout, CodeBlock, CodeLine } from '../primitives';
import { publicPath } from '@/core/seo/publicRoutes';

interface Props { lang: 'vi' | 'en'; }

export function ChartsSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Chart Studio, Dashboard & Insights' : 'Chart Studio, Dashboards & Insights'}
            subtitle={t
                ? 'Phân biệt Chart Studio tương tác với 12 preset và dashboard lưu snapshot với 6 loại widget; chọn nguồn dữ liệu, cấu hình trục, xuất và mở lại đúng luồng.'
                : 'Distinguish the interactive 12-preset Chart Studio from saved dashboards with 6 snapshot widget types; choose data, configure axes, export, and reopen the appropriate workflow.'}
        >
            <FeatureGrid>
                <InfoCard icon={<BarChart3 className="w-6 h-6 text-blue-500" />} title={t ? 'Chart Studio: 12 preset' : 'Chart Studio: 12 presets'} color="blue">
                    <p>
                        {t
                            ? 'Chọn bảng hoặc SQL tùy chỉnh, chạy lấy dữ liệu rồi cấu hình biểu đồ trong Chart Studio. Luồng này có nhiều preset và tùy chọn hơn dialog lưu widget dashboard.'
                            : 'Choose a table or custom SQL, fetch data, then configure a chart in Chart Studio. This flow has more presets and controls than the dashboard widget-save dialog.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<LayoutDashboard className="w-6 h-6 text-emerald-500" />} title={t ? 'Dashboard tabs' : 'Dashboard tabs'} color="emerald">
                    <p>
                        {t
                            ? 'Dashboard đã lưu có thể mở như một tab riêng trong workspace, không còn là panel đọc tạm.'
                            : 'Saved dashboards can be opened as dedicated workspace tabs instead of staying as temporary summary panels.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Save className="w-6 h-6 text-amber-500" />} title={t ? 'Snapshot-based widgets' : 'Snapshot-based widgets'} color="amber">
                    <p>
                        {t
                            ? 'Widget hiện lưu snapshot từ kết quả query để bạn xem nhanh lại, phù hợp cho reporting nhẹ và phân tích ngắn hạn.'
                            : 'Widgets currently store a result snapshot for fast revisit, which works well for lightweight reporting and short-term analysis.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Chart Studio: nguồn, preset và điều khiển' : 'Chart Studio: sources, presets, and controls'}>
                <Prose>
                    {t
                        ? 'Mở Chart Studio/Visualization trên connection hiện tại, chọn database và nguồn Table hoặc Custom SQL rồi chạy lấy dữ liệu. Table mode mặc định lấy 200 dòng và có limit/sort; SQL tùy chỉnh phải có cú pháp phù hợp engine. Đổi cấu hình biểu đồ không tự tạo dashboard hay lịch refresh dữ liệu.'
                        : 'Open Chart Studio/Visualization for the current connection, choose a database and Table or Custom SQL input, then fetch data. Table mode defaults to 200 rows with limit/sort controls; custom SQL must match the engine. Changing chart settings does not create a dashboard or a data-refresh schedule.'}
                </Prose>
                <div className="grid md:grid-cols-3 gap-4">
                    {[
                        {
                            title: t ? '12 preset biểu đồ' : '12 chart presets',
                            desc: t
                                ? 'Bar, Stacked Bar, Horizontal Bar, Line, Area, Composed, Pie, Donut, Scatter, Radar, Treemap và Funnel. Chọn X và một hoặc nhiều cột Y phù hợp; preset không tự tổng hợp toàn bộ database.'
                                : 'Bar, Stacked Bar, Horizontal Bar, Line, Area, Composed, Pie, Donut, Scatter, Radar, Treemap, and Funnel. Choose X and suitable Y column(s); a preset does not automatically aggregate the entire database.',
                        },
                        {
                            title: t ? 'Tùy chọn hiển thị' : 'Display controls',
                            desc: t
                                ? 'Có tiêu đề, 5 palette, kiểu đường monotone/linear/step/basis/natural và bật/tắt grid, legend, data labels, animation hoặc brush zoom. Hiệu lực tùy loại biểu đồ; không có nút kéo-thả bố cục hay Share trong flow này.'
                                : 'Controls include a title, 5 palettes, monotone/linear/step/basis/natural curves, and grid, legend, data labels, animation, or brush-zoom toggles. Applicability depends on chart type; this flow has no drag-layout or Share button.',
                        },
                        {
                            title: t ? 'Xuất PNG và CSV' : 'PNG and CSV export',
                            desc: t
                                ? 'PNG xuất hình biểu đồ; CSV xuất chartData hiện tại đã giới hạn dòng, không phải toàn bộ bảng. State hiển thị được giữ theo connection trong client; lưu widget dashboard là luồng khác từ results panel.'
                                : 'PNG exports the chart picture; CSV exports the current row-capped chartData, not the whole table. Display state is kept per connection on the client; saving a dashboard widget is a separate results-panel flow.',
                        },
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border bg-card/40 p-5">
                            <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
                <Callout type="warning">
                    <p className="text-sm">
                        {t
                            ? 'Chart Studio chỉ giữ tối đa 2.000 dòng đầu cho chartData. Khi trên 300 dòng, Line/Area/Scatter/Composed dùng mẫu mỗi ceil(N/150) dòng và luôn giữ dòng cuối (khoảng 150 điểm, tối đa 151); loại khác dùng chartData đã cap. Downsampling bỏ điểm chứ không cộng/nhóm hay bảo toàn mọi cực trị. Hãy GROUP BY, lọc và ORDER BY trong query trước nếu cần biểu đồ đại diện.'
                            : 'Chart Studio keeps only the first 2,000 rows as chartData. Above 300 rows, Line/Area/Scatter/Composed sample every ceil(N/150) rows and keep the last row (roughly 150 points, at most 151); other types use the capped chartData. Downsampling omits points rather than aggregating or preserving every extreme. GROUP BY, filter, and ORDER BY in the query first when a representative chart matters.'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Lưu widget vào dashboard' : 'Save a widget to a dashboard'}>
                <div className="grid md:grid-cols-4 gap-4 mt-2">
                    {[
                        {
                            step: '01',
                            titleVi: 'Chạy query',
                            titleEn: 'Run a query',
                            descVi: 'Bắt đầu từ SQL editor và lấy về result set có nghĩa.',
                            descEn: 'Start in the SQL editor and produce a meaningful result set.'
                        },
                        {
                            step: '02',
                            titleVi: 'Mở save dialog',
                            titleEn: 'Open the save dialog',
                            descVi: 'Từ results panel, chọn lưu vào dashboard.',
                            descEn: 'From the results panel, choose to save into a dashboard.'
                        },
                        {
                            step: '03',
                            titleVi: 'Chọn chart + axes',
                            titleEn: 'Pick chart + axes',
                            descVi: 'Chọn bar, line, pie, donut, area hoặc table tuỳ dữ liệu.',
                            descEn: 'Pick bar, line, pie, donut, area, or table depending on the data.'
                        },
                        {
                            step: '04',
                            titleVi: 'Mở dashboard tab',
                            titleEn: 'Open the dashboard tab',
                            descVi: 'Widget mới sẽ xuất hiện trong dashboard vừa tạo hoặc dashboard đã chọn.',
                            descEn: 'The new widget appears in the dashboard you just created or selected.'
                        }
                    ].map((item) => (
                        <div key={item.step} className="rounded-2xl border bg-card/40 p-5">
                            <div className="text-[10px] font-black uppercase tracking-widest text-primary">{item.step}</div>
                            <div className="mt-3 text-sm font-bold">{t ? item.titleVi : item.titleEn}</div>
                            <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{t ? item.descVi : item.descEn}</div>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Các chart phù hợp nhất' : 'Best-fit chart types'}>
                <div className="grid md:grid-cols-3 gap-4">
                    <InfoCard icon={<BarChart3 className="w-5 h-5 text-blue-500" />} title="Bar / Column" color="blue">
                        <p className="text-xs">
                            {t
                                ? 'Dùng cho ranking, top lists, hoặc so sánh category theo một metric chính.'
                                : 'Best for rankings, top lists, or comparing categories by one primary metric.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<LineChart className="w-5 h-5 text-emerald-500" />} title="Line / Area" color="emerald">
                        <p className="text-xs">
                            {t
                                ? 'Dùng cho time series, xu hướng, hoặc metric thay đổi theo ngày/tháng.'
                                : 'Best for time series, trend analysis, or metrics that change over days or months.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<PieChart className="w-5 h-5 text-fuchsia-500" />} title="Pie / Donut" color="purple">
                        <p className="text-xs">
                            {t
                                ? 'Dùng khi số nhóm ít và mục tiêu là nhìn tỷ trọng, không phải so sánh chi li từng cột.'
                                : 'Use when the number of groups is small and the goal is composition, not precise category-by-category comparison.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'AI và dashboard làm việc với nhau thế nào' : 'How AI and dashboards work together'}>
                <Prose>
                    {t
                        ? 'AI recommendation cards có thể gợi ý chart type và fields phù hợp hơn cho result set của bạn. Sau đó bạn vẫn là người quyết định lưu widget nào vào dashboard.'
                        : 'AI recommendation cards can suggest a better chart type and field mapping for your result set. You still stay in control of which widget actually gets saved into a dashboard.'}
                </Prose>
                <Callout type="tip">
                    <p className="text-sm">
                        {t
                            ? 'Prompt thử nhanh: "Suggest the best chart for this result set and explain which fields should be on each axis."'
                            : 'Quick prompt: "Suggest the best chart for this result set and explain which fields should be on each axis."'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Giới hạn hiện tại' : 'Current limitations'}>
                <ul className="grid gap-3">
                    {[
                        t ? 'Dashboard chỉ có 6 loại widget: bar, line, pie, donut, area và table; không phải toàn bộ 12 preset của Chart Studio.' : 'Dashboards have 6 widget types: bar, line, pie, donut, area, and table; they do not include all 12 Chart Studio presets.',
                        t ? 'Mỗi widget lưu tối đa 200 dòng snapshot và payload snapshot tối đa 512 KB. Một snapshot nhỏ không đại diện toàn bộ result set lớn.' : 'Each widget stores up to 200 snapshot rows with a 512 KB maximum snapshot payload. A small snapshot does not represent the entire large result set.',
                        t ? 'Refresh dashboard chỉ tải lại bản lưu từ server, không chạy lại SQL và không có scheduled refresh. Muốn dữ liệu mới, chạy lại query và lưu snapshot mới; không có nút Share công khai hoặc kéo-thả bố cục trong view này.' : 'Dashboard Refresh reloads stored server data; it does not rerun SQL and there is no scheduled refresh. For newer data, rerun the query and save a new snapshot; this view has no public Share button or drag-layout control.'
                    ].map((item) => (
                        <li key={item} className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
                <Prose>
                    <a href={publicPath(lang, '/docs/operational-limits')}>
                        {t ? 'Xem giới hạn dữ liệu và vận hành' : 'See data and operational limits'}
                    </a>
                    {' · '}
                    <a href={publicPath(lang, '/docs/data-handling')}>
                        {t ? 'Đọc về snapshot và lưu trữ dữ liệu' : 'Read about snapshots and data retention'}
                    </a>
                </Prose>
            </DocSection>

            <DocSection title={t ? 'Ví dụ query phù hợp để lưu thành widget' : 'A query example worth saving as a widget'}>
                <CodeBlock title={t ? 'Top categories by revenue' : 'Top categories by revenue'}>
                    <CodeLine>SELECT category_name, SUM(revenue) AS total_revenue</CodeLine>
                    <CodeLine>FROM sales_summary</CodeLine>
                    <CodeLine>GROUP BY category_name</CodeLine>
                    <CodeLine>ORDER BY total_revenue DESC</CodeLine>
                    <CodeLine>LIMIT 10;</CodeLine>
                </CodeBlock>
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
                    <MousePointerClick className="h-4 w-4" />
                    <span>
                        {t
                            ? 'Query kiểu này rất hợp để lưu thành bar chart widget vì có một chiều category rõ ràng và một metric numeric đơn.'
                            : 'This kind of query is ideal for a bar-chart widget because it has one clear category dimension and one numeric metric.'}
                    </span>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
