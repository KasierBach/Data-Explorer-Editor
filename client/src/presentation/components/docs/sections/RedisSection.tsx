import { Database, Zap, ShieldAlert, Activity, Server, Search } from 'lucide-react';
import { publicPath } from '@/core/seo/publicRoutes';
import { DOCS_FACTS } from '@/core/docs/docsFacts';
import { Callout, DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, CodeBlock, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function RedisSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout title={t ? 'Redis: hạ tầng và kết nối dữ liệu' : 'Redis: infrastructure and target connections'} subtitle={t ? 'Phân biệt Redis vận hành ứng dụng với Redis được đăng ký như một database đích, cùng cách cấu hình và kiểm tra an toàn.' : 'Separate application Redis infrastructure from the registered Redis target strategy, with safe configuration and diagnostics.'}>
            <FeatureGrid>
                <InfoCard icon={<Zap className="w-6 h-6 text-yellow-500" />} title={t ? 'Cache và freshness' : 'Cache and freshness'} color="blue"><p>{t ? 'Redis hỗ trợ cache metadata/count và index để giảm đọc lại database nguồn. Cache bị invalidated sau mutation; không giả định mọi raw query được cache.' : 'Redis supports metadata/count caches and indexes to reduce repeated source-database reads. Mutations invalidate freshness; not every raw-query result is cached.'}</p></InfoCard>
                <InfoCard icon={<Activity className="w-6 h-6 text-rose-500" />} title="BullMQ" color="red"><p>{t ? 'Migration chạy trong queue nền dùng Redis. Job state và các batch đã commit không được phép xóa tùy tiện để xử lý lỗi.' : 'Migration runs through a Redis-backed background queue. Job state and already-committed batches must not be erased as a troubleshooting shortcut.'}</p></InfoCard>
                <InfoCard icon={<ShieldAlert className="w-6 h-6 text-amber-500" />} title={t ? 'Phối hợp runtime' : 'Runtime coordination'} color="amber"><p>{t ? 'Throttling, notifications, presence và search dùng cùng hạ tầng. Rate limits khác nhau theo endpoint, không phải một mức 100 request/phút chung.' : 'Throttling, notifications, presence, and search share this infrastructure. Rate limits differ by endpoint; there is no universal 100-requests-per-minute limit.'}</p></InfoCard>
            </FeatureGrid>
            <DocSection title={t ? '1. Redis của ứng dụng' : '1. Application infrastructure Redis'} icon={<Server className="w-5 h-5" />}>
                <Prose>{t ? '`REDIS_URL` nối backend với cache, BullMQ, notifications, presence, search và throttling. Đây là dependency runtime: readiness kiểm tra Redis cùng PostgreSQL. Redis hạ tầng không tự xuất hiện như connection cá nhân của người dùng.' : '`REDIS_URL` connects the backend to caches, BullMQ, notifications, presence, search, and throttling. This is a runtime dependency: readiness checks Redis alongside PostgreSQL. Infrastructure Redis does not automatically become a personal database connection.'}</Prose>
                <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label={t ? 'Các namespace Redis' : 'Redis namespaces'}>
                    <table className="w-full text-left text-sm"><thead><tr><th className="p-3">Namespace</th><th className="p-3">{t ? 'Mục đích' : 'Purpose'}</th></tr></thead><tbody>{[
                        ['data-explorer-cache', t ? 'Namespace Keyv cho dữ liệu cache; cấu trúc key do thư viện quản lý.' : 'Keyv cache namespace; library-managed key layout.'],
                        ['bull:*', t ? 'Job state, locks và hàng đợi BullMQ.' : 'BullMQ job state, locks, and queues.'],
                        ['presence:*', t ? 'Presence theo scope; hash được đọc bằng HSCAN.' : 'Scoped presence; hashes are read with HSCAN.'],
                        ['search_index:*', t ? 'Metadata và candidate index tìm kiếm.' : 'Metadata and search candidate indexes.'],
                    ].map(([name, description]) => <tr key={name} className="border-t"><td className="p-3 font-mono text-primary">{name}</td><td className="p-3 text-muted-foreground">{description}</td></tr>)}</tbody></table>
                </div>
                <Callout type="info"><p>{t ? 'Namespace này mô tả implementation, không phải API để người dùng sửa trực tiếp. Service keys() tương thích dùng SCAN, không quét keyspace bằng KEYS.' : 'These namespaces describe implementation, not a public API for direct mutation. The compatibility keys() service uses SCAN rather than a blocking KEYS keyspace scan.'}</p></Callout>
            </DocSection>
            <DocSection title={t ? '2. Chạy Redis local bằng Compose' : '2. Run local Redis with Compose'}>
                <Prose>{t ? 'Dùng service có sẵn trong repository. Ports mặc định chỉ bind loopback, AOF lưu xuống volume. Đây là cấu hình local, không phải Internet-facing production.' : 'Use the repository’s existing service. Published ports bind to loopback and AOF persists into a volume. This is a local setup, not an Internet-facing production configuration.'}</Prose>
                <CodeBlock title="Terminal"><CodeLine>docker compose up -d redis</CodeLine></CodeBlock>
                <CodeBlock title="docker-compose.yml"><CodeLine>redis:</CodeLine><CodeLine>  image: redis:7-alpine</CodeLine><CodeLine>{'  command: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec"]'}</CodeLine><CodeLine>  ports:</CodeLine><CodeLine>{'    - "${REDIS_BIND:-127.0.0.1:6379}:6379"'}</CodeLine><CodeLine>  volumes:</CodeLine><CodeLine>    - redisdata:/data</CodeLine></CodeBlock>
                <Callout type="warning"><p>{t ? 'Không public port 6379 ra Internet. Production cần private networking, authentication và TLS phù hợp. Không xóa toàn bộ Redis database để “dọn job”: hành động đó cũng mất throttling, presence, cache và search. Nếu cần reset dev, dùng instance/volume riêng có thể bỏ đi và kiểm tra target trước.' : 'Do not expose port 6379 to the Internet. Production needs appropriate private networking, authentication, and TLS. Do not erase the whole Redis database to “clean jobs”: it also destroys throttling, presence, caches, and search. Use a separate disposable instance/volume for development resets and verify the target first.'}</p></Callout>
            </DocSection>
            <DocSection title={t ? '3. Redis như database đích: trạng thái hiện tại' : '3. Target Redis: current support status'} icon={<Database className="w-5 h-5" />}>
                <Prose>{t ? 'Backend có RedisStrategy và dialog cho phép tạo Redis connection. Selector NoSQL cũng liệt kê Redis, nhưng màn chính hiện chỉ chấp nhận MongoDB/Atlas. Vì vậy không xem đây là Redis Explorer hoàn chỉnh: connection có thể chọn được nhưng không có editor/browsing flow hoạt động tương ứng.' : 'The backend has RedisStrategy and the connection dialog can create Redis connections. The NoSQL selector lists Redis, but its main content currently accepts only MongoDB/Atlas. This is not a complete Redis Explorer: a selectable connection does not establish a working editor/browsing flow.'}</Prose>
                <Prose>{t ? 'Target Redis là cấu hình connection riêng, không dùng REDIS_URL của hạ tầng. Transport TLS được lưu bằng flag trên connection; rediss:// bật TLS. Certificate verification phụ thuộc ALLOW_INSECURE_DATABASE_TLS: phải đặt false rõ ràng cho production.' : 'Target Redis uses a separate connection definition, not infrastructure REDIS_URL. Its per-connection flag selects TLS; rediss:// enables it. Certificate verification depends on ALLOW_INSECURE_DATABASE_TLS: explicitly set false in production.'}</Prose>
                <div className="grid gap-3 md:grid-cols-2">{[
                    t ? `Read path yêu cầu Redis ${DOCS_FACTS.redis.minimumMajorVersion}+ và ACL cho ${DOCS_FACTS.redis.scriptCommand} nội bộ.` : `Read paths require Redis ${DOCS_FACTS.redis.minimumMajorVersion}+ and ACL access to internal ${DOCS_FACTS.redis.scriptCommand} scripts.`,
                    t ? `Giới hạn collection/scan count: ${DOCS_FACTS.redis.maxCollectionItems} items.` : `Collection/scan count limit: ${DOCS_FACTS.redis.maxCollectionItems} items.`,
                    t ? `Scan-work tối đa ${DOCS_FACTS.redis.maxScanWorkKeys} keys và ${DOCS_FACTS.redis.maxScanIterations} iterations.` : `Scan-work budgets: ${DOCS_FACTS.redis.maxScanWorkKeys} keys and ${DOCS_FACTS.redis.maxScanIterations} iterations.`,
                    t ? 'Response read path có budget 1 MiB. Oversize/ACL refusal không phải một page hoàn chỉnh; không tự fallback sang Lua tùy ý.' : 'Read responses have a 1 MiB budget. Oversize/ACL refusal is not a complete page; arbitrary caller Lua is not a fallback.',
                ].map(item => <div key={item} className="rounded-xl border p-4 text-sm text-muted-foreground">{item}</div>)}</div>
                <Prose><a href={publicPath(lang, '/docs/database-capabilities')}>{t ? 'Xem ma trận engine' : 'Read the engine capability matrix'}</a> · <a href={publicPath(lang, '/docs/operational-limits')}>{t ? 'Giới hạn vận hành' : 'Operational limits'}</a></Prose>
            </DocSection>
            <DocSection title={t ? '4. Kiểm tra lỗi theo đúng scope' : '4. Diagnose the correct scope'} icon={<Search className="w-5 h-5" />}>
                <ul className="space-y-3 text-sm text-muted-foreground">{[
                    t ? 'Backend không ready: kiểm tra service Redis, REDIS_URL, network và credentials. Host-run API dùng 127.0.0.1:6379; Compose dùng redis://redis:6379.' : 'Backend not ready: check the Redis service, REDIS_URL, network, and credentials. A host-run API uses 127.0.0.1:6379; Compose uses redis://redis:6379.',
                    t ? 'Migration job lỗi: đọc status/progress và kiểm tra dữ liệu target. Xử lý retry theo trang Migration, không xóa queue để giả lập khôi phục.' : 'Migration failure: read status/progress and inspect target data. Follow Migration retry guidance; deleting the queue does not establish recovery.',
                    t ? 'ACL/oversize errors ở target Redis: giảm COUNT/scope trong contract cho phép. Không bật arbitrary scripting hoặc mutation để vượt guard.' : 'Target Redis ACL/oversize errors: reduce COUNT/scope within the allowed contract. Do not enable arbitrary scripting or mutations to bypass safeguards.',
                    t ? 'Max connections phụ thuộc gói provider và deployment. Kiểm tra metric thực tế thay vì giả định mọi free tier có cùng limit.' : 'Connection limits depend on provider plans and deployment. Inspect actual metrics rather than assuming every free tier has the same limit.',
                ].map(item => <li key={item} className="rounded-xl border p-4">{item}</li>)}</ul>
                <Prose><a href={publicPath(lang, '/docs/data-migration')}>{t ? 'Migration và khôi phục' : 'Migration and recovery'}</a></Prose>
            </DocSection>
        </DocPageLayout>
    );
}
