import { BarChart3, LineChart, PieChart, LayoutDashboard, Save, MousePointerClick } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, Callout, CodeBlock, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ChartsSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Biểu đồ, Dashboard & Insights' : 'Charts, Dashboards & Insights'}
            subtitle={t
                ? 'Cách Data Explorer biến query result thành widget có thể lưu lại, gom vào dashboard, và mở lại như một tab làm việc riêng.'
                : 'How Data Explorer turns query results into saved widgets, groups them into dashboards, and reopens them as first-class working tabs.'}
        >
            <FeatureGrid>
                <InfoCard icon={<BarChart3 className="w-6 h-6 text-blue-500" />} title={t ? 'Biểu đồ từ query result' : 'Charts from query results'} color="blue">
                    <p>
                        {t
                            ? 'Sau khi query trả kết quả, bạn có thể lưu snapshot hiện tại thành widget thay vì chỉ xem một lần rồi mất.'
                            : 'Once a query returns data, you can save the current snapshot as a widget instead of treating it as a one-off result.'}
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

            <DocSection title={t ? 'Luồng làm việc chuẩn' : 'Recommended workflow'}>
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
                        t ? 'Widget hiện lưu dữ liệu snapshot, chưa phải scheduled live-refresh reporting.' : 'Widgets currently save a data snapshot, not a scheduled live-refresh reporting pipeline.',
                        t ? 'Dashboard phù hợp nhất cho phân tích nhanh, review nội bộ, và query-driven exploration.' : 'Dashboards are currently best suited for quick analysis, internal review, and query-driven exploration.',
                        t ? 'Các bước như share dashboard công khai, scheduled reports, hoặc embedded analytics vẫn là bước phát triển tiếp theo.' : 'Public dashboard sharing, scheduled reports, and embedded analytics are still future roadmap items.'
                    ].map((item) => (
                        <li key={item} className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
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
