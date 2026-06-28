import { HelpCircle } from 'lucide-react';
import { Callout, CodeBlock, CodeLine, DocPageLayout, DocSection, Prose } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ExplainSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Giải thích truy vấn AI' : 'AI Query Explanation'}
            subtitle={t
                ? 'Giải thích script SQL theo từng phần bằng một dialog riêng, có preview truy vấn rõ ràng, mô tả markdown dễ đọc, và model explain cấu hình tách biệt.'
                : 'Explain a SQL script section by section in a dedicated dialog with a clear query preview, readable markdown output, and a separately configurable explain model.'}
        >
            <div className="space-y-6 rounded-3xl border bg-card p-8">
                <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-full bg-primary/10 p-3 text-primary">
                        <HelpCircle className="h-6 w-6" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-xl font-bold">{t ? 'Cách flow hiện tại hoạt động' : 'How the current flow works'}</h3>
                        <Prose>
                            {t
                                ? 'Flow explain hiện tại không còn phụ thuộc vào kiểu “bôi đen rồi chuột phải” như bản mô tả cũ. Thay vào đó, từ workspace SQL bạn mở dialog `Giải thích truy vấn`, app lấy nội dung SQL hiện tại, hiển thị phần preview có số dòng, rồi gọi AI để trả về phần diễn giải theo markdown.'
                                : 'The current explain flow no longer depends on the old “highlight text and right-click” behavior. Instead, from the SQL workspace you open the `Query Explanation` dialog, the app takes the current SQL, renders a line-numbered preview, and asks the AI for a markdown explanation.'}
                        </Prose>
                        <Prose>
                            {t
                                ? 'Điểm quan trọng là dialog này chuyên cho explain: nó có loading state, error state, fallback text, và một vùng hiển thị giải thích riêng thay vì nhồi chung vào editor.'
                                : 'The important detail is that this dialog is dedicated to explanation work: it has loading, error, and fallback states, plus a separate explanation surface instead of stuffing everything into the editor.'}
                        </Prose>
                    </div>
                </div>
            </div>

            <DocSection title={t ? 'Dialog hiển thị những gì?' : 'What does the dialog show?'}>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Khối Query' : 'The Query panel'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Hiển thị đúng đoạn SQL đang được giải thích, có số dòng để bạn bám theo từng phần. Điều này giúp phần diễn giải dễ đối chiếu hơn nhiều so với chỉ nhìn một đoạn text dài.'
                                : 'Shows the exact SQL being explained with line numbers so you can track each section. This makes the explanation much easier to verify than reading one long blob of text.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Khối Explanation' : 'The Explanation panel'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Hiển thị markdown đã được format lại cho dễ đọc. Đây là nơi AI giải thích mục đích của từng phần, logic tổng thể, và những lưu ý đáng chú ý nếu có.'
                                : 'Shows formatted markdown for readability. This is where the AI explains the purpose of each section, the overall logic, and any important caveats.'}
                        </p>
                    </div>
                </div>

                <CodeBlock title={t ? 'Ví dụ truy vấn cần giải thích' : 'Example query to explain'}>
                    <CodeLine>{'WITH monthly_revenue AS ('}</CodeLine>
                    <CodeLine>{'  SELECT DATE_TRUNC(\'month\', o.created_at) AS month,'}</CodeLine>
                    <CodeLine>{'         u.id AS user_id,'}</CodeLine>
                    <CodeLine>{'         SUM(o.total_amount) AS revenue'}</CodeLine>
                    <CodeLine>{'  FROM orders o'}</CodeLine>
                    <CodeLine>{'  JOIN users u ON o.user_id = u.id'}</CodeLine>
                    <CodeLine>{'  WHERE o.status = \'completed\''}</CodeLine>
                    <CodeLine>{'  GROUP BY 1, 2'}</CodeLine>
                    <CodeLine>{')'}</CodeLine>
                    <CodeLine>{'SELECT user_id, month, revenue FROM monthly_revenue;'}</CodeLine>
                </CodeBlock>
            </DocSection>

            <DocSection title={t ? 'Model nào được dùng để explain?' : 'Which model is used for explanations?'}>
                <Prose>
                    {t
                        ? 'Dialog explain dùng role `Explain` trong `Cấu hình AI`. Bạn có thể để role này dùng lại model của Assistant, hoặc tách riêng sang model khác nếu muốn phần giải thích dài hơn, chính xác hơn, hoặc rẻ hơn.'
                        : 'The explanation dialog uses the `Explain` role from `Configure AI`. You can let this role inherit the Assistant model, or split it to a different model when you want explanations to be longer, more accurate, or cheaper.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Dùng chung model Assistant' : 'Share the Assistant model'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Đây là lựa chọn gọn nhất khi bạn muốn cấu hình đơn giản và không cần tách biệt quality giữa chat và explain.'
                                : 'This is the simplest option when you want a minimal configuration and do not need a quality split between chat and explain.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Tách riêng model Explain' : 'Use a dedicated Explain model'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Rất hợp khi bạn muốn query explanation đi theo model thiên về phân tích, diễn giải từng bước, hoặc ít tốn chi phí hơn phần chat chính.'
                                : 'Great when you want query explanations to use a model specialized for step-by-step analysis, clearer prose, or lower cost than the main assistant.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Nên dùng khi nào?' : 'When should you use it?'}>
                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        {
                            title: t ? 'Đọc query cũ' : 'Read legacy queries',
                            desc: t
                                ? 'Hữu ích khi mở lại script cũ, stored procedure, hoặc query đồng nghiệp để lại mà không muốn tự lần từng dòng.'
                                : 'Useful when revisiting old scripts, stored procedures, or teammate queries without tracing every line manually.'
                        },
                        {
                            title: t ? 'Hiểu logic trước khi sửa' : 'Understand logic before editing',
                            desc: t
                                ? 'Giúp bạn nắm ý đồ của câu lệnh trước khi tối ưu, tách bước, hoặc rewrite lại để tránh sửa mù.'
                                : 'Helps you understand intent before optimizing, splitting steps, or rewriting the statement so you do not edit blindly.'
                        },
                        {
                            title: t ? 'Onboarding nhanh hơn' : 'Faster onboarding',
                            desc: t
                                ? 'Người mới vào project có thể đọc nhanh query phức tạp mà không phải đi Google từng syntax hoặc từng window function.'
                                : 'New team members can understand complex queries faster without searching every syntax form or window function by hand.'
                        }
                    ].map((item) => (
                        <div key={item.title} className="space-y-2 rounded-2xl border bg-card p-6 transition-colors hover:border-primary/50">
                            <h4 className="font-bold text-primary">{item.title}</h4>
                            <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <Callout type="warning">
                <p className="text-sm">
                    {t
                        ? 'AI Query Explanation là lớp diễn giải bằng ngôn ngữ tự nhiên, không phải kết quả `EXPLAIN` / `EXPLAIN ANALYZE` của database engine. Nếu bạn cần execution plan thật để debug hiệu năng, hãy dùng công cụ plan/analyze của workspace.'
                        : 'AI Query Explanation is a natural-language explanation layer, not the database engine’s real `EXPLAIN` / `EXPLAIN ANALYZE` output. If you need an actual execution plan for performance debugging, use the workspace plan/analyze tooling.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
