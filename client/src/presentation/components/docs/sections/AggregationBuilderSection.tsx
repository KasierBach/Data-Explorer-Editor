import {
    AlertTriangle,
    Layers,
    Play,
    Save,
    Shuffle,
} from 'lucide-react';
import {
    Callout,
    CodeBlock,
    CodeComment,
    CodeLine,
    DocPageLayout,
    DocSection,
    FeatureGrid,
    InfoCard,
    Prose,
} from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function AggregationBuilderSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Aggregation Builder' : 'Aggregation Builder'}
            subtitle={t
                ? 'Không gian pipeline trực quan dành cho MongoDB: thêm stage, sắp xếp lại, sửa từng bước, xem preview cuối cùng, rồi áp vào editor hoặc chạy ngay.'
                : 'A visual pipeline workspace for MongoDB: add stages, reorder them, edit each step, preview the final payload, then apply it to the editor or run it immediately.'}
            gradient
        >
            <FeatureGrid columns={3}>
                <InfoCard icon={<Layers className="w-6 h-6 text-pink-500" />} title={t ? 'Pipeline gọn theo stage' : 'Stage-based pipeline'} color="purple">
                    <p>
                        {t
                            ? 'Mỗi bước trong pipeline được giữ thành một stage riêng. Điều này giúp bạn nhìn đúng cấu trúc pipeline thay vì sửa cả mảng dài trong một lần.'
                            : 'Each pipeline step stays in its own stage block. That makes the structure easy to reason about instead of editing one long array all at once.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Save className="w-6 h-6 text-blue-500" />} title={t ? 'Apply to Editor' : 'Apply to Editor'} color="blue">
                    <p>
                        {t
                            ? 'Khi pipeline đã ổn, bạn có thể đẩy payload đã assemble về MQL editor. Đây là bước tốt nếu muốn review lại toàn bộ JSON cuối trước khi chạy.'
                            : 'Once the pipeline looks right, you can push the assembled payload back into the MQL editor. This is ideal when you want one last review before execution.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Play className="w-6 h-6 text-emerald-500" />} title={t ? 'Run trực tiếp' : 'Run directly'} color="emerald">
                    <p>
                        {t
                            ? 'Nếu không có validation issue và kết nối được phép thực thi, bạn có thể chạy pipeline trực tiếp từ builder mà không cần vòng qua editor.'
                            : 'If there are no validation issues and the connection allows execution, you can run the pipeline directly from the builder without going back through the editor.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Workflow nên dùng hằng ngày' : 'The recommended daily workflow'}>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            title: t ? '1. Chọn collection trước' : '1. Pick the collection first',
                            desc: t
                                ? 'Builder cần biết collection đích để parse pipeline hiện tại đúng ngữ cảnh và assemble lại payload cuối cùng một cách nhất quán.'
                                : 'The builder needs the destination collection so it can parse the current pipeline in the right context and reassemble the final payload consistently.'
                        },
                        {
                            title: t ? '2. Giữ mỗi stage một ý' : '2. Keep each stage focused',
                            desc: t
                                ? 'Một stage tốt nên làm đúng một việc: lọc (`$match`), reshape (`$project`), nhóm (`$group`), hoặc sắp xếp (`$sort`). Cách làm này giúp debug nhanh hơn rất nhiều.'
                                : 'A good stage should do one thing: filter (`$match`), reshape (`$project`), group (`$group`), or sort (`$sort`). This makes debugging far easier.'
                        },
                        {
                            title: t ? '3. Dùng preview để phát hiện vấn đề sớm' : '3. Use the preview to catch issues early',
                            desc: t
                                ? 'Builder luôn tạo ra serialized payload cuối cùng. Nếu preview nhìn không giống ý định của bạn, sửa stage ngay ở đây sẽ nhanh hơn sửa sau khi chạy fail.'
                                : 'The builder always produces the final serialized payload. If the preview does not match your intent, fixing the stage here is much cheaper than chasing a failed run later.'
                        },
                        {
                            title: t ? '4. Chạy khi đã sạch issue' : '4. Run only after the issues are clean',
                            desc: t
                                ? 'Các issue như stage rỗng hoặc payload không hợp lệ không chỉ là cảnh báo hình thức. Chúng là dấu hiệu cho thấy pipeline của bạn còn chưa đủ để chạy tin cậy.'
                                : 'Issues such as empty stage bodies or invalid payloads are not cosmetic warnings. They are signals that the pipeline is not reliable enough to run yet.'
                        }
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                            <h3 className="text-sm font-bold">{item.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Builder giúp bạn tránh lỗi kiểu gì?' : 'How the builder helps you avoid mistakes'}>
                <div className="grid gap-4 md:grid-cols-3">
                    <InfoCard icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} title={t ? 'Stage rỗng' : 'Empty stages'} color="amber">
                        <p className="text-xs">
                            {t
                                ? 'Một `$match` hoặc `$group` rỗng không nên âm thầm lọt vào payload cuối. Builder đánh dấu chúng để bạn biết bước nào còn chưa hoàn chỉnh.'
                                : 'An empty `$match` or `$group` should not silently slide into the final payload. The builder marks those stages so you can fix the incomplete step.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Shuffle className="w-5 h-5 text-blue-500" />} title={t ? 'Đổi vị trí stage an toàn hơn' : 'Safer reordering'} color="blue">
                        <p className="text-xs">
                            {t
                                ? 'Thay vì cắt dán JSON dài, bạn di chuyển stage lên xuống bằng thao tác riêng. Điều này giảm nguy cơ hỏng ngoặc, mất dấu phẩy, hoặc đặt stage sai thứ tự.'
                                : 'Instead of cutting and pasting long JSON, you move stages with explicit controls. That cuts the risk of broken braces, missing commas, or bad stage ordering.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Layers className="w-5 h-5 text-pink-500" />} title={t ? 'Preview thống nhất' : 'Consistent preview'} color="purple">
                        <p className="text-xs">
                            {t
                                ? 'Preview là nơi builder chứng minh rằng danh sách stage hiện tại thực sự assemble thành payload hoàn chỉnh. Nó là cầu nối giữa UI trực quan và editor dạng text.'
                                : 'The preview proves that the current stage list really assembles into a complete payload. It is the bridge between the visual UI and the raw text editor.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Payload cuối cùng trông ra sao?' : 'What the final payload looks like'}>
                <Prose>
                    {t
                        ? 'Dù bạn thao tác trực quan theo stage, builder cuối cùng vẫn tạo ra một payload MQL chuẩn mà phần còn lại của app hiểu được. Điều này giúp builder không trở thành một “ngách riêng”, mà là một cách soạn thảo khác của cùng workflow thực thi.'
                        : 'Even though you edit stages visually, the builder still produces a normal MQL payload that the rest of the app understands. It is not a separate niche tool; it is simply another authoring mode for the same execution workflow.'}
                </Prose>

                <CodeBlock title={t ? 'Ví dụ payload sau khi assemble' : 'Example assembled payload'}>
                    <CodeComment>{t ? 'Builder gom nhiều stage thành một aggregate request chuẩn' : 'The builder collapses multiple stages into one standard aggregate request'}</CodeComment>
                    <CodeLine>{'{'}</CodeLine>
                    <CodeLine>{'  "action": "aggregate",'}</CodeLine>
                    <CodeLine>{'  "collection": "orders",'}</CodeLine>
                    <CodeLine>{'  "pipeline": ['}</CodeLine>
                    <CodeLine>{'    { "$match": { "status": "paid" } },'}</CodeLine>
                    <CodeLine>{'    { "$group": { "_id": "$country", "total": { "$sum": 1 } } },'}</CodeLine>
                    <CodeLine>{'    { "$sort": { "total": -1 } }'}</CodeLine>
                    <CodeLine>{'  ]'}</CodeLine>
                    <CodeLine>{'}'}</CodeLine>
                </CodeBlock>
            </DocSection>

            <Callout type="warning">
                <p className="text-sm">
                    {t
                        ? 'Aggregation Builder rất tốt cho việc dựng pipeline rõ ràng, nhưng không phải lúc nào cũng là chỗ nhanh nhất cho các case quá dị, quá dài, hoặc dùng nhiều expression nâng cao. Khi bạn cần kiểm soát hoàn toàn payload cuối, hãy Apply to Editor và tiếp tục ở raw MQL.'
                        : 'The Aggregation Builder is excellent for clear, deliberate pipelines, but it is not always the fastest place for extremely custom, long, or expression-heavy cases. When you need total control, apply the result to the editor and continue in raw MQL.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
