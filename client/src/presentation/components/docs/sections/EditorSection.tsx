import { Zap, Activity, Shield, Keyboard, MousePointer2, Settings2, Sparkles } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function EditorSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Trình soạn thảo SQL Chuyên dụng' : 'Advanced SQL Editor'}
            subtitle={t
                ? 'Kế thừa sức mạnh từ Monaco Engine (VS Code), được tinh chỉnh để tối ưu hóa hiệu suất viết truy vấn và phân tích dữ liệu.'
                : 'Powered by the Monaco Engine (VS Code), fine-tuned for high-performance query writing and data analysis.'}
        >
            {/* Core Capabilities */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
                {[
                    {
                        icon: <Zap className="w-8 h-8 text-yellow-500" />,
                        title: t ? 'Hiệu suất Cực cao' : 'High Performance',
                        desc: t ? 'Xử lý mượt mà kịch bản SQL hàng chục MB nhờ công nghệ Virtual DOM và Tokenization riêng biệt.' : 'Fluidly handles massive SQL scripts using Virtual DOM and isolated Tokenization technology.'
                    },
                    {
                        icon: <Activity className="w-8 h-8 text-emerald-500" />,
                        title: t ? 'Grammar Đa dạng' : 'Multi-Dialect Support',
                        desc: t ? 'Tự động nhận diện cú pháp PostgreSQL, MySQL, và MSSQL để cung cấp gợi ý và highlight chính xác.' : 'Auto-detects PostgreSQL, MySQL, and MSSQL syntax for accurate highlighting and suggestions.'
                    },
                    {
                        icon: <Shield className="w-8 h-8 text-rose-500" />,
                        title: t ? 'Safe Execution' : 'Safe Execution',
                        desc: t ? 'Cơ chế tự động giới hạn kết quả trả về và Timeout 30s giúp bảo vệ Backend khỏi các truy vấn "treo".' : 'Automatic result capping and 30s timeout mechanism protects backend from hanging queries.'
                    }
                ].map((item, i) => (
                    <div key={i} className="p-6 border rounded-3xl bg-card/50 space-y-4">
                        <div className="p-3 bg-background border rounded-2xl w-fit shadow-sm">{item.icon}</div>
                        <h4 className="font-bold">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>

            {/* IntelliSense Deep Dive */}
            <DocSection title={t ? 'IntelliSense & Autocomplete' : 'IntelliSense & Autocomplete'}>
                <Prose>
                    {t
                        ? 'Không chỉ đơn thuần là gợi ý từ khóa, IntelliSense trong Data Explorer hiểu được Schema hiện tại của bạn. Nó dựa trên kết quả của quá trình Introspection để cung cấp gợi ý chính xác tới từng tên cột.'
                        : 'Beyond simple keyword suggestions, IntelliSense in Data Explorer understands your actual Schema. It leverages Introspection results to provide precise column-level completions.'}
                </Prose>
                <div className="mt-8 grid md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                        <DocSubSection title={t ? 'Gợi ý theo ngữ cảnh' : 'Context-aware Suggestions'}>
                            <ul className="space-y-3">
                                {[
                                    { k: 'FROM/JOIN', v: t ? 'Gợi ý Table/View/Schema' : 'Suggests Tables/Views/Schemas' },
                                    { k: 'SELECT/WHERE', v: t ? 'Gợi ý Cột dựa theo Alias của bảng' : 'Suggests Columns based on Table Aliases' },
                                    { k: 'INSERT', v: t ? 'Gợi ý danh sách cột của bảng mục tiêu' : 'Suggests column list for target table' }
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-3 text-xs">
                                        <code className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold h-fit uppercase">{item.k}</code>
                                        <span className="text-muted-foreground">{item.v}</span>
                                    </li>
                                ))}
                            </ul>
                        </DocSubSection>
                        <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                            <h5 className="font-black text-[10px] uppercase text-amber-600 mb-2 flex items-center gap-2">
                                <Sparkles className="w-3 h-3" /> {t ? 'Mẹo nhỏ' : 'Pro Tip'}
                            </h5>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {t ? 'Sử dụng Alias (ví dụ: `FROM users u`) giúp IntelliSense hoạt động hiệu quả nhất. Khi gõ `u.`, hệ thống sẽ chỉ hiển thị các cột thuộc bảng `users`.' : 'Using Aliases (e.g., `FROM users u`) makes IntelliSense most effective. Typing `u.` will only show columns belonging to the `users` table.'}
                            </p>
                        </div>
                    </div>
                    <CodeBlock title="Smart Completion Example">
                        <CodeComment>{t ? '-- Gõ "SELECT o." để thấy gợi ý cột' : '-- Type "SELECT o." for column suggestions'}</CodeComment>
                        <CodeLine>SELECT o.order_id, o.amount, c.full_name</CodeLine>
                        <CodeLine>FROM public.orders o</CodeLine>
                        <CodeLine>JOIN public.customers c ON o.customer_id = c.id</CodeLine>
                        <CodeLine>WHERE o.status = 'COMPLETED'</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            {/* Advanced Editing Features */}
            <DocSection title={t ? 'Tính năng Soạn thảo Nâng cao' : 'Advanced Editing Features'}>
                <div className="grid sm:grid-cols-2 gap-4">
                    {[
                        {
                            icon: <MousePointer2 className="w-4 h-4 text-violet-500" />,
                            title: t ? 'Đa con trỏ (Multi-cursor)' : 'Multi-cursor',
                            desc: t ? 'Giữ Alt + Click để thêm con trỏ tại nhiều vị trí. Hoặc Ctrl + D để chọn lần xuất hiện tiếp theo của một từ.' : 'Alt + Click to add multiple cursors. Ctrl + D to select the next occurrence of a word.'
                        },
                        {
                            icon: <Settings2 className="w-4 h-4 text-emerald-500" />,
                            title: t ? 'Tìm kiếm Regex' : 'Regex Search',
                            desc: t ? 'Sử dụng Regular Expressions trong bảng tìm kiếm (Ctrl+F) để xử lý các chuỗi phức tạp.' : 'Use Regular Expressions in the search panel (Ctrl+F) for complex string manipulation.'
                        },
                        {
                            icon: <Keyboard className="w-4 h-4 text-blue-500" />,
                            title: t ? 'Gấp mã (Code Folding)' : 'Code Folding',
                            desc: t ? 'Thu gọn các khối lệnh CASE, BEGIN...END hoặc CTE dài để tập trung vào logic chính.' : 'Collapse CASE, BEGIN...END blocks or long CTEs to focus on core logic.'
                        }
                    ].map((feature, i) => (
                        <div key={i} className="p-5 border rounded-2xl bg-muted/20 hover:bg-muted/30 transition-colors flex gap-4">
                            <div className="p-2 bg-background border rounded-lg h-fit">{feature.icon}</div>
                            <div className="space-y-1">
                                <h5 className="font-bold text-sm">{feature.title}</h5>
                                <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Shortcuts Cheat Sheet */}
            <DocSection title={t ? 'Bảng phím tắt (Cheat Sheet)' : 'Shortcuts Cheat Sheet'}>
                <div className="overflow-hidden border rounded-3xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t ? 'Thao tác' : 'Action'}</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground text-right">{t ? 'Phím tắt' : 'Shortcut'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                            {[
                                { a: t ? 'Thực thi khối lệnh / Toàn bộ' : 'Execute Block / All', s: 'Ctrl + Enter' },
                                { a: t ? 'Tự động định dạng mã SQL' : 'Auto Format SQL', s: 'Shift + Alt + F' },
                                { a: t ? 'Bật/Tắt chú thích dòng' : 'Toggle Comment', s: 'Ctrl + /' },
                                { a: t ? 'Chuyển đổi Tab editor' : 'Switch Tabs', s: 'Ctrl + Tab' },
                                { a: t ? 'Mở Trợ lý AI (Inline)' : 'Open AI Assistant', s: 'Ctrl + I' },
                                { a: t ? 'Tìm kiếm & Thay thế' : 'Find & Replace', s: 'Ctrl + H' },
                                { a: t ? 'Lưu file hiện tại' : 'Save Current File', s: 'Ctrl + S' }
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-4 font-medium">{row.a}</td>
                                    <td className="p-4 text-right">
                                        <kbd className="bg-muted px-2 py-1 rounded border font-mono text-[11px] font-bold shadow-sm">{row.s}</kbd>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Best Practices */}
            <div className="mt-12 p-8 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-indigo-600 uppercase text-xs tracking-widest border-b border-indigo-500/10 pb-4">
                    <Sparkles className="w-4 h-4" /> {t ? 'Best Practices cho SQL Developer' : 'SQL Developer Best Practices'}
                </h4>
                <div className="grid sm:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-2">
                        <strong className="text-sm block">{t ? 'Luôn sử dụng CTE thay vì Subquery' : 'Prefer CTEs over Subqueries'}</strong>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t
                                ? 'CTE (WITH clause) giúp code SQL dễ đọc và debug hơn rất nhiều. Editor hỗ trợ gấp khối mã cho CTE giúp bạn quản lý các truy vấn phức tạp hiệu quả.'
                                : 'CTEs (WITH clause) make SQL code much more readable and debuggable. Our editor supports code folding for CTEs, helping you manage complex queries.'}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <strong className="text-sm block">{t ? 'Sử dụng Uppercase cho từ khóa' : 'Uppercase for Keywords'}</strong>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t
                                ? 'Mặc dù SQL không phân biệt hoa thường, việc viết hoa từ khóa (SELECT, FROM) giúp phân tách rõ giữa logic và dữ liệu. Sử dụng Shift+Alt+F để chuẩn hóa điều này tự động.'
                                : 'While SQL is case-insensitive, capitalizing keywords (SELECT, FROM) helps distinguish logic from data. Use Shift+Alt+F to automate this standardization.'}
                        </p>
                    </div>
                </div>
            </div>
        </DocPageLayout>
    );
}
