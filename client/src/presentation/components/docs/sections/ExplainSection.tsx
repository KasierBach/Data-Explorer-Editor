import { HelpCircle } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ExplainSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Giải thích truy vấn AI' : 'AI Query Explanation'}
            subtitle={t
                ? 'Hiểu rõ mọi câu lệnh SQL phức tạp chỉ với một cú click — từ subquery lồng nhau đến window functions.'
                : 'Understand any complex SQL statement with just one click — from nested subqueries to window functions.'}
        >
            {/* How It Works */}
            <div className="p-8 border rounded-3xl bg-card space-y-6">
                <div className="flex gap-4 items-start">
                    <div className="bg-primary/10 p-3 rounded-full text-primary shrink-0">
                        <HelpCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-bold text-xl">{t ? 'Cách thức hoạt động' : 'How It Works'}</h3>
                        <Prose>{t
                            ? 'Khi bạn có một đoạn mã SQL phức tạp mà không hiểu rõ (ví dụ: code của đồng nghiệp để lại, hoặc một stored procedure legacy), bạn chỉ cần bôi đen đoạn code đó trong Monaco Editor và chọn "Explain" từ context menu (chuột phải) hoặc sử dụng phím tắt.'
                            : 'When you encounter complex SQL code you don\'t fully understand (e.g., a colleague\'s code, or a legacy stored procedure), simply highlight that code in the Monaco Editor and select "Explain" from the context menu (right-click) or use a keyboard shortcut.'}</Prose>
                        <Prose>{t
                            ? 'AI sẽ phân tích cấu trúc từng phần của câu lệnh: giải thích ý nghĩa của các JOIN, mô tả logic của WHERE conditions, giải mã window functions và CTEs (Common Table Expressions), và dự đoán cấu trúc kết quả trả về.'
                            : 'The AI analyzes each part of the statement structure: explains the meaning of JOINs, describes WHERE condition logic, decodes window functions and CTEs (Common Table Expressions), and predicts the return result structure.'}</Prose>
                    </div>
                </div>
            </div>

            {/* Example: Before & After */}
            <DocSection title={t ? 'Ví dụ minh họa' : 'Example'}>
                <Prose>{t
                    ? 'Giả sử bạn gặp đoạn SQL sau trong codebase và không hiểu nó làm gì:'
                    : 'Suppose you encounter the following SQL in a codebase and don\'t understand what it does:'}</Prose>
                <CodeBlock title={t ? 'SQL cần giải thích' : 'SQL to Explain'}>
                    <CodeLine>{'WITH monthly_revenue AS ('}</CodeLine>
                    <CodeLine>{'  SELECT'}</CodeLine>
                    <CodeLine>{'    DATE_TRUNC(\'month\', o.created_at) AS month,'}</CodeLine>
                    <CodeLine>{'    u.id AS user_id,'}</CodeLine>
                    <CodeLine>{'    SUM(o.total_amount) AS revenue'}</CodeLine>
                    <CodeLine>{'  FROM orders o'}</CodeLine>
                    <CodeLine>{'  JOIN users u ON o.user_id = u.id'}</CodeLine>
                    <CodeLine>{'  WHERE o.status = \'completed\''}</CodeLine>
                    <CodeLine>{'  GROUP BY 1, 2'}</CodeLine>
                    <CodeLine>{')'}</CodeLine>
                    <CodeLine>{'SELECT'}</CodeLine>
                    <CodeLine>{'  user_id,'}</CodeLine>
                    <CodeLine>{'  month,'}</CodeLine>
                    <CodeLine>{'  revenue,'}</CodeLine>
                    <CodeLine>{'  LAG(revenue) OVER (PARTITION BY user_id ORDER BY month) AS prev_month,'}</CodeLine>
                    <CodeLine>{'  ROUND((revenue - LAG(revenue) OVER (PARTITION BY user_id ORDER BY month))'}</CodeLine>
                    <CodeLine>{'    / NULLIF(LAG(revenue) OVER (PARTITION BY user_id ORDER BY month), 0) * 100, 2'}</CodeLine>
                    <CodeLine>{'  ) AS growth_pct'}</CodeLine>
                    <CodeLine>{'FROM monthly_revenue'}</CodeLine>
                    <CodeLine>{'ORDER BY user_id, month;'}</CodeLine>
                </CodeBlock>

                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                    <h4 className="font-bold text-primary">{t ? '🤖 AI giải thích:' : '🤖 AI Explanation:'}</h4>
                    <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
                        <p><strong>CTE `monthly_revenue`:</strong> {t
                            ? 'Tạo bảng tạm tính tổng doanh thu theo tháng cho mỗi khách hàng. Chỉ tính các đơn hàng có status "completed". DATE_TRUNC cắt timestamp xuống mức tháng.'
                            : 'Creates a temporary table calculating monthly total revenue per customer. Only counts orders with "completed" status. DATE_TRUNC truncates timestamps to month level.'}</p>
                        <p><strong>LAG() Window Function:</strong> {t
                            ? 'Lấy giá trị doanh thu của tháng trước đó cho cùng một user. PARTITION BY user_id đảm bảo mỗi user có "cửa sổ" riêng.'
                            : 'Retrieves the previous month\'s revenue for the same user. PARTITION BY user_id ensures each user has their own "window".'}</p>
                        <p><strong>growth_pct:</strong> {t
                            ? 'Tính phần trăm tăng trưởng doanh thu so với tháng trước. NULLIF tránh lỗi chia cho 0 khi tháng trước không có doanh thu.'
                            : 'Calculates revenue growth percentage compared to the previous month. NULLIF prevents division by zero when previous month has no revenue.'}</p>
                        <p><strong>{t ? 'Kết quả:' : 'Result:'}</strong> {t
                            ? 'Bảng hiển thị: ID khách hàng, tháng, doanh thu tháng đó, doanh thu tháng trước, và % tăng trưởng — cho phép phân tích xu hướng chi tiêu theo thời gian.'
                            : 'Table showing: customer ID, month, that month\'s revenue, previous month revenue, and growth % — allowing spending trend analysis over time.'}</p>
                    </div>
                </div>
            </DocSection>

            {/* Benefits */}
            <DocSection title={t ? 'Lợi ích' : 'Benefits'}>
                <div className="grid md:grid-cols-3 gap-4">
                    {[
                        { title: t ? 'Học SQL nhanh hơn' : 'Learn SQL Faster', desc: t ? 'Thay vì Google từng cú pháp, bạn nhận được giải thích trong ngữ cảnh thực tế của database — với tên bảng và cột thật.' : 'Instead of Googling every syntax, get explanations in your database\'s actual context — with real table and column names.' },
                        { title: t ? 'Bảo trì code cũ' : 'Maintain Legacy Code', desc: t ? 'Dễ dàng hiểu stored procedures hàng trăm dòng mà đồng nghiệp để lại, giảm thời gian onboarding cho team member mới.' : 'Easily understand hundred-line stored procedures left by colleagues, reducing onboarding time for new team members.' },
                        { title: t ? 'Tối ưu hiệu năng' : 'Performance Optimization', desc: t ? 'AI nhận diện anti-patterns (N+1 queries, missing indexes) và gợi ý cách viết lại hiệu quả hơn.' : 'AI identifies anti-patterns (N+1 queries, missing indexes) and suggests more efficient rewrites.' },
                    ].map((item, i) => (
                        <div key={i} className="p-6 border rounded-2xl bg-card space-y-2 hover:border-primary/50 transition-colors">
                            <h4 className="font-bold text-primary">{item.title}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
