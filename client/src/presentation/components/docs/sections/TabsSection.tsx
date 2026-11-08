import { Maximize2, Plus, X, Layers, Save } from 'lucide-react';
import { publicPath } from '@/core/seo/publicRoutes';
import { DocPageLayout, DocSection, DocSubSection, Prose, InfoCard } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function TabsSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Quản lý Tab & Không gian làm việc' : 'Tabs & Workspace Management'}
            subtitle={t
                ? 'Tổ chức tab Query, DataGrid và các công cụ khác; hiểu trạng thái dùng chung và dữ liệu lưu trong trình duyệt.'
                : 'Organize Query, DataGrid and tool tabs; understand shared state and browser-local persistence.'}
            gradient
        >
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <InfoCard icon={<Plus className="w-5 h-5 text-blue-500" />} title={t ? 'Nhiều tab theo công việc' : 'Multiple task tabs'}>
                    <p className="text-xs text-muted-foreground">{t ? 'Tạo tab Query hoặc mở bảng riêng. Không có cam kết tab không giới hạn: nội dung và trạng thái vẫn dùng bộ nhớ và dung lượng localStorage của trình duyệt.' : 'Create Query tabs or open separate table tabs. There is no unlimited-tabs guarantee: content and state still consume browser memory and localStorage capacity.'}</p>
                </InfoCard>
                <InfoCard icon={<Maximize2 className="w-5 h-5 text-emerald-500" />} title={t ? 'Sắp xếp tab' : 'Organize tabs'}>
                    <p className="text-xs text-muted-foreground">{t ? 'Chuyển tab từ thanh tab và sắp xếp công việc theo connection. Lưu query quan trọng thành Saved Query thay vì chỉ dựa vào tab cục bộ.' : 'Switch using the tab bar and organize work by connection. Save important SQL as a Saved Query rather than relying only on a local tab.'}</p>
                </InfoCard>
                <InfoCard icon={<X className="w-5 h-5 text-rose-500" />} title={t ? 'Đóng tab bằng nút X' : 'Close tabs with X'}>
                    <p className="text-xs text-muted-foreground">{t ? 'Nhấn nút X trên tab để đóng. Đóng tab không tự lưu query lên server; lưu query quan trọng thành Saved Query trước khi đóng.' : 'Press the X button on a tab to close it. Closing a tab does not automatically save SQL to the server; save important SQL as a Saved Query before closing.'}</p>
                </InfoCard>
            </div>

            <DocSection title={t ? 'Trạng thái từng tab' : 'Per-tab state'}>
                <div className="space-y-8">
                    <DocSubSection title={t ? 'Nội dung và metadata riêng trong store chung' : 'Distinct content and metadata in a shared store'}>
                        <Prose>{t
                            ? 'Tab có id, loại, nội dung query và metadata riêng như phân trang, sorting hoặc filter của bảng. Chúng nằm trong Zustand store dùng chung; kết quả query được quản lý qua luồng query/cache. Không có React Context riêng cho từng tab hoặc bảo đảm mọi kết quả/scroll đều được lưu khi reload.'
                            : 'Tabs have distinct IDs, types, query contents and metadata such as table pagination, sorting or filters. They live in a shared Zustand store; query results are managed by query/cache flows. There is no isolated React Context per tab or guarantee that every result/scroll position survives reload.'}</Prose>
                    </DocSubSection>
                    <DocSubSection title={t ? 'Tên tab và query đã lưu' : 'Tab names and saved queries'}>
                        <Prose>{t
                            ? 'Tên tab lấy từ thông tin khi mở hoặc tạo tab, chẳng hạn tên bảng hay tên Query tab mặc định. Không tự phân tích FROM hoặc alias trong SQL để đặt tên tab. Nội dung chỉ nằm trong tab cục bộ chưa phải Saved Query trên server; dùng luồng lưu query để tạo tài nguyên có thể chia sẻ.'
                            : 'Tab names come from the information supplied when opening or creating a tab, such as the table name or default Query tab name. SQL FROM clauses or aliases are not automatically parsed to name tabs. Content in a local tab is not yet a server Saved Query; use the query-save flow to create a shareable resource.'}</Prose>
                    </DocSubSection>
                </div>
            </DocSection>

            <DocSection title={t ? 'Thao tác quản lý tab' : 'Tab management actions'}>
                <div className="grid sm:grid-cols-2 gap-4">
                    {[
                        { k: 'Ctrl/Cmd + N', v: t ? 'Tạo Query tab mới' : 'Create a new Query tab' },
                        { k: 'Ctrl/Cmd + D', v: t ? 'Nhân bản tab hiện tại' : 'Duplicate the current tab' },
                        { k: 'Ctrl/Cmd + Shift + W', v: t ? 'Đóng tất cả tab' : 'Close all tabs' },
                        { k: 'X', v: t ? 'Đóng tab bằng nút trên tab' : 'Close using the button on the tab' },
                    ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-xl bg-muted/30">
                            <span className="text-xs font-bold font-mono bg-background px-2 py-1 rounded border shadow-sm">{item.k}</span>
                            <span className="text-xs text-muted-foreground">{item.v}</span>
                        </div>
                    ))}
                </div>
                <Prose>{t
                    ? 'Các phím tắt quản lý tab trong app là Ctrl/Cmd+N, Ctrl/Cmd+D và Ctrl/Cmd+Shift+W như bảng trên. Dùng nút X trên tab để đóng từng tab. Nếu trình duyệt hoặc hệ điều hành giữ phím tắt, dùng thao tác trực tiếp có sẵn trong UI.'
                    : 'The app tab-management shortcuts are Ctrl/Cmd+N, Ctrl/Cmd+D and Ctrl/Cmd+Shift+W as listed above. Use the X button on a tab to close that tab. If the browser or OS intercepts a shortcut, use the available direct UI action.'}</Prose>
            </DocSection>

            <DocSection title={t ? 'Lưu trữ cục bộ và giới hạn' : 'Local persistence and limits'}>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h5 className="text-sm font-bold flex items-center gap-2 text-primary"><Layers className="w-4 h-4" />{t ? 'Zustand store' : 'Zustand store'}</h5>
                        <Prose className="text-xs">{t
                            ? 'Trạng thái được tổ chức theo tab trong store chung, không bằng Context isolation. Query đang chạy, connection quyền hạn và cache vẫn có vòng đời riêng; đổi tab không đổi quyền database.'
                            : 'State is organized by tab in the shared store, not by Context isolation. Running queries, connection permissions and caches have separate lifecycles; switching tabs does not change database permissions.'}</Prose>
                    </div>
                    <div className="space-y-4">
                        <h5 className="text-sm font-bold flex items-center gap-2 text-primary"><Save className="w-4 h-4" />localStorage</h5>
                        <Prose className="text-xs">{t
                            ? 'Workspace được persist bằng Zustand/localStorage dưới dạng JSON không nén, không phải IndexedDB. Có giới hạn quota; xóa dữ liệu site, dùng cửa sổ riêng tư hoặc đổi trình duyệt/máy có thể mất tab. Đây không phải backup hoặc đồng bộ tab xuyên thiết bị.'
                            : 'Workspace state persists through Zustand/localStorage as uncompressed JSON, not IndexedDB. Browser quotas apply; clearing site data, private browsing or switching browsers/devices can lose tabs. This is not a backup or cross-device tab sync.'}</Prose>
                    </div>
                </div>
            </DocSection>
            <Prose>
                <a href={publicPath(lang, '/docs/data-handling')}>{t ? 'Dữ liệu được lưu ở đâu?' : 'Where is data stored?'}</a>{' · '}
                <a href={publicPath(lang, '/docs/operational-limits')}>{t ? 'Giới hạn vận hành' : 'Operational limits'}</a>
            </Prose>
        </DocPageLayout>
    );
}
