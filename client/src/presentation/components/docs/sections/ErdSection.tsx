import { Layout, Database, Activity } from 'lucide-react';
import { DocPageLayout, DocSection, Prose } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function ErdSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Sơ đồ Thực thể Quan hệ (ERD)' : 'Entity Relationship Diagram (ERD)'}
            subtitle={t
                ? 'Quan sát, phân tích và chỉnh sửa cấu trúc database thông qua đồ thị tương tác mạnh mẽ — với auto-layout thông minh và khả năng thao tác schema trực tiếp.'
                : 'Visualize, analyze, and modify database structure through powerful interactive graphs — with smart auto-layout and direct schema manipulation.'}
        >
            {/* Feature Cards */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-8 border rounded-3xl bg-card space-y-4 hover:shadow-xl transition-all group">
                    <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <Layout className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-xl">Auto-Layout</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t
                        ? 'Tự động sắp xếp các bảng dựa trên mối liên hệ khóa ngoại bằng engine Dagre. Thuật toán phân tích dependency graph và tối ưu vị trí để giảm thiểu số đường giao nhau (edge crossings). Bạn cũng có thể chọn giữa layout ngang (left-to-right) hoặc dọc (top-to-bottom).'
                        : 'Automatically arrange tables based on foreign key relationships using the Dagre engine. The algorithm analyzes the dependency graph and optimizes positions to minimize edge crossings. You can also choose between horizontal (left-to-right) or vertical (top-to-bottom) layout.'}</p>
                </div>
                <div className="p-8 border rounded-3xl bg-card space-y-4 hover:shadow-xl transition-all group">
                    <div className="bg-blue-500/10 w-fit p-3 rounded-2xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <Database className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-xl">{t ? 'Thao tác Schema trực tiếp' : 'Direct Schema Mutations'}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t
                        ? 'ERD không chỉ để xem — bạn có thể thao tác trực tiếp trên đồ thị. Kéo đường nối giữa hai bảng để tạo khóa ngoại mới (ALTER TABLE ... ADD CONSTRAINT). Click vào đường nối và bấm Delete để xóa ràng buộc (DROP CONSTRAINT). Tất cả thay đổi đều tạo SQL tương ứng.'
                        : 'ERD is not just for viewing — you can manipulate directly on the graph. Drag a connector between two tables to create a new foreign key (ALTER TABLE ... ADD CONSTRAINT). Click a connector and press Delete to remove the constraint (DROP CONSTRAINT). All changes generate corresponding SQL.'}</p>
                </div>
            </div>

            {/* Interaction Guide */}
            <DocSection title={t ? 'Hướng dẫn Tương tác' : 'Interaction Guide'}>
                <div className="space-y-6 p-8 bg-muted/20 border rounded-3xl shadow-inner">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5" />
                        <h3 className="font-bold text-xl">{t ? 'Các thao tác chuột & bàn phím' : 'Mouse & Keyboard Interactions'}</h3>
                    </div>
                    <ul className="space-y-4 text-sm text-muted-foreground">
                        {[
                            { key: t ? 'Chuột trái + Click bảng' : 'Left Click Table', desc: t ? 'Chọn bảng để xem chi tiết: danh sách cột, kiểu dữ liệu, primary key, indexes và constraints.' : 'Select a table to view details: column list, data types, primary key, indexes, and constraints.' },
                            { key: t ? 'Chuột trái + Kéo bảng' : 'Left Click + Drag Table', desc: t ? 'Di chuyển vị trí bảng trên canvas. Vị trí mới được lưu tạm thời trong phiên làm việc.' : 'Move table position on canvas. New position is temporarily saved in the current session.' },
                            { key: t ? 'Chuột phải bảng' : 'Right Click Table', desc: t ? 'Menu ngữ cảnh: Copy tên bảng, Copy CREATE TABLE SQL, xem trong Query Editor, hoặc xóa khỏi canvas.' : 'Context menu: Copy table name, Copy CREATE TABLE SQL, view in Query Editor, or remove from canvas.' },
                            { key: t ? 'Click đường nối (Edge)' : 'Click Edge (Connector)', desc: t ? 'Chọn relationship để xem chi tiết foreign key: bảng nguồn, bảng đích, cột tham chiếu, và loại ON DELETE/ON UPDATE action.' : 'Select a relationship to view FK details: source table, target table, referenced columns, and ON DELETE/ON UPDATE actions.' },
                            { key: t ? 'Nút + (Thêm bảng)' : 'Plus Button (+)', desc: t ? 'Thêm bảng từ danh sách sidebar vào canvas ERD. Bạn có thể tìm kiếm bảng theo tên.' : 'Add tables from the sidebar list to the ERD canvas. You can search tables by name.' },
                            { key: t ? 'Scroll (Zoom)' : 'Scroll Wheel (Zoom)', desc: t ? 'Phóng to/thu nhỏ canvas. Giữ Ctrl + Scroll để zoom chính xác hơn. Double-click vùng trống để reset zoom.' : 'Zoom in/out on canvas. Hold Ctrl + Scroll for precise zooming. Double-click empty area to reset zoom.' },
                            { key: t ? 'Minimap' : 'Minimap', desc: t ? 'Bản đồ thu nhỏ ở góc dưới bên phải giúp điều hướng nhanh khi có nhiều bảng trên canvas.' : 'Miniature map in the bottom-right corner for quick navigation when many tables are on canvas.' },
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-4">
                                <kbd className="bg-background border-2 border-muted-foreground/20 rounded-lg px-3 py-1.5 text-[10px] font-bold shadow-sm whitespace-nowrap min-w-[180px] text-center">{item.key}</kbd>
                                <span>{item.desc}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </DocSection>

            {/* Relationship Types */}
            <DocSection title={t ? 'Loại quan hệ được hỗ trợ' : 'Supported Relationship Types'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">{t ? 'Loại' : 'Type'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Ký hiệu' : 'Notation'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Mô tả' : 'Description'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { type: 'One-to-One', notation: '1 — 1', desc: t ? 'Một bản ghi trong bảng A liên kết với chính xác một bản ghi trong bảng B (UNIQUE FK).' : 'One record in table A links to exactly one record in table B (UNIQUE FK).' },
                                { type: 'One-to-Many', notation: '1 — *', desc: t ? 'Một bản ghi trong bảng A liên kết với nhiều bản ghi trong bảng B. Đây là loại phổ biến nhất.' : 'One record in table A links to many records in table B. This is the most common type.' },
                                { type: 'Many-to-Many', notation: '* — *', desc: t ? 'Thể hiện qua junction table (bảng trung gian) với hai FK. ERD hiển thị cả ba bảng và hai edges.' : 'Represented through a junction table (intermediate table) with two FKs. ERD shows all three tables and two edges.' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-bold">{row.type}</td>
                                    <td className="p-4 font-mono text-primary font-bold">{row.notation}</td>
                                    <td className="p-4 text-muted-foreground">{row.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Export Options */}
            <DocSection title={t ? 'Xuất sơ đồ ERD' : 'ERD Export Options'}>
                <Prose>{t
                    ? 'Bạn có thể xuất sơ đồ ERD dưới nhiều định dạng để đính kèm vào tài liệu, báo cáo hoặc chia sẻ với team:'
                    : 'You can export ERD diagrams in multiple formats for attaching to documents, reports, or sharing with your team:'}</Prose>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { format: 'PNG', desc: t ? 'Hình ảnh chất lượng cao' : 'High quality image' },
                        { format: 'SVG', desc: t ? 'Vector, co giãn không vỡ' : 'Scalable vector' },
                        { format: 'SQL DDL', desc: t ? 'CREATE TABLE scripts' : 'CREATE TABLE scripts' },
                        { format: 'JSON', desc: t ? 'Schema metadata' : 'Schema metadata' },
                    ].map((item, i) => (
                        <div key={i} className="p-4 border rounded-xl text-center bg-muted/10 hover:border-primary/50 transition-colors">
                            <span className="font-mono text-primary font-bold block">{item.format}</span>
                            <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
