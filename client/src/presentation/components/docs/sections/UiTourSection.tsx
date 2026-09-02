import { MousePointerClick, LayoutDashboard, Database, FileCode, Bot, BarChart3, Users, Activity } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

interface TourStop {
    where: string;
    what: string;
    why: string;
}

export function UiTourSection({ lang }: Props) {
    const t = lang === 'vi';

    const sidebarStops: [string, string, string][] = [
        [
            t ? 'Logo / tên app (góc trên trái)' : 'App logo / name (top-left corner)',
            t ? 'Click để quay về Dashboard' : 'Click to return to the Dashboard',
            t ? 'Lối thoát nhanh về màn hình chính từ bất kỳ đâu trong workspace.' : 'A quick escape hatch back to the home screen from anywhere in the workspace.',
        ],
        [
            t ? 'Danh sách Connections' : 'Connections list',
            t ? 'Click một connection để kích hoạt nó; click mũi tên để mở/đóng cây database' : 'Click a connection to activate it; click the arrow to expand/collapse the database tree',
            t ? 'Connection đang active có nền highlight. Cây mở ra sẽ liệt kê database → schema → tables/views/functions; click đúp vào bảng để mở tab DataGrid.' : 'The active connection is highlighted. The tree lists database → schema → tables/views/functions; double-click a table to open a DataGrid tab.',
        ],
        [
            t ? 'Nút + (thêm connection)' : '+ button (add connection)',
            t ? 'Mở dialog tạo connection mới' : 'Opens the new-connection dialog',
            t ? 'Chọn engine bằng engine picker trực quan, điền host/port/user/pass hoặc dán URI. Nút Test kiểm tra kết nối trước khi lưu.' : 'Pick an engine with the visual picker, fill host/port/user/pass or paste a URI. The Test button verifies the connection before saving.',
        ],
        [
            t ? 'Ô tìm kiếm (Ctrl+P)' : 'Search box (Ctrl+P)',
            t ? 'Mở global search' : 'Opens global search',
            t ? 'Tìm bảng, view, connection đã lưu theo tên qua search index đã sync — gõ vài chữ cái là nhảy tới đúng đối tượng.' : 'Finds tables, views, and saved connections by name through the synced search index — type a few characters to jump straight to the object.',
        ],
        [
            t ? 'Icon người dùng (góc trên phải)' : 'User avatar (top-right corner)',
            t ? 'Mở Profile menu' : 'Opens the profile menu',
            t ? 'Nơi đổi ngôn ngữ, cấu hình AI (Profile > Configure AI), xem billing, đăng xuất, và chỉnh avatar.' : 'Where you switch language, configure AI (Profile > Configure AI), view billing, sign out, and edit your avatar.',
        ],
    ];

    const editorStops: [string, string, string][] = [
        [
            t ? 'Nút Run (▶) hoặc Ctrl+Enter' : 'Run button (▶) or Ctrl+Enter',
            t ? 'Thực thi SQL đang chọn (hoặc toàn bộ nếu không chọn gì)' : 'Executes the selected SQL (or everything if nothing is selected)',
            t ? 'Chỉ phần được bôi đen mới chạy — hữu ích khi file có nhiều câu. Query rủi ro (DROP, DELETE không WHERE) sẽ hiện dialog xác nhận trước.' : 'Only the highlighted portion runs — useful in multi-statement files. Risky queries (DROP, DELETE without WHERE) show a confirmation dialog first.',
        ],
        [
            t ? 'Nút Stop (■)' : 'Stop button (■)',
            t ? 'Hủy query đang chạy' : 'Cancels the running query',
            t ? 'Hủy diễn ra ngay trên server (pg_cancel_backend / KILL QUERY) chứ không chỉ bỏ qua kết quả phía client.' : 'The cancel happens on the server (pg_cancel_backend / KILL QUERY), not just by discarding the client-side result.',
        ],
        [
            t ? 'Nút Format (Shift+Alt+F)' : 'Format button (Shift+Alt+F)',
            t ? 'Tự động format SQL' : 'Auto-formats the SQL',
            t ? 'Sắp xếp lại khoảng trắng, xuống dòng theo chuẩn dễ đọc. Không đổi logic câu query.' : 'Reflows whitespace and line breaks for readability. Does not change query logic.',
        ],
        [
            t ? 'Nút AI (✨)' : 'AI button (✨)',
            t ? 'Mở panel AI Assistant' : 'Opens the AI Assistant panel',
            t ? 'AI đã biết schema của connection đang active — hỏi bằng tiếng nói thường, nó sinh SQL, giải thích, hoặc sửa query giúp bạn.' : 'The AI knows the active connection\'s schema — ask in plain language and it generates SQL, explains, or fixes queries for you.',
        ],
        [
            t ? 'Thanh tab phía trên editor' : 'Tab bar above the editor',
            t ? 'Click để chuyển tab, click X để đóng, chuột giữa để đóng nhanh' : 'Click to switch tabs, click X to close, middle-click to close quickly',
            t ? 'Mỗi tab giữ riêng editor content, kết quả, và vị trí cuộn. Tab DataGrid và tab Query có thể mở song song cho cùng connection.' : 'Each tab keeps its own editor content, results, and scroll position. DataGrid and Query tabs can be open side by side for the same connection.',
        ],
    ];

    const gridStops: [string, string, string][] = [
        [
            t ? 'Số "100 / 1,247 rows" ở footer' : 'The "100 / 1,247 rows" figure in the footer',
            t ? 'Số dòng đang hiển thị / tổng số dòng khớp query' : 'Rows currently shown / total rows matching the query',
            t ? 'Tổng được cache ngắn hạn trong Redis nên chuyển trang không phải COUNT(*) lại. Nếu tổng chưa xong sẽ hiển thị "…"' : 'The total is briefly cached in Redis so paging does not re-run COUNT(*). While pending it shows "…"',
        ],
        [
            t ? 'Số "23ms"' : 'The "23ms" figure',
            t ? 'Thời lượng thực thi query trên server' : 'How long the query took on the server',
            t ? 'Đo từ lúc server nhận SQL đến khi trả xong kết quả. Query > 1s nên xem EXPLAIN (nút Explain hoặc AI Explain).' : 'Measured from when the server receives the SQL until results return. Queries over 1s deserve an EXPLAIN (the Explain button or AI Explain).',
        ],
        [
            t ? 'Badge "windowed" / "cached"' : 'The "windowed" / "cached" badge',
            t ? 'Cho biết dữ liệu đến từ đâu' : 'Tells you where the data came from',
            t ? '"windowed" = server chỉ trả đúng trang đang xem; "cached" = kết quả lấy từ cache ngắn hạn, gần như tức thì.' : '"windowed" = the server returned only the visible page; "cached" = the result came from the short-term cache, near-instant.',
        ],
        [
            t ? 'Nút Previous / Next / page jump' : 'Previous / Next / page-jump controls',
            t ? 'Chuyển trang dữ liệu' : 'Moves through data pages',
            t ? 'Server tự áp LIMIT/OFFSET tương ứng — bạn không phải tự viết phân trang trong SQL.' : 'The server applies the matching LIMIT/OFFSET — you never have to write pagination into your SQL.',
        ],
        [
            t ? 'Nút Export (CSV/JSON)' : 'Export button (CSV/JSON)',
            t ? 'Xuất kết quả đang hiển thị ra file' : 'Exports the displayed result to a file',
            t ? 'CSV giữ encoding và delimiter đúng chuẩn Excel; JSON giữ nguyên cấu trúc nested. Chỉ xuất đúng trang đang xem — cuộn đủ rồi xuất.' : 'CSV preserves Excel-safe encoding and delimiters; JSON keeps nested structure. Only the visible page is exported — page through first if you need more.',
        ],
    ];

    const dashboardStops: [string, string, string][] = [
        [
            t ? 'Số "Active Connections"' : 'The "Active Connections" number',
            t ? 'Số connection bạn đã lưu' : 'How many connections you have saved',
            t ? 'Đếm mọi connection của bạn và của organization mà bạn là thành viên.' : 'Counts your own connections plus those of organizations you belong to.',
        ],
        [
            t ? 'Số "Queries Run"' : 'The "Queries Run" number',
            t ? 'Số query đã chạy trong phiên làm việc hiện tại' : 'Queries executed in the current working session',
            t ? 'Đếm từ lịch sử query trong phiên — reload trang sẽ reset về 0. Xem lịch sử đầy đủ qua Query History dialog.' : 'Counts from this session\'s query history — reloading resets it to 0. See the full history via the Query History dialog.',
        ],
        [
            t ? 'Số "Tables Accessed"' : 'The "Tables Accessed" number',
            t ? 'Số node cây sidebar bạn đã mở rộng' : 'How many sidebar tree nodes you expanded',
            t ? 'Ước lượng mức độ khám phá schema của bạn trong phiên — mỗi bảng/view bạn từng mở để xem đều được tính.' : 'An estimate of how much schema you explored this session — every table/view you opened to view is counted.',
        ],
        [
            t ? 'Danh sách "Recent Dashboards"' : 'The "Recent Dashboards" list',
            t ? 'Click một dashboard để mở tab xem nó' : 'Click a dashboard to open it in a tab',
            t ? 'Mỗi dòng hiện tên, số widget, visibility (private/team), và ngày cập nhật. Nút Share để mời đồng nghiệp xem.' : 'Each row shows the name, widget count, visibility (private/team), and last-updated date. The Share button invites teammates.',
        ],
        [
            t ? 'Khung "Team Activity"' : 'The "Team Activity" feed',
            t ? 'Theo dõi ai vừa làm gì trong organization' : 'Tracks who did what in the organization',
            t ? 'Hiển thị các sự kiện gần nhất: query được share, dashboard được sửa, comment mới. Số badge nhỏ là tổng sự kiện chưa xem.' : 'Shows recent events: shared queries, dashboard edits, new comments. The small badge counts unread events.',
        ],
    ];

    const renderStops = (items: TourStop[]) => (
        <div className="space-y-3">
            {items.map((item) => (
                <div key={item.where} className="p-4 border rounded-xl bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                        <MousePointerClick className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-bold">{item.where}</span>
                    </div>
                    <p className="text-xs text-foreground mb-1">
                        <span className="font-semibold">{t ? 'Làm gì: ' : 'What to do: '}</span>
                        {item.what}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-semibold">{t ? 'Tác dụng: ' : 'Why it matters: '}</span>
                        {item.why}
                    </p>
                </div>
            ))}
        </div>
    );

    return (
        <DocPageLayout
            title={t ? 'Hướng dẫn giao diện (UI Tour)' : 'UI Tour'}
            subtitle={t
                ? 'Click vào đâu, cái gì xảy ra, và những con số trên màn hình nói lên điều gì — từng vùng một của workspace.'
                : 'Where to click, what happens, and what the numbers on screen mean — one workspace area at a time.'}
            gradient
        >
            <Callout type="info">
                <p className="text-sm">
                    {t
                        ? 'Trang này là bản đồ chỉ đường: mỗi mục gồm "click vào đâu" → "làm gì" → "tác dụng là gì". Các trang chuyên sâu (Editor, Result Grid, AI...) nằm ở các mục tương ứng trong menu tài liệu.'
                        : 'This page is a road map: every item covers "where to click" → "what to do" → "why it matters". Deep dives (Editor, Result Grid, AI...) live in their own doc sections.'}
                </p>
            </Callout>

            <DocSection title={t ? '1. Sidebar trái — điều hướng dữ liệu' : '1. Left sidebar — data navigation'}>
                <Prose>
                    {t
                        ? 'Sidebar là nơi bạn bắt đầu mọi phiên làm việc: chọn connection, duyệt schema, và mở bảng.'
                        : 'The sidebar is where every session starts: pick a connection, browse the schema, and open tables.'}
                </Prose>
                {renderStops(sidebarStops.map(([where, what, why]) => ({ where, what, why })))}
            </DocSection>

            <DocSection title={t ? '2. Editor & thanh công cụ — viết và chạy SQL' : '2. Editor & toolbar — writing and running SQL'}>
                <Prose>
                    {t
                        ? 'Thanh công cụ trên editor chứa mọi thao tác thực thi; đây là những nút bạn sẽ dùng nhiều nhất.'
                        : 'The toolbar above the editor holds every execution action; these are the buttons you will use most.'}
                </Prose>
                {renderStops(editorStops.map(([where, what, why]) => ({ where, what, why })))}
            </DocSection>

            <DocSection title={t ? '3. Result Grid & footer — đọc kết quả' : '3. Result Grid & footer — reading results'}>
                <Prose>
                    {t
                        ? 'Footer của lưới kết quả chứa những con số quan trọng nhất để đánh giá query của bạn.'
                        : 'The result-grid footer holds the most important numbers for judging your query.'}
                </Prose>
                {renderStops(gridStops.map(([where, what, why]) => ({ where, what, why })))}
            </DocSection>

            <DocSection title={t ? '4. Dashboard — những con số nói lên điều gì' : '4. Dashboard — what the numbers mean'}>
                <Prose>
                    {t
                        ? 'Dashboard chào sân bạn mỗi lần mở app; các thẻ số không chỉ để trang trí.'
                        : 'The dashboard greets you every launch; its number cards are not just decoration.'}
                </Prose>
                {renderStops(dashboardStops.map(([where, what, why]) => ({ where, what, why })))}
            </DocSection>

            <DocSection title={t ? '5. Các vùng khác — tóm tắt nhanh' : '5. Other areas — quick reference'}>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            icon: <Bot className="w-5 h-5 text-violet-500" />,
                            title: t ? 'AI Panel (Ctrl+J)' : 'AI Panel (Ctrl+J)',
                            desc: t ? 'Trò chuyện với AI về dữ liệu của bạn. Chọn model/routing mode ở đầu panel, gõ prompt ở dưới, đính kèm ảnh/PDF bằng nút kẹp giấy.' : 'Chat with the AI about your data. Pick model/routing mode at the top, type prompts at the bottom, attach images/PDFs with the paperclip.',
                        },
                        {
                            icon: <BarChart3 className="w-5 h-5 text-blue-500" />,
                            title: t ? 'Dashboard tab (biểu đồ)' : 'Dashboard tab (charts)',
                            desc: t ? 'Mở từ Recent Dashboards hoặc tạo mới. Thêm widget chart từ kết quả query; kéo thả để sắp xếp; Share để mời team.' : 'Open from Recent Dashboards or create new. Add chart widgets from query results; drag to arrange; Share to invite the team.',
                        },
                        {
                            icon: <FileCode className="w-5 h-5 text-emerald-500" />,
                            title: t ? 'Query History dialog' : 'Query History dialog',
                            desc: t ? 'Toàn bộ query đã chạy kèm thời lượng và trạng thái. Click một entry để chèn lại vào editor; lọc theo connection.' : 'Every query you ran with duration and status. Click an entry to re-insert it into the editor; filter by connection.',
                        },
                        {
                            icon: <Users className="w-5 h-5 text-amber-500" />,
                            title: t ? 'TeamPage' : 'TeamPage',
                            desc: t ? 'Quản lý organization: thành viên, vai trò, teamspace, policy share resource, và backup/restore.' : 'Manage the organization: members, roles, teamspaces, resource share policies, and backup/restore.',
                        },
                        {
                            icon: <Activity className="w-5 h-5 text-rose-500" />,
                            title: t ? 'Active Queries panel' : 'Active Queries panel',
                            desc: t ? 'Liệt kê query đang chạy trên connection với durationMs; nút hủy bên từng dòng để dừng ngay.' : 'Lists queries currently running on the connection with durationMs; the cancel button on each row stops it immediately.',
                        },
                        {
                            icon: <Database className="w-5 h-5 text-cyan-500" />,
                            title: t ? 'Connection health badge' : 'Connection health badge',
                            desc: t ? 'Chấm màu cạnh tên connection: xanh = healthy, đỏ = lỗi (di chuột để xem thông báo lỗi), xám = chưa kiểm tra.' : 'The colored dot next to a connection name: green = healthy, red = error (hover for the message), gray = not yet checked.',
                        },
                    ].map((item) => (
                        <div key={item.title} className="p-5 border rounded-2xl bg-card/50 space-y-2">
                            <div className="flex items-center gap-2">
                                {item.icon}
                                <h4 className="font-bold text-sm">{item.title}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSubSection title={t ? 'Bắt đầu từ đâu?' : 'Where to start?'}>
                <Prose>
                    {t
                        ? 'Nếu bạn mới dùng app: mở sidebar → tạo connection (nút +) → test → double-click một bảng để mở DataGrid → chuyển sang tab Query (Ctrl+N) viết SQL đầu tiên → Ctrl+Enter để chạy. Đó là vòng lặp cốt lõi của Data Explorer.'
                        : 'If you are new: open the sidebar → create a connection (+ button) → test it → double-click a table to open the DataGrid → switch to a Query tab (Ctrl+N) and write your first SQL → Ctrl+Enter to run. That is the core Data Explorer loop.'}
                </Prose>
            </DocSubSection>
        </DocPageLayout>
    );
}
