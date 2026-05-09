import React, { useState } from 'react';
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

export const Navbar: React.FC = () => {
    const {
        isSidebarOpen, setSidebarOpen, openQueryTab, openInsightsTab,
        activeConnectionId, user, isAiPanelOpen, toggleAiPanel, lang,
        isDesktopModeOnMobile, toggleDesktopModeOnMobile,
    } = useAppStore();

    const navigate = useNavigate();
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activeProfileTab, setActiveProfileTab] = useState('profile');

    const { isActualMobile, isSmallMobile } = useResponsiveLayoutMode();
    const isSqlRoute = location.pathname.startsWith('/sql-explorer');
    const isNoSqlRoute = location.pathname.startsWith('/nosql');

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    return (
        <div className={cn(
            "h-14 border-b items-center px-4 bg-background/95 backdrop-blur-md select-none shrink-0 sticky top-0 z-[60] w-full",
            isNoSqlRoute ? "grid grid-cols-[0.8fr_auto_1.2fr]" : "grid grid-cols-[1fr_auto_1fr]"
        )}>
            <ProfileDialog
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                initialTab={activeProfileTab}
            />

            {/* ⬅️ LEFT: Logo & Brand */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 shrink-0">
                    {isActualMobile && (
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                            {isSidebarOpen ? <X className="w-5 h-5 text-primary" /> : <Menu className="w-5 h-5" />}
                        </Button>
                    )}
                    <NavBrand isSmallMobile={isSmallMobile} onNavigate={navigate} />
                </div>
            </div>

            {/* 🎯 CENTER: Consolidated Ribbon (Tools + Switcher + Menus) */}
            <div className={cn(
                "flex items-center justify-center gap-1 md:gap-2 px-2 md:px-6"
            )}>
                {/* 1. Tools: immediately to the LEFT of the switcher */}
                {!isActualMobile && (
                    <div className="flex items-center border-r border-border/30 pr-2">
                        <NavMainActions
                            activeConnectionId={activeConnectionId}
                            openInsightsTab={openInsightsTab}
                            onNavigate={navigate}
                            lang={lang}
                            isNoSql={isNoSqlRoute}
                        />
                    </div>
                )}

                {/* 2. SQL / NoSQL pill - Compact on Mobile */}
                <div className="relative flex items-center bg-muted/40 p-0.5 md:p-1 rounded-xl border border-border/40 gap-0.5 md:gap-1 shadow-inner mx-0.5 md:mx-1 flex-none">
                    <motion.div
                        className={cn(
                            "absolute h-[calc(100%-4px)] md:h-[calc(100%-8px)] rounded-lg shadow-sm z-0",
                            isSqlRoute ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-gradient-to-r from-emerald-600 to-green-600"
                        )}
                        initial={false}
                        animate={{ 
                            x: isSqlRoute ? 0 : (isActualMobile ? 40 : 81), 
                            width: isActualMobile ? 40 : 78 
                        }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                    <button
                        onClick={() => navigate('/sql-explorer')}
                        className={cn(
                            "relative z-10 flex items-center justify-center gap-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all",
                            isSqlRoute ? "text-white" : "text-muted-foreground hover:text-foreground",
                            isActualMobile ? "w-10 h-8" : "w-[78px] py-1.5"
                        )}
                    >
                        <Database className={cn("w-3.5 h-3.5", isSqlRoute && "scale-110")} />
                        {!isActualMobile && <span>SQL</span>}
                    </button>
                    <button
                        onClick={() => navigate('/nosql-explorer')}
                        className={cn(
                            "relative z-10 flex items-center justify-center gap-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all",
                            isNoSqlRoute ? "text-white" : "text-muted-foreground hover:text-foreground",
                            isActualMobile ? "w-10 h-8" : "w-[78px] py-1.5"
                        )}
                    >
                        <Leaf className={cn("w-3.5 h-3.5", isNoSqlRoute && "scale-110")} />
                        {!isActualMobile && <span>NoSQL</span>}
                    </button>
                </div>

                {/* 3. Menus: immediately to the RIGHT of the switcher */}
                {!isActualMobile && (
                    <div className="flex items-center border-l border-border/30 pl-2">
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

            {/* ➡️ RIGHT: Profile & Status Section */}
            <div className="flex items-center justify-end gap-3">
                <div className="flex items-center gap-2">
                    {!isActualMobile && <div className="h-4 w-px bg-border mx-1" />}
                    <Button
                        variant="ghost"
                        size={isActualMobile ? "icon" : "sm"}
                        className={cn(
                            "h-8 text-muted-foreground hover:text-foreground transition-colors",
                            isActualMobile ? "w-8" : "px-3 gap-1.5"
                        )}
                        onClick={() => navigate('/teams')}
                        title={lang === 'vi' ? 'Nhóm' : 'Teams'}
                    >
                        {!isActualMobile && <span className="font-semibold">{lang === 'vi' ? 'Nhóm' : 'Teams'}</span>}
                        <Users className={cn("w-4 h-4", isActualMobile && "text-primary")} />
                    </Button>
 
                    <NavUserSection
                        user={user} logout={handleLogout} isAiPanelOpen={isAiPanelOpen}
                        toggleAiPanel={toggleAiPanel} isMobile={isActualMobile}
                        isSmallMobile={isSmallMobile} isDesktopModeOnMobile={isDesktopModeOnMobile}
                        toggleDesktopModeOnMobile={toggleDesktopModeOnMobile} lang={lang}
                        setActiveProfileTab={setActiveProfileTab} setIsProfileOpen={setIsProfileOpen}
                        navigate={navigate}
                    />
                </div>
            </div>
        </div>
    );
};
