import { DocPageLayout, DocSection, Prose, Callout, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ResultsSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Lưới kết quả (Result Grid)' : 'Result Grid'}
            subtitle={t
                ? 'Tương tác với dữ liệu truy vấn một cách trực quan và mạnh mẽ — từ ô dữ liệu nhỏ nhất đến tập hợp hàng triệu bản ghi.'
                : 'Interact with query data intuitively and powerfully — from the smallest cell to millions of records.'}
        >
            {/* Core Features */}
            <div className="grid md:grid-cols-3 gap-4">
                {[
                    { title: t ? 'Sắp xếp thông minh' : 'Smart Sorting', desc: t ? 'Nhấn vào tiêu đề cột để sắp xếp tăng/giảm dần. Hỗ trợ sắp xếp đa cột bằng cách giữ Shift và click thêm cột. Tự động nhận diện kiểu dữ liệu (số, text, ngày) để sắp xếp chính xác.' : 'Click column headers to sort ascending/descending. Multi-column sort by holding Shift and clicking additional columns. Auto-detects data types (number, text, date) for accurate sorting.' },
                    { title: t ? 'Lọc nhanh (Quick Filter)' : 'Quick Filter', desc: t ? 'Thanh tìm kiếm trực tiếp trên lưới lọc bản ghi real-time khi bạn gõ. Hỗ trợ lọc theo cột cụ thể hoặc tìm kiếm toàn bộ bản ghi. Regex được hỗ trợ với prefix "re:".' : 'Search bar directly on the grid filters records in real-time as you type. Supports column-specific filtering or full-record search. Regex supported with "re:" prefix.' },
                    { title: t ? 'Phân trang hiệu suất' : 'Performance Pagination', desc: t ? 'Xử lý hàng triệu bản ghi nhờ phân trang phía client với virtual scrolling. Chỉ render các dòng đang hiển thị — giữ tốc độ 60fps ngay cả với dataset 100K+ rows.' : 'Handles millions of records through client-side pagination with virtual scrolling. Only visible rows are rendered — maintaining 60fps even with 100K+ row datasets.' },
                ].map((feature, i) => (
                    <div key={i} className="p-6 border rounded-2xl bg-card space-y-2 hover:border-primary/50 transition-colors">
                        <h4 className="font-bold text-primary">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>

            {/* Cell Interactions */}
            <DocSection title={t ? 'Tương tác với ô dữ liệu' : 'Cell Interactions'}>
                <Prose>{t
                    ? 'Result Grid hỗ trợ nhiều cách tương tác trực tiếp với từng ô dữ liệu:'
                    : 'The Result Grid supports multiple ways to interact directly with individual cells:'}</Prose>
                <div className="space-y-3">
                    {[
                        { action: t ? 'Click vào ô' : 'Click on a cell', result: t ? 'Chọn ô và hiển thị nội dung đầy đủ ở thanh trạng thái phía dưới. Rất hữu ích cho các cột chứa text dài hoặc JSON.' : 'Select the cell and display full content in the bottom status bar. Very useful for columns with long text or JSON.' },
                        { action: t ? 'Double-click vào ô' : 'Double-click on a cell', result: t ? 'Mở chế độ xem mở rộng cho giá trị đó. Với cột JSON/JSONB, nội dung được format đẹp với syntax highlighting.' : 'Opens an expanded view for that value. For JSON/JSONB columns, content is beautifully formatted with syntax highlighting.' },
                        { action: t ? 'Ctrl + C' : 'Ctrl + C', result: t ? 'Copy giá trị của ô đang chọn. Nếu chọn nhiều ô, copy dưới dạng tab-separated values (paste được vào Excel).' : 'Copy the selected cell value. For multiple cells, copies as tab-separated values (paste into Excel).' },
                        { action: t ? 'Kéo rộng cột' : 'Resize column', result: t ? 'Kéo viền cột trong header để thay đổi độ rộng. Double-click viền cột để auto-fit theo nội dung.' : 'Drag column border in the header to resize. Double-click the column border to auto-fit by content.' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 border rounded-xl bg-muted/20">
                            <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-3 py-1 text-[10px] font-bold shadow-sm whitespace-nowrap">{item.action}</kbd>
                            <span className="text-sm text-muted-foreground leading-relaxed">{item.result}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Data Type Rendering */}
            <DocSection title={t ? 'Hiển thị theo Kiểu dữ liệu' : 'Data Type Rendering'}>
                <Prose>{t
                    ? 'Mỗi kiểu dữ liệu được render khác nhau trong lưới để dễ phân biệt:'
                    : 'Each data type is rendered differently in the grid for easy distinction:'}</Prose>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">{t ? 'Kiểu' : 'Type'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Hiển thị' : 'Display'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Ví dụ' : 'Example'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { type: 'NULL', display: t ? 'Badge xám với chữ "NULL"' : 'Gray badge with "NULL" text', example: <span className="bg-muted px-2 py-0.5 rounded text-[10px] text-muted-foreground italic">NULL</span> },
                                { type: 'Boolean', display: t ? 'Badge màu xanh/đỏ' : 'Blue/red colored badge', example: <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold">TRUE</span> },
                                { type: 'Number', display: t ? 'Căn phải, màu số' : 'Right-aligned, number color', example: <span className="text-blue-500 font-mono">42,195</span> },
                                { type: 'Date/Time', display: t ? 'Format ISO 8601' : 'ISO 8601 format', example: <span className="font-mono text-xs">2024-03-15T10:30:00Z</span> },
                                { type: 'JSON/JSONB', display: t ? 'Preview thu gọn, click để mở rộng' : 'Collapsed preview, click to expand', example: <span className="font-mono text-xs text-purple-500">{`{...}`}</span> },
                                { type: 'Text (dài)', display: t ? 'Cắt ngắn với "..." và tooltip' : 'Truncated with "..." and tooltip', example: <span className="text-xs">Lorem ipsum do...</span> },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-mono text-primary font-bold">{row.type}</td>
                                    <td className="p-4 text-muted-foreground">{row.display}</td>
                                    <td className="p-4">{row.example}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Execution Info */}
            <DocSection title={t ? 'Thông tin thực thi' : 'Execution Info'}>
                <Prose>{t
                    ? 'Sau mỗi truy vấn, thanh trạng thái phía dưới hiển thị các thông tin quan trọng giúp bạn đánh giá hiệu suất:'
                    : 'After each query, the bottom status bar displays important information to help evaluate performance:'}</Prose>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: t ? 'Số bản ghi' : 'Rows', example: '1,247 rows' },
                        { label: t ? 'Thời gian thực thi' : 'Execution Time', example: '23ms' },
                        { label: t ? 'Số cột' : 'Columns', example: '8 columns' },
                        { label: t ? 'Kích thước dữ liệu' : 'Data Size', example: '~245 KB' },
                    ].map((info, i) => (
                        <div key={i} className="p-4 border rounded-xl text-center bg-muted/10">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase block">{info.label}</span>
                            <span className="font-mono text-primary font-bold">{info.example}</span>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
