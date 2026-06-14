import {
    Bot,
    Database,
    PanelBottom,
    Shield,
} from 'lucide-react';
import {
    Callout,
    CodeBlock,
    CodeComment,
    CodeLine,
    DocPageLayout,
    DocSection,
    DocSubSection,
    FeatureGrid,
    InfoCard,
    Prose,
} from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function NoSqlStudioSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'NoSQL Studio' : 'NoSQL Studio'}
            subtitle={t
                ? 'Tài liệu tổng quan cho không gian làm việc NoSQL của Data Explorer: cách chọn collection, viết MQL, đọc kết quả, dùng AI, và giữ an toàn cho các thao tác có thể làm thay đổi dữ liệu.'
                : 'A practical guide to Data Explorer’s NoSQL workspace: selecting collections, writing MQL, reading results, using AI, and keeping mutating operations under control.'}
            gradient
        >
            <FeatureGrid columns={3}>
                <InfoCard icon={<Database className="w-6 h-6 text-emerald-500" />} title={t ? 'Theo collection' : 'Collection-first'} color="emerald">
                    <p>
                        {t
                            ? 'Khi chưa chọn collection, workspace hiển thị một dashboard định hướng. Khi chọn collection, toàn bộ toolbar, editor, schema tools và result panel sẽ bám theo ngữ cảnh đó.'
                            : 'Before you pick a collection, the workspace stays in dashboard mode. Once a collection is selected, the toolbar, editor, schema tools, and result panel all pivot around that collection.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Shield className="w-6 h-6 text-amber-500" />} title={t ? 'Guardrails rõ ràng' : 'Visible guardrails'} color="amber">
                    <p>
                        {t
                            ? 'Không gian NoSQL luôn phản ánh trạng thái an toàn của kết nối như read-only, query execution disabled, giới hạn kết quả, và trạng thái `truncated` khi aggregate hoặc find bị cap.'
                            : 'The NoSQL workspace surfaces connection safety rules such as read-only mode, execution-disabled connections, result limits, and `truncated` state when aggregate or find results are capped.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Bot className="w-6 h-6 text-cyan-500" />} title={t ? 'AI hiểu collection hiện tại' : 'AI understands the active collection'} color="cyan">
                    <p>
                        {t
                            ? 'NoSQL AI box không chỉ là chat. Nó dùng collection đang mở, database đang active, và lịch sử prompt gần nhất để sinh MQL có thể áp dụng ngay vào editor.'
                            : 'The NoSQL AI box is more than chat. It uses the active collection, current database, and recent prompt context to generate MQL you can apply directly in the editor.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Workspace được tổ chức như thế nào?' : 'How the workspace is organized'}>
                <Prose>
                    {t
                        ? 'NoSQL Studio được chia thành ba lớp nhìn rất rõ: lớp điều hướng collection ở sidebar, lớp thao tác chính ở giữa, và lớp AI hỗ trợ ở cạnh phải. Khi bạn chọn một collection, phần trung tâm sẽ cho bạn chuyển qua lại giữa JSON tree, auto-flatten grid, schema analysis, và aggregation builder.'
                        : 'NoSQL Studio is split into three clear layers: collection navigation on the left, the main working surface in the center, and AI assistance on the right. Once you pick a collection, the center surface lets you move between JSON tree, auto-flatten grid, schema analysis, and the aggregation builder.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            title: t ? 'Trước khi chọn collection' : 'Before a collection is selected',
                            desc: t
                                ? 'Workspace hiển thị dashboard NoSQL để bạn kiểm tra kết nối, trạng thái health, và định hướng điểm bắt đầu. Đây là bước tốt để xác nhận bạn đang ở đúng cluster hoặc database.'
                                : 'The workspace stays on the NoSQL dashboard so you can confirm the connection, health state, and starting point before drilling into real data.'
                        },
                        {
                            title: t ? 'Sau khi chọn collection' : 'After a collection is selected',
                            desc: t
                                ? 'Header trung tâm đổi sang ngữ cảnh `db.<collection>`, các nút view mode xuất hiện, editor nhận đúng target collection, và result panel phản ánh chính xác lần chạy gần nhất.'
                                : 'The center header switches to `db.<collection>`, view-mode buttons appear, the editor is targeted at that collection, and the result panel reflects the latest execution.'
                        },
                        {
                            title: t ? 'Editor và kết quả tách rời' : 'Editor and results are decoupled',
                            desc: t
                                ? 'Bạn có thể viết hoặc chỉnh MQL mà không làm mất kết quả cũ ngay lập tức. Panel kết quả có thể mở/ẩn riêng để giữ không gian soạn thảo rộng hơn khi cần.'
                                : 'You can edit MQL without immediately losing the previous result. The result panel can be shown or hidden independently when you want more room to write.'
                        },
                        {
                            title: t ? 'AI là trợ lý tại chỗ' : 'AI sits in-context',
                            desc: t
                                ? 'AI panel chạy song song với editor NoSQL, nên workflow phổ biến là: mô tả ý định bằng tiếng thường, nhận MQL, áp vào editor, rồi chạy hoặc tinh chỉnh tiếp.'
                                : 'The AI panel runs alongside the NoSQL editor, so the common workflow is: describe your intent in natural language, receive MQL, apply it to the editor, and then run or refine it.'
                        }
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                            <h3 className="text-sm font-bold">{item.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'MQL trong app này có hình dạng gì?' : 'What MQL looks like in this app'}>
                <Prose>
                    {t
                        ? 'Data Explorer không ép bạn viết shell script dài dòng. Với MongoDB và các lane NoSQL hiện tại, editor ưu tiên một payload JSON có trường `action`, `collection`, và phần dữ liệu đi kèm. Cách này giúp UI hiểu được đâu là lệnh đọc, đâu là lệnh biến đổi dữ liệu, và khi nào cần bật guardrails mạnh hơn.'
                        : 'Data Explorer does not force you into long shell scripts. For MongoDB and the current NoSQL lanes, the editor prefers a JSON payload with an `action`, a `collection`, and the relevant operation body. That lets the UI distinguish read operations from mutations and decide when stronger guardrails are needed.'}
                </Prose>

                <CodeBlock title={t ? 'Ví dụ đọc dữ liệu' : 'Read example'}>
                    <CodeComment>{t ? 'Lấy 20 document mới nhất theo createdAt' : 'Fetch the 20 most recent documents by createdAt'}</CodeComment>
                    <CodeLine>{'{'}</CodeLine>
                    <CodeLine>{'  "action": "find",'}</CodeLine>
                    <CodeLine>{'  "collection": "orders",'}</CodeLine>
                    <CodeLine>{'  "filter": { "status": "paid" },'}</CodeLine>
                    <CodeLine>{'  "sort": { "createdAt": -1 },'}</CodeLine>
                    <CodeLine>{'  "limit": 20'}</CodeLine>
                    <CodeLine>{'}'}</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Pipeline tổng hợp nhiều bước' : 'Multi-stage aggregation pipeline'}</CodeComment>
                    <CodeLine>{'{'}</CodeLine>
                    <CodeLine>{'  "action": "aggregate",'}</CodeLine>
                    <CodeLine>{'  "collection": "orders",'}</CodeLine>
                    <CodeLine>{'  "pipeline": ['}</CodeLine>
                    <CodeLine>{'    { "$match": { "status": "paid" } },'}</CodeLine>
                    <CodeLine>{'    { "$group": { "_id": "$country", "total": { "$sum": 1 } } },'}</CodeLine>
                    <CodeLine>{'    { "$sort": { "total": -1 } }'}</CodeLine>
                    <CodeLine>{'  ],'}</CodeLine>
                    <CodeLine>{'  "limit": 500'}</CodeLine>
                    <CodeLine>{'}'}</CodeLine>
                </CodeBlock>

                <Callout type="info">
                    <p className="text-sm">
                        {t
                            ? 'Các action như `insertOne`, `updateOne`, `updateMany`, `deleteOne`, hoặc `deleteMany` là mutation. App sẽ không nên coi chúng như “chạy vô tư như find”. Hãy dùng chúng với kết nối phù hợp, review kỹ filter, và ưu tiên chạy thử trên môi trường an toàn trước.'
                            : 'Actions such as `insertOne`, `updateOne`, `updateMany`, `deleteOne`, and `deleteMany` are mutations. The app should not treat them like harmless `find` operations. Use them on the right connection, review filters carefully, and prefer a safe environment first.'}
                    </p>
                </Callout>

                <Callout type="info">
                    <p className="text-sm">
                        {t
                            ? 'Với `aggregate`, backend áp giới hạn trên cursor trước khi gọi `toArray()`. Response có `appliedLimit`, `limitSource` và `truncated`, nên nếu kết quả bị cap thì UI sẽ nói rõ thay vì khiến bạn tưởng đó là toàn bộ collection.'
                            : 'For `aggregate`, the backend applies the limit on the cursor before calling `toArray()`. Responses include `appliedLimit`, `limitSource`, and `truncated`, so capped results are surfaced clearly instead of looking like the full collection.'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Guardrails và quyền thực thi' : 'Guardrails and execution rules'}>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-red-400" />
                            <h3 className="text-sm font-bold">{t ? 'Execution disabled' : 'Execution disabled'}</h3>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Nếu kết nối bị tắt quyền chạy query, UI vẫn cho bạn đọc tài liệu, soạn payload, hoặc dùng AI để chuẩn bị lệnh, nhưng nút thực thi sẽ không còn là đường chạy hợp lệ.'
                                : 'If a connection has query execution disabled, the UI still lets you inspect docs, prepare payloads, or use AI, but execution is intentionally blocked.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-amber-400" />
                            <h3 className="text-sm font-bold">{t ? 'Read-only mode' : 'Read-only mode'}</h3>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Với read-only, app ưu tiên các action đọc như `find` và `aggregate`. Đây là chế độ rất hợp cho production browsing, audit nhanh, hoặc review dataset mà không chạm vào dữ liệu thật.'
                                : 'In read-only mode, the app prioritizes non-mutating actions such as `find` and `aggregate`. This is ideal for production browsing, auditing, or reviewing a live dataset safely.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5 md:col-span-2">
                        <div className="flex items-center gap-3">
                            <PanelBottom className="h-5 w-5 text-blue-400" />
                            <h3 className="text-sm font-bold">{t ? 'Result panel không chỉ để nhìn output' : 'The result panel is more than an output box'}</h3>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Panel kết quả còn là nơi app hiển thị summary label, số document đã về, badge khi kết quả bị cap, gợi ý đọc kết quả theo grid/tree, và phản hồi ngắn cho mutation. Điều này giúp bạn không phải đoán liệu truy vấn vừa rồi “đã chạy đúng ý” hay chưa.'
                                : 'The result panel also shows summary labels, returned document counts, capped-result badges, suggestions about reading the result in grid/tree mode, and compact feedback for mutations. You do not have to guess whether the last run did what you intended.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Đọc kết quả bằng đúng góc nhìn' : 'Use the right lens for the result'}>
                <DocSubSection title={t ? 'Tree (JSON)' : 'Tree (JSON)'}>
                    <Prose>
                        {t
                            ? 'Phù hợp khi bạn cần nhìn nguyên cấu trúc BSON/JSON thật, đặc biệt với nested objects, arrays, hoặc document có shape không đều. Đây là view nên dùng khi debug schema hoặc kiểm tra dữ liệu gốc.'
                            : 'Best when you need the real BSON/JSON shape, especially for nested objects, arrays, or uneven documents. This is the right view for debugging schema shape and raw data.'}
                    </Prose>
                </DocSubSection>

                <DocSubSection title={t ? 'Auto-Flatten Grid' : 'Auto-Flatten Grid'}>
                    <Prose>
                        {t
                            ? 'Phù hợp khi bạn muốn quét nhanh nhiều document dưới dạng cột, so sánh field side by side, hoặc lọc thủ công bằng mắt. Grid không thay thế JSON tree, nhưng rất mạnh cho việc scan dữ liệu hàng loạt.'
                            : 'Best when you want to scan many documents as columns, compare fields side by side, or review patterns quickly. It does not replace the JSON tree, but it is much faster for broad scanning.'}
                    </Prose>
                </DocSubSection>

                <DocSubSection title={t ? 'Schema Analysis và Aggregation Builder' : 'Schema Analysis and Aggregation Builder'}>
                    <Prose>
                        {t
                            ? 'Khi mục tiêu chuyển từ “xem document” sang “hiểu field” hoặc “tạo pipeline”, hãy đổi sang Schema Analysis hoặc Aggregation Builder. Chúng giúp bạn đi từ dữ liệu thô sang insight có cấu trúc mà không phải làm mọi thứ trong một ô editor duy nhất.'
                            : 'When the goal shifts from reading documents to understanding fields or building pipelines, move into Schema Analysis or the Aggregation Builder. Those views take you from raw data to structured insight without forcing everything into one editor box.'}
                    </Prose>
                </DocSubSection>
            </DocSection>

            <Callout type="tip">
                <p className="text-sm font-medium">
                    {t
                        ? 'Mẹo thực tế: hãy bắt đầu bằng `find` hoặc `aggregate` nhỏ để hiểu shape dữ liệu trước, sau đó mới viết mutation. Với collection lớn, thêm `$match`, `$project` hoặc `limit` sớm để tránh pipeline quá rộng rồi mới chuyển sang schema analysis hoặc aggregation builder.'
                        : 'Practical tip: start with a small `find` or `aggregate` to understand the data shape before writing mutations. On large collections, add `$match`, `$project`, or `limit` early so the pipeline stays narrow before moving into schema analysis or the aggregation builder.'}
                </p>
            </Callout>

            <Callout type="tip">
                <p className="text-sm font-medium">
                    {t
                        ? 'Nếu bạn đang kẹt ở bước viết MQL, hãy dùng NoSQL AI box như một “bản nháp thông minh”: mô tả ý định bằng tiếng thường, nhận payload, áp vào editor, rồi chỉnh tay các field nhạy cảm trước khi chạy.'
                        : 'If writing MQL is the bottleneck, use the NoSQL AI box as a smart draft tool: describe your intent in plain language, receive a payload, apply it to the editor, and then manually refine sensitive fields before running it.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
