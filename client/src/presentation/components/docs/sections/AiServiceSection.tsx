import { Sparkles, Route, Shield, Image, Database, Gauge, Bot } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, Callout, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function AiServiceSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'AI Routing & Assistant' : 'AI Routing & Assistant'}
            subtitle={t
                ? 'Tổng quan về cách Data Explorer chọn model, stream kết quả, giữ an toàn cho context, và biến câu trả lời AI thành hành động dùng được ngay trong editor.'
                : 'A practical guide to how Data Explorer chooses models, streams results, protects context, and turns AI responses into actions you can use immediately in the editor.'}
            gradient
        >
            <FeatureGrid>
                <InfoCard icon={<Route className="w-6 h-6 text-blue-500" />} title={t ? 'Routing thông minh' : 'Smart routing'} color="blue">
                    <p>
                        {t
                            ? 'AI có thể ưu tiên lane rẻ hơn cho câu hỏi nhẹ, rồi fallback sang model mạnh hơn khi câu hỏi dài, cần suy luận sâu, hoặc cần hình ảnh/current context.'
                            : 'AI can prefer a cheaper lane for lightweight prompts, then fall back to stronger models when the task is longer, needs deeper reasoning, or requires image/current context.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Gauge className="w-6 h-6 text-emerald-500" />} title={t ? 'SSE thời gian thực' : 'Realtime SSE'} color="emerald">
                    <p>
                        {t
                            ? 'Phản hồi AI được stream về từng phần để bạn thấy kết quả ngay, thay vì chờ toàn bộ payload hoàn tất mới render.'
                            : 'AI responses are streamed progressively so you can see results immediately instead of waiting for the entire payload to finish before rendering.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Database className="w-6 h-6 text-amber-500" />} title={t ? 'SQL-first output' : 'SQL-first output'} color="amber">
                    <p>
                        {t
                            ? 'Khi tác vụ mang tính hành động, Data Explorer ưu tiên SQL/MQL ở top-level trước để bạn chèn hoặc chạy nhanh, rồi phần giải thích mới đi theo sau.'
                            : 'When the task is actionable, Data Explorer prioritizes top-level SQL/MQL first so you can insert or run it quickly, with explanation following after.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Các chế độ định tuyến' : 'Routing modes'}>
                <Prose>
                    {t
                        ? 'Ngay trong panel AI, bạn có thể đổi Routing Mode để cân bằng giữa chi phí, tốc độ, và chất lượng. Đây là lớp chọn nằm trên model cụ thể.'
                        : 'Inside the AI panel, you can switch Routing Mode to balance cost, speed, and quality. This sits above the specific model selector.'}
                </Prose>
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                    {[
                        {
                            title: 'Auto',
                            descVi: 'Tự động chọn provider/model phù hợp nhất cho câu hỏi hiện tại. Đây là mode nên dùng hằng ngày.',
                            descEn: 'Automatically picks the most suitable provider/model for the current request. This is the default daily mode.'
                        },
                        {
                            title: 'Fast / Cheap',
                            descVi: 'Ưu tiên lane rẻ hoặc nhanh hơn cho các câu hỏi phổ thông, nhưng vẫn có thể fallback nếu cần.',
                            descEn: 'Prefers cheaper or faster lanes for common prompts, while still allowing fallback when needed.'
                        },
                        {
                            title: 'Best Quality',
                            descVi: 'Đẩy yêu cầu sang lane chất lượng cao sớm hơn, phù hợp với schema analysis, prompt dài, và reasoning nhiều bước.',
                            descEn: 'Escalates requests to the higher-quality lane sooner, ideal for schema analysis, long prompts, and multi-step reasoning.'
                        },
                        {
                            title: 'Gemini Only',
                            descVi: 'Luôn dùng Gemini model đang chọn. Phù hợp khi bạn muốn hành vi ổn định hoặc cần nhất quán với một model cụ thể.',
                            descEn: 'Always uses the currently selected Gemini model. Best when you want stable behavior or strict consistency with one model.'
                        }
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border bg-card/40 p-5">
                            <div className="text-sm font-bold">{item.title}</div>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                {t ? item.descVi : item.descEn}
                            </p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Provider lanes hiện có' : 'Available provider lanes'}>
                <div className="grid md:grid-cols-3 gap-4">
                    <InfoCard icon={<Bot className="w-5 h-5 text-violet-500" />} title="Gemini" color="purple">
                        <p className="text-xs">
                            {t
                                ? 'Lane chất lượng cao cho reasoning dài, image input, query generation khó, và những câu cần độ tin cậy cao hơn.'
                                : 'Higher-quality lane for longer reasoning, image input, harder query generation, and prompts that need stronger reliability.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Sparkles className="w-5 h-5 text-cyan-500" />} title="Cerebras / cheap lane" color="blue">
                        <p className="text-xs">
                            {t
                                ? 'Lane chi phí thấp hơn cho general chat, giải thích khái niệm, và các câu hỏi ngắn không cần image/search.'
                                : 'Lower-cost lane for general chat, concept explanations, and short prompts that do not need image/search.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Image className="w-5 h-5 text-emerald-500" />} title={t ? 'Vision path' : 'Vision path'} color="emerald">
                        <p className="text-xs">
                            {t
                                ? 'Ảnh và sơ đồ vẫn đi qua lane có hỗ trợ vision. Đây là lý do image-based tasks thường được route khác với chat văn bản.'
                                : 'Images and diagrams still use a vision-capable lane. That is why image-based tasks are often routed differently from plain text chat.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Action cards & typed recommendations' : 'Action cards & typed recommendations'}>
                <Prose>
                    {t
                        ? 'Khi AI thấy có bước tiếp theo rõ ràng, câu trả lời không chỉ là text. Nó có thể trả về recommendation cards với loại cụ thể như query fix, index suggestion, schema suggestion, hoặc chart suggestion.'
                        : 'When the AI detects a concrete next step, the answer is not just text. It can return recommendation cards with a specific type such as query fix, index suggestion, schema suggestion, or chart suggestion.'}
                </Prose>
                <ul className="mt-6 grid gap-3">
                    {[
                        t ? 'Insert into editor: chỉ chèn SQL/MQL vào editor hiện tại.' : 'Insert into editor: inserts SQL/MQL into the current editor only.',
                        t ? 'Run suggestion: hỏi xác nhận trước khi thực thi SQL do AI sinh ra.' : 'Run suggestion: asks for confirmation before executing AI-generated SQL.',
                        t ? 'Copy suggestion: copy nhanh để dùng ở nơi khác, không ảnh hưởng editor.' : 'Copy suggestion: copies the suggestion for use elsewhere without touching the editor.',
                        t ? 'Chart suggestions: giúp bạn chọn loại chart phù hợp hơn trước khi lưu vào dashboard.' : 'Chart suggestions: help you choose a better chart type before saving into a dashboard.'
                    ].map((item) => (
                        <li key={item} className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
            </DocSection>

            <DocSection title={t ? 'An toàn context & những gì AI không thấy' : 'Context safety and what the AI does not see'}>
                <div className="grid md:grid-cols-2 gap-4">
                    <InfoCard icon={<Shield className="w-5 h-5 text-emerald-500" />} title={t ? 'Được gửi có chọn lọc' : 'Sent selectively'} color="emerald">
                        <p className="text-xs">
                            {t
                                ? 'Schema context, active database, prompt hiện tại, và file/ảnh đính kèm liên quan có thể được gửi để tăng độ chính xác của câu trả lời.'
                                : 'Schema context, the active database, the current prompt, and relevant attached files/images may be sent to improve accuracy.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Shield className="w-5 h-5 text-rose-500" />} title={t ? 'Không gửi mặc định' : 'Not sent by default'} color="red">
                        <p className="text-xs">
                            {t
                                ? 'Saved connection passwords, app secrets, và raw credentials không được đưa vào prompt. Row data cũng không nên bị gửi trừ khi chính bạn đính kèm nó vào context.'
                                : 'Saved connection passwords, app secrets, and raw credentials are never injected into prompts. Row data should not be sent unless you explicitly include it in context.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Ví dụ prompt dùng tốt nhất' : 'Prompts that work best'}>
                <CodeBlock title={t ? 'Prompt templates' : 'Prompt templates'}>
                    <CodeComment>{t ? 'Tối ưu query' : 'Optimize a query'}</CodeComment>
                    <CodeLine>Optimize this query for PostgreSQL and suggest indexes if needed.</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Chọn biểu đồ' : 'Choose a chart'}</CodeComment>
                    <CodeLine>Suggest the best chart for this result set and explain why.</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Sửa query và cho SQL chạy được' : 'Fix a query and return runnable SQL'}</CodeComment>
                    <CodeLine>Fix this SQL and return a safer version I can run immediately.</CodeLine>
                </CodeBlock>
            </DocSection>

            <Callout type="tip">
                <p className="text-sm font-medium">
                    {t
                        ? 'Mẹo: nếu bạn chỉ muốn tiết kiệm chi phí, dùng Auto hoặc Fast / Cheap. Nếu bạn đang làm schema analysis dài, query khó, hoặc vision, hãy chuyển sang Best Quality hoặc Gemini Only.'
                        : 'Tip: if your goal is cost savings, use Auto or Fast / Cheap. For longer schema analysis, difficult queries, or vision tasks, switch to Best Quality or Gemini Only.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
