import { Cpu, Route, Shield, Sparkles } from 'lucide-react';
import { Callout, CodeBlock, CodeComment, CodeLine, DocPageLayout, DocSection, Prose } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function SqlGenerationSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'AI SQL generation' : 'AI SQL generation'}
            subtitle={t
                ? 'Cách Data Explorer dùng schema context, AI routing, SQL Steps, và typed recommendations để biến yêu cầu tự nhiên thành SQL có thể dùng thật.'
                : 'How Data Explorer uses schema context, AI routing, SQL Steps, and typed recommendations to turn natural-language requests into usable SQL.'}
            gradient
        >
            <DocSection title={t ? 'Luồng tạo SQL hiện tại' : 'Current SQL generation flow'}>
                <Prose>
                    {t
                        ? 'Data Explorer không còn là một luồng Gemini-only đơn giản. App hiện xây SQL flow bằng ba lớp: lấy schema context từ connection đang active, chọn provider bằng AI router, rồi chuẩn hóa output để editor và action cards dùng được an toàn.'
                        : 'Data Explorer is no longer a simple Gemini-only flow. The app now builds SQL generation in three layers: capture schema context from the active connection, route the request through the AI router, then normalize the output so the editor and action cards can use it safely.'}
                </Prose>

                <div className="space-y-6">
                    {[
                        {
                            step: '01',
                            title: t ? 'Schema-aware context' : 'Schema-aware context',
                            desc: t
                                ? 'Backend trích xuất metadata từ connection hiện tại: tables, columns, relationships, và một phần query context. AI không bị ép đoán tên bảng hoặc cột từ khoảng không.'
                                : 'The backend extracts metadata from the active connection: tables, columns, relationships, and part of the query context. The AI is not forced to guess table and column names from thin air.'
                        },
                        {
                            step: '02',
                            title: t ? 'Provider-aware routing' : 'Provider-aware routing',
                            desc: t
                                ? 'Routing mode trong UI chỉ là một lớp. Chain thực tế còn phụ thuộc explicit model/provider bạn chọn, việc prompt có ảnh hay không, và việc request có bị nhận diện là current-info hay không. Với SQL work thông thường, app ưu tiên chain text-capable an toàn.'
                                : 'The routing mode in the UI is only one layer. The real chain also depends on any explicit model/provider selection, whether the prompt includes an image, and whether the request is detected as current-information work. For normal SQL tasks, the app prefers a safe text-capable chain.'
                        },
                        {
                            step: '03',
                            title: t ? 'Structured output + action cards' : 'Structured output + action cards',
                            desc: t
                                ? 'Nếu task là SQL/query work, backend cố trả về SQL rõ ràng, explanation, và recommendation cards như `query_fix`, `index_suggestion`, `schema_suggestion`, hoặc `chart_suggestion` để UI thao tác tiếp.'
                                : 'If the task is SQL/query work, the backend tries to return clear SQL, an explanation, and recommendation cards such as `query_fix`, `index_suggestion`, `schema_suggestion`, or `chart_suggestion` so the UI can take the next step.'
                        },
                    ].map((item) => (
                        <div key={item.step} className="flex items-start gap-6 rounded-2xl border bg-muted/10 p-6">
                            <div className="shrink-0 rounded-2xl bg-primary/20 p-3 text-sm font-bold text-primary">{item.step}</div>
                            <div className="space-y-2">
                                <span className="block text-lg font-bold text-foreground">{item.title}</span>
                                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Vai trò model cho AI SQL' : 'The AI SQL model role'}>
                <Prose>
                    {t
                        ? 'Trong `Cấu hình AI`, vai trò `AI SQL` cho phép bạn tách riêng model dùng cho sinh SQL khỏi model chat chung. Đây là điểm rất đáng dùng nếu bạn muốn phần chat thiên về đối thoại, còn phần SQL thiên về reasoning, cú pháp, hoặc tốc độ.'
                        : 'Inside `Configure AI`, the `AI SQL` role lets you separate the model used for SQL generation from the general assistant model. This is worth using when you want chat to stay conversational while SQL stays optimized for reasoning, syntax, or speed.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Dùng lại model của Assistant' : 'Inherit the Assistant model'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Phù hợp khi bạn muốn giữ cấu hình đơn giản và chỉ quản lý một model chính cho đa số workflow.'
                                : 'Best when you want to keep configuration simple and manage one main model for most workflows.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Tách riêng model cho SQL' : 'Use a dedicated SQL model'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Phù hợp khi bạn muốn AI SQL dùng model khác cho optimize, fix query, index suggestion, hoặc các truy vấn dài nhiều join.'
                                : 'Best when you want AI SQL to use a different model for optimization, query fixing, index suggestions, or long join-heavy statements.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Routing modes' : 'Routing modes'}>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            icon: <Route className="h-5 w-5 text-primary" />,
                            title: 'Auto',
                            desc: t
                                ? 'Mode mặc định cho phần lớn SQL work. App bắt đầu từ auto chain phù hợp rồi lọc theo capability thay vì luôn đẩy thẳng sang lane đắt nhất.'
                                : 'The default mode for most SQL work. The app starts from the appropriate auto chain and filters it by capability instead of always jumping straight to the most expensive lane.'
                        },
                        {
                            icon: <Cpu className="h-5 w-5 text-primary" />,
                            title: 'Fast / Cheap',
                            desc: t
                                ? 'Thiên về iteration nhanh và lane rẻ hơn, nhưng không ghi đè explicit provider nếu bạn đã khóa model cụ thể.'
                                : 'Leans toward quicker iteration and cheaper lanes, but does not override an explicit provider if you already locked the model.'
                        },
                        {
                            icon: <Sparkles className="h-5 w-5 text-primary" />,
                            title: 'Best Quality',
                            desc: t
                                ? 'Hữu ích khi task cần reasoning, explain, rewrite, hoặc optimization sâu hơn. Nó nghiêng về lane mạnh hơn sớm hơn.'
                                : 'Useful when a task needs heavier reasoning, explanation, rewriting, or deeper optimization. It leans toward stronger lanes earlier.'
                        },
                        {
                            icon: <Shield className="h-5 w-5 text-primary" />,
                            title: 'Gemini Only',
                            desc: t
                                ? 'Luôn dùng model Gemini bạn đã chọn. Hữu ích khi bạn cần đầu ra ổn định nhất hoặc muốn tránh provider khác.'
                                : 'Always uses the Gemini model you selected. Useful when you want the most stable output or want to avoid other providers entirely.'
                        },
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border bg-card/40 p-5">
                            <div className="flex items-center gap-2 text-sm font-bold">{item.icon}{item.title}</div>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>

                <Callout type="info">
                    <p className="text-sm">
                        {t
                            ? 'Điểm rất dễ hiểu sai: nếu prompt bị nhận diện là cần thông tin hiện thời như “mới nhất”, “hôm nay”, hay “giá hiện tại”, router sẽ nghiêng về live-search chat behavior thay vì coi đó là một SQL generation request thuần.'
                            : 'One easy misunderstanding: if a prompt is detected as a current-information request such as “latest”, “today”, or “current price”, the router leans toward live-search chat behavior instead of treating it as a pure SQL generation request.'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'SQL Steps / chạy tuần tự nhiều câu lệnh' : 'SQL Steps / sequential multi-statement execution'}>
                <Prose>
                    {t
                        ? 'Khi script có nhiều câu SQL, bạn có thể mở `SQL Steps` để tách script thành từng khối, kéo thả sắp xếp lại thứ tự, chỉnh sửa từng bước, thêm bước mới, rồi áp vào editor hoặc chạy tuần tự đúng theo thứ tự đã sắp.'
                        : 'When a script contains multiple SQL statements, you can open `SQL Steps` to split the script into blocks, drag and reorder them, edit each step, add new ones, then apply the sequence back to the editor or run it sequentially in the arranged order.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Dùng khi nào?' : 'When should you use it?'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Rất hợp cho script setup, seed dữ liệu, tạo bảng + insert + index + analyze, hoặc các luồng cần kiểm soát thứ tự thực thi rõ ràng.'
                                : 'Great for setup scripts, data seeding, create-table plus insert plus index plus analyze flows, or any workflow where execution order matters.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Bạn làm được gì trong dialog?' : 'What can you do in the dialog?'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Kéo thả lên xuống, dùng nút lên/xuống, xóa bước, thêm bước mới, sửa trực tiếp nội dung SQL của từng bước, rồi `Áp vào editor` hoặc `Chạy tuần tự`.'
                                : 'Drag up and down, use move up/down buttons, delete steps, add a new step, edit each step directly, then choose `Apply to editor` or `Run sequence`.'}
                        </p>
                    </div>
                </div>

                <CodeBlock title={t ? 'Ví dụ workflow nhiều bước' : 'Example multi-step workflow'}>
                    <CodeComment>{t ? 'Một script phổ biến trong SQL Steps' : 'A common SQL Steps script'}</CodeComment>
                    <CodeLine>CREATE TABLE perf_orders_200k_v1 (...);</CodeLine>
                    <CodeLine>INSERT INTO perf_orders_200k_v1 (...) SELECT ...;</CodeLine>
                    <CodeLine>CREATE INDEX idx_perf_orders_tenant_id ON perf_orders_200k_v1(tenant_id);</CodeLine>
                    <CodeLine>ANALYZE perf_orders_200k_v1;</CodeLine>
                </CodeBlock>
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
                        ? 'Recommendation cards dưới bubble AI có thể chèn SQL vào editor hoặc chạy luôn nếu card có payload phù hợp. Tuy nhiên `Insert into editor` chỉ chèn SQL, còn `Run suggestion` mới là hành động thực thi và app sẽ hỏi xác nhận trước khi chạy SQL do AI sinh ra.'
                        : 'Recommendation cards under the AI bubble can insert SQL into the editor or run it directly when the card carries the right payload. However, `Insert into editor` only inserts the SQL, while `Run suggestion` is the execution path and the app asks for confirmation before running AI-generated SQL.'}
                </Prose>

                <Callout type="warning">
                    <p className="text-sm">
                        {t
                            ? 'AI vẫn có thể gợi ý sai cột, sai bảng, hoặc sinh câu lệnh chưa phù hợp với dữ liệu thực tế. Hãy xem lại SQL trước khi chạy, đặc biệt với DDL, index creation, hoặc các thao tác có thể ảnh hưởng hiệu năng.'
                            : 'AI can still suggest the wrong column, the wrong table, or a statement that does not match your real data. Review SQL before running it, especially for DDL, index creation, or operations that can affect performance.'}
                    </p>
                </Callout>
            </DocSection>
        </DocPageLayout>
    );
}
