import { DocPageLayout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function FaqSection({ lang }: Props) {
    const t = lang === 'vi';

    const faqs = [
        {
            q: t ? 'Tôi có cần cài đặt database trước khi dùng Data Explorer không?' : 'Do I need to install a database before using Data Explorer?',
            a: t ? 'Có — bạn cần có ít nhất một instance database đang chạy (PostgreSQL, MySQL hoặc SQL Server) để kết nối. Data Explorer là công cụ quản lý, không phải database server. Tuy nhiên, bạn có thể nhanh chóng tạo một container Docker cho mục đích thử nghiệm (xem phần Installation).' : 'Yes — you need at least one running database instance (PostgreSQL, MySQL, or SQL Server) to connect to. Data Explorer is a management tool, not a database server. However, you can quickly spin up a Docker container for testing purposes (see Installation section).'
        },
        {
            q: t ? 'Dữ liệu của tôi có bị gửi lên cloud không?' : 'Is my data sent to the cloud?',
            a: t ? 'Không. Data Explorer chạy hoàn toàn trên máy/server của bạn (Local-First). Dữ liệu thực trong database không bao giờ rời khỏi mạng nội bộ. Chỉ khi bạn sử dụng tính năng AI, metadata lược đồ (tên bảng, tên cột) mới được gửi tới Google Gemini API — nhưng dữ liệu dòng (rows) thì không bao giờ.' : 'No. Data Explorer runs entirely on your machine/server (Local-First). Actual database data never leaves your internal network. Only when using AI features, schema metadata (table names, column names) is sent to Google Gemini API — but row data is never sent.'
        },
        {
            q: t ? 'Data Explorer có miễn phí không?' : 'Is Data Explorer free?',
            a: t ? 'Data Explorer là mã nguồn mở. Bạn có thể tự host trên máy tính cá nhân hoặc server nội bộ hoàn toàn miễn phí. Để sử dụng tính năng AI, bạn cần API key từ Google AI Studio (miễn phí cho free tier với giới hạn 60 requests/phút).' : 'Data Explorer is open source. You can self-host on your personal machine or internal server completely free. For AI features, you need an API key from Google AI Studio (free tier with 60 requests/minute limit).'
        },
        {
            q: t ? 'Làm sao để thêm hỗ trợ cho database engine mới (ví dụ: SQLite)?' : 'How to add support for a new database engine (e.g., SQLite)?',
            a: t ? 'Nhờ Strategy Pattern, bạn chỉ cần tạo class mới implements IDatabaseAdapter interface (ví dụ: SQLiteAdapter) với các method: connect(), disconnect(), executeQuery(), introspect(). Không cần thay đổi bất kỳ code nào ở Domain Layer hoặc các adapter khác.' : 'Thanks to the Strategy Pattern, you only need to create a new class implementing IDatabaseAdapter interface (e.g., SQLiteAdapter) with methods: connect(), disconnect(), executeQuery(), introspect(). No changes needed to the Domain Layer or other adapters.'
        },
        {
            q: t ? 'Tại sao kết nối của tôi bị từ chối (Connection refused)?' : 'Why is my connection being refused?',
            a: t
                ? 'Nguyên nhân phổ biến: (1) Database chưa khởi động — kiểm tra bằng systemctl status hoặc docker ps. (2) Sai port — xác nhận database đang lắng nghe trên port bạn nhập. (3) Firewall chặn — mở port trong Windows Firewall hoặc iptables. (4) listen_addresses — PostgreSQL mặc định chỉ nghe localhost, cần thay đổi thành 0.0.0.0 nếu truy cập từ xa.'
                : 'Common causes: (1) Database not started — check with systemctl status or docker ps. (2) Wrong port — verify the database is listening on the port you entered. (3) Firewall blocking — open the port in Windows Firewall or iptables. (4) listen_addresses — PostgreSQL defaults to localhost only, change to 0.0.0.0 for remote access.'
        },
        {
            q: t ? 'AI không hoạt động / trả về lỗi API key' : 'AI not working / API key error',
            a: t ? 'Kiểm tra: (1) Biến GEMINI_API_KEY trong file server/.env đã được set chưa. (2) API key có hợp lệ không — test bằng cách gọi trực tiếp từ Google AI Studio. (3) Đã vượt quota free tier chưa (~60 requests/phút). (4) Backend server đã được restart sau khi thay đổi .env chưa (NestJS cần restart để đọc lại env).' : 'Check: (1) GEMINI_API_KEY in server/.env is properly set. (2) API key is valid — test by calling directly from Google AI Studio. (3) Free tier quota (~60 requests/min) not exceeded. (4) Backend server was restarted after changing .env (NestJS needs restart to re-read env).'
        },
        {
            q: t ? 'Tôi bị mất phiên đăng nhập sau khi restart server' : 'Login session lost after server restart',
            a: t ? 'Nếu bạn không đặt JWT_SECRET cố định trong .env, server sẽ tạo secret ngẫu nhiên mỗi lần khởi động — khiến tất cả JWT token cũ bị invalidate. Giải pháp: thêm một giá trị cố định vào JWT_SECRET và giữ nguyên nó giữa các lần restart.' : 'If you don\'t set a fixed JWT_SECRET in .env, the server generates a random secret on each startup — invalidating all old JWT tokens. Solution: add a fixed value to JWT_SECRET and keep it consistent across restarts.'
        },
        {
            q: t ? 'Kết quả truy vấn quá lớn, trình duyệt bị chậm' : 'Query results too large, browser slows down',
            a: t ? 'Result Grid sử dụng virtual scrolling, nhưng nếu truy vấn trả về hàng triệu dòng, trình duyệt vẫn cần xử lý metadata. Giải pháp: (1) Thêm LIMIT vào truy vấn (ví dụ: LIMIT 10000). (2) Sử dụng WHERE để lọc trước. (3) Dùng pagination phía SQL (OFFSET / FETCH NEXT).' : 'Result Grid uses virtual scrolling, but if queries return millions of rows, the browser still needs to process metadata. Solutions: (1) Add LIMIT to queries (e.g., LIMIT 10000). (2) Use WHERE to filter first. (3) Use SQL-side pagination (OFFSET / FETCH NEXT).'
        },
        {
            q: t ? 'Làm sao lưu truy vấn SQL để dùng lại?' : 'How to save SQL queries for reuse?',
            a: t ? 'Hiện tại, nội dung tab được lưu tạm vào Local Storage của trình duyệt — kể cả khi reload trang, nội dung vẫn được phục hồi. Tuy nhiên, nếu xóa dữ liệu trình duyệt thì sẽ mất. Khuyến nghị: copy các truy vấn quan trọng vào file .sql trên máy.' : 'Currently, tab content is temporarily saved to browser Local Storage — even after page reload, content is restored. However, clearing browser data will lose it. Recommendation: copy important queries to .sql files on your machine.'
        },
        {
            q: t ? 'Tại sao dự án lại chia nhỏ nhiều Service như Otp, Seed, Token?' : 'Why split into many small services like Otp, Seed, Token?',
            a: t ? 'Đây là áp dụng nguyên tắc Single Responsibility (SRP). Việc chia nhỏ giúp code dễ test (unit test), dễ bảo trì và tránh việc một file "God Service" phình to hàng nghìn dòng. Nó cũng giúp team collab tốt hơn mà không bị xung đột code.' : 'This follows the Single Responsibility Principle (SRP). Splitting makes code easier to test (unit test), maintain, and prevents "God Service" files from growing to thousands of lines. It also improves team collaboration with fewer merge conflicts.'
        },
        {
            q: t ? 'Data Explorer có hỗ trợ CI/CD không?' : 'Does Data Explorer support CI/CD?',
            a: t ? 'Có. Bạn có thể tận dụng Vitest để chạy unit tests trong GitHub Actions. File cấu hình Docker Compose cũng sẵn sàng để deploy lên các nền tảng như Render, Railway hoặc tự host trên VPS thông qua Coolify/Portainer.' : 'Yes. You can leverage Vitest to run unit tests in GitHub Actions. The Docker Compose configuration is also ready for deployment on platforms like Render, Railway, or self-hosting on VPS via Coolify/Portainer.'
        },
    ];

    return (
        <DocPageLayout
            title={t ? 'Câu hỏi Thường gặp & Khắc phục sự cố' : 'FAQ & Troubleshooting'}
            subtitle={t
                ? 'Tổng hợp các câu hỏi phổ biến nhất và hướng dẫn xử lý các lỗi thường gặp khi sử dụng Data Explorer.'
                : 'Collection of the most common questions and guides for handling frequent issues when using Data Explorer.'}
        >
            <div className="space-y-4">
                {faqs.map((faq, i) => (
                    <details key={i} className="group border rounded-2xl bg-card overflow-hidden">
                        <summary className="flex items-center gap-4 p-5 cursor-pointer hover:bg-muted/30 transition-colors list-none">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm shrink-0 group-open:bg-primary group-open:text-primary-foreground transition-colors">
                                {i + 1}
                            </div>
                            <span className="font-bold text-sm">{faq.q}</span>
                            <span className="ml-auto text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="px-5 pb-5 pt-0">
                            <div className="pl-12 border-l-2 border-primary/20 ml-4">
                                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                            </div>
                        </div>
                    </details>
                ))}
            </div>
        </DocPageLayout>
    );
}
