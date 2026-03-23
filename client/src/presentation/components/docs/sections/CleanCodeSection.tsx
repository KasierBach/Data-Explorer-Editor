import { ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function CleanCodeSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Clean Code & Refactoring' : 'Clean Code & Refactoring'}
            subtitle={t
                ? 'Hướng dẫn thực tế về cách chúng tôi áp dụng các nguyên tắc SOLID, DRY và SRP để duy trì một codebase bền vững và dễ mở rộng.'
                : 'A practical guide on how we apply SOLID, DRY, and SRP principles to maintain a sustainable and scalable codebase.'}
            gradient
        >
            {/* Core Philosophy */}
            <div className="grid md:grid-cols-2 gap-6 mb-16">
                <div className="p-6 border rounded-2xl bg-card/50 hover:bg-card transition-colors border-primary/20">
                    <div className="mb-4 text-primary"><ShieldCheck className="w-8 h-8" /></div>
                    <h4 className="font-bold text-lg mb-2">{t ? 'Nguyên tắc Trách nhiệm Đơn lẻ (SRP)' : 'Single Responsibility (SRP)'}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t 
                            ? 'Mỗi class, module hay hook chỉ nên làm một việc duy nhất. Chúng tôi tách biệt rõ ràng giữa Business Logic, Data Access và Presentation.' 
                            : 'Every class, module, or hook should have only one reason to change. We strictly separate Business Logic, Data Access, and Presentation.'}
                    </p>
                </div>
                <div className="p-6 border rounded-2xl bg-card/50 hover:bg-card transition-colors border-indigo-500/20">
                    <div className="mb-4 text-indigo-500"><Zap className="w-8 h-8" /></div>
                    <h4 className="font-bold text-lg mb-2">{t ? 'Đừng lặp lại chính mình (DRY)' : "Don't Repeat Yourself (DRY)"}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t 
                            ? 'Tránh trùng lặp code bằng cách trừu tượng hóa các logic dùng chung vào Services hoặc Utilities. Ví dụ: TokenService và UserUtils.' 
                            : 'Avoid code duplication by abstracting shared logic into Services or Utilities. Example: TokenService and UserUtils.'}
                    </p>
                </div>
            </div>

            <DocSection title={t ? '1. Chiến lược SOLID trong Thực tế' : '1. SOLID Principles in Action'}>
                <Prose>
                    {t
                        ? 'Chúng tôi không chỉ nói về lý thuyết. Trong Data Explorer, SOLID được áp dụng để giải quyết các vấn đề hữu hình về khả năng mở rộng.'
                        : 'We don\'t just talk about theory. In Data Explorer, SOLID is applied to solve tangible scalability problems.'}
                </Prose>
                <div className="mt-8 space-y-6">
                    <DocSubSection title={t ? 'Open/Closed & Factory Pattern' : 'Open/Closed & Factory Pattern'}>
                        <Prose className="text-xs">
                            {t
                                ? 'Khi thêm một Database Engine mới, chúng tôi không sửa đổi core logic. Thay vào đó, chúng tôi tạo một Adapter mới và đăng ký nó vào Factory.'
                                : 'When adding a new Database Engine, we don\'t modify core logic. Instead, we create a new Adapter and register it in the Factory.'}
                        </Prose>
                        <CodeBlock title="Database Strategy Factory">
                            <CodeComment>{t ? '// Tuân thủ nguyên tắc Open/Closed' : '// Adheres to Open/Closed Principle'}</CodeComment>
                            <CodeLine>{'export class DatabaseFactory {'}</CodeLine>
                            <CodeLine>{'  private static strategies = new Map<string, DatabaseStrategy>();'}</CodeLine>
                            <CodeLine>{'  '}</CodeLine>
                            <CodeLine>{'  static register(key: string, strategy: DatabaseStrategy) {'}</CodeLine>
                            <CodeLine>{'    this.strategies.set(key, strategy);'}</CodeLine>
                            <CodeLine>{'  }'}</CodeLine>
                            <CodeLine>{'  '}</CodeLine>
                            <CodeLine>{'  static get(key: string): DatabaseStrategy {'}</CodeLine>
                            <CodeLine>{'    return this.strategies.get(key) ?? new DefaultStrategy();'}</CodeLine>
                            <CodeLine>{'  }'}</CodeLine>
                            <CodeLine>{'}'}</CodeLine>
                        </CodeBlock>
                    </DocSubSection>

                    <DocSubSection title={t ? 'Interface Segregation (ISP)' : 'Interface Segregation (ISP)'}>
                        <Prose className="text-xs">
                             {t
                                 ? 'Thay vì một Interface khổng lồ, chúng tôi chia nhỏ thành IReadable, IWritable, IMetadataProvider giúp các adapter chỉ cần triển khai những gì nó thực sự hỗ trợ.'
                                 : 'Instead of one generic interface, we break it down into IReadable, IWritable, and IMetadataProvider so adapters only implement what they actually support.'}
                        </Prose>
                    </DocSubSection>
                </div>
            </DocSection>

            <DocSection title={t ? '2. Tách biệt Trạng thái & Logic (Frontend)' : '2. Decoupling State & Logic (Frontend)'}>
                <Prose>
                    {t
                        ? 'Chúng tôi tránh việc viết logic xử lý dữ liệu trực tiếp trong React Components. Thay vào đó, chúng tôi sử dụng Custom Hooks kết hợp với ApiService.'
                        : 'We avoid writing data processing logic directly within React Components. Instead, we use Custom Hooks combined with a centralized ApiService.'}
                </Prose>
                <div className="grid sm:grid-cols-2 gap-4 mt-8">
                    <div className="p-4 border rounded-xl bg-muted/20">
                        <h5 className="font-bold text-xs mb-2 flex items-center gap-2">
                             <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                             ApiService (DRY)
                        </h5>
                        <p className="text-[11px] text-muted-foreground">
                            {t 
                                ? 'Tự động chèn Bearer Token và xử lý lỗi 401 (Logout) một cách tập trung.' 
                                : 'Automatically injects Bearer Tokens and handles 401 errors (Logout) centrally.'}
                        </p>
                    </div>
                    <div className="p-4 border rounded-xl bg-muted/20">
                        <h5 className="font-bold text-xs mb-2 flex items-center gap-2">
                             <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                             Modular Hooks (SRP)
                        </h5>
                        <p className="text-[11px] text-muted-foreground">
                            {t 
                                ? 'useProfileLogic được chia nhỏ thành useUserProfile, useUserSettings, useAccountSecurity.' 
                                : 'useProfileLogic is broken down into useUserProfile, useUserSettings, and useAccountSecurity.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? '3. Kiểm thử với Vitest' : '3. Testing with Vitest'}>
                <Prose>
                    {t
                        ? 'Để đảm bảo việc refactor không làm hỏng các tính năng hiện có, chúng tôi áp dụng Unit Testing cho các core services và logic hooks.'
                        : 'To ensure refactoring doesn\'t break existing features, we apply Unit Testing to core services and logic hooks.'}
                </Prose>
                <div className="mt-8">
                    <CodeBlock title="Testing ApiService">
                        <CodeLine>{'describe(\'ApiService\', () => {'}</CodeLine>
                        <CodeLine>{'  it(\'should inject authorization header\', async () => {'}</CodeLine>
                        <CodeLine>{'    const response = await ApiService.get(\'/profile\');'}</CodeLine>
                        <CodeLine>{'    expect(global.fetch).toHaveBeenCalledWith('}</CodeLine>
                        <CodeLine>{'      expect.stringContaining(\'/profile\'),'}</CodeLine>
                        <CodeLine>{'      expect.objectContaining({ headers: { Authorization: \'Bearer mock-token\' } })'}</CodeLine>
                        <CodeLine>{'    );'}</CodeLine>
                        <CodeLine>{'  });'}</CodeLine>
                        <CodeLine>{'});'}</CodeLine>
                    </CodeBlock>
                </div>
                <Callout type="info">
                    <p className="text-xs">
                        {t 
                            ? '💡 Mẹo: Sử dụng `vi.stubGlobal(\'fetch\', mock)` và `vi.mock(\'@/core/services/store\')` để giả lập môi trường chạy tests một cách cô lập.' 
                            : '💡 Tip: Use `vi.stubGlobal(\'fetch\', mock)` and `vi.mock(\'@/core/services/store\')` to simulate an isolated test environment.'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Quy trình Refactoring: Từ Legacy sang Clean' : 'Refactoring Workflow: From Legacy to Clean'}>
                <Prose>
                    {t
                        ? 'Refactoring là hành trình liên tục. Chúng tôi áp dụng chiến lược "Boy Scout Rule": Luôn để lại codebase sạch hơn lúc bạn mới tìm thấy nó.'
                        : 'Refactoring is a continuous journey. We apply the "Boy Scout Rule": Always leave the codebase cleaner than you found it.'}
                </Prose>
                <ul className="mt-6 space-y-4">
                    {[
                        { title: t ? "Bước 1: Cô lập (Isolation)" : "Step 1: Isolation", desc: t ? "Xác định logic hỗn loạn và bao bọc nó bằng một Interface." : "Identify messy logic and wrap it with an Interface." },
                        { title: t ? "Bước 2: Viết Test (Cover)" : "Step 2: Coverage", desc: t ? "Viết Unit Tests để bảo vệ hành vi hiện tại trước khi thay đổi." : "Write Unit Tests to protect current behavior before changing it." },
                        { title: t ? "Bước 3: Chia nhỏ (Decomposition)" : "Step 3: Decomposition", desc: t ? "Bóc tách logic vào các Service nhỏ hơn tuân thủ SRP." : "Extract logic into smaller services following SRP." },
                        { title: t ? "Bước 4: Bơm phụ thuộc (Injection)" : "Step 4: Dependency Injection", desc: t ? "Thay thế việc khởi tạo trực tiếp (`new`) bằng Dependency Injection." : "Replace direct instantiation (`new`) with Dependency Injection." }
                    ].map((item, i) => (
                        <li key={i} className="flex gap-4 p-4 border rounded-2xl bg-muted/10">
                             <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</div>
                             <div>
                                 <h6 className="font-bold text-xs">{item.title}</h6>
                                 <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{item.desc}</p>
                             </div>
                        </li>
                    ))}
                </ul>
            </DocSection>
        </DocPageLayout>
    );
}
