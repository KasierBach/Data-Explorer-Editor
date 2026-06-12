import { Cpu, Database, AlertCircle, Shield, Code, Terminal } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function PrerequisitesSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Điều kiện tiên quyết' : 'Prerequisites & environment setup'}
            subtitle={t
                ? 'Những thứ cần có trước khi Data Explorer chạy ổn: runtime, app metadata database, quyền mạng, và quyền truy cập tới các target databases.'
                : 'What you need before Data Explorer runs smoothly: runtime, an app metadata database, network access, and reachability to target databases.'}
        >
            <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="p-6 border rounded-3xl bg-blue-500/5 border-blue-500/10">
                    <Cpu className="w-6 h-6 text-blue-500 mb-4" />
                    <h4 className="font-bold text-sm mb-2">Runtime</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t ? 'Node.js 20.x LTS được khuyên dùng. Frontend build bằng Vite 7.x.' : 'Node.js 20.x LTS is recommended. The frontend builds with Vite 7.x.'}
                    </p>
                </div>
                <div className="p-6 border rounded-3xl bg-emerald-500/5 border-emerald-500/10">
                    <Database className="w-6 h-6 text-emerald-500 mb-4" />
                    <h4 className="font-bold text-sm mb-2">Persistence</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t ? 'Một PostgreSQL riêng cho metadata app và một Redis instance cho cache, queue, notifications, presence, và throttling.' : 'A dedicated PostgreSQL database for app metadata plus a Redis instance for cache, queues, notifications, presence, and throttling.'}
                    </p>
                </div>
                <div className="p-6 border rounded-3xl bg-violet-500/5 border-violet-500/10">
                    <Shield className="w-6 h-6 text-violet-500 mb-4" />
                    <h4 className="font-bold text-sm mb-2">Security</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t ? 'JWT secret mạnh, ENCRYPTION_KEY đúng 32 ký tự, và outbound HTTPS tới AI providers nếu bạn bật AI routing.' : 'A strong JWT secret, an ENCRYPTION_KEY with exactly 32 characters, and outbound HTTPS to AI providers if you enable AI routing.'}
                    </p>
                </div>
            </div>

            <DocSection title={t ? 'Yêu cầu hệ thống' : 'System requirements'}>
                <div className="space-y-6">
                    <Prose>
                        {t ? 'Repo hiện chạy tốt nhất với full-stack TypeScript, npm, một PostgreSQL metadata database mà Prisma có thể đồng bộ bằng `db push`, và một Redis endpoint ổn định cho cache, background jobs, search index, notifications, cùng rate limiting.' : 'The repo currently runs best with full-stack TypeScript, npm, a PostgreSQL metadata database that Prisma can sync through `db push`, and a stable Redis endpoint for cache, background jobs, search indexing, notifications, and rate limiting.'}
                    </Prose>
                    <FeatureGrid>
                        <InfoCard icon={<Code className="w-5 h-5" />} title="Node.js" color="orange">
                            <p className="text-xs">{t ? 'Khuyên dùng Node.js 20.x LTS cho dev và production builds.' : 'Node.js 20.x LTS is recommended for development and production builds.'}</p>
                        </InfoCard>
                        <InfoCard icon={<Terminal className="w-5 h-5" />} title="Package Manager" color="blue">
                            <p className="text-xs">{t ? 'npm là đường được dùng nhiều nhất trong repo hiện tại. Tránh trộn nhiều package manager để khỏi lệch lockfile.' : 'npm is the most common path in the current repo. Avoid mixing package managers to prevent lockfile drift.'}</p>
                        </InfoCard>
                        <InfoCard icon={<Database className="w-5 h-5" />} title="Prisma sync" color="emerald">
                            <p className="text-xs">{t ? 'Schema app hiện được đồng bộ bằng `npx prisma db push` thay vì flow migrate deploy chuẩn.' : 'The app schema is currently synced with `npx prisma db push` instead of a clean migrate-deploy flow.'}</p>
                        </InfoCard>
                    </FeatureGrid>
                </div>
            </DocSection>

            <DocSection title={t ? 'Ma trận tương thích database' : 'Database compatibility matrix'}>
                <div className="border rounded-2xl overflow-hidden bg-card/30">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">{t ? 'Engine' : 'Engine'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản' : 'Versions'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Ghi chú' : 'Notes'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y border-t">
                            {[
                                { engine: 'PostgreSQL', ver: '12+', feat: t ? 'SQL workspace chính, health checks, explain, dashboards.' : 'Primary SQL workspace, health checks, explain, dashboards.' },
                                { engine: 'MySQL / MariaDB', ver: '5.7 / 8.0+', feat: t ? 'SQL workspace, guardrails, saved queries, AI context.' : 'SQL workspace, guardrails, saved queries, AI context.' },
                                { engine: 'SQL Server', ver: '2017+', feat: t ? 'SQL workspace, metadata explorer, AI-assisted query flow.' : 'SQL workspace, metadata explorer, AI-assisted query flow.' },
                                { engine: 'MongoDB', ver: '6+', feat: t ? 'NoSQL workspace và document exploration.' : 'NoSQL workspace and document exploration.' },
                                { engine: 'MongoDB Atlas (SRV)', ver: 'Current', feat: t ? 'Atlas SRV parsing, SSRF-aware validation, NoSQL workspace.' : 'Atlas SRV parsing, SSRF-aware validation, NoSQL workspace.' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-4 font-bold">{row.engine}</td>
                                    <td className="p-4">{row.ver}</td>
                                    <td className="p-4 text-muted-foreground">{row.feat}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            <DocSection title={t ? 'Điều kiện mạng' : 'Network prerequisites'}>
                <ul className="space-y-4">
                    {[
                        {
                            label: t ? 'AI providers' : 'AI providers',
                            desc: t
                                ? 'Backend cần outbound HTTPS (443) tới provider bạn bật: Gemini, OpenRouter, Groq, Cerebras, Beeknoee, hoặc TokenRouter. Nếu key thiếu hoặc provider không reach được, lane đó sẽ bị loại khỏi chuỗi chạy thay vì được giả vờ là đang sẵn sàng.'
                                : 'The backend needs outbound HTTPS (443) to whichever providers you enable: Gemini, OpenRouter, Groq, Cerebras, Beeknoee, or TokenRouter. If a key is missing or the provider is unreachable, that lane is removed from the execution chain rather than treated as if it were available.'
                        },
                        {
                            label: t ? 'Redis / dịch vụ nội bộ' : 'Redis / internal services',
                            desc: t
                                ? 'Nếu `REDIS_URL` không hoạt động, các lớp như BullMQ, throttling, presence, notification stream, và một phần caching/search sẽ không ổn định. Đây không chỉ là “optional optimization” nữa trong cấu trúc repo hiện tại.'
                                : 'If `REDIS_URL` is not working, BullMQ, throttling, presence, notification streaming, and part of the caching/search layer become unstable. In the current repo structure this is no longer just an optional optimization.'
                        },
                        {
                            label: t ? 'Target databases' : 'Target databases',
                            desc: t
                                ? 'Host chạy backend phải reach được các database đích. Nếu mạng trường/công ty chặn 5432, 3306, hoặc 27017, cả local dev lẫn app web đều có thể fail reachability.'
                                : 'The backend host must be able to reach target databases. If a school or company network blocks 5432, 3306, or 27017, both local development and the deployed app can lose reachability.'
                        },
                        {
                            label: t ? 'App ports' : 'App ports',
                            desc: t
                                ? 'Local dev mặc định dùng 5173 cho frontend và 3001 cho backend API. Production thường đặt frontend sau Vercel và backend sau Render hoặc nginx.'
                                : 'Local development uses 5173 for the frontend and 3001 for the backend API by default. Production commonly places the frontend behind Vercel and the backend behind Render or nginx.'
                        },
                    ].map((item, i) => (
                        <li key={i} className="flex gap-4 p-5 border rounded-2xl items-start bg-muted/5">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h5 className="font-bold text-sm">{item.label}</h5>
                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </DocSection>
        </DocPageLayout>
    );
}
