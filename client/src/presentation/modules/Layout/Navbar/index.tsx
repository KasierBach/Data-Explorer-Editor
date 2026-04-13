import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Database, Leaf } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import { useMediaQuery } from '@/presentation/hooks/useMediaQuery';
import { ProfileDialog } from '../ProfileDialog/index';
import { NavBrand } from './components/NavBrand';
import { NavMainActions } from './components/NavMainActions';
import { NavMenus } from './components/NavMenus';
import { NavUserSection } from './components/NavUserSection';
import { AuthService } from '@/core/services/AuthService';

export const Navbar: React.FC = () => {
    const { 
        isSidebarOpen, setSidebarOpen, openQueryTab, openInsightsTab, 
        activeConnectionId, user, isAiPanelOpen, toggleAiPanel, lang 
    } = useAppStore();
    
    const navigate = useNavigate();
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activeProfileTab, setActiveProfileTab] = useState('profile');
    
    const isMobile = useMediaQuery('(max-width: 768px)');
    const isSmallMobile = useMediaQuery('(max-width: 480px)');

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    return (
        <div className="h-14 border-b flex items-center px-4 bg-card justify-between select-none shrink-0 sticky top-0 z-[60]">
            <ProfileDialog 
                isOpen={isProfileOpen} 
                onClose={() => setIsProfileOpen(false)} 
                initialTab={activeProfileTab} 
            />

            <div className="flex items-center gap-2 md:gap-6">
                {isMobile && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setSidebarOpen(!isSidebarOpen)}
                    >
                        {isSidebarOpen ? <X className="w-5 h-5 text-primary" /> : <Menu className="w-5 h-5" />}
                    </Button>
                )}

                <NavBrand isSmallMobile={isSmallMobile} onNavigate={navigate} />

                {!isMobile && (
                    <div className="flex bg-muted p-1 rounded-md border items-center">
                        <Button 
                            variant={location.pathname.startsWith('/sql-explorer') ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-7 px-3 text-xs w-[88px] flex gap-1.5"
                            onClick={() => navigate('/sql-explorer')}
                        >
                            <Database className="w-3.5 h-3.5" />
                            <span className="font-semibold">SQL</span>
                        </Button>
                        <Button 
                            variant={location.pathname.startsWith('/nosql') ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-7 px-3 text-xs w-[88px] flex gap-1.5 text-green-600 dark:text-green-400"
                            onClick={() => navigate('/nosql-explorer')}
                        >
                            <Leaf className="w-3.5 h-3.5" />
                            <span className="font-semibold text-green-700 dark:text-green-400">NoSQL</span>
                        </Button>
                    </div>
                )}

                {!isMobile && (location.pathname.startsWith('/sql-explorer') || location.pathname.startsWith('/nosql')) && (
                    <NavMainActions 
                        activeConnectionId={activeConnectionId}
                        openInsightsTab={openInsightsTab}
                        onNavigate={navigate}
                        lang={lang}
                        isNoSql={location.pathname.startsWith('/nosql')}
                    />
                )}
            </div>

            <div className="flex items-center gap-2 md:gap-3">
                {!isMobile && (
                    <NavMenus 
                        lang={lang}
                        openQueryTab={openQueryTab}
                        isSidebarOpen={isSidebarOpen}
                        setSidebarOpen={setSidebarOpen}
                        isNoSql={location.pathname.startsWith('/nosql')}
                    />
                )}

                <NavUserSection 
                    user={user}
                    logout={handleLogout}
                    isAiPanelOpen={isAiPanelOpen}
                    toggleAiPanel={toggleAiPanel}
                    isMobile={isMobile}
                    isSmallMobile={isSmallMobile}
                    lang={lang}
                    setActiveProfileTab={setActiveProfileTab}
                    setIsProfileOpen={setIsProfileOpen}
                    navigate={navigate}
                />
            </div>
        </div>
    );
};
