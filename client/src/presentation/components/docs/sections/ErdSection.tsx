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
                <p className="font-bold">{t ? 'Đọc cấu trúc theo từng engine' : 'Read structure per engine'}</p>
                <p className="mt-1 text-muted-foreground italic">
                    {t
                        ? 'Quan hệ phụ thuộc đường metadata của từng engine, không phải một lần quét information_schema áp dụng cho mọi database. PostgreSQL hiện đọc FK trong schema public; SQLite và ClickHouse trả danh sách relationship rỗng; MongoDB dùng heuristic, không phải ràng buộc FK thật. Hãy kiểm tra schema/constraint trực tiếp trước khi dựa vào sơ đồ.'
                        : 'Relationships depend on each engine’s metadata path, not a universal information_schema scan. PostgreSQL currently reads FKs in the public schema; SQLite and ClickHouse return empty relationship lists; MongoDB uses heuristics, not real foreign-key constraints. Verify the schema/constraints directly before relying on the diagram.'}
                </p>
            </Callout>

            {/* Core Capabilities */}
            <FeatureGrid>
                <InfoCard icon={<Layout className="w-6 h-6 text-emerald-500" />} title={t ? 'Auto-Layout (Dagre Engine)' : 'Auto-Layout (Dagre Engine)'} color="emerald">
                    <p>{t
                        ? 'Dagre tự sắp xếp các bảng theo quan hệ để tạo điểm bắt đầu cho bố cục. Bạn vẫn có thể kéo bảng và dùng lại Auto Layout; đây không phải cam kết mọi schema lớn đều có bố cục tối ưu hoặc không chồng đường.'
                        : 'Dagre arranges tables by relationships to give you a starting layout. You can still drag tables and run Auto Layout again; it does not guarantee an optimal layout or non-overlapping edges for every large schema.'}</p>
                </InfoCard>
                <InfoCard icon={<Zap className="w-6 h-6 text-blue-500" />} title={t ? 'Tạo Foreign Key là thay đổi thật' : 'Creating a foreign key is a real change'} color="blue">
                    <p>{t
                        ? 'Kéo nối cột mở bước xác nhận tạo Foreign Key. Xác nhận gọi mutation trực tiếp vào database thật khi engine hỗ trợ; không có bản preview ALTER TABLE trong flow này. Kiểm tra cột, quyền, dữ liệu hiện có và tác động khóa trước khi xác nhận.'
                        : 'Dragging a column connection opens foreign-key confirmation. Confirming calls a direct mutation against the real database when the engine supports it; this flow has no ALTER TABLE preview. Check columns, permissions, existing data, and locking impact before confirming.'}</p>
                </InfoCard>
            </FeatureGrid>

            {/* Technical Deep Dive */}
            <DocSection title={t ? 'Kiến trúc Đồ thị (React Flow)' : 'Graph Architecture (React Flow)'}>
                <Prose>
                    {t
                        ? 'Canvas dùng React Flow, Auto Layout và chế độ chỉ render phần tử đang visible để giảm tải hiển thị. Fit View căn khung vào sơ đồ hiện tại; số bảng và đường nối lớn vẫn có thể làm thao tác chậm, nên lọc bớt bảng khi cần. Đây là công cụ khám phá schema, không phải benchmark bảo đảm hiệu năng.'
                        : 'The canvas uses React Flow, Auto Layout, and rendering of only visible elements to reduce display work. Fit View frames the current diagram; large table and edge counts can still slow interaction, so filter tables when needed. This is a schema-exploration tool, not a performance guarantee.'}
                </Prose>
                <div className="grid md:grid-cols-2 gap-4 mt-8">
                    <div className="p-6 border rounded-3xl bg-muted/10 relative group">
                        <Search className="w-8 h-8 text-primary mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        <h5 className="font-bold mb-2">{t ? 'Lọc theo tên bảng' : 'Filter by table name'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Ô tìm kiếm lọc danh sách theo tên bảng. Không tìm toàn bộ tên cột và không tự pan/zoom đến kết quả. Dùng lựa chọn bảng để điều chỉnh sơ đồ rồi bấm Fit View nếu cần căn khung.' : 'The search field filters the table list by table name. It does not search every column or automatically pan/zoom to a match. Adjust table visibility and use Fit View to frame the result.'}</p>
                    </div>
                    <div className="p-6 border rounded-3xl bg-muted/10 relative group">
                        <Share2 className="w-8 h-8 text-indigo-500 mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        <h5 className="font-bold mb-2">{t ? 'Xuất PNG hoặc SQL DDL' : 'Export PNG or SQL DDL'}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t ? 'Export cung cấp PNG của sơ đồ và SQL DDL, không có SVG export. SQL dựng bảng/cột đang visible và loại cột đã ẩn; không xuất đầy đủ Foreign Key hoặc index, không sao lưu dữ liệu hay thay thế schema dump của engine.' : 'Export provides a diagram PNG and SQL DDL, not SVG export. SQL builds visible tables/columns and excludes hidden columns; it does not include complete foreign keys or indexes, back up data, or replace an engine schema dump.'}</p>
                    </div>
                </div>
            </DocSection>

            {/* Interaction Guide */}
            <DocSection title={t ? 'Cẩm nang điều khiển' : 'Control Guide'}>
                <div className="space-y-4">
                    {[
                        { k: <><MousePointer2 className="w-3 h-3 inline" /> {t ? 'Chọn / kéo bảng' : 'Select / drag table'}</>, d: t ? 'Chọn và sắp xếp bảng trên canvas; dùng lựa chọn bảng/cột để giới hạn phần hiển thị' : 'Select and arrange tables on the canvas; use table/column visibility to limit the view' },
                        { k: t ? 'Điều khiển canvas' : 'Canvas controls', d: t ? 'Dùng điều khiển zoom/pan của canvas để xem vùng cần làm việc' : 'Use canvas zoom/pan controls to inspect the working area' },
                        { k: 'Auto Layout', d: t ? 'Sắp xếp lại bảng bằng Dagre' : 'Rearrange tables with Dagre' },
                        { k: 'Fit View', d: t ? 'Bấm nút Fit View để căn sơ đồ; double-click không phải lệnh reset zoom' : 'Press Fit View to frame the diagram; double-click is not a reset-zoom command' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-2xl bg-card hover:border-primary/30 transition-colors">
                            <span className="text-xs font-black uppercase tracking-widest text-primary">{item.k}</span>
                            <span className="text-xs text-muted-foreground font-medium">{item.d}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Lưu và mở ERD workspace' : 'Save and open an ERD workspace'}>
                <Prose>
                    {t
                        ? 'Dùng Save để lưu ERD workspace với tên, ghi chú và bố cục/lựa chọn hiển thị; dùng Open để mở lại workspace đã lưu. Bản lưu là metadata của sơ đồ gắn với connection, không phải bản sao schema hoặc dữ liệu nguồn. Quyền truy cập connection và ERD vẫn áp dụng khi mở lại.'
                        : 'Use Save to store an ERD workspace with a name, notes, and layout/visibility choices; use Open to reopen a saved workspace. This stores diagram metadata tied to a connection, not a copy of the source schema or data. Connection and ERD permissions still apply when reopening.'}
                </Prose>
            </DocSection>

            {/* DB Architect Pro-tips */}
            <DocSection title={t ? 'Mẹo cho Database Architect' : 'Pro-tips for Database Architects'}>
                <div className="p-10 rounded-[40px] bg-indigo-600 text-white relative overflow-hidden group">
                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
                    <h4 className="text-2xl font-bold mb-6 tracking-tight">{t ? 'Thiết kế Schema tối ưu' : 'Optimal Schema Design'}</h4>
                    <ul className="space-y-4 text-sm text-indigo-100">
                        <li className="flex gap-3">
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-[10px] font-bold">1</div>
                            <p>{t ? 'Nhóm công việc bằng tên/ghi chú workspace và lựa chọn bảng hiển thị. Không có bộ chọn màu tùy chỉnh cho từng bảng trong UI hiện tại.' : 'Group work with workspace names/notes and table visibility choices. The current UI does not offer a custom per-table color picker.'}</p>
                        </li>
                        <li className="flex gap-3">
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-[10px] font-bold">2</div>
                            <p>{t ? 'Dùng sơ đồ để xác định quan hệ cần review, rồi kiểm tra index bằng metadata hoặc lệnh của engine. Relationship rỗng/heuristic không chứng minh database không có hoặc đã có đủ ràng buộc.' : 'Use the diagram to identify relationships for review, then verify indexes with engine metadata or commands. Empty/heuristic relationships do not prove the database has no constraints or has all required constraints.'}</p>
                        </li>
                        <li className="flex gap-3">
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-[10px] font-bold">3</div>
                            <p>{t ? 'Review SQL DDL export trước khi đưa vào version control. Vì chỉ có bảng/cột visible và thiếu FK/index, không dùng nó như bản backup có thể khôi phục toàn bộ schema.' : 'Review exported SQL DDL before placing it in version control. It contains visible tables/columns and omits FKs/indexes, so do not treat it as a backup capable of restoring the complete schema.'}</p>
                        </li>
                    </ul>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
