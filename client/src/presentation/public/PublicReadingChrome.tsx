import { ArrowUpRight, Database, Github } from 'lucide-react';
import { LanguageControl } from '../components/shared/LanguageControl';
import { usePublicNavigation } from './PublicNavigationContext';
import type { PublicLanguage } from '@/core/seo/publicRoutes';
import { PublicPageLinks } from './PublicPageLinks';

export function PublicReadingHeader({ lang, isAuthenticated, onLogout }: { lang: PublicLanguage; isAuthenticated: boolean; onLogout?: () => void | Promise<void> }) {
    const navigation = usePublicNavigation();
    const vi = lang === 'vi';
    const workspace = isAuthenticated ? '/sql-explorer' : '/login';
    return (
        <header className="pe-header">
            <div className="pe-container pe-header-layout">
                <a href={navigation.path('/')} className="pe-brand"><span className="pe-brand-mark"><Database size={17} aria-hidden="true" /></span><span>Data<span>Explorer</span></span></a>
                <nav className="pe-header-nav" aria-label={vi ? 'Điều hướng chính' : 'Main navigation'}>
                    <PublicPageLinks lang={lang} currentPage={navigation.route?.kind ?? 'changelog'} className="pe-nav-link" />
                </nav>
                <div className="pe-header-actions">
                    <LanguageControl lang={lang} onChange={() => {}} hrefs={navigation.languageUrls} appearance="pill" />
                    <a className="pe-icon-link pe-header-github" href="https://github.com/KasierBach/Data-Explorer-Editor" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><Github size={19} aria-hidden="true" /></a>
                    <div className="pe-header-utilities"><a href={workspace} className="pe-button pe-button-primary pe-header-workspace">Workspace<ArrowUpRight size={14} aria-hidden="true" /></a>
                        {isAuthenticated && onLogout && <button className="pe-reading-logout" type="button" onClick={() => { void onLogout(); }}>{vi ? 'Đăng xuất' : 'Logout'}</button>}
                    </div>
                </div>
            </div>
        </header>
    );
}

export function PublicReadingFooter({ lang }: { lang: PublicLanguage }) {
    const navigation = usePublicNavigation();
    const vi = lang === 'vi';
    return (
        <footer className="pe-footer">
            <div className="pe-container pe-footer-grid">
                <div><a className="pe-brand" href={navigation.path('/')}><span className="pe-brand-mark"><Database size={17} aria-hidden="true" /></span><span>Data<span>Explorer</span></span></a>
                    <p>{vi ? 'SQL, NoSQL và AI tùy chọn. Một workspace cho dòng suy nghĩ của bạn.' : 'SQL, NoSQL, and optional AI. One workspace for your flow.'}</p>
                    <div className="pe-footer-tools"><a href="https://github.com/KasierBach/Data-Explorer-Editor" target="_blank" rel="noopener noreferrer">GitHub</a><a href={navigation.path('/docs')}>{vi ? 'Tài liệu' : 'Documentation'}</a><a href={navigation.path('/changelog')}>{vi ? 'Cập nhật' : 'Changelog'}</a></div>
                </div>
                <div><h2>{vi ? 'Khám phá' : 'Explore'}</h2><a href={navigation.path('/docs')}>{vi ? 'Tài liệu' : 'Documentation'}</a><a href={navigation.path('/changelog')}>{vi ? 'Cập nhật' : 'Changelog'}</a><a href="/sql-explorer">SQL Workspace</a><a href="/nosql-explorer">NoSQL Studio</a></div>
                <div><h2>{vi ? 'Pháp lý' : 'Legal'}</h2><a href={navigation.path('/legal')}>{vi ? 'Trung tâm pháp lý' : 'Legal center'}</a><a href={navigation.path('/privacy')}>{vi ? 'Quyền riêng tư' : 'Privacy'}</a><a href={navigation.path('/terms')}>{vi ? 'Điều khoản dịch vụ' : 'Terms of service'}</a></div>
            </div>
            <div className="pe-container pe-footer-bottom"><span>© 2026 Data Explorer</span><span>{vi ? 'Khám phá. Hiểu rõ. Xây dựng.' : 'Explore. Understand. Build.'}</span></div>
        </footer>
    );
}
