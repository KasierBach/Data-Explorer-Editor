import { publicPath } from '@/core/seo/publicRoutes';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ExportSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Xuất trang dữ liệu' : 'Export a data page'}
            subtitle={t
                ? 'DataGrid có CSV, JSON và SQL INSERT cho trang đã tải; Query Result chỉ có CSV trang hiện tại. Đây không phải backup toàn database.'
                : 'DataGrid offers CSV, JSON and SQL INSERT for the loaded page; Query Result offers current-page CSV only. This is not a database backup.'}
        >
            <DocSection title={t ? 'Định dạng trong DataGrid' : 'DataGrid formats'}>
                <div className="space-y-4">
                    {[
                        {
                            format: 'CSV',
                            desc: t
                                ? 'Có header cột và dữ liệu trang đã tải/sau lọc cục bộ. Có thể mở bằng spreadsheet, nhưng đây là CSV text, không phải file Excel XLSX.'
                                : 'Includes headers and loaded/locally filtered page rows. A spreadsheet can open it, but this is CSV text, not an Excel XLSX file.',
                            example: 'id,name\n1,Alex Chen\n2,Sarah Miller',
                            filename: 'users_export.csv',
                        },
                        {
                            format: 'JSON',
                            desc: t
                                ? 'Mảng object theo tên cột trong trang đã tải. Giá trị nested đã có trong response được serialize, không quét thêm document/bảng liên quan.'
                                : 'An array of objects keyed by columns in the loaded page. Nested values already in the response are serialized; it does not scan related documents/tables.',
                            example: '[\n  {"id": 1, "name": "Alex Chen"},\n  {"id": 2, "name": "Sarah Miller"}\n]',
                            filename: 'users_export.json',
                        },
                        {
                            format: 'SQL INSERT',
                            desc: t
                                ? 'Một INSERT cho mỗi dòng của trang; quote identifier theo dialect hiện có và escape dấu nháy trong chuỗi. Không kèm schema DDL, index, FK hay bảo đảm type/engine portability.'
                                : 'One INSERT per page row, with available dialect identifier quoting and string-quote escaping. No schema DDL, indexes, foreign keys or type/engine portability guarantee is included.',
                            example: `INSERT INTO "public"."users" ("id", "name") VALUES (1, 'Alex Chen');\nINSERT INTO "public"."users" ("id", "name") VALUES (2, 'Sarah Miller');`,
                            filename: 'users_export.sql',
                        },
                    ].map((style) => (
                        <div key={style.format} className="border rounded-2xl bg-card overflow-hidden">
                            <div className="flex items-center gap-3 p-5 border-b bg-muted/10">
                                <div>
                                    <span className="font-bold block">{style.format}</span>
                                    <span className="text-xs text-muted-foreground">{style.desc}</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <CodeBlock title={style.filename}>
                                    {style.example.split('\n').map((line, j) => <CodeLine key={j}>{line}</CodeLine>)}
                                </CodeBlock>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Xuất từ đúng bề mặt' : 'Export from the right surface'}>
                <Prose>{t
                    ? 'Xác định bạn đang ở tab bảng DataGrid hay panel Query Result dưới SQL editor. Các nút và phạm vi không giống nhau.'
                    : 'Identify whether you are in a table DataGrid tab or the SQL editor Query Result panel. Their controls and scope differ.'}</Prose>
                <div className="space-y-3">
                    {[
                        { step: '1', desc: t ? 'DataGrid: tải trang cần xuất, kiểm tra filter cục bộ rồi mở menu Export/More của lưới và chọn CSV, JSON hoặc SQL INSERT.' : 'DataGrid: load the desired page, check local filters, open the grid Export/More menu and select CSV, JSON or SQL INSERT.' },
                        { step: '2', desc: t ? 'Tên DataGrid dùng tên bảng: <tableName>_export.csv, .json hoặc .sql; đổi tên tab không đổi quy tắc này.' : 'DataGrid filenames use the table name: <tableName>_export.csv, .json or .sql; renaming a tab does not change this rule.' },
                        { step: '3', desc: t ? 'Query Result: nút tải xuống xuất CSV của trang đang có trong response, tên query_result_<timestamp>.csv. Không có dropdown JSON/SQL/XLSX trên bề mặt này.' : 'Query Result: its download button exports the current response page as CSV, named query_result_<timestamp>.csv. There is no JSON/SQL/XLSX dropdown on this surface.' },
                    ].map((item) => (
                        <div key={item.step} className="flex gap-4 items-start p-4 border rounded-xl bg-muted/20">
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">{item.step}</div>
                            <p className="text-sm text-muted-foreground leading-relaxed pt-1">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>
            <Callout type="warning">
                <p className="font-bold">{t ? 'Chỉ trang đã tải, không phải toàn bộ kết quả' : 'Loaded page only, not the full result'}</p>
                <p className="mt-1 text-muted-foreground">{t
                    ? 'Cuộn hoặc chuyển qua mọi trang không tích lũy dữ liệu cho export; trang mới thay trang cũ. DataGrid xuất tất cả dòng trong row model trang hiện tại sau filter, không chỉ dòng đang nhìn trong viewport. Query Result xuất response trang hiện tại. Không có file backup đầy đủ hoặc XLSX ở đây.'
                    : 'Scrolling or visiting every page does not accumulate data for export; each new page replaces the old one. DataGrid exports the current page row model after filtering, not only rows visible in the viewport. Query Result exports its current response page. Neither provides a complete backup or XLSX file here.'}</p>
            </Callout>
            <Callout type="info">
                <p className="text-sm">{t
                    ? 'allowImportExport không phải chặn dữ liệu rời hệ thống: download được tạo từ dữ liệu đã nằm trong trình duyệt và không gọi endpoint export được bảo vệ. Dùng chính sách truy cập và phân phối dữ liệu phù hợp; kiểm tra SQL INSERT trước khi chạy ở database khác.'
                    : 'allowImportExport is not an egress block: downloads are built from data already in the browser and do not call a guarded export endpoint. Apply suitable access/data-distribution policies, and review SQL INSERT output before running it in another database.'}</p>
            </Callout>
            <Prose>
                <a href={publicPath(lang, '/docs/data-migration')}>{t ? 'Workflow chuyển dữ liệu có giới hạn' : 'Bounded data migration workflow'}</a>{' · '}
                <a href={publicPath(lang, '/docs/data-handling')}>{t ? 'Phạm vi xử lý dữ liệu' : 'Data handling scope'}</a>{' · '}
                <a href={publicPath(lang, '/docs/operational-limits')}>{t ? 'Giới hạn vận hành' : 'Operational limits'}</a>
            </Prose>
        </DocPageLayout>
    );
}
