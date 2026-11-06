import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import type { AuthUser } from '@/core/services/store/slices/authSlice';
import { SEO } from '@/presentation/components/shared/Seo';
import { Button } from '@/presentation/components/ui/button';
import { PublicRoutePage } from '@/presentation/public/PublicRoutePage';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';
import type { LegalDocKey } from '@/presentation/public/legalContent';

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
        <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
            <SEO title={t('Chấp thuận pháp lý', 'Legal consent')} lang={lang} robots="noindex, nofollow" />
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
