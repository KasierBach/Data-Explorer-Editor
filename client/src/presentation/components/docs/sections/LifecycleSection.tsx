import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function LifecycleSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Quy trình Phát triển' : 'Development Lifecycle'}
            subtitle={t
                ? 'Hướng dẫn toàn diện về quy trình phát triển, các script hữu ích, và coding conventions cho Data Explorer.'
                : 'Comprehensive guide on the development workflow, useful scripts, and coding conventions for Data Explorer.'}
        >
            {/* Development Scripts */}
            <DocSection title={t ? 'Scripts phát triển' : 'Development Scripts'}>
                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">Script</th>
                                <th className="text-left p-4 font-bold">{t ? 'Thư mục' : 'Directory'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Mô tả' : 'Description'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { script: 'npm run dev', dir: 'client/', desc: t ? 'Khởi động Vite dev server với HMR (cổng 5173)' : 'Start Vite dev server with HMR (port 5173)' },
                                { script: 'npm run build', dir: 'client/', desc: t ? 'Build production bundle (output: dist/)' : 'Build production bundle (output: dist/)' },
                                { script: 'npm run preview', dir: 'client/', desc: t ? 'Preview bản build production locally' : 'Preview production build locally' },
                                { script: 'npm run start:dev', dir: 'server/', desc: t ? 'Khởi động NestJS ở chế độ watch (tự restart khi thay đổi code)' : 'Start NestJS in watch mode (auto-restart on code changes)' },
                                { script: 'npm run build', dir: 'server/', desc: t ? 'Biên dịch TypeScript sang JavaScript (output: dist/)' : 'Compile TypeScript to JavaScript (output: dist/)' },
                                { script: 'npm run start:prod', dir: 'server/', desc: t ? 'Chạy bản build production' : 'Run production build' },
                                { script: 'npx prisma studio', dir: 'server/', desc: t ? 'Mở GUI để duyệt database PostgreSQL hệ thống' : 'Open GUI to browse internal PostgreSQL database' },
                                { script: 'npx prisma db push', dir: 'server/', desc: t ? 'Đồng bộ schema Prisma với database' : 'Sync Prisma schema with database' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4"><code className="bg-primary/10 text-primary px-2 py-0.5 rounded font-mono text-xs font-bold">{row.script}</code></td>
                                    <td className="p-4 font-mono text-xs text-muted-foreground">{row.dir}</td>
                                    <td className="p-4 text-muted-foreground">{row.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Git Workflow */}
            <DocSection title={t ? 'Quy trình Git' : 'Git Workflow'}>
                <Prose>{t
                    ? 'Chúng tôi khuyến nghị quy trình Git chuẩn sau cho việc phát triển tính năng mới hoặc fix bug:'
                    : 'We recommend the following standard Git workflow for developing new features or fixing bugs:'}</Prose>
                <CodeBlock title={t ? 'Quy trình Feature Branch' : 'Feature Branch Workflow'}>
                    <CodeComment>{t ? 'Bước 1: Tạo branch mới từ main' : 'Step 1: Create new branch from main'}</CodeComment>
                    <CodeLine>git checkout main</CodeLine>
                    <CodeLine>git pull origin main</CodeLine>
                    <CodeLine>git checkout -b feature/add-postgres-adapter</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Bước 2: Phát triển tính năng' : 'Step 2: Develop the feature'}</CodeComment>
                    <CodeLine>{'# ... viết code, test ...'}</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Bước 3: Commit atomic changes' : 'Step 3: Commit atomic changes'}</CodeComment>
                    <CodeLine>git add -A</CodeLine>
                    <CodeLine>git commit -m "feat(adapter): add SQLite adapter with introspection"</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Bước 4: Push và tạo Pull Request' : 'Step 4: Push and create Pull Request'}</CodeComment>
                    <CodeLine>git push origin feature/add-postgres-adapter</CodeLine>
                </CodeBlock>
            </DocSection>

            {/* Commit Conventions */}
            <DocSection title={t ? 'Quy ước Commit Message' : 'Commit Message Conventions'}>
                <Prose>{t
                    ? 'Tuân theo quy ước Conventional Commits để giữ lịch sử Git sạch và dễ đọc:'
                    : 'Follow the Conventional Commits convention to keep Git history clean and readable:'}</Prose>
                <div className="space-y-2">
                    {[
                        { prefix: 'feat:', desc: t ? 'Tính năng mới — feat(editor): add multi-cursor support' : 'New feature — feat(editor): add multi-cursor support' },
                        { prefix: 'fix:', desc: t ? 'Sửa lỗi — fix(adapter): handle null values in PostgreSQL arrays' : 'Bug fix — fix(adapter): handle null values in PostgreSQL arrays' },
                        { prefix: 'refactor:', desc: t ? 'Tái cấu trúc — refactor(auth): extract JWT logic to separate guard' : 'Restructure — refactor(auth): extract JWT logic to separate guard' },
                        { prefix: 'docs:', desc: t ? 'Tài liệu — docs(readme): update installation instructions' : 'Documentation — docs(readme): update installation instructions' },
                        { prefix: 'style:', desc: t ? 'Style CSS — style(sidebar): adjust padding on mobile view' : 'CSS style — style(sidebar): adjust padding on mobile view' },
                        { prefix: 'chore:', desc: t ? 'Maintenance — chore(deps): upgrade tailwindcss to 3.4' : 'Maintenance — chore(deps): upgrade tailwindcss to 3.4' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 border rounded-xl bg-muted/20">
                            <code className="bg-primary/10 text-primary px-3 py-1 rounded text-xs font-mono font-bold min-w-[80px]">{item.prefix}</code>
                            <span className="text-xs text-muted-foreground">{item.desc}</span>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Coding Standards */}
            <DocSection title={t ? 'Tiêu chuẩn Coding' : 'Coding Standards'}>
                <ul className="space-y-3">
                    {[
                        t ? 'TypeScript strict mode cho cả client và server — không sử dụng any trừ trường hợp bất khả kháng.' : 'TypeScript strict mode for both client and server — no any unless absolutely necessary.',
                        t ? 'Component React: Functional components + hooks. Không sử dụng class components.' : 'React components: Functional components + hooks. No class components.',
                        t ? 'File naming: PascalCase cho components (UserProfile.tsx), camelCase cho utilities (formatDate.ts), kebab-case cho routes.' : 'File naming: PascalCase for components (UserProfile.tsx), camelCase for utilities (formatDate.ts), kebab-case for routes.',
                        t ? 'State management: Zustand stores tách biệt theo feature (useConnectionStore, useEditorStore, useAIStore).' : 'State management: Zustand stores separated by feature (useConnectionStore, useEditorStore, useAIStore).',
                        t ? 'CSS: Tailwind utility classes. Tránh inline styles. Sử dụng cn() helper cho conditional classes.' : 'CSS: Tailwind utility classes. Avoid inline styles. Use cn() helper for conditional classes.',
                        t ? 'Imports: Sắp xếp theo thứ tự — React → third-party → local modules → types. Sử dụng path aliases (@/).' : 'Imports: Ordered — React → third-party → local modules → types. Use path aliases (@/).',
                    ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3 p-4 border rounded-xl bg-muted/20">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                            <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                        </li>
                    ))}
                </ul>
            </DocSection>
        </DocPageLayout>
    );
}
