import { Zap, Activity, Shield, Sparkles, Cpu } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function EditorSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Trình soạn thảo SQL Chuyên dụng' : 'Advanced SQL Editor'}
            subtitle={t
                ? 'Kế thừa sức mạnh từ Monaco Engine (VS Code), được tinh chỉnh để tối ưu hóa hiệu suất viết truy vấn và phân tích dữ liệu.'
                : 'Powered by the Monaco Engine (VS Code), fine-tuned for high-performance query writing and data analysis.'}
            gradient
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

            {/* Technical Inner Workings */}
            <DocSection title={t ? 'Cơ chế hoạt động (The Inner Workings)' : 'The Inner Workings'}>
                <Prose>
                    {t
                        ? 'Data Explorer không chỉ nhúng editor vào website, chúng tôi đã cấu hình lại hạ tầng của Monaco để tối ưu cho SQL và Data Engineering.'
                        : 'Data Explorer doesn\'t just embed an editor; we have re-engineered Monaco\'s infrastructure to optimize for SQL and Data Engineering.'}
                </Prose>

                <div className="mt-8 space-y-6">
                    <div className="p-6 border rounded-2xl bg-muted/5 group hover:border-primary/50 transition-colors">
                        <h5 className="font-bold text-sm mb-3 flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-blue-500" />
                            {t ? 'Web Worker-based Validation' : 'Web Worker-based Validation'}
                        </h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t
                                ? 'Toàn bộ việc kiểm tra cú pháp (Syntax Checking) và cung cấp gợi ý được chạy trong một luồng nền (Web Worker) riêng biệt. Điều này đảm bảo rằng ngay cả khi bạn đang gõ trong một tệp SQL khổng lồ, giao diện người dùng vẫn phản hồi tức thì với tốc độ 60fps.'
                                : 'All syntax checking and suggestion generation run in a separate background thread (Web Worker). This ensures that even when typing in a massive SQL file, the UI remains responsive at 60fps.'}
                        </p>
                    </div>

                    <div className="p-6 border rounded-2xl bg-muted/5 group hover:border-primary/50 transition-colors">
                        <h5 className="font-bold text-sm mb-3 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            {t ? 'AI Inline Completions (Ghost Text)' : 'AI Inline Completions (Ghost Text)'}
                        </h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t
                                ? 'Chúng tôi tích hợp một Provider riêng cho Gemini AI để cung cấp "mã lệnh mờ" (Ghost Text) khi bạn gõ. Hệ thống sử dụng thuật toán debouncing tinh vi để chỉ gửi yêu cầu AI khi bạn thực sự cần, giảm thiểu chi phí API và tăng tốc độ hiện thị.'
                                : 'We integrated a custom provider for Gemini AI to provide "Ghost Text" as you type. The system uses a sophisticated debouncing algorithm to only trigger AI requests when truly needed, minimizing API costs and boosting performance.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            {/* IntelliSense Deep Dive */}
            <DocSection title={t ? 'IntelliSense & Schema Awareness' : 'IntelliSense & Schema Awareness'}>
                <Prose>
                    {t
                        ? 'IntelliSense trong Data Explorer hiểu được Schema hiện tại của bạn dựa trên kết quả của quá trình Introspection để cung cấp gợi ý chính xác tới từng tên cột.'
                        : 'IntelliSense in Data Explorer understands your actual Schema based on Introspection results to provide precise column-level completions.'}
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
                        <Callout type="tip">
                            {t ? 'Sử dụng Alias (ví dụ: `FROM users u`) giúp IntelliSense hoạt động hiệu quả nhất. Khi gõ `u.`, hệ thống sẽ chỉ hiển thị các cột thuộc bảng `users`.' : 'Using Aliases (e.g., `FROM users u`) makes IntelliSense most effective. Typing `u.` will only show columns belonging to the `users` table.'}
                        </Callout>
                    </div>
                    <CodeBlock title="Smart Completion Example">
                        <CodeComment>{t ? '-- Gõ "SELECT o." để thấy gợi ý cột' : '-- Type "SELECT o." for column suggestions'}</CodeComment>
                        <CodeLine>SELECT o.order_id, o.amount, c.full_name</CodeLine>
                        <CodeLine>FROM public.orders o</CodeLine>
                        <CodeLine>JOIN public.customers c ON o.customer_id = c.id</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            {/* Shortcuts Cheat Sheet */}
            <DocSection title={t ? 'Bảng phím tắt (Cheat Sheet)' : 'Shortcuts Cheat Sheet'}>
                <div className="overflow-hidden border rounded-3xl">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="p-4 font-bold uppercase tracking-widest text-muted-foreground">{t ? 'Thao tác' : 'Action'}</th>
                                <th className="p-4 font-bold uppercase tracking-widest text-muted-foreground text-right">{t ? 'Phím tắt' : 'Shortcut'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { a: t ? 'Thực thi khối lệnh / Toàn bộ' : 'Execute Block / All', s: 'Ctrl + Enter' },
                                { a: t ? 'Tự động định dạng mã SQL' : 'Auto Format SQL', s: 'Shift + Alt + F' },
                                { a: t ? 'Bật/Tắt chú thích dòng' : 'Toggle Comment', s: 'Ctrl + /' },
                                { a: t ? 'Mở Trợ lý AI (Inline)' : 'Open AI Assistant', s: 'Ctrl + I' },
                                { a: t ? 'Tìm kiếm & Thay thế' : 'Find & Replace', s: 'Ctrl + H' }
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-4 font-medium">{row.a}</td>
                                    <td className="p-4 text-right">
                                        <kbd className="bg-muted px-2 py-1 rounded border font-mono text-[10px] font-bold shadow-sm">{row.s}</kbd>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}

