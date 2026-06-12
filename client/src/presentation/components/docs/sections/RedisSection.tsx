import { Database, Zap, ShieldAlert, Cpu, Activity, Server, Bell, Search, Share2 } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function RedisSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Cấu trúc & Cấu hình Redis' : 'Redis Architecture & Config'}
            subtitle={t
                ? 'Data Explorer sử dụng Redis làm lớp trung gian hiệu năng cao cho caching, hàng đợi (queues) và giới hạn lưu lượng (rate limiting).'
                : 'Data Explorer utilizes Redis as a high-performance middleware layer for caching, background queues, and rate limiting.'}
        >
            <FeatureGrid>
                <InfoCard icon={<Zap className="w-6 h-6 text-yellow-500" />} title="Global Caching" color="blue">
                    <p>
                        {t
                            ? 'Lưu trữ kết quả schema introspection và metadata để giảm tải cho database nguồn.'
                            : 'Caches schema introspection results and metadata to reduce load on source databases.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Activity className="w-6 h-6 text-rose-500" />} title="BullMQ Queues" color="red">
                    <p>
                        {t
                            ? 'Xử lý các workflow nền có hàng đợi, hiện thấy rõ nhất ở migration và các tác vụ async không nên chặn request chính.'
                            : 'Handles queued background workflows, currently most visible in migration and other async work that should not block the main request path.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<ShieldAlert className="w-6 h-6 text-amber-500" />} title="Rate Limiting" color="amber">
                    <p>
                        {t
                            ? 'Sử dụng ThrottlerStorageRedis để đồng bộ giới hạn API request trên toàn bộ cụm server.'
                            : 'Uses ThrottlerStorageRedis to synchronize API request limits across the entire server cluster.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            {/* Redis Roles */}
            <DocSection title={t ? 'Vai trò của Redis trong hệ thống' : 'Redis Roles in the Ecosystem'} icon={<Server className="w-5 h-5"/>}>
                <Prose>
                    {t
                        ? 'Trong Data Explorer, Redis không chỉ là cache đơn thuần mà là lớp phối hợp cho nhiều năng lực backend: cache, BullMQ, throttling, notifications, presence, và search index. Nói cách khác, nó là hạ tầng runtime thực thụ chứ không còn là “phần tăng tốc nếu có thì tốt”.'
                        : 'In Data Explorer, Redis is more than a simple cache. It coordinates multiple backend capabilities: cache, BullMQ, throttling, notifications, presence, and search indexing. In other words, it is real runtime infrastructure rather than a nice-to-have accelerator.'}
                </Prose>
                <div className="grid md:grid-cols-2 gap-8 mt-10">
                    <div className="space-y-4">
                        <h4 className="font-bold text-white flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-primary" />
                            {t ? 'Xử lý tác vụ nền (BullMQ)' : 'Background Processing (BullMQ)'}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t
                                ? 'Khi một workflow không nên giữ request đồng bộ quá lâu, backend có thể đẩy job vào Redis để worker xử lý riêng. Trong repo hiện tại, dấu vết rõ nhất của mô hình này nằm ở migration queue và các tác vụ nội bộ async.'
                                : 'When a workflow should not keep a synchronous request open for too long, the backend can push a job into Redis so a worker handles it separately. In the current repo, the clearest example of this pattern is the migration queue and related internal async work.'}
                        </p>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-bold text-white flex items-center gap-2">
                            <Database className="w-4 h-4 text-emerald-500" />
                            {t ? 'Đồng bộ hóa Trạng thái' : 'State Synchronization'}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t
                                ? 'Redis giúp đảm bảo rằng nếu bạn chạy 3 server backend (Scaling), giới hạn 100 requests/phút sẽ được áp dụng chính xác cho user đó trên cả 3 server.'
                                : 'Redis ensures that if you run 3 backend servers (scaling), the 100 requests/min limit is correctly applied to that user across all 3 servers.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            {/* Internal Architecture */}
            <DocSection title={t ? 'Cấu trúc dữ liệu nội bộ' : 'Internal Data Structure'} icon={<Cpu className="w-5 h-5"/>}>
                <Prose>
                    {t
                        ? 'Data Explorer tổ chức dữ liệu trong Redis theo các tiền tố (prefixes) nhất quán để dễ quản lý và monitor.'
                        : 'Data Explorer organizes data in Redis using consistent prefixes for easier management and monitoring.'}
                </Prose>
                <div className="mt-8 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                <th className="py-2 px-4">Prefix</th>
                                <th className="py-2 px-4">{t ? 'Module sử dụng' : 'Module'}</th>
                                <th className="py-2 px-4">{t ? 'Loại dữ liệu' : 'Data Type'}</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            <tr className="border-b border-white/5">
                                <td className="py-3 px-4 font-mono font-bold text-blue-400">cache:*</td>
                                <td className="py-3 px-4 text-muted-foreground">CacheManager</td>
                                <td className="py-3 px-4 italic text-xs">String / JSON (Schema metadata)</td>
                            </tr>
                            <tr className="border-b border-white/5">
                                <td className="py-3 px-4 font-mono font-bold text-red-400">bull:*</td>
                                <td className="py-3 px-4 text-muted-foreground">BullMQ</td>
                                <td className="py-3 px-4 italic text-xs">Hash / List / Set (Job queue state)</td>
                            </tr>
                            <tr className="border-b border-white/5">
                                <td className="py-3 px-4 font-mono font-bold text-amber-400">throttler:*</td>
                                <td className="py-3 px-4 text-muted-foreground">Rate Limiter</td>
                                <td className="py-3 px-4 italic text-xs">Integer (Request counters)</td>
                            </tr>
                            <tr className="border-b border-white/5">
                                <td className="py-3 px-4 font-mono font-bold text-emerald-400">presence:*</td>
                                <td className="py-3 px-4 text-muted-foreground">Presence service</td>
                                <td className="py-3 px-4 italic text-xs">Expiring sets / presence heartbeats</td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 font-mono font-bold text-fuchsia-400">search_index:*</td>
                                <td className="py-3 px-4 text-muted-foreground">Search service</td>
                                <td className="py-3 px-4 italic text-xs">Indexed metadata for global search</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* BullMQ Lifecycle */}
            <DocSection title={t ? 'Vòng đời tác vụ BullMQ' : 'BullMQ Job Lifecycle'}>
                <Prose>
                    {t
                        ? 'Các workflow queue-based như migration hoặc các tác vụ async dài hơn sẽ đi qua 3 giai đoạn chính trong Redis:'
                        : 'Queue-based workflows such as migration or longer async tasks go through three main stages in Redis:'}
                </Prose>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="text-xs font-black text-blue-500 mb-1 uppercase tracking-widest">Waiting</div>
                        <p className="text-xs text-muted-foreground">{t ? "Job được đưa vào Redis List và đợi Worker nhàn rỗi." : "Job is pushed to Redis List and waits for an idle worker."}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="text-xs font-black text-white mb-1 uppercase tracking-widest">Active</div>
                        <p className="text-xs text-muted-foreground">{t ? "Worker đang xử lý job. Redis giữ khóa (lock) để tránh xử lý trùng." : "Worker is processing. Redis holds a lock to prevent duplicate processing."}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="text-xs font-black text-emerald-500 mb-1 uppercase tracking-widest">Completed</div>
                        <p className="text-xs text-muted-foreground">{t ? "Job hoàn thành, kết quả được lưu tạm để Frontend polling." : "Job finished, result is temporarily cached for frontend polling."}</p>
                    </div>
                </div>
            </DocSection>

            {/* Docker Setup */}
            <DocSection title={t ? 'Triển khai Redis với Docker' : 'Redis Deployment with Docker'}>
                <Prose>
                    {t
                        ? 'Cách nhanh nhất để chạy Redis cho môi trường dev hoặc self-host là dùng Docker Compose.'
                        : 'The fastest way to run Redis for dev or self-hosting is using Docker Compose.'}
                </Prose>
                <div className="mt-6">
                    <CodeBlock title="docker-compose.yml (extract)">
                        <CodeLine>redis:</CodeLine>
                        <CodeLine>  image: redis:7-alpine</CodeLine>
                        <CodeLine>  ports:</CodeLine>
                        <CodeLine>    - "6379:6379"</CodeLine>
                        <CodeLine>  command: redis-server --save 60 1 --loglevel warning</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            {/* Advanced Integrations */}
            <DocSection title={t ? 'Tính năng nâng cao với Redis' : 'Advanced Redis Features'} icon={<Zap className="w-5 h-5 text-yellow-400"/>}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 space-y-4">
                        <div className="flex items-center gap-3">
                            <Bell className="w-5 h-5 text-blue-500" />
                            <h4 className="font-bold text-white">{t ? 'Thông báo Real-time' : 'Real-time Notifications'}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t 
                                ? 'Sử dụng Redis Pub/Sub kết hợp với SSE (Server-Sent Events) để đẩy thông báo ngay lập tức tới trình duyệt khi các tác vụ nặng (như sync dữ liệu hoặc export) hoàn tất.'
                                : 'Uses Redis Pub/Sub combined with SSE (Server-Sent Events) to push instant notifications to the browser when long-running tasks (like data sync or export) complete.'}
                        </p>
                    </div>
                    <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                        <div className="flex items-center gap-3">
                            <Search className="w-5 h-5 text-emerald-500" />
                            <h4 className="font-bold text-white">{t ? 'Tìm kiếm Schema Toàn cục' : 'Global Schema Search'}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t
                                ? 'Redis lưu trữ index metadata của tất cả các kết nối database. Điều này cho phép bạn tìm kiếm bảng hoặc view trên hàng chục database khác nhau chỉ trong vài mili giây.'
                                : 'Redis stores metadata indexes for all database connections. This allows you to search for tables or views across dozens of different databases in just a few milliseconds.'}
                        </p>
                    </div>
                </div>

                <div className="mt-6 p-8 rounded-[2rem] bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent border border-indigo-500/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Share2 className="w-32 h-32 text-indigo-500" />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                            <Zap className="w-6 h-6 text-yellow-400" />
                            {t ? 'Tối ưu hóa ERD Designer' : 'ERD Designer Optimization'}
                        </h4>
                        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                            <p>
                                {t
                                    ? 'Cùng một lớp search/index này cũng là nền để các bề mặt như ERD, global search, và các luồng chọn bảng có thể phản hồi nhanh mà không phải query lại metadata nguồn ở mỗi lần gõ:'
                                    : 'That same search/index layer is what lets surfaces such as ERD, global search, and table-picking flows stay responsive without re-querying source metadata on every keystroke:'}
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>
                                    <strong className="text-white">{t ? 'Smart Suggestions' : 'Smart Suggestions'}:</strong> {t ? 'Cho phép gợi ý bảng hoặc thực thể liên quan dựa trên index đã sync trước đó.' : 'Enables suggestions for related tables or entities based on a previously synced index.'}
                                </li>
                                <li>
                                    <strong className="text-white">{t ? 'Low Re-query Pressure' : 'Low Re-query Pressure'}:</strong> {t ? 'Việc tra cứu diễn ra trên lớp index Redis thay vì luôn phải chạm lại DB nguồn, giảm độ trễ và tải không cần thiết.' : 'Lookups happen against the Redis-backed index instead of constantly hitting the source database again, reducing latency and unnecessary load.'}
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </DocSection>

            {/* Current boundary */}
            <DocSection title={t ? 'Ranh giới sản phẩm hiện tại' : 'Current product boundary'}>
                <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10">
                    <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        {t ? 'Redis hiện là hạ tầng, chưa phải workspace riêng' : 'Redis is infrastructure today, not a dedicated workspace'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                        {t
                            ? 'Trong codebase hiện tại, Redis phục vụ cache, queue, notification stream, presence, throttling và search index. Nó chưa được mở ra thành một Redis Explorer hoàn chỉnh cho người dùng cuối, nên docs phần này nên được đọc như tài liệu kiến trúc/vận hành hơn là hướng dẫn sử dụng một workspace Redis riêng.'
                            : 'In the current codebase, Redis powers cache, queues, notification streams, presence, throttling, and the search index. It is not yet exposed as a full Redis Explorer for end users, so this section should be read as architecture and operations documentation rather than a guide to a dedicated Redis workspace.'}
                    </p>
                </div>
            </DocSection>

            {/* Configuration */}
            <DocSection title={t ? 'Cấu hình & Kết nối' : 'Configuration & Connectivity'}>
                <Prose>
                    {t
                        ? 'Backend sử dụng biến môi trường `REDIS_URL` để kết nối. Nếu không khai báo, mặc định sẽ dùng `redis://localhost:6379`.'
                        : 'The backend uses the `REDIS_URL` environment variable for connectivity. If undefined, it defaults to `redis://localhost:6379`.'}
                </Prose>
                <div className="mt-8">
                    <CodeBlock title={t ? 'Cấu hình trong .env' : '.env Configuration'}>
                        <CodeComment>{t ? 'URL kết nối Redis đầy đủ' : 'Full Redis connection URL'}</CodeComment>
                        <CodeLine>REDIS_URL=redis://user:password@your-redis-host:6379</CodeLine>
                        <p className="mt-4" />
                        <CodeComment>{t ? 'Dùng Redis TLS (cho các managed services như Upstash / AWS)' : 'Using Redis TLS (for managed services like Upstash / AWS)'}</CodeComment>
                        <CodeLine>REDIS_URL=rediss://default:yourpassword@name.upstash.io:6379</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            {/* Troubleshooting */}
            <DocSection title={t ? 'Khắc phục sự cố' : 'Troubleshooting Redis'}>
                <div className="space-y-4">
                    {[
                        {
                            q: t ? "Backend không thể khởi động do lỗi Redis?" : "Backend fails to start due to Redis error?",
                            a: t ? "Kiểm tra xem Redis đã chạy chưa (redis-cli ping). Đảm bảo firewall đã mở port 6379." : "Check if Redis is running (redis-cli ping). Ensure port 6379 is open in the firewall."
                        },
                        {
                            q: t ? "BullMQ job bị treo hoặc không xử lý?" : "BullMQ jobs are stuck or not processing?",
                            a: t ? "Xác nhận Redis không bị đầy bộ nhớ (OOM). Bạn có thể cần xóa các job cũ bằng lệnh FLUSHDB nếu đang dev." : "Confirm Redis is not out of memory (OOM). You might need to clear old jobs with FLUSHDB during development."
                        },
                        {
                            q: t ? "Lỗi Max connections?" : "Max connections error?",
                            a: t ? "Các cloud provider miễn phí thường giới hạn 10-20 connections. Hãy cân nhắc nâng cấp lên gói trả phí nếu app có nhiều user." : "Free cloud providers often limit connections to 10-20. Consider upgrading if the app scale increases."
                        }
                    ].map((item, i) => (
                        <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                            <h5 className="text-sm font-bold text-white mb-2">{item.q}</h5>
                            <p className="text-xs text-muted-foreground">{item.a}</p>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
