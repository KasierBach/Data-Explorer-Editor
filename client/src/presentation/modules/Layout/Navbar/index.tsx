import React, { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Database, Leaf, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { ProfileDialog } from '../ProfileDialog/index';
import { NavBrand } from './components/NavBrand';
import { NavMainActions } from './components/NavMainActions';
import { NavMenus } from './components/NavMenus';
import { NavUserSection } from './components/NavUserSection';
import { AuthService } from '@/core/services/AuthService';
import { getWorkspaceText } from '@/core/utils/workspaceText';

export const Navbar: React.FC = () => {
    const {
        isSidebarOpen, setSidebarOpen, openQueryTab, openInsightsTab,
        activeConnectionId, user, isAiPanelOpen, toggleAiPanel, lang,
        isDesktopModeOnMobile, toggleDesktopModeOnMobile,
    } = useAppStore();

    const navigate = useNavigate();
    const location = useLocation();
    const profileTriggerRef = useRef<HTMLButtonElement>(null);
    const headerRef = useRef<HTMLElement>(null);
    const brandRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const userSectionRef = useRef<HTMLDivElement>(null);
    const [headerCenter, setHeaderCenter] = useState<number | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activeProfileTab, setActiveProfileTab] = useState('profile');

    const { isActualMobile, isSmallMobile, isCompactMobileLayout } = useResponsiveLayoutMode();
    const useCompactChrome = isCompactMobileLayout;
    const isSqlRoute = location.pathname.startsWith('/sql-explorer');
    const isNoSqlRoute = location.pathname.startsWith('/nosql');
    const text = getWorkspaceText(lang);

    useLayoutEffect(() => {
        const header = headerRef.current;
        const brand = brandRef.current;
        const actions = actionsRef.current;
        const userSection = userSectionRef.current;
        if (!header || !brand || !actions || !userSection) return;

        const updateCenter = () => {
            if (window.innerWidth < 1300) {
                setHeaderCenter(null);
                return;
            }
            const headerBox = header.getBoundingClientRect();
            const brandBox = brand.getBoundingClientRect();
            const userBox = userSection.getBoundingClientRect();
            const actionsWidth = actions.getBoundingClientRect().width;
            const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
            const preferredCenter = headerBox.width / 2 - (useCompactChrome ? 0 : 5.75 * rootFontSize);
            const minimumCenter = brandBox.right - headerBox.left + 8 + actionsWidth / 2;
            const maximumCenter = userBox.left - headerBox.left - 8 - actionsWidth / 2;
            setHeaderCenter(minimumCenter <= maximumCenter
                ? Math.min(Math.max(preferredCenter, minimumCenter), maximumCenter)
                : preferredCenter);
        };

        updateCenter();
        const observer = new ResizeObserver(updateCenter);
        [header, brand, actions, userSection].forEach(element => observer.observe(element));
        return () => observer.disconnect();
    }, [lang, useCompactChrome]);

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    return (
        <header ref={headerRef} data-testid="workspace-header" className="relative h-14 border-b flex items-center px-4 bg-background/95 backdrop-blur-md select-none shrink-0 sticky top-0 z-[60] w-full max-[1300px]:h-auto max-[1300px]:min-h-14 max-[1300px]:grid max-[1300px]:grid-cols-[auto_1fr] max-[1300px]:gap-y-2 max-[1300px]:py-2 max-[360px]:px-2">
            <ProfileDialog
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                initialTab={activeProfileTab}
                returnFocusRef={profileTriggerRef}
            />

            <div ref={brandRef} className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 items-center gap-4 min-w-0 max-[1300px]:relative max-[1300px]:left-0 max-[1300px]:top-auto max-[1300px]:translate-y-0">
                <div className="flex items-center gap-2 shrink-0">
                    {useCompactChrome && (
                        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={isSidebarOpen ? text.navMenus.hideSidebar : text.navMenus.showSidebar} onClick={() => setSidebarOpen(!isSidebarOpen)}>
                            {isSidebarOpen ? <X className="w-5 h-5 text-primary" /> : <Menu className="w-5 h-5" />}
                        </Button>
                    )}
                    <NavBrand isSmallMobile={isSmallMobile && useCompactChrome} onNavigate={navigate} />
                </div>
            </div>

            <div
                ref={actionsRef}
                className={cn(
                    "absolute top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 md:gap-2 px-2 md:px-6 min-w-0 max-[1300px]:relative max-[1300px]:top-auto max-[1300px]:col-span-2 max-[1300px]:row-start-2 max-[1300px]:w-full max-[1300px]:translate-x-0 max-[1300px]:translate-y-0 max-[1300px]:!left-0 max-[1300px]:!max-w-none",
                    useCompactChrome ? "max-w-[calc(100vw-9rem)]" : "max-w-[calc(100vw-42rem)]"
                )}
                style={{ left: headerCenter ?? (useCompactChrome ? '50%' : 'calc(50% - 5.75rem)') }}
            >
                {!useCompactChrome && (
                    <div className="flex shrink-0 items-center border-r border-border/30 pr-2">
                        <NavMainActions
                            activeConnectionId={activeConnectionId}
                            openInsightsTab={openInsightsTab}
                            onNavigate={navigate}
                            lang={lang}
                            isNoSql={isNoSqlRoute}
                        />
                    </div>
                )}

                <div className="relative flex items-center bg-muted/40 p-0.5 md:p-1 rounded-xl border border-border/40 gap-0.5 md:gap-1 shadow-inner mx-0.5 md:mx-1 flex-none">
                    <motion.div
                        className={cn(
                            "absolute h-[calc(100%-4px)] md:h-[calc(100%-8px)] rounded-lg shadow-sm z-0",
                            isSqlRoute ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-gradient-to-r from-emerald-600 to-green-600"
                        )}
                        initial={false}
                        animate={{
                            x: isSqlRoute ? 0 : (useCompactChrome ? 40 : 81),
                            width: useCompactChrome ? 40 : 78
                        }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                    <button
                        type="button"
                        aria-label="SQL"
                        aria-pressed={isSqlRoute}
                        onClick={() => navigate('/sql-explorer')}
                        className={cn(
                            "relative z-10 flex items-center justify-center gap-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all",
                            isSqlRoute ? "text-white" : "text-muted-foreground hover:text-foreground",
                            useCompactChrome ? "w-10 h-8" : "w-[78px] py-1.5"
                        )}
                    >
                        <Database className={cn("w-3.5 h-3.5", isSqlRoute && "scale-110")} aria-hidden="true" />
                        {!useCompactChrome && <span>SQL</span>}
                    </button>
                    <button
                        type="button"
                        aria-label="NoSQL"
                        aria-pressed={isNoSqlRoute}
                        onClick={() => navigate('/nosql-explorer')}
                        className={cn(
                            "relative z-10 flex items-center justify-center gap-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all",
                            isNoSqlRoute ? "text-white" : "text-muted-foreground hover:text-foreground",
                            useCompactChrome ? "w-10 h-8" : "w-[78px] py-1.5"
                        )}
                    >
                        <Leaf className={cn("w-3.5 h-3.5", isNoSqlRoute && "scale-110")} aria-hidden="true" />
                        {!useCompactChrome && <span>NoSQL</span>}
                    </button>
                </div>

                {!useCompactChrome && (
                    <div className="flex shrink-0 items-center border-l border-border/30 pl-2">
                        <NavMenus
                            lang={lang}
                            openQueryTab={openQueryTab}
                            isSidebarOpen={isSidebarOpen}
                            setSidebarOpen={setSidebarOpen}
                            isNoSql={isNoSqlRoute}
                        />
                    </div>
                )}
            </div>

            <div ref={userSectionRef} className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 items-center justify-end gap-3 min-w-0 max-[1300px]:relative max-[1300px]:right-0 max-[1300px]:top-auto max-[1300px]:col-start-2 max-[1300px]:row-start-1 max-[1300px]:translate-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    {!useCompactChrome && <div className="h-4 w-px bg-border mx-1" />}
                    <Button
                        variant="ghost"
                        size={useCompactChrome ? "icon" : "sm"}
                        className={cn(
                            "h-8 text-muted-foreground hover:text-foreground transition-colors",
                            useCompactChrome ? "w-8" : "px-3 gap-1.5"
                        )}
                        onClick={() => navigate('/teams')}
                        aria-label={text.navbar.teams}
                        title={text.navbar.teams}
                    >
                        {!useCompactChrome && <span className="font-semibold">{text.navbar.teams}</span>}
                        <Users className={cn("w-4 h-4", useCompactChrome && "text-primary")} />
                    </Button>

                    <NavUserSection
                        profileTriggerRef={profileTriggerRef}
                        user={user} logout={handleLogout} isAiPanelOpen={isAiPanelOpen}
                        toggleAiPanel={toggleAiPanel} isMobile={isActualMobile}
                        isSmallMobile={isSmallMobile && useCompactChrome} isDesktopModeOnMobile={isDesktopModeOnMobile}
                        toggleDesktopModeOnMobile={toggleDesktopModeOnMobile} lang={lang}
                        setActiveProfileTab={setActiveProfileTab} setIsProfileOpen={setIsProfileOpen}
                        navigate={navigate}
                    />
                </div>
            </div>
        </header>
    );
};
