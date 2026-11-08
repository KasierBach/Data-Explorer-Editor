import { publicPath } from '@/core/seo/publicRoutes';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function LifecycleSection({ lang }: Props) {
    const t = lang === 'vi';
    const scripts = [
        ['npm run dev', 'root', t ? 'Chạy backend và Vite sau khi cài dependencies/generate Prisma.' : 'Run the backend and Vite after installing dependencies/generating Prisma.'],
        ['npm run dev', 'client/', t ? 'Vite HMR, mặc định port 5173.' : 'Vite HMR, normally port 5173.'],
        ['npm run build', 'client/', t ? 'Typecheck, Vite, bundle budget và public prerender; output dist/.' : 'Typecheck, Vite, bundle budget, and public prerender; output dist/.'],
        ['npm run preview', 'client/', t ? 'Preview dist; không build thay bạn.' : 'Preview dist; does not build automatically.'],
        ['npm run start:dev', 'server/', t ? 'Nest watch; server.env template đặt port 3001, source fallback 3000.' : 'Nest watch; the server.env template sets port 3001, while source fallback is 3000.'],
        ['npm run build', 'server/', t ? 'Safe Prisma generation wrapper rồi Nest build.' : 'Safe Prisma generation wrapper followed by the Nest build.'],
        ['npm run typecheck', 'server/', t ? 'Kiểm types cả source và test, không emit.' : 'Type-check source and tests without emitting output.'],
        ['npm run test:ci', 'client/ / server/', t ? 'Client Vitest run / server Jest runInBand, không watch.' : 'Client Vitest run / server Jest runInBand, not watch mode.'],
        ['npx prisma migrate deploy', 'server/', t ? 'Áp migrations đã commit vào application database đã kiểm tra.' : 'Apply committed migrations to the verified application database.'],
    ];
    return (
        <DocPageLayout title={t ? 'Quy trình phát triển' : 'Development lifecycle'} subtitle={t ? 'Script, workflow và conventions hiện tại — phân biệt điều được tooling enforce với hướng dẫn khuyến nghị.' : 'Current scripts, workflow, and conventions — distinguish tooling enforcement from recommended guidelines.'}>
            <DocSection title={t ? '1. Runtime và scripts' : '1. Runtime and scripts'}>
                <Prose>{t ? '.nvmrc, CI và Docker dùng Node 22. Root không cài hộ server/client dependencies. Setup đúng theo Installation trước khi chạy scripts; không dùng production database để chuẩn bị dev/tests.' : '.nvmrc, CI, and Docker use Node 22. The root package does not install server/client dependencies. Follow Installation before running scripts; never prepare development/tests against a production database.'}</Prose>
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t ? 'Bảng scripts' : 'Scripts table'}><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Script</th><th className="p-3">{t ? 'Thư mục' : 'Directory'}</th><th className="p-3">{t ? 'Mục đích' : 'Purpose'}</th></tr></thead><tbody>{scripts.map(([script, directory, purpose]) => <tr key={`${directory}:${script}`} className="border-t"><td className="p-3 font-mono text-xs text-primary">{script}</td><td className="p-3 font-mono text-xs">{directory}</td><td className="p-3 text-muted-foreground">{purpose}</td></tr>)}</tbody></table></div>
                <Prose><a href={publicPath(lang, '/docs/installation')}>{t ? 'Setup và môi trường' : 'Setup and environment'}</a> · <a href={publicPath(lang, '/docs/testing')}>{t ? 'Test layers' : 'Test layers'}</a></Prose>
                <Callout type="warning"><p>{t ? 'npm run start:prod là script package cho môi trường có npm. Runtime Docker production bỏ npm/npx và chạy node dist/src/main.js sau migration; theo Deployment thay vì dùng npm trong container.' : 'npm run start:prod is a package script for environments with npm. The production Docker runtime removes npm/npx and launches node dist/src/main.js after migration; follow Deployment rather than using npm inside the runtime container.'}</p></Callout>
            </DocSection>
            <DocSection title={t ? '2. Thay đổi trên feature branch' : '2. Work on a feature branch'}>
                <Prose>{t ? 'Kiểm tra working tree trước checkout; không overwrite thay đổi của người khác. Ví dụ dưới là workflow từ một working tree sạch, không phải lệnh cần chạy mù quáng trên repo có pending edits.' : 'Inspect the working tree before checkout and preserve other work. The example below assumes a clean working tree; do not run it blindly with pending edits.'}</Prose>
                <CodeBlock title="Git workflow"><CodeLine>git status --short</CodeLine><CodeLine>git switch main</CodeLine><CodeLine>git pull --ff-only origin main</CodeLine><CodeLine>git switch -c docs/update-installation</CodeLine><CodeLine># Implement and run relevant checks</CodeLine><CodeLine>git diff --check</CodeLine><CodeLine>git add client/src/presentation/components/docs/sections/InstallationSection.tsx</CodeLine><CodeLine>{'git commit -m "docs(setup): align local installation with runtime"'}</CodeLine><CodeLine>git push -u origin docs/update-installation</CodeLine></CodeBlock>
                <Prose>{t ? 'Chỉ commit/push khi được người dùng yêu cầu. Với agent, AGENTS.md yêu cầu impact trước edit symbol và detect_changes trước commit. Conventional Commits là convention; không khẳng định mọi commit đã được commitlint enforce.' : 'Commit/push only when requested by the user. Agents follow AGENTS.md: impact before symbol edits and detect_changes before committing. Conventional Commits is a convention; do not claim commitlint enforces every commit.'}</Prose>
            </DocSection>
            <DocSection title={t ? '3. Conventions và các ngoại lệ hợp lệ' : '3. Conventions and valid exceptions'}>
                <ul className="space-y-3 text-sm text-muted-foreground">{[
                    t ? 'Client TypeScript strict; server strictNullChecks nhưng noImplicitAny=false. Viết types rõ và giảm any là guideline, không mô tả cả server strict.' : 'Client TypeScript is strict; the server has strictNullChecks but noImplicitAny=false. Clear types and fewer any values are guidelines, not a claim of full server strictness.',
                    t ? 'React function components/hooks là mặc định; class ErrorBoundary là ngoại lệ cần thiết.' : 'React function components/hooks are the default; a class ErrorBoundary is a necessary exception.',
                    t ? 'Zustand root store gom slices theo feature; TanStack Query quản server state. Không có các useConnectionStore/useEditorStore tách rời như contract mặc định.' : 'A Zustand root store composes feature slices; TanStack Query manages server state. Separate useConnectionStore/useEditorStore APIs are not the default contract.',
                    t ? 'ESLint ở cả hai package; Prettier integration ở server. CSS utilities/cn và inline styles động đều tồn tại; ưu tiên idiom xung quanh, không áp redesign kỹ thuật.' : 'Both packages use ESLint; Prettier integration is server-side. CSS utilities/cn and dynamic inline styles coexist; match local idioms instead of introducing a technical redesign.',
                    t ? 'Naming/import/comment density theo code xung quanh. Thay dependency như Tailwind 4.1 phải deliberate và có lockfile/tests, không trộn package managers.' : 'Match surrounding naming, imports, and comment density. Dependency changes such as Tailwind 4.1 need deliberate lockfile/tests; do not mix package managers.',
                ].map(item => <li key={item} className="rounded-xl border p-4">{item}</li>)}</ul>
            </DocSection>
            <DocSection title={t ? '4. PR và release evidence' : '4. PR and release evidence'}>
                <Prose>{t ? 'PR cần mục tiêu focused, behavior/compatibility notes và kết quả check thực tế. Local pass khác successful CI trên exact SHA; deployment chỉ qua workflow đã cấu hình. Đính kèm ít ảnh cần thiết, sanitized logs, và ghi rõ tests skipped/limitations.' : 'PRs need a focused goal, behavior/compatibility notes, and actual check results. A local pass differs from successful CI on the exact SHA; deployment follows the configured workflows. Include only necessary images, sanitized logs, and explicit skipped tests/limitations.'}</Prose>
                <Prose><a href={publicPath(lang, '/docs/deployment')}>{t ? 'Delivery và rollback' : 'Delivery and rollback'}</a> · <a href={publicPath(lang, '/docs/clean-code')}>Clean Code</a></Prose>
            </DocSection>
        </DocPageLayout>
    );
}
