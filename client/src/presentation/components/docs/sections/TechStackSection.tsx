import { DocPageLayout, DocSection, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function TechStackSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Công nghệ sử dụng' : 'Technology stack'}
            subtitle={t
                ? 'Tổng quan các framework, runtime, driver, và lane AI đang được dùng thật trong Data Explorer.'
                : 'Overview of the frameworks, runtimes, drivers, and AI lanes actually used in Data Explorer today.'}
        >
            <DocSection title={t ? 'Frontend' : 'Frontend'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-blue-500/10">
                                <th className="text-left p-4 font-bold">{t ? 'Công nghệ' : 'Technology'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản' : 'Version'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Vai trò' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { tech: 'React', ver: '19.x', role: t ? 'Nền tảng giao diện chính cho toàn bộ ứng dụng client.' : 'Primary UI foundation for the entire client application.' },
                                { tech: 'Vite', ver: '7.x', role: t ? 'Dev server và build pipeline tốc độ cao.' : 'Fast dev server and build pipeline.' },
                                { tech: 'TypeScript', ver: '5.9.x', role: t ? 'Type safety xuyên suốt frontend và backend.' : 'Type safety across frontend and backend.' },
                                { tech: 'Tailwind CSS', ver: '4.x', role: t ? 'Styling utility-first cho toàn bộ surface UI.' : 'Utility-first styling across the whole UI surface.' },
                                { tech: 'Zustand', ver: '5.x', role: t ? 'State management dạng slice cho tabs, AI chat, connections và UI shell.' : 'Slice-based state management for tabs, AI chat, connections, and the shell.' },
                                { tech: 'Monaco Editor', ver: '4.7+', role: t ? 'SQL editor chính với shortcut, formatting, và completions.' : 'Primary SQL editor with shortcuts, formatting, and completions.' },
                                { tech: '@tanstack/react-query', ver: '5.x', role: t ? 'Server state, caching, và request synchronization.' : 'Server state, caching, and request synchronization.' },
                                { tech: '@xyflow/react', ver: '12.x', role: t ? 'Canvas engine cho ERD/visual diagram flow.' : 'Canvas engine for ERD and visual diagram flows.' },
                                { tech: 'Recharts', ver: '3.x', role: t ? 'Chart rendering cho query results và dashboard widgets.' : 'Chart rendering for query results and dashboard widgets.' },
                                { tech: 'Radix UI', ver: 'latest', role: t ? 'Headless primitives cho dialog, dropdown, tooltip, tabs và menus.' : 'Headless primitives for dialogs, dropdowns, tooltips, tabs, and menus.' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-bold text-primary">{row.tech}</td>
                                    <td className="p-4 font-mono text-xs">{row.ver}</td>
                                    <td className="p-4 text-muted-foreground">{row.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            <DocSection title={t ? 'Backend' : 'Backend'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-emerald-500/10">
                                <th className="text-left p-4 font-bold">{t ? 'Công nghệ' : 'Technology'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản' : 'Version'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Vai trò' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { tech: 'NestJS', ver: '11.x', role: t ? 'Framework backend chính với module boundaries và DI.' : 'Primary backend framework with module boundaries and DI.' },
                                { tech: 'Prisma', ver: '6.x', role: t ? 'ORM cho metadata app: users, connections, saved queries, dashboards.' : 'ORM for app metadata: users, connections, saved queries, and dashboards.' },
                                { tech: 'Passport + JWT', ver: '11.x / 4.x', role: t ? 'Email login, Google/GitHub OAuth, JWT session flow.' : 'Email login, Google/GitHub OAuth, and JWT session flow.' },
                                { tech: 'pg', ver: '8.x', role: t ? 'Native PostgreSQL driver cho SQL execution.' : 'Native PostgreSQL driver for SQL execution.' },
                                { tech: 'mysql2', ver: '3.x', role: t ? 'MySQL/MariaDB driver.' : 'MySQL/MariaDB driver.' },
                                { tech: 'mssql', ver: '12.x', role: t ? 'SQL Server driver.' : 'SQL Server driver.' },
                                { tech: 'mongodb', ver: '7.x', role: t ? 'MongoDB / Atlas support cho NoSQL workspace.' : 'MongoDB / Atlas support for the NoSQL workspace.' },
                                { tech: 'RxJS', ver: '7.x', role: t ? 'Streaming flows, especially cho AI SSE responses.' : 'Streaming flows, especially for AI SSE responses.' },
                                { tech: 'helmet', ver: '8.x', role: t ? 'HTTP hardening headers trên backend.' : 'HTTP hardening headers on the backend.' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-bold text-primary">{row.tech}</td>
                                    <td className="p-4 font-mono text-xs">{row.ver}</td>
                                    <td className="p-4 text-muted-foreground">{row.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            <DocSection title={t ? 'AI stack & routing' : 'AI stack & routing'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-purple-500/10">
                                <th className="text-left p-4 font-bold">{t ? 'Lane / Provider' : 'Lane / Provider'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Ví dụ model' : 'Example model'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Vai trò' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                {
                                    service: 'Gemini premium lane',
                                    model: 'gemini-3-flash-preview / selected Gemini model',
                                    role: t ? 'Task khó hơn, image input, vision flows, và fallback chất lượng cao.' : 'Harder tasks, image input, vision flows, and higher-quality fallback.'
                                },
                                {
                                    service: 'Cerebras cheap lane',
                                    model: 'llama3.1-8b',
                                    role: t ? 'General chat và prompt nhẹ để giảm tần suất gọi Gemini.' : 'General chat and light prompts to reduce Gemini usage.'
                                },
                                {
                                    service: 'OpenRouter fallback lane',
                                    model: 'openrouter/auto',
                                    role: t ? 'Fallback lane tùy chọn khi muốn thêm provider ngoài Gemini/Cerebras.' : 'Optional fallback lane when you want a provider beyond Gemini/Cerebras.'
                                },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-bold">{row.service}</td>
                                    <td className="p-4 font-mono text-primary font-bold text-xs">{row.model}</td>
                                    <td className="p-4 text-muted-foreground">{row.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Callout type="info">
                    <p className="text-muted-foreground">
                        {t
                            ? 'AI panel hiện hỗ trợ các routing mode như Auto, Fast / Cheap, Best Quality và Gemini Only. UI cũng hiển thị provider/model thực tế đã trả lời để tránh nhầm lẫn khi routing đang hoạt động.'
                            : 'The AI panel now supports routing modes such as Auto, Fast / Cheap, Best Quality, and Gemini Only. The UI also shows the actual provider/model that answered so routing decisions stay transparent.'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Testing & quality' : 'Testing & quality'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-amber-500/10">
                                <th className="text-left p-4 font-bold">{t ? 'Công cụ' : 'Tool'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Phiên bản' : 'Version'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Vai trò' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { tech: 'Vitest', ver: '4.x', role: t ? 'Frontend unit tests và component tests.' : 'Frontend unit tests and component tests.' },
                                { tech: 'React Testing Library', ver: '16.x', role: t ? 'UI testing theo hành vi người dùng.' : 'User-behavior-oriented UI testing.' },
                                { tech: 'Jest', ver: '30.x', role: t ? 'Backend test runner cho NestJS services/controllers.' : 'Backend test runner for NestJS services and controllers.' },
                                { tech: 'ts-jest', ver: '29.x', role: t ? 'TypeScript transform cho backend test suite.' : 'TypeScript transform for the backend test suite.' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-4 font-bold text-primary">{row.tech}</td>
                                    <td className="p-4 font-mono text-xs">{row.ver}</td>
                                    <td className="p-4 text-muted-foreground">{row.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
