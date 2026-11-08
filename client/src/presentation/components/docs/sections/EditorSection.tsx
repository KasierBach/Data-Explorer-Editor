import { Zap, Activity, Shield, Sparkles, Cpu } from 'lucide-react';
import { publicPath } from '@/core/seo/publicRoutes';
import { DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function EditorSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Trình soạn thảo SQL' : 'SQL Editor'}
            subtitle={t
                ? 'Monaco với highlight SQL chung, gợi ý schema và các thao tác chạy, format, Stop trực tiếp trên toolbar.'
                : 'Monaco with generic SQL highlighting, schema completions and direct Run, Format and Stop toolbar actions.'}
            gradient
        >
            <div className="grid md:grid-cols-3 gap-6 mb-12">
                {[
                    {
                        icon: <Zap className="w-8 h-8 text-yellow-500" />,
                        title: t ? 'Monaco editor' : 'Monaco editor',
                        desc: t ? 'Soạn SQL với highlight, đa con trỏ và thao tác tìm kiếm quen thuộc. Không có cam kết xử lý script hàng chục MB hoặc tốc độ 60fps.' : 'Write SQL with highlighting, multi-cursor editing and familiar search actions. No tens-of-megabytes script capacity or 60fps guarantee is made.'
                    },
                    {
                        icon: <Activity className="w-8 h-8 text-emerald-500" />,
                        title: t ? 'SQL chung và metadata' : 'Generic SQL and metadata',
                        desc: t ? 'Editor dùng ngôn ngữ SQL chung và completion từ schema đang tải; không có parser/linter theo dialect hoặc suy luận alias riêng.' : 'The editor uses generic SQL and completions from loaded schema; it has no custom per-dialect parser/linter or alias inference.'
                    },
                    {
                        icon: <Shield className="w-8 h-8 text-rose-500" />,
                        title: t ? 'Thực thi có kiểm tra' : 'Guarded execution',
                        desc: t ? 'Backend áp quyền connection và xác nhận SQL rủi ro. SELECT dùng cửa sổ kết quả từ server; raw SQL có trần 50.000 dòng. Guard không thay thế quyền database thật.' : 'The backend checks connection permissions and high-impact SQL confirmation. SELECT uses server result windows; raw SQL has a 50,000-row ceiling. Guards do not replace actual database permissions.'
                    }
                ].map((item, i) => (
                    <div key={i} className="p-6 border rounded-3xl bg-card/50 space-y-4">
                        <div className="p-3 bg-background border rounded-2xl w-fit shadow-sm">{item.icon}</div>
                        <h4 className="font-bold">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>

            <Callout type="info">
                <p className="text-sm">{t
                    ? 'DataGrid là tab bảng có chức năng sửa dữ liệu; Query Result bên dưới SQL editor chỉ đọc. Cả hai tải theo trang, nhưng có bộ thao tác và định dạng export khác nhau.'
                    : 'DataGrid is the table tab with editing controls; Query Result below the SQL editor is read-only. Both fetch pages, but their actions and export formats differ.'}</p>
            </Callout>

            <DocSection title={t ? 'Soạn query và completion' : 'Authoring queries and completions'}>
                <Prose>{t
                    ? 'Monaco hiển thị SQL chung. Metadata của connection cung cấp tên bảng/cột cho completion; danh sách phụ thuộc schema đã tải và quyền truy cập. Màu cú pháp không có nghĩa query hợp lệ trên engine đang chọn.'
                    : 'Monaco displays generic SQL. Connection metadata supplies table/column completion names; suggestions depend on loaded schema and access permissions. Syntax colors do not mean a query is valid for the selected engine.'}</Prose>
                <div className="mt-8 space-y-6">
                    <div className="p-6 border rounded-2xl bg-muted/5 group hover:border-primary/50 transition-colors">
                        <h5 className="font-bold text-sm mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-blue-500" />{t ? 'Gợi ý từ schema' : 'Schema-derived suggestions'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t
                            ? 'Dùng completion để tìm tên object, sau đó kiểm tra schema đầy đủ trong Explorer. Không có custom SQL worker để lint/format theo dialect hoặc tự ánh xạ u. thành cột của alias u.'
                            : 'Use completions to find object names, then inspect the full schema in Explorer. There is no custom SQL worker for dialect linting/formatting or automatic mapping of u. to the columns of alias u.'}</p>
                    </div>
                    <div className="p-6 border rounded-2xl bg-muted/5 group hover:border-primary/50 transition-colors">
                        <h5 className="font-bold text-sm mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500" />{t ? 'AI inline completion tùy chọn' : 'Optional AI inline completions'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t
                            ? 'Ghost Text dùng vai trò Autocomplete đã cấu hình. Ngữ cảnh editor/schema có thể được gửi qua backend tới provider. AI không bắt buộc và gợi ý không được thực thi tự động; xem lại trước khi chấp nhận.'
                            : 'Ghost Text uses the configured Autocomplete role. Editor/schema context can be sent through the backend to a provider. AI is optional and suggestions are not automatically executed; review before accepting.'}</p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Run, Format và Stop' : 'Run, Format and Stop'}>
                <div className="mt-2 space-y-6">
                    <div className="p-6 border rounded-2xl bg-muted/5 group hover:border-primary/50 transition-colors">
                        <h5 className="font-bold text-sm mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" />{t ? 'Chạy phần chọn hoặc toàn query' : 'Run the selection or full query'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t
                            ? 'Run hoặc Ctrl/Cmd+Enter chạy phần đang chọn; nếu không chọn thì chạy nội dung editor. Kiểm tra connection/database trước. Xác nhận SQL rủi ro không vượt qua readOnly hoặc allowQueryExecution=false.'
                            : 'Run or Ctrl/Cmd+Enter executes the selection, or the editor contents when nothing is selected. Check the connection/database first. High-impact SQL confirmation does not override readOnly or allowQueryExecution=false.'}</p>
                    </div>
                    <div className="p-6 border rounded-2xl bg-muted/5 group hover:border-primary/50 transition-colors">
                        <h5 className="font-bold text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-500" />{t ? 'Format bằng nút trực tiếp' : 'Use the direct Format button'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t
                            ? 'Bấm Format trên toolbar để định dạng query. App không đăng ký binding SQL Shift+Alt+F; không coi format là bước kiểm chứng ngữ nghĩa hoặc linter dialect.'
                            : 'Press Format in the toolbar to format a query. The app does not register a SQL Shift+Alt+F binding; formatting is not semantic verification or dialect linting.'}</p>
                    </div>
                    <div className="p-6 border rounded-2xl bg-muted/5 group hover:border-primary/50 transition-colors">
                        <h5 className="font-bold text-sm mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" />{t ? 'Stop và Active Queries' : 'Stop and Active Queries'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t
                            ? 'Khi query đang chạy, bấm Stop trực tiếp; Active Queries cho phép yêu cầu cancel từng query. PostgreSQL dùng pg_cancel_backend, MySQL/MariaDB dùng KILL QUERY khi khả dụng. Cancel là yêu cầu tới engine, không bảo đảm tức thì hoặc rollback ghi đã hoàn thành.'
                            : 'While a query runs, press Stop directly; Active Queries lets you request cancellation per query. PostgreSQL uses pg_cancel_backend and MySQL/MariaDB use KILL QUERY where available. Cancellation is an engine request, not a guarantee of immediate stopping or rollback of completed writes.'}</p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Ví dụ và kiểm tra kết quả' : 'Example and result checks'}>
                <div className="mt-8 grid md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                        <DocSubSection title={t ? 'Query nhỏ, thứ tự rõ ràng' : 'Small query, explicit ordering'}>
                            <Prose>{t
                                ? 'Bắt đầu bằng SELECT nhỏ và ORDER BY ổn định. Thay public.orders/cột bằng tên trong schema của bạn. Alias vẫn là SQL hợp lệ, nhưng không có completion nhận diện alias được cam kết.'
                                : 'Start with a small SELECT and stable ORDER BY. Replace public.orders/columns with names from your schema. Aliases are valid SQL, but alias-aware completion is not promised.'}</Prose>
                        </DocSubSection>
                        <Callout type="tip">{t
                            ? 'Query Result chỉ đọc. Muốn sửa dữ liệu, mở bảng DataGrid rồi dùng Edit → sửa thành pending → Save, nếu connection và khóa dòng cho phép.'
                            : 'Query Result is read-only. To edit data, open the table DataGrid and use Edit → pending changes → Save, when connection permissions and row identity allow it.'}</Callout>
                    </div>
                    <CodeBlock title={t ? 'Ví dụ PostgreSQL — thay tên theo schema của bạn' : 'PostgreSQL example — substitute your schema names'}>
                        <CodeComment>{t ? 'Một query có giới hạn rõ ràng' : 'A query with an explicit bound'}</CodeComment>
                        <CodeLine>SELECT order_id, amount</CodeLine>
                        <CodeLine>FROM public.orders</CodeLine>
                        <CodeLine>ORDER BY order_id</CodeLine>
                        <CodeLine>LIMIT 20;</CodeLine>
                    </CodeBlock>
                </div>
                <Prose>{t
                    ? 'AI Explain giải thích query theo luồng hỗ trợ AI, không thay thế execution plan từ database. Standalone hook EXPLAIN cũ không được nối vào UI hiện tại; nếu cần plan, tự chạy lệnh EXPLAIN phù hợp với engine và quyền của bạn.'
                    : 'AI Explain explains a query through AI assistance; it does not replace a database execution plan. The older standalone EXPLAIN hook is not wired into the current UI; run an appropriate EXPLAIN statement manually when you need a plan and have permission.'}</Prose>
            </DocSection>

            <DocSection title={t ? 'Bảng phím tắt' : 'Shortcuts cheat sheet'}>
                <div className="overflow-hidden border rounded-3xl mb-8">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead><tr className="bg-muted/50 border-b"><th className="p-4 font-bold uppercase tracking-widest text-muted-foreground">{t ? 'Thao tác' : 'Action'}</th><th className="p-4 font-bold uppercase tracking-widest text-muted-foreground text-right">{t ? 'Phím tắt' : 'Shortcut'}</th></tr></thead>
                        <tbody className="divide-y">
                            {[
                                { a: t ? 'Chạy phần chọn / toàn query' : 'Run selection / full query', s: 'Ctrl/Cmd + Enter' },
                                { a: t ? 'Tìm kiếm toàn cục' : 'Global search', s: 'Ctrl/Cmd + K' },
                                { a: t ? 'Query tab mới' : 'New Query tab', s: 'Ctrl/Cmd + N' },
                                { a: t ? 'Bật/tắt kết quả' : 'Toggle results', s: 'Ctrl/Cmd + J' },
                                { a: t ? 'Bật/tắt Explorer' : 'Toggle Explorer', s: 'Ctrl/Cmd + B' },
                                { a: t ? 'Bật/tắt AI Assistant' : 'Toggle AI Assistant', s: 'Ctrl/Cmd + I' },
                                { a: t ? 'Nhân bản tab' : 'Duplicate tab', s: 'Ctrl/Cmd + D' },
                                { a: t ? 'Đóng tất cả tab' : 'Close all tabs', s: 'Ctrl/Cmd + Shift + W' },
                                { a: t ? 'Mở Query History (không phải thay thế)' : 'Open Query History (not replace)', s: 'Ctrl/Cmd + H' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/30 transition-colors"><td className="p-4 font-medium">{row.a}</td><td className="p-4 text-right"><kbd className="bg-muted px-2 py-1 rounded border font-mono text-[10px] font-bold shadow-sm">{row.s}</kbd></td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Prose>{t
                    ? 'Phím Ctrl/Cmd có thể bị trình duyệt/hệ điều hành giữ. Dùng nút Run, Format, Stop, tab X/chuột giữa và double-click tên tab làm đường trực tiếp; dùng menu Find của Monaco thay vì gán Ctrl/Cmd+H cho Replace.'
                    : 'The browser/OS may intercept Ctrl/Cmd shortcuts. Use direct Run, Format, Stop, tab X/middle-click and double-click tab rename actions; use Monaco Find actions rather than assigning Ctrl/Cmd+H to Replace.'}</Prose>
            </DocSection>
            <Prose>
                <a href={publicPath(lang, '/docs/first-query')}>{t ? 'Truy vấn đầu tiên' : 'First query'}</a>{' · '}
                <a href={publicPath(lang, '/docs/operational-limits')}>{t ? 'Giới hạn vận hành' : 'Operational limits'}</a>{' · '}
                <a href={publicPath(lang, '/docs/data-handling')}>{t ? 'Dữ liệu và AI' : 'Data and AI'}</a>
            </Prose>
        </DocPageLayout>
    );
}
