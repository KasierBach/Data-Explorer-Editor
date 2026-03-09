import { Layout, Share2, Search, Zap, MousePointer2 } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ErdSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Sơ đồ Thực thể Quan hệ (ERD)' : 'Entity Relationship Diagram (ERD)'}
            subtitle={t
                ? 'Công cụ thiết kế và trực quan hóa database mạnh mẽ, giúp bạn hiểu sâu cấu trúc hệ thống phức tạp thông qua đồ thị tương tác.'
                : 'A powerful database design and visualization tool, helping you gain deep insights into complex system structures through interactive graphs.'}
        >
            <Callout type="tip">
                <p className="font-bold">{t ? '💡 Reverse Engineering thông minh' : '💡 Intelligent Reverse Engineering'}</p>
                <p className="mt-1 text-muted-foreground italic">
                    {t
                        ? 'Data Explorer tự động quét "information_schema" để phát hiện các ràng buộc Foreign Key thực tế, giúp bạn tái hiện chính xác kiến trúc database hiện hữu mà không cần vẽ thủ công.'
                        : 'Data Explorer automatically scans "information_schema" to detect actual Foreign Key constraints, helping you accurately reproduce existing database architecture without manual drawing.'}
                </p>
            </Callout>

            {/* Core Capabilities */}
            <FeatureGrid>
                <InfoCard icon={<Layout className="w-6 h-6 text-emerald-500" />} title={t ? 'Auto-Layout (Dagre Engine)' : 'Auto-Layout (Dagre Engine)'} color="emerald">
                    <p>{t
                        ? 'Sử dụng thuật toán Dagre để tự động sắp xếp hàng trăm bảng một cách tối ưu. Giảm thiểu các đường chéo chồng chéo và tối ưu hóa luồng dữ liệu (Data Flow) theo kiến trúc hình cây hoặc phân tầng.'
                        : 'Uses the Dagre algorithm to automatically arrange hundreds of tables optimally. Minimizes overlapping lines and optimizes data flow according to tree or hierarchical architectures.'}</p>
                </InfoCard>
                <InfoCard icon={<Zap className="w-6 h-6 text-blue-500" />} title={t ? 'Phản hồi Real-time' : 'Real-time Feedback'} color="blue">
                    <p>{t
                        ? 'Mọi thay đổi trên sơ đồ (như kéo nối khóa ngoại) đều được đồng bộ tức thì với SQL Script. Bạn có thể xem trước lệnh ALTER TABLE trước khi áp dụng trực tiếp vào database.'
                        : 'Every change on the diagram (like dragging foreign key connectors) is instantly synced with the SQL Script. You can preview ALTER TABLE commands before applying them directly to the database.'}</p>
                </InfoCard>
            </FeatureGrid>

            {/* Technical Deep Dive */}
            <DocSection title={t ? 'Kiến trúc Đồ thị (React Flow)' : 'Graph Architecture (React Flow)'}>
                <Prose>
                    {t
                        ? 'ERD Engine được xây dựng trên nền tảng React Flow, cung cấp khả năng render vector (SVG) mượt mà ngay cả khi làm việc với các Schema khổng lồ (vàng nghìn bảng). Hệ thống sử dụng cơ chế "Zoom-to-Content" và "Viewport Virtualization" để đảm bảo hiệu năng tối đa trên trình duyệt.'
                        : 'The ERD Engine is built on React Flow, providing smooth vector (SVG) rendering even when working with massive schemas (thousands of tables). The system uses "Zoom-to-Content" and "Viewport Virtualization" mechanisms to ensure maximum browser performance.'}
                </Prose>
                <div className="grid md:grid-cols-2 gap-4 mt-8">
                    <div className="p-6 border rounded-3xl bg-muted/10 relative group">
                        <Search className="w-8 h-8 text-primary mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        <h5 className="font-bold mb-2">{t ? 'Global Search & Focus' : 'Global Search & Focus'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Tìm kiếm nhanh bất kỳ bảng hoặc cột nào trong sơ đồ. Hệ thống sẽ tự động điều hướng (pan) và zoom vào vị trí đó.' : 'Quickly search for any table or column in the diagram. The system will automatically pan and zoom to that location.'}</p>
                    </div>
                    <div className="p-6 border rounded-3xl bg-muted/10 relative group">
                        <Share2 className="w-8 h-8 text-indigo-500 mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        <h5 className="font-bold mb-2">{t ? 'Exporter Chuyên nghiệp' : 'Professional Exporter'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Xuất sơ đồ ra PNG mật độ điểm ảnh cao (for presentation) hoặc SVG (for documentation) với đầy đủ metadata về kiểu dữ liệu.' : 'Export diagrams to high-DPI PNG (for presentations) or SVG (for documentation) with complete data type metadata.'}</p>
                    </div>
                </div>
            </DocSection>

            {/* Interaction Guide */}
            <DocSection title={t ? 'Cẩm nang điều khiển' : 'Control Guide'}>
                <div className="space-y-4">
                    {[
                        { k: <><MousePointer2 className="w-3 h-3 inline" /> Left Click</>, d: t ? 'Chọn bảng / xem chi tiết Index & Constraints' : 'Select table / view Index & Constraints details' },
                        { k: 'Space + Drag', d: t ? 'Di chuyển canvas (Panning) nhanh chóng' : 'Quickly pan the canvas' },
                        { k: 'Ctrl + Scroll', d: t ? 'Phóng to/thu nhỏ tập trung vào con trỏ' : 'Zoom in/out focused on cursor' },
                        { k: 'Double Click', d: t ? 'Reset zoom và căn giữa sơ đồ' : 'Reset zoom and center diagram' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-2xl bg-card hover:border-primary/30 transition-colors">
                            <span className="text-xs font-black uppercase tracking-widest text-primary">{item.k}</span>
                            <span className="text-xs text-muted-foreground font-medium">{item.d}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* DB Architect Pro-tips */}
            <DocSection title={t ? 'Mẹo cho Database Architect' : 'Pro-tips for Database Architects'}>
                <div className="p-10 rounded-[40px] bg-indigo-600 text-white relative overflow-hidden group">
                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
                    <h4 className="text-2xl font-bold mb-6 tracking-tight">{t ? 'Thiết kế Schema tối ưu' : 'Optimal Schema Design'}</h4>
                    <ul className="space-y-4 text-sm text-indigo-100">
                        <li className="flex gap-3">
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-[10px] font-bold">1</div>
                            <p>{t ? 'Sử dụng màu sắc để phân nhóm các bảng theo Module logic (Ví dụ: Đỏ cho Finance, Xanh cho User).' : 'Use colors to group tables by logical modules (e.g., Red for Finance, Blue for User).'}</p>
                        </li>
                        <li className="flex gap-3">
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-[10px] font-bold">2</div>
                            <p>{t ? 'Tận dụng ERD để phát hiện các thiếu sót về Index trên các cột Foreign Key — một nguyên nhân gây chậm join.' : 'Leverage ERD to detect missing indexes on Foreign Key columns — a common cause of slow joins.'}</p>
                        </li>
                        <li className="flex gap-3">
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-[10px] font-bold">3</div>
                            <p>{t ? 'Xuất SQL DDL trực tiếp từ giao diện thiết kế để đảm bảo Version Control (Git) luôn cập nhật.' : 'Export SQL DDL directly from the design interface to ensure Version Control (Git) is always up to date.'}</p>
                        </li>
                    </ul>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
