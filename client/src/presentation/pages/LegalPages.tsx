import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import type { AuthUser } from '@/core/services/store/slices/authSlice';
import { SEO } from '@/presentation/components/shared/Seo';
import { Button } from '@/presentation/components/ui/button';
import { PublicRoutePage } from '@/presentation/public/PublicRoutePage';
import { publicPath, resolvePublicRoute } from '@/core/seo/publicRoutes';
import type { LegalDocKey } from '@/presentation/public/legalContent';
import '@/presentation/public/public-reading.css';
import '@/presentation/public/public-legal.css';

function PublicLegalDocument({ docKey }: { docKey: LegalDocKey }) {
    const { pathname } = useLocation();
    const current = resolvePublicRoute(pathname);
    const route = current?.kind === docKey ? current : resolvePublicRoute(`/${docKey}`)!;
    return <PublicRoutePage route={route} />;
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
        <div className="public-experience public-legal-consent font-sans">
            <SEO title={t('Chấp thuận pháp lý', 'Legal consent')} lang={lang} robots="noindex, nofollow" />
            <header className="pl-consent-header">
                <div className="pe-container"><a href={publicPath(lang === 'vi' ? 'vi' : 'en', '/')} className="pe-brand pl-consent-brand"><span className="pe-brand-mark"><Database size={17} aria-hidden="true" /></span><span>Data<span>Explorer</span></span></a></div>
            </header>
            <main className="pl-consent-main">
                <section className="pl-consent-panel" aria-labelledby="legal-consent-title">
                    <span className="pl-consent-icon"><CheckCircle2 size={25} aria-hidden="true" /></span>
                    <h1 id="legal-consent-title">{t('Xác nhận trước khi vào workspace', 'Confirm before entering the workspace')}</h1>
                    <p className="pl-consent-intro">
                        {t(
                            'Trước khi tiếp tục, bạn cần xác nhận đã đọc và đồng ý với các tài liệu pháp lý hiện hành.',
                            'Before continuing, confirm that you have reviewed and accepted the current legal documents.',
                        )}
                    </p>
                    <div className="pl-consent-documents">
                        <p>
                            {t(
                                'Việc tiếp tục đồng nghĩa với việc bạn chấp thuận Điều khoản dịch vụ và Chính sách riêng tư của Data Explorer cho tài khoản này.',
                                'Continuing means you accept the Data Explorer Terms of Service and Privacy Policy for this account.',
                            )}
                        </p>
                        <nav className="pl-consent-links" aria-label={t('Đọc tài liệu pháp lý', 'Read legal documents')}>
                            <a href={publicPath(lang === 'vi' ? 'vi' : 'en', '/terms')} target="_blank" rel="noopener noreferrer">{t('Điều khoản dịch vụ', 'Terms of Service')}<ArrowUpRight size={16} aria-hidden="true" /></a>
                            <a href={publicPath(lang === 'vi' ? 'vi' : 'en', '/privacy')} target="_blank" rel="noopener noreferrer">{t('Chính sách riêng tư', 'Privacy Policy')}<ArrowUpRight size={16} aria-hidden="true" /></a>
                            <a href={publicPath(lang === 'vi' ? 'vi' : 'en', '/legal')} target="_blank" rel="noopener noreferrer">{t('Trung tâm pháp lý', 'Legal Center')}<ArrowUpRight size={16} aria-hidden="true" /></a>
                        </nav>
                    </div>
                    <div className="pl-consent-actions" aria-busy={isLoading}>
                        <Button className="pe-button" variant="outline" type="button" onClick={() => navigate('/login')} disabled={isLoading}>
                            {t('Quay lại đăng nhập', 'Back to sign in')}
                        </Button>
                        <Button className="pe-button pe-button-primary" type="button" onClick={handleAccept} disabled={isLoading}>
                            {isLoading ? t('Đang lưu...', 'Saving...') : t('Tôi đồng ý và tiếp tục', 'I agree and continue')}
                        </Button>
                    </div>
                </section>
            </main>
            <footer className="pl-consent-footer">© 2026 Data Explorer</footer>
        </div>
    );
};
