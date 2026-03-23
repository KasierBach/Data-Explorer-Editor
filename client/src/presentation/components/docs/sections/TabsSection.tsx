import { Maximize2, Plus, X, Layers, Save } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, InfoCard } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function TabsSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Quản lý Tab & Không gian làm việc' : 'Tabs & Workspace Management'}
            subtitle={t
                ? 'Cách Data Explorer giúp bạn tổ chức hàng chục truy vấn song song mà không bị nhầm lẫn, với hiệu ứng chuyển cảnh mượt mà.'
                : 'How Data Explorer helps you organize dozens of parallel queries without confusion, featuring smooth transition effects.'}
            gradient
        >
            {/* Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <InfoCard icon={<Plus className="w-5 h-5 text-blue-500" />} title={t ? 'Tab Không giới hạn' : 'Unlimited Tabs'}>
                    <p className="text-xs text-muted-foreground">{t ? 'Mở bao nhiêu tab tùy thích. Hệ thống virtualization đảm bảo hiệu suất không bị suy giảm.' : 'Open as many tabs as you need. Virtualization ensures performance remains consistent.'}</p>
                </InfoCard>
                <InfoCard icon={<Maximize2 className="w-5 h-5 text-emerald-500" />} title={t ? 'Kéo thả Linh hoạt' : 'Drag & Drop'} >
                    <p className="text-xs text-muted-foreground">{t ? 'Sắp xếp lại thứ tự ưu tiên các công việc chỉ bằng thao tác kéo thả chuột mượt mà.' : 'Reorder priority tasks with smooth, intuitive drag-and-drop mouse actions.'}</p>
                </InfoCard>
                <InfoCard icon={<X className="w-5 h-5 text-rose-500" />} title={t ? 'Đóng & Khôi phục' : 'Close & Restore'}>
                    <p className="text-xs text-muted-foreground">{t ? 'Đóng tab nhanh chóng bằng phím tắt hoặc chuột với hiệu ứng mượt mà 300ms.' : 'Quickly close tabs using shortcuts or mouse with 300ms smooth animations.'}</p>
                </InfoCard>
            </div>

            <DocSection title={t ? 'Tính năng Nâng cao' : 'Advanced Features'}>
                <div className="space-y-8">
                    <DocSubSection title={t ? 'Quản lý trạng thái độc lập' : 'Independent State Management'}>
                        <Prose>
                            {t
                                ? 'Mỗi tab lưu trữ mã SQL, kết quả truy vấn, và cấu hình bảng (sorting/filtering) riêng biệt. Bạn có thể chạy truy vấn ở Tab A và chuyển sang làm việc ở Tab B mà không gián đoạn.'
                                : 'Each tab stores its own SQL code, query results, and table configurations (sorting/filtering). You can run a query in Tab A and switch to work in Tab B without interruption.'}
                        </Prose>
                    </DocSubSection>

                    <DocSubSection title={t ? 'Đồng bộ hóa Tên Tab' : 'Tab Name Syncing'}>
                        <Prose>
                            {t
                                ? 'Data Explorer tự động đặt tên tab dựa trên bảng chính mà bạn đang truy vấn (ví dụ: "SELECT * FROM users" -> tab "users"). Bạn cũng có thể double-click để đổi tên thủ công.'
                                : 'Data Explorer automatically names tabs based on the primary table being queried (e.g., "SELECT * FROM users" -> "users" tab). You can also double-click to rename manually.'}
                        </Prose>
                    </DocSubSection>
                </div>
            </DocSection>

            <DocSection title={t ? 'Phím tắt Quản lý Tab' : 'Tab Management Shortcuts'}>
                <div className="grid sm:grid-cols-2 gap-4">
                    {[
                        { k: 'Ctrl + N', v: t ? 'Mở tab truy vấn mới' : 'Open new query tab' },
                        { k: 'Ctrl + D', v: t ? 'Nhân bản Tab hiện tại' : 'Duplicate current tab' },
                        { k: 'Ctrl + W', v: t ? 'Đóng tab hiện tại' : 'Close current tab' },
                        { k: 'Ctrl + Shift + W', v: t ? 'Đóng tất cả các Tab' : 'Close all tabs' },
                        { k: 'Ctrl + Tab', v: t ? 'Chuyển sang tab kế tiếp' : 'Switch to next tab' },
                        { k: 'Ctrl + Shift + Tab', v: t ? 'Quay lại tab trước đó' : 'Switch to previous tab' }
                    ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-xl bg-muted/30">
                            <span className="text-xs font-bold font-mono bg-background px-2 py-1 rounded border shadow-sm">{item.k}</span>
                            <span className="text-xs text-muted-foreground">{item.v}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Cơ chế Cô lập & Lưu trữ (Under the Hood)' : 'Under the Hood: Isolation & Persistence'}>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h5 className="text-sm font-bold flex items-center gap-2 text-primary">
                             <Layers className="w-4 h-4" />
                             {t ? 'Virtualization & Context Isolation' : 'Virtualization & Context Isolation'}
                        </h5>
                        <Prose className="text-xs">
                            {t
                                ? 'Hệ thống Tab sử dụng React Context cô lập cho mỗi instance. Điều này ngăn chặn việc rò rỉ trạng thái (State Leakage) giữa các tab, ngay cả khi chúng cùng truy vấn một database.'
                                : 'The Tab system uses isolated React Context for each instance. This prevents State Leakage between tabs, even if they query the same database.'}
                        </Prose>
                    </div>
                    <div className="space-y-4">
                        <h5 className="text-sm font-bold flex items-center gap-2 text-primary">
                             <Save className="w-4 h-4" />
                             {t ? 'Persistence Engine' : 'Persistence Engine'}
                        </h5>
                        <Prose className="text-xs">
                            {t
                                ? 'Toàn bộ danh sách tab và nội dung Editor được nén (Compressed) và lưu vào IndexedDB. Điều này cho phép khôi phục hàng trăm tab sau khi khởi động lại ứng dụng mà không tốn nhiều RAM.'
                                : 'All tab lists and Editor content are Compressed and stored in IndexedDB. This allows restoring hundreds of tabs after app restart without significant RAM usage.'}
                        </Prose>
                    </div>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
