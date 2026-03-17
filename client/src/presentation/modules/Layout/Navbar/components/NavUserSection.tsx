import React from 'react';
import { 
    Sparkles, Settings, User as UserIcon, CreditCard, LogOut, Shield 
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { ModeToggle } from '@/presentation/components/mode-toggle';
import { TokenTimer } from '@/presentation/components/TokenTimer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu"
import { cn } from '@/lib/utils';

interface NavUserSectionProps {
    user: any;
    logout: () => void;
    isAiPanelOpen: boolean;
    toggleAiPanel: () => void;
    isMobile: boolean;
    isSmallMobile: boolean;
    lang: string;
    setActiveProfileTab: (tab: string) => void;
    setIsProfileOpen: (open: boolean) => void;
    navigate: (path: string) => void;
}

export const NavUserSection: React.FC<NavUserSectionProps> = ({
    user, logout, isAiPanelOpen, toggleAiPanel, isMobile, isSmallMobile, 
    lang, setActiveProfileTab, setIsProfileOpen, navigate
}) => {
    return (
        <div className={cn("flex items-center gap-1 md:gap-2", isMobile && "pl-2")}>
            {!isSmallMobile && <div className="h-4 w-px bg-border mx-1" />}

            <ModeToggle />

            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-8 w-8 transition-colors",
                    isAiPanelOpen ? 'text-violet-500 bg-violet-500/10' : 'text-muted-foreground hover:text-violet-500'
                )}
                onClick={toggleAiPanel}
                title="AI Assistant (Ctrl+I)"
            >
                <Sparkles className="w-4 h-4" />
            </Button>

            {!isSmallMobile && (
                <>
                    <div className="h-4 w-px bg-border mx-1" />
                    <TokenTimer />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="w-4 h-4 text-muted-foreground" />
                    </Button>
                </>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 overflow-hidden bg-muted hover:bg-muted/80 border border-border/50 transition-all shrink-0 ml-1">
                        {user?.avatarUrl ? (
                            <>
                                <img 
                                    src={user.avatarUrl} 
                                    alt={user.firstName || user.name || 'User'} 
                                    className="h-full w-full object-cover relative z-10" 
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).classList.add('hidden');
                                    }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-bold text-xs z-0">
                                    {(user.firstName || user.name || user.email || 'U').charAt(0).toUpperCase()}
                                </div>
                            </>
                        ) : (
                            <span className="text-blue-500 font-bold text-xs">
                                {(user?.firstName || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal p-4">
                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border relative">
                                    {user?.avatarUrl ? (
                                        <>
                                            <img 
                                                src={user.avatarUrl} 
                                                alt="" 
                                                className="h-full w-full object-cover relative z-10" 
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).classList.add('hidden');
                                                }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-bold z-0">
                                                {(user.firstName || user.name || user.email || 'U').charAt(0).toUpperCase()}
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-blue-500 font-bold">
                                            {(user?.firstName || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <p className="text-sm font-bold leading-none truncate">
                                        {user?.firstName} {user?.lastName}
                                    </p>
                                    <p className="text-[10px] leading-none text-muted-foreground mt-1 truncate">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>
                            {user?.jobRole && (
                                <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 text-[10px] font-medium w-fit capitalize">
                                    {user?.jobRole}
                                </div>
                            )}
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => { setActiveProfileTab('profile'); setIsProfileOpen(true); }}>
                            <UserIcon className="mr-2 h-4 w-4" />
                            <span>{lang === 'vi' ? 'Hồ sơ' : 'Profile'}</span>
                            {!isMobile && <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActiveProfileTab('billing'); setIsProfileOpen(true); }}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            <span>{lang === 'vi' ? 'Gói cước' : 'Billing'}</span>
                            {!isMobile && <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActiveProfileTab('advanced'); setIsProfileOpen(true); }}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>{lang === 'vi' ? 'Cài đặt' : 'Settings'}</span>
                            {!isMobile && <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>}
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

                    {user?.role === 'admin' && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate('/admin')}>
                                <Shield className="mr-2 h-4 w-4 text-primary" />
                                <span className="text-primary font-medium">{lang === 'vi' ? 'Quản trị viên' : 'Admin Panel'}</span>
                            </DropdownMenuItem>
                        </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Đăng xuất' : 'Log out'}</span>
                        {!isMobile && <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
