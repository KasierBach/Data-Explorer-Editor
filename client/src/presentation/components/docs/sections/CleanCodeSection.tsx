import { ShieldCheck, Zap, GitBranch, CheckCircle2 } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

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

            <DocSection title={t ? '1. Phân rã Monolithic Services (Backend)' : '1. Decomposing Monolithic Services (Backend)'}>
                <Prose>
                    {t
                        ? 'Trong các phiên bản trước, AuthService xử lý mọi thứ từ đăng ký, login đến tạo OTP và seeding dữ liệu. Điều này vi phạm SRP.'
                        : 'In previous versions, AuthService handled everything from registration and login to OTP generation and data seeding. This violated SRP.'}
                </Prose>
                <div className="mt-8 space-y-4">
                    <Callout type="tip">
                        <strong className="block mb-1">{t ? 'Giải pháp hiện tại:' : 'Current Solution:'}</strong>
                        <ul className="list-disc pl-5 text-xs space-y-1">
                            <li><strong>OtpService:</strong> {t ? 'Chuyên trách tạo và xác thực mã OTP.' : 'Specialized in OTP generation and verification.'}</li>
                            <li><strong>SeedService:</strong> {t ? 'Xử lý dữ liệu khởi tạo (Admin seeding).' : 'Handles initial data seeding (Admin seeding).'}</li>
                            <li><strong>TokenService:</strong> {t ? 'Tập trung logic tạo JWT và định dạng response.' : 'Centralizes JWT generation and response formatting.'}</li>
                        </ul>
                    </Callout>
                    <CodeBlock title="Unified Token Generation (DRY)">
                        <CodeComment>{t ? '// Chia sẻ logic giữa AuthService và SocialAuthService' : '// Shared logic between AuthService and SocialAuthService'}</CodeComment>
                        <CodeLine>{'export class TokenService {'}</CodeLine>
                        <CodeLine>{'  generateTokenResponse(user: any) {'}</CodeLine>
                        <CodeLine>{'    const payload = { email: user.email, sub: user.id, role: user.role };'}</CodeLine>
                        <CodeLine>{'    return {'}</CodeLine>
                        <CodeLine>{'      access_token: this.jwtService.sign(payload),'}</CodeLine>
                        <CodeLine>{'      user: { id: user.id, email: user.email, ... }'}</CodeLine>
                        <CodeLine>{'    };'}</CodeLine>
                        <CodeLine>{'  }'}</CodeLine>
                        <CodeLine>{'}'}</CodeLine>
                    </CodeBlock>
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

            <DocSection title={t ? 'Tại sao lại cần làm phức tạp như vậy?' : 'Why the Complexity?'}>
                <Prose>
                    {t
                        ? 'Chia nhỏ code có vẻ làm tăng số lượng file, nhưng nó mang lại lợi ích khổng lồ trong dài hạn:'
                        : 'Breaking down code might seem to increase file count, but it brings huge long-term benefits:'}
                </Prose>
                <ul className="mt-4 space-y-3">
                    {[
                        { title: t ? "Dễ Debug" : "Easier Debugging", desc: t ? "Biết chính xác lỗi nằm ở đâu (vd: lỗi mail thì vào MailService)." : "Know exactly where the bug is (e.g., mail issues are in MailService)." },
                        { title: t ? "Dễ Test" : "Easier Testing", desc: t ? "Viết test cho các unit nhỏ dễ hơn nhiều so với các class nghìn dòng." : "Writing tests for small units is much easier than for 1000-line classes." },
                        { title: t ? "Team Collaboration" : "Collaboration", desc: t ? "Nhiều người có thể làm việc trên các module khác nhau mà không bị merge conflict." : "Multiple people can work on different modules without merge conflicts." }
                    ].map((item, i) => (
                        <li key={i} className="flex gap-4">
                             <div className="mt-1"><GitBranch className="w-4 h-4 text-primary" /></div>
                             <div>
                                 <h6 className="font-bold text-xs">{item.title}</h6>
                                 <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                             </div>
                        </li>
                    ))}
                </ul>
            </DocSection>
        </DocPageLayout>
    );
}
