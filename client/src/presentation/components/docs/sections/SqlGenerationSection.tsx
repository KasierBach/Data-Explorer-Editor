import { Cpu, Route, Shield, Sparkles } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function SqlGenerationSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'AI SQL generation' : 'AI SQL generation'}
            subtitle={t
                ? 'Cách Data Explorer dùng schema context, AI routing, và typed recommendations để biến yêu cầu tự nhiên thành SQL có thể dùng thật.'
                : 'How Data Explorer uses schema context, AI routing, and typed recommendations to turn natural-language requests into usable SQL.'}
            gradient
        >
            <DocSection title={t ? 'Luồng tạo SQL hiện tại' : 'Current SQL generation flow'}>
                <Prose>
                    {t
                        ? 'Data Explorer không còn là một luồng Gemini-only đơn giản. App hiện xây SQL flow bằng ba lớp: lấy schema context từ connection đang active, chọn provider bằng AI router, rồi chuẩn hóa output để editor và action cards dùng được.'
                        : 'Data Explorer is no longer a simple Gemini-only flow. The app now builds SQL generation in three layers: capture schema context from the active connection, route the request through the AI router, then normalize the output so the editor and action cards can use it safely.'}
                </Prose>
                <div className="space-y-6">
                    {[
                        {
                            step: '01',
                            title: t ? 'Schema-aware context' : 'Schema-aware context',
                            desc: t
                                ? 'Backend trích xuất metadata từ connection hiện tại: tables, columns, relationships, và một phần query context. AI không bị ép đoán tên bảng/cột từ khoảng không.'
                                : 'The backend extracts metadata from the active connection: tables, columns, relationships, and part of the query context. The AI is not forced to guess table and column names from thin air.'
                        },
                        {
                            step: '02',
                            title: t ? 'Provider-aware routing' : 'Provider-aware routing',
                            desc: t
                                ? 'Routing mode trong UI quyết định lane nào được ưu tiên. Prompt nhẹ có thể đi qua Cerebras hoặc OpenRouter trước; image, vision, hoặc task khó hơn có thể được đẩy sang Gemini.'
                                : 'The routing mode in the UI decides which lane is preferred. Light prompts can go through Cerebras or OpenRouter first; images, vision, or harder tasks can be escalated to Gemini.'
                        },
                        {
                            step: '03',
                            title: t ? 'Structured output + action cards' : 'Structured output + action cards',
                            desc: t
                                ? 'Nếu task là SQL/query work, backend sẽ cố trả về SQL rõ ràng, explanation, và recommendation cards như `query_fix`, `index_suggestion`, `schema_suggestion`, `chart_suggestion`.'
                                : 'If the task is SQL/query work, the backend tries to return clear SQL, an explanation, and recommendation cards such as `query_fix`, `index_suggestion`, `schema_suggestion`, and `chart_suggestion`.'
                        },
                    ].map((item, i) => (
                        <div key={i} className="flex gap-6 items-start p-6 border rounded-2xl bg-muted/10">
                            <div className="bg-primary/20 p-3 rounded-2xl text-primary font-bold text-sm shrink-0">{item.step}</div>
                            <div className="space-y-2">
                                <span className="text-foreground font-bold text-lg block">{item.title}</span>
                                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Routing modes' : 'Routing modes'}>
                <div className="grid md:grid-cols-2 gap-4">
                    {[
                        {
                            icon: <Route className="w-5 h-5 text-primary" />,
                            title: 'Auto',
                            desc: t
                                ? 'Cân bằng cost và quality. Prompt nhẹ có thể dùng lane rẻ hơn trước; task khó hơn hoặc cần vision có thể lên Gemini.'
                                : 'Balances cost and quality. Lighter prompts may use cheaper lanes first; harder or vision-heavy tasks can escalate to Gemini.'
                        },
                        {
                            icon: <Cpu className="w-5 h-5 text-primary" />,
                            title: 'Fast / Cheap',
                            desc: t
                                ? 'Ưu tiên lane rẻ hơn để giảm tần suất gọi Gemini, nhưng vẫn có thể fallback nếu cần.'
                                : 'Prefers lower-cost lanes to reduce Gemini usage, while still allowing fallback when needed.'
                        },
                        {
                            icon: <Sparkles className="w-5 h-5 text-primary" />,
                            title: 'Best Quality',
                            desc: t
                                ? 'Đẩy task lên lane chất lượng cao sớm hơn để tối đa độ chắc tay trong phân tích/query work.'
                                : 'Escalates work to the higher-quality lane earlier to maximize reliability for analysis and query work.'
                        },
                        {
                            icon: <Shield className="w-5 h-5 text-primary" />,
                            title: 'Gemini Only',
                            desc: t
                                ? 'Luôn dùng model Gemini bạn đã chọn. Hữu ích khi bạn cần đầu ra ổn định nhất hoặc muốn tránh provider khác.'
                                : 'Always uses the Gemini model you selected. Useful when you want the most stable output or want to avoid other providers entirely.'
                        },
                    ].map((item, i) => (
                        <div key={i} className="p-5 border rounded-2xl bg-card/40">
                            <div className="flex items-center gap-2 font-bold text-sm">{item.icon}{item.title}</div>
                            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Prompt test hiệu quả' : 'Effective prompt patterns'}>
                <Prose>
                    {t
                        ? 'Những prompt tốt nhất là prompt có ý định rõ ràng: cần SQL mới, cần tối ưu, cần index, hay cần chart suggestion từ result set.'
                        : 'The best prompts are intention-clear prompts: ask for a new SQL statement, an optimization pass, an index suggestion, or a chart suggestion from a result set.'}
                </Prose>

                <div className="space-y-6">
                    <CodeBlock title={t ? 'Tạo query mới' : 'Generate a new query'}>
                        <CodeComment>{t ? 'Prompt mẫu' : 'Sample prompt'}</CodeComment>
                        <CodeLine>List top 10 customers by spending in Q4 2025 with order count and total revenue.</CodeLine>
                    </CodeBlock>

                    <CodeBlock title={t ? 'Tối ưu + gợi ý index' : 'Optimize + suggest indexes'}>
                        <CodeComment>{t ? 'Prompt mẫu' : 'Sample prompt'}</CodeComment>
                        <CodeLine>Optimize this query and give me actionable index recommendations with runnable SQL if possible.</CodeLine>
                    </CodeBlock>

                    <CodeBlock title={t ? 'Gợi ý biểu đồ' : 'Chart suggestion'}>
                        <CodeComment>{t ? 'Prompt mẫu' : 'Sample prompt'}</CodeComment>
                        <CodeLine>Suggest the best chart for this result set and explain which fields should be used.</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            <DocSection title={t ? 'Action cards & execution safety' : 'Action cards & execution safety'}>
                <Prose>
                    {t
                        ? 'Recommendation cards dưới bubble AI có thể chèn SQL vào editor hoặc chạy luôn nếu card có payload phù hợp. Tuy nhiên `Insert into editor` chỉ chèn SQL, còn `Run suggestion` mới là hành động thực thi và app hiện hỏi xác nhận trước khi chạy SQL do AI sinh ra.'
                        : 'Recommendation cards under the AI bubble can now insert SQL into the editor or run it directly when the card carries the right payload. However, `Insert into editor` only inserts the SQL, while `Run suggestion` is the execution path and the app now asks for confirmation before running AI-generated SQL.'}
                </Prose>
                <Callout type="warning">
                    <p className="text-sm">
                        {t
                            ? 'AI có thể gợi ý câu lệnh sai cột, sai bảng, hoặc không phù hợp với dữ liệu thực tế. Hãy xem lại SQL trước khi chạy, đặc biệt với DDL, index creation, hoặc các thao tác có thể ảnh hưởng hiệu năng.'
                            : 'AI can still suggest the wrong column, the wrong table, or a statement that does not match your real data. Review SQL before running it, especially for DDL, index creation, or operations that can affect performance.'}
                    </p>
                </Callout>
            </DocSection>
        </DocPageLayout>
    );
}
