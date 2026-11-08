import { MousePointerClick, Database, FileCode, Bot, BarChart3, Users, Activity } from 'lucide-react';
import { publicPath } from '@/core/seo/publicRoutes';
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
            t ? 'Ô tìm kiếm (Ctrl/Cmd+K)' : 'Search box (Ctrl/Cmd+K)',
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
            t ? 'Nút Run hoặc Ctrl/Cmd+Enter' : 'Run button or Ctrl/Cmd+Enter',
            t ? 'Thực thi SQL đang chọn (hoặc toàn bộ nếu không chọn gì)' : 'Executes the selected SQL (or everything if nothing is selected)',
            t ? 'Chỉ phần được bôi đen mới chạy — hữu ích khi file có nhiều câu. Query rủi ro (DROP, DELETE không WHERE) sẽ hiện dialog xác nhận trước.' : 'Only the highlighted portion runs — useful in multi-statement files. Risky queries (DROP, DELETE without WHERE) show a confirmation dialog first.',
        ],
        [
            t ? 'Nút Stop' : 'Stop button',
            t ? 'Yêu cầu hủy query đang chạy' : 'Requests cancellation of the running query',
            t ? 'Dùng Stop trên toolbar của query đang chạy; backend gọi cơ chế cancel phù hợp với engine. Cancel không bảo đảm tức thì hoặc rollback các ghi đã hoàn thành; kiểm tra trạng thái trước khi chạy lại.' : 'Use Stop in the running query toolbar; the backend invokes the engine cancellation path. Cancellation is not guaranteed to be immediate or roll back completed writes; inspect the state before retrying.',
        ],
        [
            t ? 'Nút Format trên toolbar' : 'Format button on the toolbar',
            t ? 'Định dạng SQL bằng nút trực tiếp' : 'Formats SQL using the direct button',
            t ? 'Không có binding SQL Shift+Alt+F được cấu hình trong app. Xem lại query sau format; định dạng không phải kiểm tra tính đúng của SQL theo dialect.' : 'The app does not configure a SQL Shift+Alt+F binding. Review the query after formatting; formatting is not dialect-aware SQL validation.',
        ],
        [
            t ? 'Nút AI hoặc Ctrl/Cmd+I' : 'AI button or Ctrl/Cmd+I',
            t ? 'Mở panel AI Assistant' : 'Opens the AI Assistant panel',
            t ? 'AI tùy chọn có thể dùng ngữ cảnh schema để tạo, giải thích hoặc sửa query. Xem lại nội dung và phạm vi dữ liệu gửi tới provider trước khi dùng.' : 'Optional AI can use schema context to draft, explain or fix queries. Review its output and the data sent to the provider before using it.',
        ],
        [
            t ? 'Thanh tab phía trên editor' : 'Tab bar above the editor',
            t ? 'Click chuyển tab, X hoặc chuột giữa để đóng, double-click tên để đổi tên' : 'Click to switch, X or middle-click to close, double-click the name to rename',
            t ? 'Ctrl/Cmd+N tạo Query tab, +D nhân bản và +Shift+W đóng tất cả. Các tab có nội dung/metadata riêng trong store chung; đóng tab không tự lưu query thành tài nguyên trên server.' : 'Ctrl/Cmd+N creates a Query tab, +D duplicates and +Shift+W closes all. Tabs keep distinct content/metadata in the shared store; closing does not save a query as a server resource.',
        ],
    ];

    const gridStops: [string, string, string][] = [
        [
            t ? 'Số "100 / 1,247 rows" ở footer' : 'The "100 / 1,247 rows" figure in the footer',
            t ? 'Số dòng đang hiển thị / tổng số dòng khớp query' : 'Rows currently shown / total rows matching the query',
            t ? 'Số dòng trang và total từ server khi có. Total có thể được cache ngắn hạn; filter cục bộ không làm total thành số khớp của cả bảng. Không coi dữ liệu nhiều trang là snapshot nhất quán.' : 'Page row count and server total when available. Totals can be briefly cached; a local filter does not turn the total into a whole-table match count. Multiple pages are not necessarily one consistent snapshot.',
        ],
        [
            t ? 'Số "23ms"' : 'The "23ms" figure',
            t ? 'Thời lượng thực thi query trên server' : 'How long the query took on the server',
            t ? 'Thời lượng do response báo, không phải đo độ trễ toàn trình duyệt. Nếu cần xem query plan, chạy lệnh EXPLAIN phù hợp với engine trong editor; không có nút standalone EXPLAIN đang được nối vào UI.' : 'Duration is reported by the response, not total browser latency. To inspect a plan, run the appropriate engine EXPLAIN statement in the editor; a standalone EXPLAIN button is not wired into the current UI.',
        ],
        [
            t ? 'Trạng thái giới hạn trong kết quả' : 'Result limit metadata',
            t ? 'Kiểm tra giới hạn và nguồn dữ liệu khi có' : 'Check the applied limit and source when available',
            t ? 'appliedLimit, limitSource và truncated là metadata response về cửa sổ/giới hạn dữ liệu. Không giả định mọi lưới luôn có badge literal "windowed" hoặc "cached", hoặc cache đồng nghĩa dữ liệu mới nhất.' : 'appliedLimit, limitSource and truncated are response metadata about data windows/limits. Do not assume every grid always displays literal "windowed" or "cached" badges, or that a cache implies fresh data.',
        ],
        [
            t ? 'Nút Previous / Next / page jump' : 'Previous / Next / page-jump controls',
            t ? 'Chuyển trang dữ liệu' : 'Moves through data pages',
            t ? 'Server tự áp LIMIT/OFFSET tương ứng — bạn không phải tự viết phân trang trong SQL.' : 'The server applies the matching LIMIT/OFFSET — you never have to write pagination into your SQL.',
        ],
        [
            t ? 'Xuất ở DataGrid / Query Result' : 'DataGrid / Query Result export',
            t ? 'Tải trang dữ liệu hiện tại' : 'Downloads the current data page',
            t ? 'DataGrid có CSV, JSON và SQL INSERT cho trang đã tải/sau lọc cục bộ. Query Result chỉ có CSV trang hiện tại. Chuyển trang không tích lũy dữ liệu cho lần export tiếp theo; không có XLSX hoặc full-backup ở đây.' : 'DataGrid offers CSV, JSON and SQL INSERT for the loaded/locally filtered page. Query Result offers current-page CSV only. Paging does not accumulate data for the next export; there is no XLSX or full backup here.',
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
                        ? 'DataGrid là tab bảng có Edit → pending → Save nếu được cấp quyền; Query Result chỉ đọc. Lọc DataGrid chỉ trên trang đã tải, còn sort đầu tiên gửi tới server; không coi lọc là tìm cả bảng.'
                        : 'DataGrid is the table tab with Edit → pending → Save when permitted; Query Result is read-only. DataGrid filtering only covers the loaded page, while the first sort goes to the server; filtering is not a whole-table search.'}
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
                            title: t ? 'AI Panel (Ctrl/Cmd+I)' : 'AI Panel (Ctrl/Cmd+I)',
                            desc: t ? 'Trò chuyện với AI về dữ liệu của bạn. Chọn model/routing mode ở đầu panel, gõ prompt ở dưới, đính kèm ảnh/PDF bằng nút kẹp giấy.' : 'Chat with the AI about your data. Pick model/routing mode at the top, type prompts at the bottom, attach images/PDFs with the paperclip.',
                        },
                        {
                            icon: <BarChart3 className="w-5 h-5 text-blue-500" />,
                            title: t ? 'Dashboard tab (biểu đồ)' : 'Dashboard tab (charts)',
                            desc: t ? 'Mở từ Recent Dashboards hoặc tạo mới. Thêm widget chart từ kết quả query; kéo thả để sắp xếp; Share để mời team.' : 'Open from Recent Dashboards or create new. Add chart widgets from query results; drag to arrange; Share to invite the team.',
                        },
                        {
                            icon: <FileCode className="w-5 h-5 text-emerald-500" />,
                            title: t ? 'Query History (Ctrl/Cmd+H)' : 'Query History (Ctrl/Cmd+H)',
                            desc: t ? 'Xem query đã chạy kèm thời lượng và trạng thái. Ctrl/Cmd+H mở lịch sử của app, không phải Find & Replace; dùng menu Find của Monaco để tìm trong editor.' : 'Review executed queries, duration and status. Ctrl/Cmd+H opens app history, not Find & Replace; use Monaco Find actions to search the editor.',
                        },
                        {
                            icon: <Users className="w-5 h-5 text-amber-500" />,
                            title: t ? 'TeamPage' : 'TeamPage',
                            desc: t ? 'Quản lý organization: thành viên, vai trò, teamspace, policy share resource, và backup/restore.' : 'Manage the organization: members, roles, teamspaces, resource share policies, and backup/restore.',
                        },
                        {
                            icon: <Activity className="w-5 h-5 text-rose-500" />,
                            title: t ? 'Active Queries panel' : 'Active Queries panel',
                            desc: t ? 'Liệt kê query đang chạy cùng durationMs; nút hủy từng dòng yêu cầu cancel. Kiểm tra trạng thái hoàn tất và dữ liệu đã ghi trước khi thử lại.' : 'Lists active queries and durationMs; each cancel button requests cancellation. Check completion and any writes before retrying.',
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
                        ? 'Bắt đầu bằng sidebar → tạo connection (+) → kiểm tra URI/TLS và Test → mở bảng DataGrid → Ctrl/Cmd+N tạo Query tab → Ctrl/Cmd+Enter chạy. Ctrl/Cmd+J mở/ẩn kết quả và Ctrl/Cmd+I mở/ẩn AI. Với MongoDB, dùng NoSQL Studio và payload JSON MQL thay cho SQL.'
                        : 'Start with the sidebar → create a connection (+) → check URI/TLS and Test → open a DataGrid table → Ctrl/Cmd+N creates a Query tab → Ctrl/Cmd+Enter runs it. Ctrl/Cmd+J toggles results and Ctrl/Cmd+I toggles AI. For MongoDB, use NoSQL Studio and JSON MQL payloads instead of SQL.'}
                </Prose>
                <Prose>
                    <a href={publicPath(lang, '/docs/first-query')}>{t ? 'Truy vấn đầu tiên' : 'First query'}</a>{' · '}
                    <a href={publicPath(lang, '/docs/database-capabilities')}>{t ? 'Khả năng theo engine' : 'Capabilities by engine'}</a>{' · '}
                    <a href={publicPath(lang, '/docs/data-handling')}>{t ? 'Xử lý dữ liệu AI' : 'AI data handling'}</a>
                </Prose>
            </DocSubSection>
        </DocPageLayout>
    );
}
