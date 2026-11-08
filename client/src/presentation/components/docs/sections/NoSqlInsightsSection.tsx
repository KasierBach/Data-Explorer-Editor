import {
    BarChart3,
    Bot,
    SearchCode,
    TableProperties,
    TreePine,
} from 'lucide-react';
import { publicPath } from '@/core/seo/publicRoutes';
import {
    Callout,
    DocPageLayout,
    DocSection,
    DocSubSection,
    FeatureGrid,
    InfoCard,
    Prose,
} from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function NoSqlInsightsSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Schema & Insight Tools' : 'Schema & Insight Tools'}
            subtitle={t
                ? 'Cách Data Explorer biến result set NoSQL thành nhiều “góc nhìn” khác nhau để bạn chuyển nhanh từ document thô sang schema pattern, metric gợi ý, và MQL có thể dùng tiếp.'
                : 'How Data Explorer turns a NoSQL result set into multiple lenses so you can move from raw documents to schema patterns, quick metrics, and next-step MQL faster.'}
            gradient
        >
            <FeatureGrid columns={3}>
                <InfoCard icon={<TreePine className="w-6 h-6 text-emerald-500" />} title={t ? 'JSON tree nguyên bản' : 'Raw JSON tree'} color="emerald">
                    <p>
                        {t
                            ? 'Giữ lại cấu trúc document thật khi bạn cần debug nested objects, arrays, hoặc field hiếm xuất hiện.'
                            : 'Preserves the original document shape when you need to debug nested objects, arrays, or sparsely populated fields.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<TableProperties className="w-6 h-6 text-blue-500" />} title={t ? 'Auto-Flatten Grid' : 'Auto-Flatten Grid'} color="blue">
                    <p>
                        {t
                            ? 'Chuyển các field phổ biến thành cột để so sánh nhanh nhiều document cùng lúc, thay vì mở từng node JSON riêng lẻ.'
                            : 'Turns common fields into columns so you can compare many documents at once instead of expanding each JSON node manually.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<SearchCode className="w-6 h-6 text-indigo-500" />} title={t ? 'Schema Analysis' : 'Schema Analysis'} color="purple">
                    <p>
                        {t
                            ? 'Tập trung vào cấu trúc collection: field coverage, type variance, và ví dụ giá trị thay vì chỉ xem dữ liệu từng dòng.'
                            : 'Focuses on collection structure itself: field coverage, type variance, and example values instead of just row-by-row reading.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Chọn đúng góc nhìn cho đúng câu hỏi' : 'Pick the right lens for the right question'}>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            title: t ? '“Document này thật ra trông thế nào?”' : '"What does this document actually look like?"',
                            answer: t
                                ? 'Dùng Tree (JSON). Đây là mode tốt nhất để nhìn nested shape, object lồng nhau, hoặc những field không xuất hiện đều.'
                                : 'Use Tree (JSON). This is the best mode for nested shapes, embedded objects, and fields that do not appear consistently.'
                        },
                        {
                            title: t ? '“Field nào đang phổ biến nhất?”' : '"Which fields are the most common?"',
                            answer: t
                                ? 'Dùng Auto-Flatten Grid hoặc Schema Analysis. Grid cho cảm giác quét nhanh; schema analysis cho bạn ngôn ngữ có cấu trúc hơn về field coverage.'
                                : 'Use Auto-Flatten Grid or Schema Analysis. The grid gives a faster scan; schema analysis gives a more structured explanation of field coverage.'
                        },
                        {
                            title: t ? '“Tôi muốn nhìn metric hoặc group pattern”' : '"I want grouped metrics or patterns"',
                            answer: t
                                ? 'Dùng visualize/result insights cho một insight nhanh, hoặc quay sang Aggregation Builder nếu bạn cần một pipeline có chủ đích và có thể lặp lại.'
                                : 'Use visualize/result insights for a quick read, or move into the Aggregation Builder if you need a deliberate, repeatable pipeline.'
                        },
                        {
                            title: t ? '“Tôi muốn AI giúp viết MQL tiếp theo”' : '"I want AI to draft the next MQL step"',
                            answer: t
                                ? 'Dùng NoSQL AI box khi bạn đã có collection đúng ngữ cảnh. AI sẽ mạnh hơn nhiều khi nó biết collection nào đang mở và result trước đó đang gợi ý điều gì.'
                                : 'Use the NoSQL AI box after you have the correct collection selected. It is much stronger when it knows the active collection and what the previous result already suggests.'
                        }
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                            <h3 className="text-sm font-bold">{item.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Schema Analysis thực sự nói cho bạn điều gì?' : 'What Schema Analysis really tells you'}>
                <Prose>
                    {t
                        ? 'Schema Analysis không biến MongoDB thành một schema cứng như SQL. Thay vào đó, nó quan sát mẫu document hiện có để trả lời các câu hỏi rất thực dụng: field nào xuất hiện đều, field nào chỉ có trong một nhóm nhỏ, kiểu dữ liệu nào bị trộn lẫn, và ví dụ giá trị nào đáng chú ý. Mẫu này có giới hạn runtime rõ ràng, nên kết quả là tín hiệu định hướng chứ không phải lời hứa tuyệt đối về toàn bộ collection.'
                        : 'Schema Analysis does not try to turn MongoDB into a rigid SQL-style schema. Instead, it inspects the current sample to answer practical questions: which fields are stable, which appear only in a small subset, where data types are mixed, and which values are worth noticing. The sample has explicit runtime limits, so the result is directional evidence rather than an absolute promise about the whole collection.'}
                </Prose>

                <DocSubSection title={t ? 'Những gì nó phù hợp để hỗ trợ' : 'What it is good at'}>
                    <Prose>
                        {t
                            ? 'Nó rất phù hợp cho onboarding một collection mới, kiểm tra chất lượng ingest, phát hiện drift kiểu dữ liệu, hoặc chuẩn bị cho một pipeline `$project` / `$group` sạch hơn.'
                            : 'It is excellent for onboarding into a new collection, checking ingest quality, detecting type drift, or preparing a cleaner `$project` / `$group` pipeline.'}
                    </Prose>
                </DocSubSection>

                <DocSubSection title={t ? 'Những gì nó không nên bị hiểu nhầm' : 'What it should not be mistaken for'}>
                    <Prose>
                        {t
                            ? 'Đây không phải một lời hứa rằng mọi document trong collection đều giống hệt nhau. Nó là một công cụ quan sát dựa trên dữ liệu hiện có và các giới hạn runtime hợp lý, nên hãy dùng nó để định hướng, rồi xác nhận thêm bằng query của chính bạn khi cần.'
                            : 'It is not a guarantee that every document in the collection is identical. It is an observational tool based on the current data sample and runtime limits, so use it for direction and then verify with your own queries when needed.'}
                    </Prose>
                </DocSubSection>
            </DocSection>

            <DocSection title={t ? 'Mẫu schema, phạm vi và cache' : 'Schema sample, scope and cache'}>
                <Prose>{t
                    ? 'Schema Analysis gửi yêu cầu đọc riêng cho collection: mặc định 100 document, API clamp tối đa 1.000. Nó không phân tích lại mọi document của result set hiện tại hoặc dùng random sample đại diện chắc chắn cho toàn collection.'
                    : 'Schema Analysis makes a separate collection read: 100 documents by default, clamped to at most 1,000 by the API. It does not analyze every document in the current result set or guarantee a representative random sample of the whole collection.'}</Prose>
                <Prose>{t
                    ? 'Thống kê chỉ ở field top-level, có count/type/probability và tối đa 5 giá trị ví dụ khác nhau mỗi field. Nested object/array được phân loại ở top-level, không có thống kê đệ quy từng path. Kết quả cache trong Redis một giờ theo connection/database/collection/sample size; refresh yêu cầu lấy lại mẫu.'
                    : 'Statistics cover top-level fields only, with count/type/probability and at most 5 distinct example values per field. Nested objects/arrays are classified at the top level, not recursively profiled per path. Redis caches results for one hour by connection/database/collection/sample size; refresh requests a new sample.'}</Prose>
                <Callout type="warning"><p className="text-sm">{t
                    ? 'allowQueryExecution=false chặn schema sampling. readOnly vẫn cho phép đọc được kiểm tra nếu execution bật. Mẫu và cache có thể bỏ sót field hiếm hoặc thay đổi mới; đây là quan sát, không phải schema validator hay chứng nhận mọi document.'
                    : 'allowQueryExecution=false blocks schema sampling. readOnly still permits validated reads when execution is enabled. Samples/caches can miss rare fields or recent changes; this is observation, not schema validation or certification of every document.'}</p></Callout>
            </DocSection>

            <DocSection title={t ? 'Visual insights: hữu ích, nhưng không phải BI hoàn chỉnh' : 'Visual insights: useful, but not a full BI layer'}>
                <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard icon={<BarChart3 className="w-5 h-5 text-orange-500" />} title={t ? 'Insight nhanh từ result set' : 'Fast insight from the current result set'} color="orange">
                        <p className="text-xs">
                            {t
                                ? 'Phần visualize trong NoSQL thiên về việc rút ra nhóm metric, category nổi bật, hoặc so sánh nhanh trên kết quả hiện tại. Nếu result set đang bị cap, insight cũng chỉ phản ánh phần dữ liệu đã trả về. Nó hợp để ra quyết định tiếp theo, không phải để thay thế dashboard lâu dài.'
                                : 'The NoSQL visualize flow is designed for extracting grouped metrics, standout categories, or quick comparisons from the current result set. If the result set is capped, the insight reflects only the returned data. It helps you decide the next step, not replace a long-term dashboard.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Bot className="w-5 h-5 text-cyan-500" />} title={t ? 'AI là lớp hỗ trợ tiếp theo' : 'AI is the next support layer'} color="cyan">
                        <p className="text-xs">
                            {t
                                ? 'Khi schema analysis hoặc visualize khiến bạn nảy ra câu hỏi tiếp theo, NoSQL AI box là nơi chuyển câu hỏi đó thành MQL mới thay vì buộc bạn phải tự viết lại từ đầu.'
                                : 'When schema analysis or visualize sparks the next question, the NoSQL AI box is where you turn that question into the next MQL draft instead of starting from scratch.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <Callout type="info">
                <p className="text-sm">
                    {t
                        ? 'find/aggregate trả tối đa 50.000 document, dùng maxTimeMS 30 giây; pipeline tối đa 100 stage và payload bị giới hạn sâu 10, array 10.000 phần tử, object 2.000 key. Khi truncated, visualization phản ánh kết quả bị cap. Muốn số liệu toàn collection, thiết kế pipeline tổng hợp hợp lệ rồi kiểm tra giới hạn/tính đầy đủ của output.'
                        : 'find/aggregate return at most 50,000 documents with a 30-second maxTimeMS; pipelines cap at 100 stages and payloads at depth 10, arrays of 10,000 entries and objects of 2,000 keys. When truncated, visualization reflects capped output. For collection-wide figures, design a valid aggregate pipeline and verify the output limits/completeness.'}
                </p>
            </Callout>

            <Callout type="tip">
                <p className="text-sm font-medium">
                    {t
                        ? 'Một workflow rất hiệu quả là: mở collection → chạy `find` nhỏ → nhìn Tree/Grid để hiểu shape → dùng Schema Analysis để xác nhận field pattern → chuyển sang Aggregation Builder hoặc AI để viết bước tiếp theo.'
                        : 'A very effective workflow is: open the collection -> run a small `find` -> inspect Tree/Grid to learn the shape -> use Schema Analysis to confirm field patterns -> move into the Aggregation Builder or AI for the next step.'}
                </p>
            </Callout>
            <Prose>
                <a href={publicPath(lang, '/docs/operational-limits')}>{t ? 'Giới hạn vận hành' : 'Operational limits'}</a>{' · '}
                <a href={publicPath(lang, '/docs/data-handling')}>{t ? 'Xử lý dữ liệu và AI' : 'Data handling and AI'}</a>
            </Prose>
        </DocPageLayout>
    );
}
