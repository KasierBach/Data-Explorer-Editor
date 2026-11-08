import { publicPath } from '@/core/seo/publicRoutes';
import { Callout, DocPageLayout, DocSection, Prose } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ResultsSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'DataGrid & Query Result' : 'DataGrid & Query Result'}
            subtitle={t
                ? 'Phân biệt tab bảng có chỉnh sửa và kết quả SQL chỉ đọc; hiểu phạm vi phân trang, lọc, sắp xếp và export.'
                : 'Distinguish editable table tabs from read-only SQL results; understand pagination, filtering, sorting and export scope.'}
        >
            <div className="grid md:grid-cols-3 gap-4">
                {[
                    { title: 'DataGrid', desc: t ? 'Tab bảng mở từ Explorer, có view dữ liệu, sort/filter trang hiện tại và Edit → pending → Save khi được cấp quyền.' : 'Table tab opened from Explorer, with data views, page filters/sorting and Edit → pending → Save when permitted.' },
                    { title: 'Query Result', desc: t ? 'Panel kết quả dưới SQL editor chỉ đọc. Không double-click để UPDATE và không có bộ export CSV/JSON/SQL của DataGrid.' : 'The SQL editor result panel is read-only. Double-click does not perform UPDATE, and it does not expose DataGrid CSV/JSON/SQL export choices.' },
                    { title: t ? 'Phân trang phía server' : 'Server-side pagination', desc: t ? 'Hai bề mặt tải từng cửa sổ dữ liệu từ server. Chuyển trang thay dữ liệu hiện tại, không cộng dồn vào một dataset export.' : 'Both surfaces fetch data windows from the server. Paging replaces the current data; it does not accumulate a combined export dataset.' },
                ].map((feature, i) => (
                    <div key={i} className="p-6 border rounded-2xl bg-card space-y-2 hover:border-primary/50 transition-colors">
                        <h4 className="font-bold text-primary">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>
            <Callout type="info">
                <p className="text-sm">{t
                    ? 'DataGrid gửi sort đầu tiên tới server để sắp xếp trước khi lấy trang. Không có bảo đảm multi-column server sort. Quick Filter áp trên các dòng của trang đã tải, không tìm toàn bộ bảng; muốn lọc toàn bảng, viết WHERE trong query.'
                    : 'DataGrid sends the first sort to the server so it orders before paging. Multi-column server sorting is not guaranteed. Quick Filter applies to rows in the loaded page, not the entire table; use a WHERE query for whole-table filtering.'}</p>
            </Callout>

            <DocSection title={t ? 'Đọc ô và xem giá trị đầy đủ' : 'Read cells and inspect full values'}>
                <Prose>{t
                    ? 'DataGrid có thao tác chọn ô và Cell Inspector. Đây là luồng đọc giá trị, không phải editor cập nhật dữ liệu. Các thao tác có thể khác với Query Result.'
                    : 'DataGrid provides cell selection and a Cell Inspector. This is a value-reading flow, not a data-update editor. Its actions can differ from Query Result.'}</Prose>
                <div className="space-y-3">
                    {[
                        { action: t ? 'Chọn ô' : 'Select a cell', result: t ? 'Kiểm tra giá trị hoặc dùng thao tác copy có sẵn. Không coi mọi selection là vùng spreadsheet với copy đa ô/TSV.' : 'Inspect its value or use available copy actions. Do not assume spreadsheet-range selection with multi-cell/TSV copying.' },
                        { action: 'Cell Inspector', result: t ? 'Xem đầy đủ text/JSON của ô và copy khi cần. Inspector chỉ đọc; sửa ô trong Edit mode của DataGrid, không trong inspector.' : 'Read full cell text/JSON and copy when needed. The inspector is read-only; edit using DataGrid Edit mode, not the inspector.' },
                        { action: t ? 'Header / Filter' : 'Header / Filter', result: t ? 'Sort đầu tiên tác động query lấy trang phía server; filter chỉ tác động trang đã tải. Tổng số dòng server không phải số dòng khớp filter cục bộ.' : 'The first sort affects the server page query; filtering only affects the loaded page. The server total is not the count matching a local filter.' },
                        { action: t ? 'Chuyển trang' : 'Change page', result: t ? 'Lấy cửa sổ dữ liệu mới. Đặt ORDER BY ổn định cho SQL; dữ liệu đang thay đổi và cache có thể khiến kết quả giữa các trang không phải snapshot nhất quán.' : 'Fetch a new data window. Use stable ORDER BY in SQL; live changes and caching mean successive pages are not necessarily one consistent snapshot.' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 border rounded-xl bg-muted/20">
                            <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-3 py-1 text-[10px] font-bold shadow-sm whitespace-nowrap">{item.action}</kbd>
                            <span className="text-sm text-muted-foreground leading-relaxed">{item.result}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Giá trị và kiểu dữ liệu' : 'Values and data types'}>
                <Prose>{t
                    ? 'Các ví dụ sau minh họa loại giá trị; màu/badge có thể khác giữa DataGrid và Query Result. NULL không phải chuỗi rỗng, JSON preview không thay thế nội dung đầy đủ.'
                    : 'These examples illustrate value types; colors/badges can differ between DataGrid and Query Result. NULL is not an empty string, and a JSON preview does not replace the full value.'}</Prose>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-muted/50"><th className="text-left p-4 font-bold">{t ? 'Kiểu' : 'Type'}</th><th className="text-left p-4 font-bold">{t ? 'Cách đọc' : 'How to read'}</th><th className="text-left p-4 font-bold">{t ? 'Ví dụ' : 'Example'}</th></tr></thead>
                        <tbody className="divide-y">
                            {[
                                { type: 'NULL', display: t ? 'Không có giá trị' : 'No value', example: 'NULL' },
                                { type: 'Boolean', display: t ? 'Giá trị đúng/sai' : 'True/false value', example: 'true' },
                                { type: 'Number', display: t ? 'Giá trị số theo response' : 'Numeric response value', example: '42.5' },
                                { type: 'Date/Time', display: t ? 'Kiểm tra timezone trong dữ liệu' : 'Check the data timezone', example: '2026-01-15T10:30:00Z' },
                                { type: 'JSON/JSONB', display: t ? 'Mở inspector để xem đầy đủ' : 'Inspect the full value', example: '{...}' },
                                { type: 'Text', display: t ? 'Preview có thể bị rút gọn' : 'The preview can be shortened', example: 'Long text...' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors"><td className="p-4 font-mono text-primary font-bold">{row.type}</td><td className="p-4 text-muted-foreground">{row.display}</td><td className="p-4 font-mono">{row.example}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            <DocSection title={t ? 'Sửa dữ liệu trong DataGrid' : 'Edit data in DataGrid'}>
                <Prose>{t
                    ? 'Chỉ tab bảng DataGrid có workflow sửa trực tiếp. Bảng và connection phải đủ quyền và có định danh dòng phù hợp; Query Result luôn là luồng chỉ đọc.'
                    : 'Only table DataGrid tabs offer direct editing. The table and connection need suitable permissions and row identity; Query Result remains read-only.'}</Prose>
                <div className="space-y-3">
                    {[
                        { action: 'Edit', result: t ? 'Bật Edit mode trước khi sửa ô. Khi chưa bật, thao tác xem ô không gửi UPDATE.' : 'Enter Edit mode before changing cells. Inspecting a cell outside Edit mode does not send UPDATE.' },
                        { action: t ? 'Sửa ô → pending' : 'Edit cell → pending', result: t ? 'Hoàn tất nhập đưa thay đổi vào pending changes cục bộ. Enter không đồng nghĩa đã ghi database; Esc hủy chỉnh sửa ô hiện tại.' : 'Completing a cell edit stages local pending changes. Enter does not mean the database was updated; Esc cancels the current cell edit.' },
                        { action: 'Save', result: t ? 'Bấm Save để gửi pending changes tới server. Kiểm tra lỗi và kết quả; chỉ coi dữ liệu đã ghi khi server báo thành công. Hủy/thoát Edit để bỏ thay đổi chưa lưu theo thao tác UI.' : 'Press Save to submit pending changes to the server. Check errors and results; consider changes written only after server success. Use the UI cancel/exit action to discard unsaved edits.' },
                        { action: t ? 'Thêm / xóa dòng' : 'Insert / delete rows', result: t ? 'Dùng các nút tương ứng của DataGrid nếu được cấp quyền. Không có Ctrl/Cmd+H bulk replace: phím đó mở lịch sử query của app.' : 'Use the DataGrid insert/delete controls when permitted. There is no Ctrl/Cmd+H bulk replace: that shortcut opens app query history.' },
                        { action: 'Cell Inspector', result: t ? 'Chỉ xem/copy; không Save giá trị JSON dài từ inspector.' : 'Read/copy only; it does not save long JSON values.' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 border rounded-xl bg-muted/20">
                            <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-3 py-1 text-[10px] font-bold shadow-sm whitespace-nowrap">{item.action}</kbd>
                            <span className="text-sm text-muted-foreground leading-relaxed">{item.result}</span>
                        </div>
                    ))}
                </div>
                <Callout type="warning"><p className="text-sm">{t
                    ? 'readOnly hoặc allowQueryExecution=false chặn sửa dữ liệu ở backend. Bảng/view không có khóa định danh dòng phù hợp có thể không sửa được; đừng coi mọi SELECT hoặc engine đều hỗ trợ UPDATE trực tiếp.'
                    : 'readOnly or allowQueryExecution=false blocks edits at the backend. Tables/views without suitable row keys may not be editable; do not assume every SELECT or engine supports direct UPDATE.'}</p></Callout>
            </DocSection>

            <DocSection title={t ? 'Phạm vi kết quả và export' : 'Result and export scope'}>
                <Prose>{t
                    ? 'Đọc số dòng trên trang, page size và total do server trả. Total có thể dùng cache ngắn hạn hoặc chưa có; filter cục bộ không thay đổi total server. Thời lượng là số liệu response, không phải bảo đảm độ trễ trình duyệt.'
                    : 'Read the page row count, page size and server-reported total. Totals can use short-lived caches or be unavailable; local filtering does not change the server total. Duration is response metadata, not a browser-latency guarantee.'}</Prose>
                <Callout type="info"><p className="text-sm">{t
                    ? 'DataGrid export CSV/JSON/SQL từ row model của trang đã tải, sau filter cục bộ. Query Result chỉ export CSV trang hiện tại. Không có XLSX, export toàn bộ kết quả hoặc tích lũy các trang bằng cách đi Previous/Next.'
                    : 'DataGrid exports CSV/JSON/SQL from the loaded page row model, after local filtering. Query Result exports current-page CSV only. There is no XLSX, full-result export or accumulation by paging Previous/Next.'}</p></Callout>
                <Prose>
                    <a href={publicPath(lang, '/docs/export')}>{t ? 'Chi tiết export' : 'Export details'}</a>{' · '}
                    <a href={publicPath(lang, '/docs/operational-limits')}>{t ? 'Giới hạn vận hành' : 'Operational limits'}</a>{' · '}
                    <a href={publicPath(lang, '/docs/data-migration')}>{t ? 'Chuyển dữ liệu' : 'Data migration'}</a>
                </Prose>
            </DocSection>
        </DocPageLayout>
    );
}
