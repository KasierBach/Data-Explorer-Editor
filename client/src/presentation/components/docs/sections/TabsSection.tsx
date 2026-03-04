import { DocPageLayout, DocSection, Prose, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function TabsSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Quản lý Tab' : 'Tab Management'}
            subtitle={t
                ? 'Đa nhiệm hiệu quả với hệ thống quản lý tab thông minh — mỗi tab là một phiên làm việc SQL độc lập.'
                : 'Efficient multi-tasking with a smart tab management system — each tab is an independent SQL session.'}
        >
            {/* Working in parallel */}
            <div className="p-8 border rounded-3xl bg-card space-y-4">
                <h3 className="font-bold text-xl">{t ? 'Làm việc song song' : 'Work in Parallel'}</h3>
                <Prose>{t
                    ? 'Bạn có thể mở đồng thời nhiều tab truy vấn từ các cơ sở dữ liệu khác nhau. Mỗi tab duy trì phiên làm việc, kết quả truy vấn và lịch sử soạn thảo riêng biệt. Điều này cho phép bạn so sánh kết quả giữa các database, hoặc viết các truy vấn phụ thuộc lẫn nhau mà không cần chuyển đổi giữa các cửa sổ.'
                    : 'You can open multiple query tabs from different databases simultaneously. Each tab maintains its own session, query results, and editor history. This allows you to compare results across databases, or write interdependent queries without switching between windows.'}</Prose>
                <Prose>{t
                    ? 'Ví dụ: mở một tab kết nối tới PostgreSQL production để kiểm tra dữ liệu, đồng thời mở một tab khác kết nối tới MySQL staging để so sánh schema. Kết quả truy vấn của mỗi tab được lưu giữ độc lập — chuyển qua lại giữa các tab không làm mất kết quả trước đó.'
                    : 'Example: open one tab connected to PostgreSQL production to check data, while opening another tab connected to MySQL staging to compare schemas. Query results for each tab are independently preserved — switching between tabs doesn\'t lose previous results.'}</Prose>
            </div>

            {/* Tab Features */}
            <DocSection title={t ? 'Tính năng Tab' : 'Tab Features'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                        {
                            title: t ? 'Tự động Lưu' : 'Auto-Save',
                            desc: t
                                ? 'Nội dung tab được lưu tạm thời vào Local Storage của trình duyệt. Kể cả khi bạn vô tình đóng trình duyệt hoặc tải lại trang, mã SQL trong mỗi tab sẽ được phục hồi tự động khi bạn mở lại ứng dụng.'
                                : 'Tab content is temporarily saved to the browser\'s Local Storage. Even if you accidentally close the browser or reload the page, SQL code in each tab is automatically restored when you reopen the app.'
                        },
                        {
                            title: t ? 'Đổi tên linh hoạt' : 'Flexible Renaming',
                            desc: t
                                ? 'Nhấn đúp vào tên tab để đổi tên cho phù hợp với mục đích truy vấn — ví dụ: "Revenue Report Q4", "User Migration Script", hoặc "Debug: Missing Orders". Tên có ý nghĩa giúp bạn nhanh chóng định vị tab cần thiết khi làm việc với nhiều tab cùng lúc.'
                                : 'Double-click a tab name to rename it to match your query purpose — e.g., "Revenue Report Q4", "User Migration Script", or "Debug: Missing Orders". Meaningful names help quickly locate the right tab when working with many tabs.'
                        },
                        {
                            title: t ? 'Đóng và Sắp xếp' : 'Close & Reorder',
                            desc: t
                                ? 'Click nút X để đóng tab (có xác nhận nếu chưa lưu). Kéo thả để sắp xếp lại thứ tự tab theo ý muốn. Click chuột giữa (middle-click) để đóng nhanh tab mà không cần xác nhận.'
                                : 'Click the X button to close a tab (with confirmation if unsaved). Drag and drop to reorder tabs. Middle-click to quickly close a tab without confirmation.'
                        },
                        {
                            title: t ? 'Tab Insights' : 'Insights Tabs',
                            desc: t
                                ? 'Ngoài tab truy vấn SQL, bạn cũng có thể mở tab Insights (phân tích database) cho mỗi kết nối. Tab Insights hiển thị tổng quan về kích thước bảng, số phiên hoạt động, và sơ đồ quan hệ.'
                                : 'Besides SQL query tabs, you can also open Insights tabs (database analysis) for each connection. Insights tabs display table size overview, active session count, and relationship diagrams.'
                        },
                    ].map((item, i) => (
                        <div key={i} className="p-6 border rounded-2xl bg-muted/20 space-y-2">
                            <h4 className="font-bold">{item.title}</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Keyboard Shortcuts for Tabs */}
            <DocSection title={t ? 'Phím tắt quản lý Tab' : 'Tab Keyboard Shortcuts'}>
                <div className="space-y-2">
                    {[
                        { label: t ? 'Tab mới' : 'New Tab', key: 'Ctrl + N' },
                        { label: t ? 'Đóng tab hiện tại' : 'Close Current Tab', key: 'Ctrl + W' },
                        { label: t ? 'Chuyển sang tab tiếp theo' : 'Next Tab', key: 'Ctrl + Tab' },
                        { label: t ? 'Chuyển sang tab trước' : 'Previous Tab', key: 'Ctrl + Shift + Tab' },
                    ].map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                            <span className="text-sm font-medium">{s.label}</span>
                            <kbd className="bg-muted border border-muted-foreground/30 px-3 py-1.5 rounded-md shadow-sm font-mono text-[11px] font-bold text-primary">{s.key}</kbd>
                        </div>
                    ))}
                </div>
            </DocSection>

            <Callout type="tip">
                <p className="font-bold">{t ? '💡 Mẹo nâng cao' : '💡 Pro Tip'}</p>
                <p className="mt-1 text-muted-foreground">{t
                    ? 'Bạn có thể mở cùng lúc một tab truy vấn SQL và một tab Insights cho cùng một kết nối. Khi bạn chạy ALTER TABLE hoặc CREATE INDEX trong tab SQL, tab Insights sẽ tự động phản ánh thay đổi khi bạn refresh.'
                    : 'You can open both a SQL query tab and an Insights tab for the same connection simultaneously. When you run ALTER TABLE or CREATE INDEX in the SQL tab, the Insights tab will automatically reflect changes when refreshed.'}</p>
            </Callout>
        </DocPageLayout>
    );
}
