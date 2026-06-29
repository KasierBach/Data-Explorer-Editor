import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Scale, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import type { AuthUser } from '@/core/services/store/slices/authSlice';
import { AuthService } from '@/core/services/AuthService';
import { SEO } from '@/presentation/components/shared/Seo';
import { Button } from '@/presentation/components/ui/button';
import { LandingHeader } from '@/presentation/modules/LandingPage/components/LandingHeader';
import { InteractiveBackground } from '@/presentation/modules/LandingPage/components/InteractiveBackground';
import { LandingFooter } from '@/presentation/modules/LandingPage/components/LandingFooter';

type LegalDocKey = 'legal' | 'privacy' | 'terms';

type LegalSection = {
    title: string;
    paragraphs: readonly string[];
    bullets?: readonly string[];
};

type LegalDocument = {
    title: string;
    subtitle: string;
    effectiveDate: string;
    sections: readonly LegalSection[];
    quickLinks?: readonly { label: string; href: string }[];
};

const getLegalDocument = (lang: 'vi' | 'en', key: LegalDocKey): LegalDocument => {
    const docs = {
        vi: {
            legal: {
                title: 'Trung tâm pháp lý',
                subtitle: 'Một nơi tập trung để đọc nhanh các cam kết vận hành, quyền riêng tư và điều khoản sử dụng của Data Explorer.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                quickLinks: [
                    { label: 'Xem chính sách riêng tư', href: '/privacy' },
                    { label: 'Xem điều khoản dịch vụ', href: '/terms' },
                ],
                sections: [
                    {
                        title: 'Cách các tài liệu này hoạt động',
                        paragraphs: [
                            'Bộ tài liệu này mô tả cách Data Explorer xử lý tài khoản, dữ liệu cấu hình, kết quả truy vấn, nội dung AI và các trách nhiệm cơ bản khi bạn sử dụng sản phẩm.',
                            'Nếu bạn tạo tài khoản hoặc dùng các khu vực cần đăng nhập, việc tiếp tục sử dụng đồng nghĩa với việc bạn đang vận hành theo các tài liệu được liên kết tại đây.',
                        ],
                    },
                    {
                        title: 'Những gì áp dụng khi bạn đăng ký',
                        paragraphs: [
                            'Khi tạo tài khoản, bạn xác nhận mình có quyền dùng email đó, chịu trách nhiệm với truy vấn hoặc nội dung mình gửi lên hệ thống, và đồng ý với điều khoản lẫn chính sách riêng tư hiện hành.',
                        ],
                        bullets: [
                            'Điều khoản dịch vụ quy định quyền truy cập, giới hạn sử dụng và các trường hợp bị tạm ngưng tài khoản.',
                            'Chính sách riêng tư giải thích dữ liệu nào được lưu, vì sao hệ thống cần nó và bạn có thể yêu cầu gì từ phía chúng tôi.',
                        ],
                    },
                    {
                        title: 'Liên hệ và yêu cầu pháp lý',
                        paragraphs: [
                            'Nếu bạn cần gửi yêu cầu liên quan đến dữ liệu cá nhân, bảo mật tài khoản hoặc điều khoản sử dụng, hãy liên hệ đội vận hành qua địa chỉ legal@dataexplorer.app.',
                        ],
                    },
                ],
            },
            privacy: {
                title: 'Chính sách riêng tư',
                subtitle: 'Tóm tắt cách Data Explorer thu thập, sử dụng, lưu giữ và bảo vệ thông tin liên quan đến tài khoản và workspace của bạn.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                sections: [
                    {
                        title: 'Dữ liệu chúng tôi thu thập',
                        paragraphs: [
                            'Chúng tôi thu thập các trường cần để vận hành tài khoản như email, tên hiển thị, thông tin hồ sơ, cấu hình giao diện và các cài đặt thông báo bạn tự chọn.',
                            'Trong workspace, hệ thống có thể lưu metadata như connections, truy vấn đã lưu, lịch sử thao tác, dashboard, ERD workspace và các thiết lập AI mà bạn chủ động tạo.',
                        ],
                    },
                    {
                        title: 'Cách dữ liệu được sử dụng',
                        paragraphs: [
                            'Dữ liệu tài khoản được dùng để xác thực, đồng bộ phiên đăng nhập, cá nhân hóa giao diện và duy trì các tính năng cộng tác, lịch sử hoặc billing khi có.',
                        ],
                        bullets: [
                            'Bảo vệ phiên đăng nhập và phát hiện đăng nhập bất thường.',
                            'Khôi phục workspace, draft và lịch sử sử dụng khi bạn quay lại.',
                            'Cung cấp trải nghiệm AI theo provider hoặc model mà bạn đã cấu hình.',
                        ],
                    },
                    {
                        title: 'Lưu giữ và bảo mật',
                        paragraphs: [
                            'Chúng tôi áp dụng cơ chế xác thực, kiểm soát quyền và guardrail mức ứng dụng để giảm rủi ro truy cập trái phép. Dữ liệu chỉ được giữ trong phạm vi cần thiết để cung cấp dịch vụ và đáp ứng yêu cầu vận hành hợp lý.',
                        ],
                    },
                    {
                        title: 'Quyền của bạn',
                        paragraphs: [
                            'Bạn có thể yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu tài khoản của mình trong phạm vi sản phẩm hỗ trợ hoặc thông qua kênh liên hệ pháp lý.',
                        ],
                    },
                ],
            },
            terms: {
                title: 'Điều khoản dịch vụ',
                subtitle: 'Những nguyên tắc cơ bản khi bạn truy cập, đăng ký và sử dụng Data Explorer trong công việc hàng ngày.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                sections: [
                    {
                        title: 'Tài khoản và quyền truy cập',
                        paragraphs: [
                            'Bạn chịu trách nhiệm với tài khoản của mình, bao gồm thông tin đăng nhập, provider OAuth được liên kết và mọi thao tác được thực hiện trong phạm vi tài khoản đó.',
                        ],
                        bullets: [
                            'Không dùng tài khoản của người khác khi chưa được phép.',
                            'Không cố tình vượt qua cơ chế phân quyền, guardrail hoặc hạn chế truy cập của hệ thống.',
                        ],
                    },
                    {
                        title: 'Sử dụng chấp nhận được',
                        paragraphs: [
                            'Bạn chỉ nên dùng Data Explorer cho các hoạt động hợp pháp, an toàn và phù hợp với quyền truy cập dữ liệu mà mình thực sự sở hữu hoặc được ủy quyền.',
                        ],
                        bullets: [
                            'Không dùng sản phẩm để phá hoại dữ liệu, đánh cắp thông tin hoặc khai thác trái phép hạ tầng.',
                            'Không gửi nội dung vi phạm pháp luật, độc hại hoặc cố tình gây mất ổn định dịch vụ.',
                        ],
                    },
                    {
                        title: 'Nội dung AI và kết quả truy vấn',
                        paragraphs: [
                            'Các gợi ý AI, câu SQL hoặc diễn giải do hệ thống sinh ra chỉ mang tính hỗ trợ. Bạn vẫn là người chịu trách nhiệm cuối cùng trước khi chạy truy vấn trên dữ liệu thật.',
                        ],
                    },
                    {
                        title: 'Tạm ngưng hoặc chấm dứt',
                        paragraphs: [
                            'Chúng tôi có thể giới hạn hoặc tạm ngưng tài khoản nếu phát hiện hành vi lạm dụng, vi phạm bảo mật hoặc sử dụng sản phẩm theo cách có nguy cơ ảnh hưởng đến người dùng khác hoặc hệ thống.',
                        ],
                    },
                ],
            },
        },
        en: {
            legal: {
                title: 'Legal center',
                subtitle: 'One place to review the operating commitments, privacy rules, and product terms behind Data Explorer.',
                effectiveDate: 'Effective June 28, 2026',
                quickLinks: [
                    { label: 'Read the privacy policy', href: '/privacy' },
                    { label: 'Read the terms of service', href: '/terms' },
                ],
                sections: [
                    {
                        title: 'How these documents work',
                        paragraphs: [
                            'These documents explain how Data Explorer handles accounts, configuration data, query results, AI-related content, and the baseline responsibilities that come with using the product.',
                            'If you create an account or use authenticated parts of the product, your continued use follows the documents linked from this page.',
                        ],
                    },
                    {
                        title: 'What applies when you sign up',
                        paragraphs: [
                            'When you create an account, you confirm that you control the email address you use, that you are responsible for the queries and content you send through the system, and that you agree to the current terms and privacy policy.',
                        ],
                        bullets: [
                            'The terms of service describe access rights, usage boundaries, and when an account may be limited or suspended.',
                            'The privacy policy explains what data is stored, why it is needed, and what requests you can make about it.',
                        ],
                    },
                    {
                        title: 'Contact and legal requests',
                        paragraphs: [
                            'For requests about personal data, account security, or product terms, contact the operations team at legal@dataexplorer.app.',
                        ],
                    },
                ],
            },
            privacy: {
                title: 'Privacy policy',
                subtitle: 'A practical summary of how Data Explorer collects, uses, retains, and protects account and workspace information.',
                effectiveDate: 'Effective June 28, 2026',
                sections: [
                    {
                        title: 'What we collect',
                        paragraphs: [
                            'We collect the fields needed to operate your account, such as email, display identity, profile details, interface preferences, and the notification settings you choose.',
                            'Inside the workspace, the system may store metadata such as connections, saved queries, activity history, dashboards, ERD workspaces, and AI settings that you explicitly create.',
                        ],
                    },
                    {
                        title: 'How the data is used',
                        paragraphs: [
                            'Account data is used to authenticate users, maintain sessions, personalize the interface, and support collaboration, history, and billing-related flows when enabled.',
                        ],
                        bullets: [
                            'Protect account sessions and detect unusual sign-ins.',
                            'Restore workspace state, drafts, and usage history when you return.',
                            'Deliver AI experiences through the provider or model choices you configured.',
                        ],
                    },
                    {
                        title: 'Retention and security',
                        paragraphs: [
                            'We use authentication controls, permission boundaries, and application-level guardrails to reduce unauthorized access. Data is kept only as long as reasonably required to operate the service and support legitimate product workflows.',
                        ],
                    },
                    {
                        title: 'Your choices',
                        paragraphs: [
                            'You can request access to, correction of, or deletion of your account data through supported product flows or through the legal contact channel.',
                        ],
                    },
                ],
            },
            terms: {
                title: 'Terms of service',
                subtitle: 'The baseline rules for accessing, registering for, and using Data Explorer in day-to-day work.',
                effectiveDate: 'Effective June 28, 2026',
                sections: [
                    {
                        title: 'Accounts and access',
                        paragraphs: [
                            'You are responsible for your account, including login credentials, linked OAuth providers, and activity performed through that account.',
                        ],
                        bullets: [
                            'Do not use another person\'s account without permission.',
                            'Do not bypass product permissions, guardrails, or access restrictions.',
                        ],
                    },
                    {
                        title: 'Acceptable use',
                        paragraphs: [
                            'Use Data Explorer only for lawful, safe work and only against data systems that you own or are authorized to access.',
                        ],
                        bullets: [
                            'Do not use the product to damage data, exfiltrate information, or attack infrastructure.',
                            'Do not submit illegal, harmful, or intentionally disruptive content.',
                        ],
                    },
                    {
                        title: 'AI output and query results',
                        paragraphs: [
                            'AI suggestions, generated SQL, and textual explanations are assistive outputs. You remain responsible for reviewing them before running anything against production data.',
                        ],
                    },
                    {
                        title: 'Suspension or termination',
                        paragraphs: [
                            'We may limit or suspend access if an account is abusive, violates security expectations, or uses the product in a way that creates risk for other users or the service itself.',
                        ],
                    },
                ],
            },
        },
    } as const;

    return docs[lang][key];
};

function getDocIcon(key: LegalDocKey) {
    if (key === 'privacy') return <ShieldCheck className="h-5 w-5 text-cyan-300" />;
    if (key === 'terms') return <Scale className="h-5 w-5 text-amber-300" />;
    return <FileText className="h-5 w-5 text-blue-300" />;
}

function PublicLegalDocument({ docKey }: { docKey: LegalDocKey }) {
    const { isAuthenticated, lang } = useAppStore();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const navigate = useNavigate();
    const doc = useMemo(() => getLegalDocument(lang === 'vi' ? 'vi' : 'en', docKey), [lang, docKey]);

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden relative">
            <SEO
                lang={lang}
                title={doc.title}
                description={doc.subtitle}
                ogUrl={`https://data-explorer-editor.vercel.app/${docKey}`}
            />
            <InteractiveBackground />
            <LandingHeader
                lang={lang}
                isAuthenticated={isAuthenticated}
                logout={handleLogout}
                isMobileNavOpen={isMobileNavOpen}
                setIsMobileNavOpen={setIsMobileNavOpen}
            />

            <main className="relative z-10 flex-1">
                <section className="container mx-auto px-4 sm:px-6 py-16 md:py-24">
                    <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 md:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                        <Button variant="ghost" type="button" onClick={() => navigate('/')} className="mb-6 h-auto px-0 text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {lang === 'vi' ? 'Quay lại trang chủ' : 'Back to home'}
                        </Button>

                        <div className="mb-8 flex flex-wrap items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                                {getDocIcon(docKey)}
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                {doc.effectiveDate}
                            </span>
                        </div>

                        <div className="max-w-3xl">
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{doc.title}</h1>
                            <p className="mt-4 text-base md:text-lg leading-8 text-slate-300">{doc.subtitle}</p>
                        </div>

                        {doc.quickLinks && (
                            <div className="mt-8 grid gap-3 md:grid-cols-2">
                                {doc.quickLinks.map((link) => (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold text-slate-100 transition-colors hover:border-blue-400/50 hover:bg-blue-500/10"
                                    >
                                        {link.label}
                                    </a>
                                ))}
                            </div>
                        )}

                        <article className="mt-10 space-y-8">
                            {doc.sections.map((section) => (
                                <section key={section.title} className="rounded-2xl border border-white/8 bg-black/20 p-5 md:p-6">
                                    <h2 className="text-xl font-bold text-white">{section.title}</h2>
                                    <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                                        {section.paragraphs.map((paragraph) => (
                                            <p key={paragraph}>{paragraph}</p>
                                        ))}
                                        {section.bullets && (
                                            <ul className="space-y-2 pl-5">
                                                {section.bullets.map((bullet) => (
                                                    <li key={bullet} className="list-disc">{bullet}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </section>
                            ))}
                        </article>
                    </div>
                </section>
            </main>

            <LandingFooter lang={lang} />
        </div>
    );
}

export const LegalCenterPage: React.FC = () => <PublicLegalDocument docKey="legal" />;

export const PrivacyPage: React.FC = () => <PublicLegalDocument docKey="privacy" />;

export const TermsPage: React.FC = () => <PublicLegalDocument docKey="terms" />;

export const LegalConsentPage: React.FC = () => {
    const navigate = useNavigate();
    const { lang, user, updateUser } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);
    const t = (vi: string, en: string) => (lang === 'vi' ? vi : en);

    useEffect(() => {
        if (user?.legalAcceptedAt) {
            navigate('/sql-explorer', { replace: true });
        }
    }, [navigate, user?.legalAcceptedAt]);

    const handleAccept = async () => {
        setIsLoading(true);
        try {
            const updated = await apiService.patch<AuthUser>('/users/legal-consent', {});
            updateUser(updated);
            toast.success(t('Đã lưu chấp thuận pháp lý.', 'Legal consent saved.'));
            navigate('/sql-explorer', { replace: true });
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : t('Không thể lưu chấp thuận pháp lý.', 'Could not save legal consent.');
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <SEO title={t('Chấp thuận pháp lý', 'Legal consent')} lang={lang} />
            <div className="w-full max-w-xl rounded-3xl border bg-background p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-2xl bg-primary/10 p-3">
                        <CheckCircle2 className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('Xác nhận trước khi vào workspace', 'Confirm before entering the workspace')}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t(
                                'Trước khi tiếp tục, bạn cần xác nhận đã đọc và đồng ý với các tài liệu pháp lý hiện hành.',
                                'Before continuing, confirm that you have reviewed and accepted the current legal documents.',
                            )}
                        </p>
                    </div>
                </div>

                <div className="space-y-4 rounded-2xl border bg-muted/30 p-5 text-sm text-muted-foreground">
                    <p>
                        {t(
                            'Việc tiếp tục đồng nghĩa với việc bạn chấp thuận Điều khoản dịch vụ và Chính sách riêng tư của Data Explorer cho tài khoản này.',
                            'Continuing means you accept the Data Explorer Terms of Service and Privacy Policy for this account.',
                        )}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                            {t('Điều khoản dịch vụ', 'Terms of Service')}
                        </a>
                        <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                            {t('Chính sách riêng tư', 'Privacy Policy')}
                        </a>
                        <a href="/legal" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                            {t('Trung tâm pháp lý', 'Legal Center')}
                        </a>
                    </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button variant="outline" type="button" onClick={() => navigate('/login')} disabled={isLoading}>
                        {t('Quay lại đăng nhập', 'Back to sign in')}
                    </Button>
                    <Button type="button" onClick={handleAccept} disabled={isLoading}>
                        {isLoading ? t('Đang lưu...', 'Saving...') : t('Tôi đồng ý và tiếp tục', 'I agree and continue')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
