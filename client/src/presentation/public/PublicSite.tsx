import { useState } from 'react';
import type { PublicRoute } from '@/core/seo/publicRoutes';
import { PublicDocsNavigationContext, PublicNavigationContext } from './PublicNavigationContext';
import type { DocsNavigate } from './docsNavigation';
import { PublicSeo } from './PublicSeo';
import { PublicHeader } from './PublicHeader';
import { LandingAppearanceContext, useLandingTheme } from '../modules/LandingPage/hooks/useLandingAppearance';
import { LandingFooter } from '../modules/LandingPage/components/LandingFooter';
import { InteractiveBackground } from '../modules/LandingPage/components/InteractiveBackground';
import type { PublicView } from './publicViews';
import { PublicExperienceContext } from './PublicExperienceContext';
import { PublicReadingFooter, PublicReadingHeader } from './PublicReadingChrome';
import './public-reading.css';
import './public-changelog.css';
import '../modules/LandingPage/landing-page.css';

interface PublicSiteProps {
    route: PublicRoute;
    View: PublicView;
    isAuthenticated?: boolean;
    onLogout?: () => void | Promise<void>;
    embedded?: boolean;
    onNavigateDocs?: DocsNavigate;
}

export function PublicSite({ route, View, isAuthenticated = false, onLogout, embedded = false, onNavigateDocs }: PublicSiteProps) {
    const appearance = useLandingTheme('dark');
    const [paused, setPaused] = useState(false);
    const landing = route.kind === 'landing';
    const docs = route.kind === 'docs';
    const changelog = route.kind === 'changelog';
    return (
        <PublicNavigationContext.Provider value={route}>
            <PublicDocsNavigationContext.Provider value={docs ? onNavigateDocs : undefined}>
            <LandingAppearanceContext.Provider value={appearance}>
                <PublicSeo route={route} />
                {!embedded && <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring">Skip to content</a>}
                <PublicExperienceContext.Provider value={{ lang: route.lang, paused, onToggleMotion: () => setPaused(value => !value) }}>
                    <div id={embedded ? undefined : 'main-content'} tabIndex={-1} className={landing ? 'landing-page min-h-screen flex flex-col font-sans overflow-x-clip' : docs ? '' : changelog ? 'public-experience public-changelog-site min-h-screen flex flex-col font-sans' : 'relative min-h-screen flex flex-col overflow-x-hidden bg-background font-sans text-foreground selection:bg-blue-500/30'} data-theme={landing ? appearance.theme : undefined} data-motion={landing ? (paused ? 'paused' : 'active') : undefined}>
                        {!landing && !docs && !changelog && <InteractiveBackground />}
                        {changelog ? <PublicReadingHeader lang={route.lang} isAuthenticated={isAuthenticated} onLogout={onLogout} /> : !docs && <PublicHeader lang={route.lang} isAuthenticated={isAuthenticated} onLogout={onLogout} appearance={landing ? 'landing' : 'default'} />}
                        <View route={route} isAuthenticated={isAuthenticated} isMotionPaused={paused} onToggleMotion={() => setPaused(value => !value)} />
                        {changelog ? <PublicReadingFooter lang={route.lang} /> : !docs && <LandingFooter lang={route.lang} appearance={landing ? 'landing' : 'default'} />}
                    </div>
                </PublicExperienceContext.Provider>
            </LandingAppearanceContext.Provider>
            </PublicDocsNavigationContext.Provider>
        </PublicNavigationContext.Provider>
    );
}
