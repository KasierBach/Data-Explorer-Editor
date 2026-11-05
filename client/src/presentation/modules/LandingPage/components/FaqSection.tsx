import React from 'react';

interface FaqSectionProps {
    lang: string;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ lang }) => {
    const items = lang === 'vi'
        ? [
            {
                question: 'Data Explorer hỗ trợ những database nào?',
                answer: 'Hiện có 9 engine được đăng ký: PostgreSQL, CockroachDB, MySQL, MariaDB, SQL Server, MongoDB (kể cả Atlas SRV), SQLite, ClickHouse và Redis. Khả năng query, schema và chỉnh sửa khác nhau theo engine; xem tài liệu để chọn đúng luồng cho database của bạn.',
            },
            {
                question: 'Có cần cài đặt gì để bắt đầu?',
                answer: 'Data Explorer chạy trong trình duyệt. Tính năng cần đến một backend: tự host bằng Docker Compose (kèm PostgreSQL và Redis cho dữ liệu ứng dụng) hoặc chạy chế độ development với Node.js 22. Các database bạn muốn duyệt kết nối qua saved connection, không cần cài thêm gì trên máy khách.',
            },
            {
                question: 'Thông tin kết nối được lưu và truyền thế nào?',
                answer: 'Saved connection được lưu trong database của ứng dụng; mật khẩu được mã hóa AES-256-GCM trước khi ghi xuống. TLS phụ thuộc vào engine và cấu hình kết nối/triển khai; kiểm tra các cài đặt này trước khi dùng database từ xa. Mỗi kết nối có thể bật/tắt riêng quyền chạy query, sửa schema hay import/export.',
            },
            {
                question: 'AI gửi dữ liệu gì và cấu hình ra sao?',
                answer: 'Mặc định AI nhận metadata schema (bảng, cột, quan hệ) chứ không đọc giá trị dòng. Nội dung bạn nhập và tệp đính kèm được gửi tới provider đã cấu hình. Bạn chọn model riêng cho từng vai trò trong Profile → Configure AI, và có thể thêm provider OpenAI-compatible của riêng mình.',
            },
            {
                question: 'Free và Pro khác nhau thế nào?',
                answer: 'Gói Free gồm workspace SQL/NoSQL local, trợ lý AI cơ bản và duyệt schema. Pro là trạng thái 30 hoặc 365 ngày, kích hoạt sau khi webhook từ MoMo/ZaloPay xác nhận thanh toán. Ma trận quyền lợi chi tiết của Pro đang chờ phê duyệt sản phẩm nên chưa được quảng bá trên trang này.',
            },
        ]
        : [
            {
                question: 'Which databases does Data Explorer support?',
                answer: 'Nine engines are registered today: PostgreSQL, CockroachDB, MySQL, MariaDB, SQL Server, MongoDB (including Atlas SRV), SQLite, ClickHouse, and Redis. Query, schema, and editing capabilities differ by engine; check the documentation for the workflow that fits your database.',
            },
            {
                question: 'What do I need to install to get started?',
                answer: 'Data Explorer runs in the browser. The features need a backend: self-host with Docker Compose (which includes PostgreSQL and Redis for application data) or run development mode with Node.js 22. Databases you want to browse connect through saved connections — nothing extra installs on the client.',
            },
            {
                question: 'How are connection details stored and transmitted?',
                answer: 'Saved connections are stored in the application database; passwords are encrypted with AES-256-GCM before they are written. TLS depends on the engine and connection/deployment settings; check these before using a remote database. Each connection can independently allow or block query execution, schema changes, and import/export.',
            },
            {
                question: 'What data does the AI send, and how is it configured?',
                answer: 'By default the AI receives schema metadata (tables, columns, relations) rather than row values. Text you submit and files you attach go to the configured provider. You pick models per role under Profile → Configure AI, and you can add your own OpenAI-compatible provider.',
            },
            {
                question: 'How do Free and Pro differ?',
                answer: 'Free includes the local SQL/NoSQL workspace, a basic AI assistant, and schema browsing. Pro is a 30- or 365-day status activated after a confirmed MoMo/ZaloPay webhook. The detailed Pro feature matrix is pending product approval, so it is not advertised on this page yet.',
            },
        ];

    return (
        <section className="lp-section">
            <div className="lp-container">
                <div className="mx-auto max-w-3xl">
                    <h2 className="lp-h2 text-center" style={{ color: 'var(--lp-text)' }}>
                        {lang === 'vi' ? 'Câu hỏi thường gặp' : 'Frequently asked questions'}
                    </h2>
                    <div className="mt-10 space-y-3">
                        {items.map((item) => (
                            <details
                                key={item.question}
                                className="group rounded-xl border px-5 py-4"
                                style={{ borderColor: 'var(--lp-border)', backgroundColor: 'var(--lp-surface)' }}
                            >
                                <summary className="cursor-pointer list-none text-base font-semibold marker:hidden" style={{ color: 'var(--lp-text)' }}>
                                    <span className="flex items-center justify-between gap-4">
                                        {item.question}
                                        <span aria-hidden="true" className="text-xl leading-none transition-transform group-open:rotate-45" style={{ color: 'var(--lp-accent)' }}>+</span>
                                    </span>
                                </summary>
                                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--lp-muted)' }}>
                                    {item.answer}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
