import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Database, Leaf, Users } from 'lucide-react';
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
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activeProfileTab, setActiveProfileTab] = useState('profile');

    const { isActualMobile, isSmallMobile, isCompactMobileLayout } = useResponsiveLayoutMode();
    const useCompactChrome = isCompactMobileLayout;
    const isSqlRoute = location.pathname.startsWith('/sql-explorer');
    const isNoSqlRoute = location.pathname.startsWith('/nosql');
    const text = getWorkspaceText(lang);

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    return (
        <header data-testid="workspace-header" className="sticky top-0 z-40 flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-2 py-2 backdrop-blur-md select-none sm:px-4">
            <ProfileDialog
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                initialTab={activeProfileTab}
                returnFocusRef={profileTriggerRef}
            />

            <div className="flex min-w-0 shrink-0 items-center gap-2">
                <div className="flex items-center gap-2 shrink-0">
                    {useCompactChrome && (
                        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={isSidebarOpen ? text.navMenus.hideSidebar : text.navMenus.showSidebar} onClick={() => setSidebarOpen(!isSidebarOpen)}>
                            {isSidebarOpen ? <X className="w-5 h-5 text-primary" /> : <Menu className="w-5 h-5" />}
                        </Button>
                    )}
                    <NavBrand isSmallMobile={isSmallMobile && useCompactChrome} onNavigate={navigate} />
                </div>
            </div>

            <div className="order-3 flex w-full flex-wrap items-center justify-center gap-2 border-t border-border/30 pt-2 min-[1440px]:order-none min-[1440px]:w-auto min-[1440px]:border-0 min-[1440px]:pt-0">
                <div className="flex items-center border-r border-border/30 pr-2">
                        <NavMainActions
                            activeConnectionId={activeConnectionId}
                            openInsightsTab={openInsightsTab}
                            onNavigate={navigate}
                            lang={lang}
                            isNoSql={isNoSqlRoute}
                        />
                    </div>

                <div className="order-first flex shrink-0 items-center gap-1 rounded-xl border border-border/40 bg-muted/40 p-1">
                    <Button variant={isSqlRoute ? 'default' : 'ghost'} className="h-11 px-3" aria-label="SQL" aria-pressed={isSqlRoute} onClick={() => navigate('/sql-explorer')}>
                        <Database className="h-4 w-4" aria-hidden="true" /> SQL
                    </Button>
                    <Button variant={isNoSqlRoute ? 'default' : 'ghost'} className="h-11 px-3" aria-label="NoSQL" aria-pressed={isNoSqlRoute} onClick={() => navigate('/nosql-explorer')}>
                        <Leaf className="h-4 w-4" aria-hidden="true" /> NoSQL
                    </Button>
                </div>

                <div className="flex items-center border-l border-border/30 pl-2">
                        <NavMenus
                            lang={lang}
                            openQueryTab={openQueryTab}
                            isSidebarOpen={isSidebarOpen}
                            setSidebarOpen={setSidebarOpen}
                            isNoSql={isNoSqlRoute}
                        />
                    </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
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
