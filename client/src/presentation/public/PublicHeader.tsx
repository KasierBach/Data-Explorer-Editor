import { useState } from 'react';
import { LanguageControl } from '../components/shared/LanguageControl';
import { LandingHeaderView } from './LandingHeaderView';
import { usePublicNavigation } from './PublicNavigationContext';
import type { PublicLanguage } from '@/core/seo/publicRoutes';

export function PublicHeader({ lang, isAuthenticated = false, onLogout, appearance = 'landing' }: { lang: PublicLanguage; isAuthenticated?: boolean; onLogout?: () => void | Promise<void>; appearance?: 'landing' | 'default' }) {
    const [open, setOpen] = useState(false);
    const navigation = usePublicNavigation();
    const language = <LanguageControl lang={lang} onChange={() => {}} hrefs={navigation.languageUrls} touch={appearance === 'landing'} />;
    return <LandingHeaderView lang={lang} isAuthenticated={isAuthenticated} logout={() => onLogout?.()} isMobileNavOpen={open} setIsMobileNavOpen={setOpen} hideSectionLinks={navigation.route?.kind === 'changelog'} appearance={appearance} language={language} navigate={path => window.location.assign(navigation.path(path))} hrefFor={navigation.path} />;
}
