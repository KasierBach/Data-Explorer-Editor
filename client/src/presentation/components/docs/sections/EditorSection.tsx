import { Zap, Activity } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function EditorSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Trình soạn thảo Monaco SQL' : 'Monaco SQL Editor'}
            subtitle={t
                ? 'Trải nghiệm soạn thảo tiêu chuẩn công nghiệp — cùng engine đang chạy bên trong VS Code — được tối ưu riêng cho phát triển SQL chuyên nghiệp.'
                : 'Industry-standard editing experience — the same engine powering VS Code — specifically optimized for professional SQL development.'}
        >
            {/* Feature Cards */}
            <div className="grid md:grid-cols-2 gap-4">
                <div className="p-6 border rounded-3xl bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-default group">
                    <Zap className="w-10 h-10 text-yellow-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold text-lg">{t ? 'Tốc độ Ánh sáng' : 'Lightning Fast'}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                        {t
                            ? 'Soạn thảo không độ trễ ngay cả với các stored procedure dài hàng chục nghìn dòng. Monaco sử dụng Web Worker riêng biệt cho syntax highlighting, đảm bảo UI luôn mượt mà 60fps. Bộ nhớ được tối ưu thông qua virtual rendering — chỉ render các dòng đang hiển thị trên viewport.'
                            : 'Zero-latency editing even with stored procedures tens of thousands of lines long. Monaco uses a dedicated Web Worker for syntax highlighting, ensuring a smooth 60fps UI. Memory is optimized through virtual rendering — only lines visible in the viewport are rendered.'}
                    </p>
                </div>
                <div className="p-6 border rounded-3xl bg-card hover:border-primary/50 hover:shadow-lg transition-all cursor-default group">
                    <Activity className="w-10 h-10 text-emerald-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold text-lg">{t ? 'Linting Thời gian thực' : 'Real-time Linting'}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                        {t
                            ? 'Xác thực cú pháp tức thì dựa trên từng phương ngữ SQL cụ thể. Khi bạn kết nối tới PostgreSQL, editor tự động chuyển sang chế độ PostgreSQL dialect — nhận diện riêng các kiểu như serial, text[], jsonb. Tương tự cho MySQL (AUTO_INCREMENT, ENUM) và MSSQL (nvarchar, datetime2).'
                            : 'Instant syntax validation based on specific SQL dialects. When you connect to PostgreSQL, the editor automatically switches to PostgreSQL dialect mode — recognizing types like serial, text[], jsonb. Similarly for MySQL (AUTO_INCREMENT, ENUM) and MSSQL (nvarchar, datetime2).'}
                    </p>
                </div>
            </div>

            {/* IntelliSense */}
            <DocSection title={t ? 'IntelliSense thông minh' : 'Smart IntelliSense'}>
                <Prose>{t
                    ? 'Data Explorer tích hợp auto-completion dựa trên metadata thực tế từ database của bạn. Khi bạn gõ SQL, hệ thống sẽ gợi ý tên bảng, cột, hàm và kiểu dữ liệu phù hợp với engine đang kết nối.'
                    : 'Data Explorer integrates auto-completion based on actual metadata from your database. As you type SQL, the system suggests table names, columns, functions, and data types matching the connected engine.'}</Prose>
                <Prose>{t
                    ? 'IntelliSense hoạt động theo ngữ cảnh: sau từ khóa FROM hoặc JOIN, nó gợi ý tên bảng; sau SELECT hoặc WHERE, nó gợi ý tên cột của bảng đang được tham chiếu. Đây không phải là một từ điển tĩnh — mà là dữ liệu sống từ schema thật của bạn.'
                    : 'IntelliSense works contextually: after FROM or JOIN keywords, it suggests table names; after SELECT or WHERE, it suggests column names from referenced tables. This is not a static dictionary — it\'s live data from your actual schema.'}</Prose>
                <CodeBlock title={t ? 'Ví dụ: IntelliSense gợi ý cột theo bảng' : 'Example: IntelliSense suggests columns per table'}>
                    <CodeComment>{t ? 'Gõ "SELECT u." → Gợi ý: id, name, email, created_at...' : 'Type "SELECT u." → Suggests: id, name, email, created_at...'}</CodeComment>
                    <CodeLine>SELECT u.id, u.name, u.email</CodeLine>
                    <CodeLine>FROM public.users u</CodeLine>
                    <CodeLine>WHERE u.created_at {'>'} '2024-01-01'</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Gõ "JOIN " → Gợi ý: orders, products, transactions...' : 'Type "JOIN " → Suggests: orders, products, transactions...'}</CodeComment>
                    <CodeLine>JOIN public.orders o ON u.id = o.user_id</CodeLine>
                </CodeBlock>
            </DocSection>

            {/* Multi-cursor and Editing */}
            <DocSection title={t ? 'Chỉnh sửa Nâng cao' : 'Advanced Editing'}>
                <Prose>{t
                    ? 'Monaco Editor hỗ trợ đầy đủ các tính năng chỉnh sửa nâng cao, giúp bạn viết và refactor SQL nhanh hơn nhiều so với các GUI database truyền thống.'
                    : 'Monaco Editor fully supports advanced editing features, helping you write and refactor SQL much faster than traditional database GUIs.'}</Prose>
                <div className="space-y-3">
                    {[
                        { title: t ? 'Đa con trỏ (Multi-cursor)' : 'Multi-cursor Editing', desc: t ? 'Giữ Alt và click để thêm con trỏ. Hoặc chọn một từ, nhấn Ctrl+D để chọn thêm lần xuất hiện tiếp theo. Rất tiện khi đổi tên cột ở nhiều chỗ cùng lúc.' : 'Hold Alt and click to add cursors. Or select a word, press Ctrl+D to select the next occurrence. Great for renaming columns in multiple places at once.' },
                        { title: t ? 'Gấp mã (Code Folding)' : 'Code Folding', desc: t ? 'Gấp/mở các khối BEGIN...END, CASE...END, và CTE (WITH). Click vào mũi tên ở cột số dòng hoặc dùng phím tắt Ctrl+Shift+[.' : 'Fold/unfold BEGIN...END, CASE...END, and CTE (WITH) blocks. Click the arrow in the line number gutter or use Ctrl+Shift+[.' },
                        { title: t ? 'Minimap' : 'Minimap', desc: t ? 'Bản đồ thu nhỏ bên phải editor giúp bạn nhanh chóng điều hướng trong file SQL dài. Hover lên minimap để xem preview nội dung.' : 'A miniature map on the right side of the editor helps quickly navigate long SQL files. Hover over the minimap to preview content.' },
                        { title: t ? 'Tìm và Thay thế Regex' : 'Regex Find & Replace', desc: t ? 'Ctrl+H mở panel tìm và thay thế. Hỗ trợ regex với capture groups — ví dụ thay tất cả tbl_(\\w+) thành public.\\1.' : 'Ctrl+H opens find and replace. Supports regex with capture groups — e.g., replace all tbl_(\\w+) with public.\\1.' },
                    ].map((feature, i) => (
                        <div key={i} className="p-5 border rounded-2xl bg-muted/20 space-y-1">
                            <h4 className="font-bold text-sm">{feature.title}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* SQL Formatting */}
            <DocSection title={t ? 'Định dạng SQL tự động' : 'Auto SQL Formatting'}>
                <Prose>{t
                    ? 'Nhấn Shift+Alt+F để tự động format mã SQL. Data Explorer sử dụng sql-formatter với cấu hình riêng cho từng dialect. Kết quả format bao gồm: thụt đầu dòng nhất quán, viết hoa từ khóa, và căn chỉnh các mệnh đề SELECT/FROM/WHERE.'
                    : 'Press Shift+Alt+F to auto-format SQL code. Data Explorer uses sql-formatter with per-dialect configuration. Formatting includes: consistent indentation, uppercase keywords, and aligned SELECT/FROM/WHERE clauses.'}</Prose>
                <CodeBlock title={t ? 'Trước khi format' : 'Before formatting'}>
                    <CodeComment>{t ? 'Mã SQL chưa được format' : 'Unformatted SQL'}</CodeComment>
                    <CodeLine>select u.name,count(o.id) as total_orders,sum(o.amount) as revenue from users u join orders o on u.id=o.user_id where o.status='completed' and o.created_at{'>'}='2024-01-01' group by u.name having count(o.id){'>'}5 order by revenue desc;</CodeLine>
                </CodeBlock>
                <CodeBlock title={t ? 'Sau khi format (Shift+Alt+F)' : 'After formatting (Shift+Alt+F)'}>
                    <CodeComment>{t ? 'Mã SQL đã được format' : 'Formatted SQL'}</CodeComment>
                    <CodeLine>{'SELECT'}</CodeLine>
                    <CodeLine>{'  u.name,'}</CodeLine>
                    <CodeLine>{'  COUNT(o.id) AS total_orders,'}</CodeLine>
                    <CodeLine>{'  SUM(o.amount) AS revenue'}</CodeLine>
                    <CodeLine>{'FROM users u'}</CodeLine>
                    <CodeLine>{'JOIN orders o ON u.id = o.user_id'}</CodeLine>
                    <CodeLine>{"WHERE o.status = 'completed'"}</CodeLine>
                    <CodeLine>{"  AND o.created_at >= '2024-01-01'"}</CodeLine>
                    <CodeLine>{'GROUP BY u.name'}</CodeLine>
                    <CodeLine>{'HAVING COUNT(o.id) > 5'}</CodeLine>
                    <CodeLine>{'ORDER BY revenue DESC;'}</CodeLine>
                </CodeBlock>
            </DocSection>

            {/* Keyboard Shortcuts */}
            <DocSection title={t ? 'Phím tắt cho Power Users' : 'Shortcuts for Power Users'}>
                <Prose>{t
                    ? 'Tất cả phím tắt đều tương thích với chuẩn VS Code. Dưới đây là các phím tắt quan trọng nhất cho việc phát triển SQL:'
                    : 'All shortcuts are VS Code compatible. Here are the most important shortcuts for SQL development:'}</Prose>
                <div className="space-y-2">
                    {[
                        { label: t ? 'Thực thi Toàn bộ' : 'Execute All', key: 'Ctrl + Enter', desc: t ? 'Chạy toàn bộ nội dung trong tab hiện tại' : 'Run all content in current tab' },
                        { label: t ? 'Thực thi Vùng chọn' : 'Execute Selection', key: 'Ctrl + Shift + Enter', desc: t ? 'Chỉ chạy đoạn SQL đang được bôi đen' : 'Run only the highlighted SQL block' },
                        { label: t ? 'Định dạng mã SQL' : 'Format SQL Code', key: 'Shift + Alt + F', desc: t ? 'Format code với indentation và uppercase keywords' : 'Format code with indentation and uppercase keywords' },
                        { label: t ? 'Bật/Tắt Chú thích' : 'Toggle Comment', key: 'Ctrl + /', desc: t ? 'Comment/uncomment dòng hoặc vùng chọn' : 'Comment/uncomment current line or selection' },
                        { label: t ? 'Tìm kiếm' : 'Find', key: 'Ctrl + F', desc: t ? 'Tìm kiếm trong file hiện tại' : 'Search within current file' },
                        { label: t ? 'Tìm và Thay thế' : 'Find & Replace', key: 'Ctrl + H', desc: t ? 'Tìm và thay thế, hỗ trợ regex' : 'Find and replace with regex support' },
                        { label: t ? 'Chọn thêm từ giống' : 'Add Next Occurrence', key: 'Ctrl + D', desc: t ? 'Chọn thêm lần xuất hiện tiếp theo của từ đang chọn' : 'Select next occurrence of current selection' },
                        { label: t ? 'Di chuyển dòng' : 'Move Line', key: 'Alt + ↑/↓', desc: t ? 'Di chuyển dòng hiện tại lên/xuống' : 'Move current line up/down' },
                        { label: t ? 'Nhân đôi dòng' : 'Duplicate Line', key: 'Shift + Alt + ↓', desc: t ? 'Nhân đôi dòng hoặc vùng chọn hiện tại' : 'Duplicate current line or selection' },
                        { label: t ? 'Trợ lý AI' : 'AI Assistant', key: 'Ctrl + I', desc: t ? 'Mở/đóng panel AI Assistant' : 'Toggle AI Assistant panel' },
                    ].map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                            <div>
                                <span className="text-sm font-medium block">{s.label}</span>
                                <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                            </div>
                            <kbd className="bg-muted border border-muted-foreground/30 px-3 py-1.5 rounded-md shadow-sm font-mono text-[11px] uppercase font-bold text-primary whitespace-nowrap">{s.key}</kbd>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
