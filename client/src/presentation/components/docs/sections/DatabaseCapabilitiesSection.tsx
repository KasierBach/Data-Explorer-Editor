import { Database, Lock, ShieldCheck } from 'lucide-react';
import { DATABASE_CAPABILITIES, DOCS_FACTS } from '@/core/docs/docsFacts';
import { publicPath } from '@/core/seo/publicRoutes';
import { Callout, CodeBlock, CodeLine, DocPageLayout, DocSection, Prose } from '../primitives';

export function DatabaseCapabilitiesSection({ lang }: { lang: 'vi' | 'en' }) {
    const t = lang === 'vi';
    const workspaceLabels = {
        sql: t ? 'Workspace SQL' : 'SQL workspace',
        mongodb: t ? 'Workspace MongoDB' : 'MongoDB workspace',
        'selector-gap': t ? 'Có trong form; thiếu trong selector SQL' : 'In the form; missing from SQL selector',
        'main-content-gap': t ? 'Có trong selector NoSQL; main chỉ nhận MongoDB' : 'In NoSQL selector; main accepts only MongoDB',
    };
    const transportLabels = {
        'postgres-tls': t ? 'Remote SSL; kiểm chứng tùy flag server' : 'Remote SSL; verification depends on server flag',
        'mysql-tls': t ? 'Toggle TLS; local không SSL' : 'TLS toggle; local without SSL',
        'mssql-tls': t ? 'Encrypt/trust theo host và flag server' : 'Encrypt/trust follows host and server flag',
        'mongo-driver': t ? 'Theo URI được tạo lại / MongoDB driver' : 'Reconstructed URI / MongoDB driver',
        'mongo-srv': t ? 'SRV / TLS mặc định driver; URI có giới hạn' : 'SRV / driver-default TLS; URI limitations',
        'server-file': t ? 'File server, không TLS mạng' : 'Server file, no network TLS',
        'clickhouse-http': t ? 'HTTP mặc định; HTTPS khi remote + flag false' : 'HTTP default; HTTPS for remote + flag false',
        'redis-tls': t ? 'Toggle TLS; chứng chỉ theo flag server' : 'TLS toggle; certificates follow server flag',
    };
    const batchLabels = {
        atomic: t ? 'Transaction batch' : 'Transactional batch',
        'postgres-compatible': t ? 'Theo strategy tương thích PostgreSQL' : 'PostgreSQL-compatible strategy',
        'implicit-ddl': t ? 'DML transaction; DDL có thể commit ngầm' : 'DML transaction; DDL may implicitly commit',
        transaction: t ? 'Transaction theo strategy' : 'Strategy transaction',
        'single-payload': t ? 'Một payload MQL' : 'One MQL payload',
        sequential: t ? 'Tuần tự; không rollback toàn batch' : 'Sequential; no whole-batch rollback',
        'read-commands': t ? 'Endpoint lệnh đọc giới hạn' : 'Bounded read-command endpoint',
    };
    return (
        <DocPageLayout title={t ? 'Khả năng từng database' : 'Database Capabilities'} subtitle={t ? 'Ma trận dựa trên strategy backend và các cổng kiểm tra hiện tại — không phải tuyên bố mọi engine, phiên bản hay cloud đều đã được chứng nhận.' : 'A matrix grounded in current backend strategies and application gates — not a claim that every engine, version, or cloud service is certified.'}>
            <div data-doc-facts="database-capabilities sql tls" className="space-y-8">
                <Callout type="info"><p>{t ? 'Factory có 10 khóa type dùng thật. MariaDB dùng MySQL strategy; mongodb+srv dùng MongoDB strategy; CockroachDB mở rộng PostgreSQL strategy. mock được DTO/client nhận như dữ liệu mẫu nhưng không có registration trong factory, nên không được tính là engine backend thứ 11.' : 'The factory registers 10 real type keys. MariaDB uses the MySQL strategy; mongodb+srv uses the MongoDB strategy; CockroachDB extends the PostgreSQL strategy. mock is accepted by DTO/client types for demo data but has no factory registration, so it is not an eleventh backend engine.'}</p></Callout>
                <DocSection title={t ? 'Backend và tuyến giao diện' : 'Backend and UI routing'} icon={<Database className="w-5 h-5" />}>
                    <Prose><p>{t ? '“Có strategy” nghĩa là adapter được đăng ký, không có nghĩa mọi đường giao diện đã hoàn chỉnh. Cột sửa/xóa nói riêng về endpoint và grid có kiểm chứng khóa dòng, không đại diện mọi lệnh SQL/MQL hay insert/import. Mọi truy cập còn phụ thuộc quyền kết nối, database, tài khoản và guardrail.' : '“Strategy registered” means an adapter is registered, not that every UI path is complete. The update/delete column specifically covers verified-row-identity endpoints and grids, not every SQL/MQL command or insert/import operation. Access still depends on connection/database permissions, credentials, and guardrails.'}</p></Prose>
                    <div className="overflow-x-auto rounded-2xl border">
                        <table className="w-full text-sm text-left">
                            <caption className="sr-only">{t ? '10 kiểu kết nối được backend đăng ký' : '10 registered backend connection types'}</caption>
                            <thead className="bg-muted/30"><tr>{[t ? 'Kiểu / engine' : 'Type / engine', t ? 'Giao diện hiện tại' : 'Current UI', t ? 'Grid UPDATE/DELETE' : 'Grid UPDATE/DELETE', t ? 'Hủy đang chạy' : 'Active cancellation', t ? 'Batch' : 'Batch'].map(label => <th key={label} scope="col" className="p-4 font-semibold">{label}</th>)}</tr></thead>
                            <tbody>{DATABASE_CAPABILITIES.map(engine => <tr key={engine.type} data-doc-engine={engine.type} className="border-t">
                                <th scope="row" className="p-4 font-medium">{engine.name}<code className="block text-xs text-muted-foreground mt-1">{engine.type}</code></th>
                                <td className="p-4 text-muted-foreground">{workspaceLabels[engine.workspace]}</td>
                                <td className="p-4">{engine.rowUpdateDelete ? (engine.type === 'sqlite' ? (t ? 'Có ở backend, chỉ main' : 'Backend only, main schema') : (t ? 'Có, cần PK/quyền ghi' : 'Yes, PK/write permission required')) : (t ? 'Không qua allowlist này' : 'Not in this allowlist')}</td>
                                <td className="p-4">{engine.cancellation === 'request' ? (t ? 'Có thể gửi yêu cầu, không bảo đảm' : 'Request supported, not guaranteed') : (t ? 'Không có handle hủy' : 'No cancellation handle')}</td>
                                <td className="p-4 text-muted-foreground">{batchLabels[engine.batch]}</td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                </DocSection>
                <DocSection title={t ? 'Ba điểm dễ hiểu nhầm' : 'Three common misunderstandings'} icon={<ShieldCheck className="w-5 h-5" />}>
                    <ul className="list-disc pl-5 space-y-3 text-sm text-muted-foreground">
                        <li>{t ? 'SQLite có file strategy và quyền sửa main ở backend, nhưng SQL_TYPES trong selector không chứa sqlite. Add Connection hiện có SQLite; khoảng trống nằm ở chọn kết nối workspace, không phải không có driver.' : 'SQLite has a file strategy and backend main-schema editing, but the selector’s SQL_TYPES omits sqlite. Add Connection already offers SQLite; the gap is workspace selection, not a missing driver.'}</li>
                        <li>{t ? 'Redis có strategy cho đích database, có trong NOSQL_TYPES của selector, nhưng NoSqlMainContent chỉ nhận mongodb/mongodb+srv. Không gọi đây là workspace Redis hoàn chỉnh. Redis hạ tầng cache/queue là vai trò khác.' : 'Redis has a target-database strategy and appears in the selector’s NOSQL_TYPES, but NoSqlMainContent accepts only mongodb/mongodb+srv. This is not a complete Redis workspace. Infrastructure Redis for cache/queues is a separate role.'}</li>
                        <li>{t ? 'MongoDB có các action ghi MQL được quyền kiểm tra; ClickHouse có phương thức mutation nội bộ. Cả hai vẫn không được phép sửa/xóa dòng qua allowlist grid SQL có kiểm chứng PK. Không dùng một method tồn tại để suy ra hỗ trợ end-to-end.' : 'MongoDB has permission-checked MQL write actions; ClickHouse has internal mutation methods. Neither is included in the verified-PK SQL-grid update/delete allowlist. The existence of a method is not proof of end-to-end support.'}</li>
                    </ul>
                    <CodeBlock title={t ? 'Kiểm tra chỉ đọc với các engine SQL' : 'Read-only check for SQL engines'}><CodeLine>SELECT 1 AS connected;</CodeLine></CodeBlock>
                    <Prose><p>{t ? 'Ví dụ SQL này không áp dụng cho MongoDB/Redis. Chọn dialect và collection/command phù hợp, không gửi SQL sang mọi engine.' : 'This SQL example does not apply to MongoDB/Redis. Choose the appropriate dialect and collection/command rather than sending SQL to every engine.'}</p></Prose>
                </DocSection>
                <DocSection title={t ? 'TLS và xác minh chứng chỉ' : 'TLS and certificate verification'} icon={<Lock className="w-5 h-5" />}>
                    <Callout type="warning"><p>{t ? 'ALLOW_INSECURE_DATABASE_TLS hiện cho phép chế độ không an toàn trừ khi giá trị đúng bằng false. Do đó không mô tả cấu hình mặc định như bảo đảm xác minh chứng chỉ. Phải kiểm tra cả flag server, local/remote, toggle riêng và endpoint; URI form không bảo toàn toàn bộ tùy chọn TLS.' : 'ALLOW_INSECURE_DATABASE_TLS currently permits insecure behavior unless its value is exactly false. The default configuration therefore must not be described as guaranteed certificate verification. Check the server flag, local/remote host, per-engine toggles, and endpoint; the URI form does not preserve every TLS option.'}</p></Callout>
                    <div className="overflow-x-auto rounded-2xl border"><table className="w-full text-sm text-left"><caption className="sr-only">{t ? 'Khác biệt transport theo engine' : 'Transport differences by engine'}</caption><thead className="bg-muted/30"><tr><th className="p-4" scope="col">Engine</th><th className="p-4" scope="col">{t ? 'Hành vi transport cần kiểm tra' : 'Transport behavior to verify'}</th></tr></thead><tbody>{DATABASE_CAPABILITIES.map(engine => <tr key={engine.type} className="border-t"><th className="p-4 font-medium" scope="row">{engine.name}</th><td className="p-4 text-muted-foreground">{transportLabels[engine.transport]}</td></tr>)}</tbody></table></div>
                </DocSection>
                <DocSection title={t ? 'Kiểm chứng theo môi trường của bạn' : 'Verify in your own environment'}>
                    <Prose><p>{t ? 'Không có danh sách chứng nhận tất cả phiên bản engine/cloud trong code này. Test connection và kiểm thử strategy không thay thế kiểm thử integration với đúng server, TLS, quyền, kiểu dữ liệu và truy vấn của bạn. Trước production, thử truy vấn chỉ đọc, metadata, giới hạn, permission denial và cách xử lý mất kết nối trên môi trường staging.' : 'This code does not contain a certification list for every engine version/cloud provider. Connection tests and strategy tests do not replace integration testing against your actual server, TLS, permissions, data types, and queries. Before production, test read-only queries, metadata, limits, permission denials, and disconnect handling in staging.'}</p></Prose>
                    <Prose><p>{t ? 'Giới hạn sửa/xóa backend hiện có ' : 'The backend update/delete allowlist currently contains '}<span data-doc-fact="sql.rowUpdateDeleteTypes">{DOCS_FACTS.sql.rowUpdateDeleteTypes.join(', ')}</span>{t ? '. Những giới hạn này không tự mở rộng theo gói Pro.' : '. These capabilities do not automatically expand with a Pro plan.'}</p></Prose>
                    <p className="text-sm flex flex-wrap gap-4">{[['/docs/sqlite', 'SQLite', 'SQLite'], ['/docs/clickhouse', 'ClickHouse', 'ClickHouse'], ['/docs/redis', 'Redis & caching', 'Redis & caching'], ['/docs/operational-limits', 'Giới hạn vận hành', 'Operational limits'], ['/docs/security', 'Quyền và bảo mật', 'Permissions and security']].map(([path, vi, en]) => <a key={path} className="text-primary hover:underline" href={publicPath(lang, path)}>{t ? vi : en}</a>)}</p>
                </DocSection>
            </div>
        </DocPageLayout>
    );
}
