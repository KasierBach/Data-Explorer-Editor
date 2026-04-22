import { Beaker, FlaskConical, Github, CheckCircle, Terminal } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid, CodeBlock, CodeComment, CodeLine } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function TestingSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Kiểm thử & Đóng góp' : 'Testing & Contribution'}
            subtitle={t
                ? 'Cách chúng tôi đảm bảo chất lượng phần mềm thông qua các bài kiểm tra tự động và quy trình đóng góp mã nguồn (Pull Request).'
                : 'How we ensure software quality through automated tests and the contribution process (Pull Request).'}
        >
            <FeatureGrid>
                <InfoCard icon={<Beaker className="w-6 h-6 text-orange-500" />} title="Backend Testing" color="blue">
                    <p>
                        {t
                            ? 'Sử dụng Jest cho Unit Tests và Integration Tests. Toàn bộ logic nghiệp vụ (Use Cases) đều được bao phủ để tránh lỗi hồi quy.'
                            : 'Using Jest for Unit and Integration Tests. All business logic (Use Cases) is covered to prevent regressions.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<FlaskConical className="w-6 h-6 text-indigo-500" />} title="Frontend Testing" color="purple">
                    <p>
                        {t
                            ? 'Sử dụng Vitest kết hợp React Testing Library để kiểm tra các component UI và luồng xử lý trạng thái (Zustand).'
                            : 'Using Vitest with React Testing Library to verify UI components and state management (Zustand).'}
                    </p>
                </InfoCard>
                <InfoCard icon={<CheckCircle className="w-6 h-6 text-emerald-500" />} title="Guardrails" color="emerald">
                    <p>
                        {t
                            ? 'Mọi thay đổi nhạy cảm đều phải vượt qua các bài kiểm thử AI (ai.service.spec.ts) để đảm bảo không làm vỡ luồng routing.'
                            : 'Sensitive changes must pass AI tests (ai.service.spec.ts) to ensure the routing engine remains intact.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            {/* Backend Tests */}
            <DocSection title={t ? 'Kiểm thử Backend (NestJS + Jest)' : 'Backend Testing (NestJS + Jest)'} icon={<Terminal className="w-5 h-5"/>}>
                <Prose>
                    {t
                        ? 'Các bài kiểm tra backend nằm trong thư mục `server/src/tests`. Chúng tôi ưu tiên kiểm tra các Database Strategies và AI Service.'
                        : 'Backend tests are located in `server/src/tests`. We prioritize testing Database Strategies and the AI Service.'}
                </Prose>
                <div className="mt-8">
                    <CodeBlock title={t ? 'Lệnh chạy test backend' : 'Backend test commands'}>
                        <CodeComment>{t ? 'Chạy toàn bộ test' : 'Run all tests'}</CodeComment>
                        <CodeLine>npm run test</CodeLine>
                        <p className="mt-4" />
                        <CodeComment>{t ? 'Chạy test ở mode watch (dùng khi đang dev)' : 'Run tests in watch mode (for dev)'}</CodeComment>
                        <CodeLine>npm run test:watch</CodeLine>
                        <p className="mt-4" />
                        <CodeComment>{t ? 'Chạy một file test cụ thể' : 'Run a specific test file'}</CodeComment>
                        <CodeLine>npx jest server/src/tests/ai/ai.service.spec.ts</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            {/* Frontend Tests */}
            <DocSection title={t ? 'Kiểm thử Frontend (Vite + Vitest)' : 'Frontend Testing (Vite + Vitest)'}>
                <Prose>
                    {t
                        ? 'Phía frontend sử dụng Vitest để đạt tốc độ tối đa trong môi trường phát triển.'
                        : 'The frontend uses Vitest for maximum speed in the development environment.'}
                </Prose>
                <div className="mt-8">
                    <CodeBlock title={t ? 'Lệnh chạy test frontend' : 'Frontend test commands'}>
                        <CodeComment>{t ? 'Chạy test frontend' : 'Run frontend tests'}</CodeComment>
                        <CodeLine>cd client && npm run test</CodeLine>
                    </CodeBlock>
                </div>
            </DocSection>

            {/* Contribution Guide */}
            <DocSection title={t ? 'Hướng dẫn Đóng góp (Contribution Flow)' : 'Contribution Flow'} icon={<Github className="w-5 h-5"/>}>
                <div className="space-y-6">
                    <Prose>
                        {t
                            ? 'Chúng tôi tuân thủ quy trình GitHub Flow. Mọi thay đổi đều bắt đầu từ một feature branch mới.'
                            : 'We follow the GitHub Flow. Every change starts with a new feature branch.'}
                    </Prose>
                    <div className="grid md:grid-cols-2 gap-4">
                        {[
                            {
                                step: "1",
                                title: t ? "Tạo Branch" : "Create Branch",
                                desc: "feature/your-feature-name"
                            },
                            {
                                step: "2",
                                title: t ? "Commit & Push" : "Commit & Push",
                                desc: "Tuân thủ Conventional Commits (feat:, fix:, chore:)"
                            },
                            {
                                step: "3",
                                title: t ? "Mở Pull Request" : "Open Pull Request",
                                desc: "Mô tả rõ ràng các thay đổi và đính kèm video/ảnh minh họa"
                            },
                            {
                                step: "4",
                                title: t ? "Review & Merge" : "Review & Merge",
                                desc: "Ít nhất 1 approval từ maintainers"
                            }
                        ].map((item, i) => (
                            <div key={i} className="p-4 border border-white/5 rounded-2xl bg-white/[0.02] flex gap-4 items-start">
                                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-black text-sm shrink-0">
                                    {item.step}
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-white">{item.title}</h4>
                                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Quy chuẩn mã nguồn' : 'Coding Standards'}>
                <Prose>
                    {t
                        ? 'Để giữ cho project dễ bảo trì, chúng tôi áp dụng các quy tắc sau:'
                        : 'To keep the project maintainable, we apply the following rules:'}
                </Prose>
                <div className="mt-6 grid gap-3">
                    {[
                        t ? 'Sử dụng ESLint và Prettier để tự động hóa format code.' : 'Use ESLint and Prettier for automated formatting.',
                        t ? 'Mọi hàm mới đều phải có kiểu dữ liệu (TypeScript strict mode).' : 'All new functions must be typed (TypeScript strict mode).',
                        t ? 'Sử dụng kiến trúc Ports & Adapters thay vì gọi trực tiếp thư viện trong Service.' : 'Use Ports & Adapters architecture instead of direct library calls in Services.',
                        t ? 'Tránh lồng nháy (Nesting) quá sâu và ưu tiên Early Return.' : 'Avoid deep nesting and prioritize Early Returns.'
                    ].map((item) => (
                        <div key={item} className="flex gap-3 items-center text-xs text-muted-foreground bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                            <div className="w-1 h-1 rounded-full bg-primary" />
                            {item}
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
