import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ExportSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Xuất dữ liệu' : 'Data Export'}
            subtitle={t
                ? 'Chia sẻ và lưu trữ kết quả phân tích dưới nhiều định dạng chuyên nghiệp, từ CSV đến SQL scripts.'
                : 'Share and store your analysis results in multiple professional formats, from CSV to SQL scripts.'}
        >
            {/* Formats Overview */}
            <DocSection title={t ? 'Định dạng xuất được hỗ trợ' : 'Supported Export Formats'}>
                <div className="space-y-4">
                    {[
                        {
                            format: 'CSV / Excel', icon: '📊',
                            desc: t
                                ? 'Xuất dữ liệu dạng comma-separated values. Có thể mở trực tiếp bằng Microsoft Excel, Google Sheets, hoặc bất kỳ phần mềm bảng tính nào. Headers cột được bao gồm theo mặc định.'
                                : 'Export data as comma-separated values. Can be opened directly in Microsoft Excel, Google Sheets, or any spreadsheet software. Column headers included by default.',
                            example: 'id,name,email,created_at\n1,"Alex Chen","alex@example.com","2024-01-15"\n2,"Sarah Miller","sarah@example.com","2024-02-20"'
                        },
                        {
                            format: 'JSON', icon: '📋',
                            desc: t
                                ? 'Xuất dưới dạng mảng JSON objects. Mỗi bản ghi là một object với key là tên cột. Phù hợp để import vào ứng dụng web, NoSQL databases, hoặc xử lý bằng Python/JavaScript.'
                                : 'Export as an array of JSON objects. Each record is an object with column names as keys. Suitable for importing into web apps, NoSQL databases, or processing with Python/JavaScript.',
                            example: '[\n  {"id": 1, "name": "Alex Chen", "email": "alex@example.com"},\n  {"id": 2, "name": "Sarah Miller", "email": "sarah@example.com"}\n]'
                        },
                        {
                            format: 'SQL INSERT', icon: '💾',
                            desc: t
                                ? 'Tạo kịch bản SQL INSERT INTO cho từng bản ghi. Phù hợp để migrate dữ liệu giữa các database hoặc tạo seed data cho môi trường phát triển. Tự động escape các ký tự đặc biệt trong giá trị.'
                                : 'Generate SQL INSERT INTO scripts for each record. Perfect for migrating data between databases or creating seed data for development environments. Automatically escapes special characters in values.',
                            example: "INSERT INTO users (id, name, email) VALUES\n  (1, 'Alex Chen', 'alex@example.com'),\n  (2, 'Sarah Miller', 'sarah@example.com');"
                        },
                    ].map((style, i) => (
                        <div key={i} className="border rounded-2xl bg-card overflow-hidden">
                            <div className="flex items-center gap-3 p-5 border-b bg-muted/10">
                                <span className="text-2xl">{style.icon}</span>
                                <div>
                                    <span className="font-bold block">{style.format}</span>
                                    <span className="text-xs text-muted-foreground">{style.desc}</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <CodeBlock title={t ? 'Ví dụ đầu ra' : 'Output Example'}>
                                    {style.example.split('\n').map((line, j) => (
                                        <CodeLine key={j}>{line}</CodeLine>
                                    ))}
                                </CodeBlock>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* How to Export */}
            <DocSection title={t ? 'Cách xuất dữ liệu' : 'How to Export'}>
                <Prose>{t
                    ? 'Sau khi chạy truy vấn và nhận kết quả trong Result Grid, bạn có thể xuất dữ liệu theo các bước sau:'
                    : 'After running a query and receiving results in the Result Grid, you can export data using these steps:'}</Prose>
                <div className="space-y-3">
                    {[
                        { step: '1', desc: t ? 'Nhìn vào góc trên bên phải của Result Grid — tìm icon Export (biểu tượng tải xuống ↓).' : 'Look at the top-right corner of the Result Grid — find the Export icon (download ↓ symbol).' },
                        { step: '2', desc: t ? 'Click vào icon Export — một dropdown menu hiện ra với các tùy chọn: CSV, JSON, hoặc SQL INSERT.' : 'Click the Export icon — a dropdown menu appears with options: CSV, JSON, or SQL INSERT.' },
                        { step: '3', desc: t ? 'Chọn định dạng mong muốn — file sẽ được tải xuống tự động với tên mặc định dựa trên tên tab hiện tại.' : 'Select your desired format — the file downloads automatically with a default name based on the current tab name.' },
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 items-start p-4 border rounded-xl bg-muted/20">
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">{item.step}</div>
                            <p className="text-sm text-muted-foreground leading-relaxed pt-1">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <Callout type="info">
                <p className="font-bold">{t ? '📌 Lưu ý quan trọng' : '📌 Important Note'}</p>
                <p className="mt-1 text-muted-foreground">{t
                    ? 'Tính năng Export xuất toàn bộ kết quả truy vấn (không chỉ trang hiện tại nếu đang phân trang). Nếu kết quả có hàng triệu bản ghi, hãy thêm LIMIT vào truy vấn trước khi xuất để tránh file quá lớn.'
                    : 'The Export feature exports all query results (not just the current page if paginated). If results contain millions of records, add LIMIT to your query before exporting to avoid overly large files.'}</p>
            </Callout>
        </DocPageLayout>
    );
}
