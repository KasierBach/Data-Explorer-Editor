import { Activity, BrainCircuit, Database, ShieldAlert } from 'lucide-react';
import { DOCS_FACTS } from '@/core/docs/docsFacts';
import { publicPath } from '@/core/seo/publicRoutes';
import { Callout, CodeBlock, CodeLine, DocPageLayout, DocSection, Prose } from '../primitives';

type LimitRow = { label: string; value: number; unit: string; fact: string };

export function OperationalLimitsSection({ lang }: { lang: 'vi' | 'en' }) {
    const t = lang === 'vi';
    const { sql, mongo, redis, ai, visualization } = DOCS_FACTS;
    const rows = (limits: LimitRow[]) => <dl className="grid sm:grid-cols-2 gap-3">{limits.map(limit => <div key={limit.fact} className="rounded-2xl border bg-muted/20 p-5"><dt className="text-sm font-medium">{limit.label}</dt><dd className="mt-2 font-mono text-primary"><span data-doc-fact={limit.fact}>{limit.value.toLocaleString(lang)}</span> <span className="text-xs text-muted-foreground">{limit.unit}</span></dd></div>)}</dl>;
    return (
        <DocPageLayout title={t ? 'Giới hạn vận hành' : 'Operational Limits'} subtitle={t ? 'Các giới hạn bảo vệ và phạm vi thực thi được lấy từ code hiện tại. Đây không phải quota gói dịch vụ hay cam kết tốc độ.' : 'Protective bounds and execution scopes taken from current code. These are not subscription quotas or performance guarantees.'}>
            <div data-doc-facts="sql mongo redis ai visualization" className="space-y-8">
                <Callout type="info"><p>{t ? 'Giới hạn client, DTO, driver và server không giống nhau. Một flag timeout không nâng mọi giới hạn driver; một limit kết quả không chứng minh trả về toàn bộ dữ liệu. Các quyền kết nối và guardrail vẫn được kiểm tra độc lập với những con số này.' : 'Client, DTO, driver, and server limits are different layers. A timeout flag does not raise every driver limit; a result limit does not prove a complete result. Connection permissions and guardrails are checked separately from these numbers.'}</p></Callout>
                <DocSection title={t ? 'SQL và phân trang' : 'SQL and pagination'} icon={<Database className="w-5 h-5" />}>
                    {rows([
                        { label: t ? 'Độ dài SQL mỗi yêu cầu' : 'SQL length per request', value: sql.maxCharacters, unit: t ? 'ký tự' : 'characters', fact: 'sql.maxCharacters' },
                        { label: t ? 'Statement trong batch' : 'Statements per batch', value: sql.maxStatements, unit: 'statements', fact: 'sql.maxStatements' },
                        { label: t ? 'Kết quả query thô' : 'Raw query result', value: sql.rawResultRows, unit: t ? 'dòng' : 'rows', fact: 'sql.rawResultRows' },
                        { label: t ? 'Trang bảng mặc định' : 'Default table page', value: sql.tablePageDefault, unit: t ? 'dòng' : 'rows', fact: 'sql.tablePageDefault' },
                        { label: t ? 'Trang bảng tối đa' : 'Maximum table page', value: sql.tablePageMax, unit: t ? 'dòng' : 'rows', fact: 'sql.tablePageMax' },
                        { label: t ? 'Query đang chạy mỗi user' : 'Active queries per user', value: sql.concurrentPerUser, unit: 'queries', fact: 'sql.concurrentPerUser' },
                        { label: t ? 'Deadline mặc định server' : 'Default server deadline', value: sql.timeoutDefaultMs / 1000, unit: t ? 'giây' : 'seconds', fact: 'sql.timeoutDefaultMs' },
                        { label: t ? 'Deadline server lớn nhất' : 'Maximum server deadline', value: sql.timeoutMaxMs / 1000, unit: t ? 'giây' : 'seconds', fact: 'sql.timeoutMaxMs' },
                    ])}
                    <Prose><p>{t ? 'QUERY_TIMEOUT_MS có mặc định 60 giây và bị chặn trên ở 600 giây; giá trị không hợp lệ quay lại mặc định. Khi deadline tới, server yêu cầu hủy qua handle rồi kiểm tra kết quả thực thi, không bảo đảm trả HTTP ngay hay ngắt engine đồng bộ. PostgreSQL, MySQL và ClickHouse còn có timeout driver riêng; SQLite/MongoDB/ClickHouse/Redis không có đường hủy đang chạy tương đương.' : 'QUERY_TIMEOUT_MS defaults to 60 seconds and is capped at 600 seconds; invalid values fall back to the default. On reaching the deadline, the server requests handle-based cancellation and checks the execution outcome; it does not guarantee an immediate HTTP response or interrupt a synchronous engine. PostgreSQL, MySQL, and ClickHouse also have driver-specific timeouts; SQLite/MongoDB/ClickHouse/Redis do not have equivalent active cancellation paths.'}</p></Prose>
                    <CodeBlock title={t ? 'Đọc một kết quả nhỏ trước' : 'Read a small result first'}><CodeLine>SELECT 1 AS connected;</CodeLine></CodeBlock>
                    <Callout type="warning"><p>{t ? 'Batch có tối đa 100 statement không có nghĩa 100 statement luôn atomic. MySQL/MariaDB có DDL commit ngầm; ClickHouse chạy tuần tự. Mất kết nối, timeout hoặc báo hủy không chứng minh các lệnh ghi đã rollback.' : 'A maximum of 100 statements does not make all 100 statements atomic. MySQL/MariaDB DDL can commit implicitly; ClickHouse executes sequentially. Disconnects, timeouts, or cancellation messages do not prove writes rolled back.'}</p></Callout>
                </DocSection>
                <DocSection title={t ? 'MongoDB: payload và schema lấy mẫu' : 'MongoDB: payloads and sampled schemas'}>
                    {rows([
                        { label: 'maxTimeMS', value: mongo.maxTimeMs / 1000, unit: t ? 'giây cho thao tác được cấu hình' : 'seconds for configured operations', fact: 'mongo.maxTimeMs' },
                        { label: t ? 'Kết quả find/aggregate' : 'find/aggregate result', value: mongo.findAggregateResultRows, unit: t ? 'document' : 'documents', fact: 'mongo.findAggregateResultRows' },
                        { label: t ? 'Pipeline' : 'Pipeline', value: mongo.pipelineStages, unit: 'stages', fact: 'mongo.pipelineStages' },
                        { label: t ? 'Độ sâu sanitizer' : 'Sanitizer nesting depth', value: mongo.nestingDepth, unit: t ? 'mức' : 'levels', fact: 'mongo.nestingDepth' },
                        { label: t ? 'Array và insertMany' : 'Array and insertMany', value: mongo.arrayItems, unit: t ? 'phần tử' : 'items', fact: 'mongo.arrayItems' },
                        { label: t ? 'Key mỗi object' : 'Keys per object', value: mongo.objectKeys, unit: 'keys', fact: 'mongo.objectKeys' },
                        { label: t ? 'Schema sample mặc định/UI' : 'Default/UI schema sample', value: mongo.schemaSampleDefault, unit: 'documents', fact: 'mongo.schemaSampleDefault' },
                        { label: t ? 'Schema sample backend tối đa' : 'Maximum backend schema sample', value: mongo.schemaSampleMax, unit: 'documents', fact: 'mongo.schemaSampleMax' },
                        { label: t ? 'Giá trị mẫu mỗi field' : 'Sample values per field', value: mongo.sampleValuesPerField, unit: t ? 'giá trị phân biệt' : 'distinct values', fact: 'mongo.sampleValuesPerField' },
                        { label: t ? 'Cache schema lấy mẫu' : 'Sampled-schema cache', value: mongo.schemaCacheSeconds / 3600, unit: t ? 'giờ' : 'hour', fact: 'mongo.schemaCacheSeconds' },
                    ])}
                    <Prose><p>{t ? 'Action được sanitizer cho phép: ' : 'Actions accepted by the sanitizer: '}<code data-doc-fact="mongo.actions">{mongo.actions.join(', ')}</code>{t ? '. Aggregate vẫn phải qua kiểm tra stage/operator và read-only; 100 stage không phải quyền chạy mọi operator. Giới hạn 50.000 nói về find/aggregate, không tuyên bố mọi output distinct/count hay mọi import đều có cùng cap.' : '. Aggregation still passes stage/operator and read-only checks; 100 stages does not authorize every operator. The 50,000 bound describes find/aggregate, not an identical cap for every distinct/count output or import.'}</p></Prose>
                    <Prose><p>{t ? 'Schema analysis lấy field top-level, tối đa 5 giá trị phân biệt mỗi field và cache 1 giờ. Đây là mẫu, không phải schema đầy đủ hay thống kê chính xác toàn collection; cache/freshness và quyền đọc vẫn có thể ảnh hưởng kết quả.' : 'Schema analysis reads top-level fields, retains up to 5 distinct sample values per field, and caches for 1 hour. It is a sample, not a complete schema or exact collection-wide statistic; caching/freshness and read permissions can affect results.'}</p></Prose>
                </DocSection>
                <DocSection title={t ? 'Redis đích: đọc có chặn ngân sách' : 'Redis targets: budgeted reads'} icon={<ShieldAlert className="w-5 h-5" />}>
                    {rows([
                        { label: t ? 'Redis tối thiểu cho đọc an toàn' : 'Minimum Redis for safe reads', value: redis.minimumMajorVersion, unit: '+', fact: 'redis.minimumMajorVersion' },
                        { label: t ? 'SCAN COUNT tối đa' : 'Maximum SCAN COUNT', value: redis.maxScanCount, unit: t ? 'mỗi yêu cầu' : 'per request', fact: 'redis.maxScanCount' },
                        { label: t ? 'Phần tử collection tối đa' : 'Maximum collection items', value: redis.maxCollectionItems, unit: 'items', fact: 'redis.maxCollectionItems' },
                        { label: t ? 'Ngân sách SCAN work' : 'SCAN work budget', value: redis.maxScanWorkKeys, unit: t ? 'key xử lý' : 'processed keys', fact: 'redis.maxScanWorkKeys' },
                        { label: t ? 'Vòng SCAN tối đa' : 'Maximum SCAN iterations', value: redis.maxScanIterations, unit: 'iterations', fact: 'redis.maxScanIterations' },
                        { label: t ? 'Ngân sách an toàn result' : 'Runtime-result safety budget', value: redis.resultSafetyBytes, unit: 'bytes (1 MiB)', fact: 'redis.resultSafetyBytes' },
                    ])}
                    <Prose><p>{t ? 'Đọc giới hạn dùng script nội bộ EVAL_RO trên Redis 7+ để kiểm tra length/cardinality, OBJECT ENCODING và MEMORY USAGE trước khi đọc. Không có caller-supplied Lua hay fallback EVAL không an toàn. Thiếu ACL hoặc vượt ngân sách gây từ chối, không âm thầm trả một trang đầy đủ hoặc số đếm chính xác. Ngân sách 1 MiB là kiểm tra runtime result, không phải giới hạn heap/JSON sau serialize.' : 'Bounded reads use fixed internal EVAL_RO scripts on Redis 7+ to check length/cardinality, OBJECT ENCODING, and MEMORY USAGE before reading. There is no caller-supplied Lua or unsafe EVAL fallback. Missing ACLs or exhausted budgets produce a refusal, not a silently “complete” page or exact count. The 1 MiB budget is a runtime-result check, not a serialized JSON/heap-size ceiling.'}</p></Prose>
                    <CodeBlock title={t ? 'Lệnh đọc nhỏ, dành cho đường Redis được hỗ trợ' : 'Small reads for a supported Redis path'}><CodeLine>PING</CodeLine><CodeLine>SCAN 0 MATCH app:* COUNT 100</CodeLine></CodeBlock>
                    <Callout type="info"><p>{t ? 'Strategy Redis tồn tại nhưng selector NoSQL và main content chưa thống nhất. Không coi ví dụ lệnh này là một workspace Redis UI hoàn chỉnh; xem trang Redis để phân biệt Redis hạ tầng và Redis đích.' : 'A Redis strategy exists, but the NoSQL selector and main content are not aligned. These command examples do not imply a complete Redis UI workspace; see the Redis page for infrastructure-versus-target distinctions.'}</p></Callout>
                </DocSection>
                <DocSection title={t ? 'AI: attachment, history và context' : 'AI: attachments, history, and context'} icon={<BrainCircuit className="w-5 h-5" />}>
                    {rows([
                        { label: t ? 'Ảnh vision mỗi request hiện tại' : 'Vision images per current request', value: ai.imagesPerRequest, unit: 'image', fact: 'ai.imagesPerRequest' },
                        { label: t ? 'PDF native mỗi request hiện tại' : 'Native PDFs per current request', value: ai.nativePdfsPerRequest, unit: 'PDF', fact: 'ai.nativePdfsPerRequest' },
                        { label: t ? 'Ngưỡng PDF native ở client' : 'Client native-PDF threshold', value: ai.nativePdfBytes, unit: 'bytes (5 MiB)', fact: 'ai.nativePdfBytes' },
                        { label: t ? 'Văn bản trích xuất được cắt' : 'Extracted text clipped at', value: ai.extractedTextCharacters, unit: t ? 'ký tự nội dung' : 'content characters', fact: 'ai.extractedTextCharacters' },
                        { label: t ? 'History gửi provider tối đa' : 'Maximum provider history', value: ai.historyMessages, unit: 'messages', fact: 'ai.historyMessages' },
                        { label: t ? 'Tổng ký tự history' : 'Total history characters', value: ai.historyCharacters, unit: t ? 'ký tự' : 'characters', fact: 'ai.historyCharacters' },
                        { label: t ? 'Bảng có metadata chi tiết' : 'Tables with detailed metadata', value: ai.detailedSchemaTables, unit: 'tables', fact: 'ai.detailedSchemaTables' },
                        { label: t ? 'Schema context được cắt' : 'Schema context clipped at', value: ai.schemaCharacters, unit: t ? 'ký tự, chưa tính ghi chú cắt' : 'characters, before truncation note', fact: 'ai.schemaCharacters' },
                        { label: t ? 'HTTP JSON body server' : 'Server HTTP JSON body', value: ai.bodyBytes, unit: 'bytes (10 MiB)', fact: 'ai.bodyBytes' },
                    ])}
                    <Prose><p>{t ? 'Luồng hiện tại chọn ảnh đầu tiên và PDF native đầu tiên đủ điều kiện. PDF lớn hơn 5 MiB đi theo văn bản trích xuất ở client; văn bản PDF/text được cắt ở 50.000 ký tự rồi có thể thêm nhãn/ghi chú. Đây không phải cap toàn bộ prompt/context. Base64 tăng kích thước body; model có vision/PDF vẫn có thể bị provider từ chối hoặc có giới hạn riêng.' : 'The current flow selects the first image and first eligible native PDF. PDFs above 5 MiB use client-extracted text; PDF/text content is clipped at 50,000 characters and can then receive labels/notes. This is not a cap on the entire prompt/context. Base64 increases body size; a model advertising vision/PDF can still be rejected by its provider or have separate limits.'}</p></Prose>
                </DocSection>
                <DocSection title={t ? 'Biểu đồ và snapshot dashboard' : 'Charts and dashboard snapshots'} icon={<Activity className="w-5 h-5" />}>
                    {rows([
                        { label: t ? 'Kiểu chart trong visualizer' : 'Visualizer chart types', value: visualization.chartTypes.length, unit: t ? 'kiểu' : 'types', fact: 'visualization.chartTypes' },
                        { label: t ? 'Input chart được lấy' : 'Chart input used', value: visualization.chartInputRows, unit: t ? 'dòng đầu' : 'first rows', fact: 'visualization.chartInputRows' },
                        { label: t ? 'Kiểu widget trong save dialog' : 'Save-dialog widget types', value: visualization.dashboardTypes.length, unit: t ? 'kiểu' : 'types', fact: 'visualization.dashboardTypes' },
                        { label: t ? 'Snapshot widget' : 'Widget snapshot', value: visualization.snapshotRows, unit: t ? 'dòng tối đa' : 'maximum rows', fact: 'visualization.snapshotRows' },
                        { label: t ? 'JSON snapshot server' : 'Server JSON snapshot', value: visualization.snapshotBytes, unit: 'bytes (512 KiB)', fact: 'visualization.snapshotBytes' },
                    ])}
                    <Prose><p>{t ? '12 kiểu chart trong visualizer không phải 12 kiểu lưu dashboard: save dialog hiện có bar, line, area, pie, donut và table. Snapshot là dữ liệu đã lưu, không phải live refresh; cắt 2.000/200 dòng không chứng nhận báo cáo đầy đủ.' : 'The visualizer’s 12 chart types are not 12 dashboard-save types: the save dialog currently offers bar, line, area, pie, donut, and table. A snapshot is saved data, not live refresh; clipping to 2,000/200 rows does not certify a complete report.'}</p></Prose>
                </DocSection>
                <p className="text-sm flex flex-wrap gap-4"><a className="text-primary hover:underline" href={publicPath(lang, '/docs/database-capabilities')}>{t ? 'Ma trận khả năng' : 'Capability matrix'}</a><a className="text-primary hover:underline" href={publicPath(lang, '/docs/data-handling')}>{t ? 'Dữ liệu được lưu ở đâu?' : 'Where is data stored?'}</a><a className="text-primary hover:underline" href={publicPath(lang, '/docs/billing')}>{t ? 'Gói dịch vụ — không phải quota này' : 'Plans — separate from these limits'}</a></p>
            </div>
        </DocPageLayout>
    );
}
