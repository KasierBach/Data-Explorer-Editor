import { BarChart3, LineChart, PieChart, TrendingUp, Palette, Share2, MousePointerClick } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeLine, InfoCard, FeatureGrid, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ChartsSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Biểu đồ Tương tác & Phân tích' : 'Interactive Charts & Analytics'}
            subtitle={t
                ? 'Biến dữ liệu thô thành cái nhìn sâu sắc (insights) thông qua hệ thống biểu đồ hiện đại, hỗ trợ kéo thả và tùy chỉnh chuyên sâu.'
                : 'Turn raw data into actionable insights through modern charting systems, supporting drag-and-drop and deep customization.'}
        >
            <Callout type="tip">
                <p className="font-bold">{t ? '📊 Phân tích đa chiều với Recharts' : '📊 Multi-dimensional Analysis with Recharts'}</p>
                <p className="mt-1 text-muted-foreground">
                    {t
                        ? 'Engine biểu đồ của chúng tôi được xây dựng trên Recharts, tối ưu hóa cho hiệu năng render SVG và khả năng đáp ứng (responsiveness) trên mọi thiết bị.'
                        : 'Our chart engine is built on Recharts, optimized for SVG rendering performance and cross-device responsiveness.'}
                </p>
            </Callout>

            {/* Comprehensive Chart Library */}
            <DocSection title={t ? 'Thư viện Biểu đồ đa dạng' : 'Comprehensive Chart Library'}>
                <FeatureGrid>
                    <InfoCard icon={<TrendingUp className="w-6 h-6 text-blue-500" />} title={t ? 'Biểu đồ Chuỗi thời gian' : 'Time-series Charts'} color="blue">
                        <p>{t ? 'Phân tích xu hướng (Line/Area) theo thời gian. Tự động xử lý các khoảng trống dữ liệu (null values) và hỗ trợ zoom vào các khoảng thời gian cụ thể.' : 'Analyze trends (Line/Area) over time. Automatically handles data gaps (null values) and supports zooming into specific periods.'}</p>
                    </InfoCard>
                    <InfoCard icon={<BarChart3 className="w-6 h-6 text-emerald-500" />} title={t ? 'Phân tích Xếp hạng' : 'Ranking Analysis'} color="emerald">
                        <p>{t ? 'Sử dụng Bar/Column Chart để so sánh hiệu suất giữa các thực thể. Hỗ trợ Stacked Bar cho phân tích cơ cấu đa cấp.' : 'Use Bar/Column Charts to compare entity performance. Supports Stacked Bar for multi-level structure analysis.'}</p>
                    </InfoCard>
                </FeatureGrid>
            </DocSection>

            {/* Data Storytelling Section */}
            <DocSection title={t ? 'Nghệ thuật kể chuyện bằng Dữ liệu' : 'The Art of Data Storytelling'}>
                <Prose>
                    {t
                        ? 'Việc chọn đúng loại biểu đồ là chìa khóa để truyền tải thông điệp. Data Explorer gợi ý bạn:'
                        : 'Choosing the right chart type is key to delivering your message. Data Explorer suggests:'}
                </Prose>
                <div className="grid md:grid-cols-3 gap-4 mt-6">
                    <div className="p-6 border rounded-3xl bg-muted/5 border-dashed space-y-3">
                        <div className="font-bold text-sm text-primary flex items-center gap-2 underline decoration-primary/30 underline-offset-4"><LineChart className="w-4 h-4" /> {t ? 'Sự thay đổi' : 'Changes'}</div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Dùng Line Chart cho biến động giá, doanh thu theo ngày/tháng.' : 'Use Line Charts for price fluctuations, daily/monthly revenue.'}</p>
                    </div>
                    <div className="p-6 border rounded-3xl bg-muted/5 border-dashed space-y-3">
                        <div className="font-bold text-sm text-primary flex items-center gap-2 underline decoration-primary/30 underline-offset-4"><PieChart className="w-4 h-4" /> {t ? 'Thành phần' : 'Composition'}</div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Dùng Pie/Donut cho phân bổ thị phần hoặc cơ cấu chi phí.' : 'Use Pie/Donut for market share distribution or cost structure.'}</p>
                    </div>
                    <div className="p-6 border rounded-3xl bg-muted/5 border-dashed space-y-3">
                        <div className="font-bold text-sm text-primary flex items-center gap-2 underline decoration-primary/30 underline-offset-4"><BarChart3 className="w-4 h-4" /> {t ? 'Tương quan' : 'Correlation'}</div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Dùng Scatter Plot để tìm mối liên hệ giữa hai biến số lượng.' : 'Use Scatter Plots to find relationships between two quantitative variables.'}</p>
                    </div>
                </div>
            </DocSection>

            {/* Advanced Configuration */}
            <DocSection title={t ? 'Cấu hình & Tùy chỉnh Cao cấp' : 'Advanced Configuration'}>
                <div className="space-y-6">
                    <div className="flex gap-4 p-6 border rounded-3xl bg-card group hover:border-primary/50 transition-colors">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                            <Palette className="w-6 h-6" />
                        </div>
                        <div>
                            <h5 className="font-bold mb-1">{t ? 'Hệ thống Theme Động' : 'Dynamic Theme System'}</h5>
                            <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Biểu đồ tự động kế thừa Palette màu từ Brand của bạn. Hỗ trợ hoàn hảo Dark/Light Mode với độ tương phản cao, đảm bảo khả năng đọc (readability) tốt nhất.' : 'Charts automatically inherit color palettes from your Brand. Perfect Dark/Light Mode support with high contrast, ensuring the best readability.'}</p>
                        </div>
                    </div>
                    <div className="flex gap-4 p-6 border rounded-3xl bg-card group hover:border-indigo-500/50 transition-colors">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-indigo-foreground transition-all">
                            <MousePointerClick className="w-6 h-6" />
                        </div>
                        <div>
                            <h5 className="font-bold mb-1">{t ? 'Tương tác Zoom & Pan' : 'Interactive Zoom & Pan'}</h5>
                            <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Kéo chuột để chọn vùng dữ liệu cần zoom sâu (Brush Tool). Giúp bạn soi xét các biến động nhỏ trong tập dữ liệu khổng lồ hàng nghìn points.' : 'Drag to select a data area for deep zooming (Brush Tool). Helps you examine small fluctuations in massive datasets of thousands of points.'}</p>
                        </div>
                    </div>
                </div>
            </DocSection>

            {/* SQL for Visual Thinking */}
            <DocSection title={t ? 'SQL cho Tư duy Trực quan' : 'SQL for Visual Thinking'}>
                <CodeBlock title="Complex Time-series Analysis">
                    <CodeLine>{t ? '-- Phân tích Cumulative Revenue (Doanh thu cộng dồn)' : '-- Cumulative Revenue Analysis'}</CodeLine>
                    <CodeLine>SELECT</CodeLine>
                    <CodeLine>  day,</CodeLine>
                    <CodeLine>  SUM(daily_sales) OVER (ORDER BY day) as cumulative_revenue</CodeLine>
                    <CodeLine>FROM (</CodeLine>
                    <CodeLine>  SELECT DATE_TRUNC(\'day\', created_at) as day, SUM(amount) as daily_sales</CodeLine>
                    <CodeLine>  FROM orders GROUP BY 1</CodeLine>
                    <CodeLine>) subquery;</CodeLine>
                </CodeBlock>
                <div className="mt-4 flex items-center gap-2 p-4 bg-muted/20 border border-dashed rounded-2xl text-[10px] text-muted-foreground">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{t ? 'Mẹo: Sử dụng Window Functions (OVER) để tạo ra các đường biểu diễn xu hướng mượt mà hơn.' : 'Tip: Use Window Functions (OVER) to create smoother trend lines.'}</span>
                </div>
            </DocSection>

            {/* Export & Sharing */}
            <DocSection title={t ? 'Chia sẻ & Xuất bản' : 'Export & Sharing'}>
                <div className="p-10 border rounded-[40px] bg-slate-950 text-slate-50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full" />
                    <div className="relative flex flex-col md:flex-row items-center gap-8">
                        <div className="flex-1 space-y-4">
                            <h4 className="text-2xl font-bold">{t ? 'Sẵn sàng cho Báo cáo' : 'Ready for Reporting'}</h4>
                            <p className="text-sm text-slate-400 leading-relaxed">{t
                                ? 'Mọi biểu đồ có thể được xuất ra định dạng PNG/SVG chất lượng cao hoặc PDF. Bạn cũng có thể copy mã cấu hình JSON để tái hiện biểu đồ ở bất kỳ dashboard nào khác.'
                                : 'All charts can be exported to high-quality PNG/SVG formats or PDF. You can also copy the JSON configuration to reproduce the chart in any other dashboard.'}</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-xs">PDF</div>
                            <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-xs">SVG</div>
                            <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-xs">JSON</div>
                        </div>
                    </div>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
