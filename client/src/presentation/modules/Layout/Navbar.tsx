import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModeToggle } from '@/presentation/components/mode-toggle';
import { Database, Settings, LogOut, User as UserIcon, Github, LifeBuoy, Cloud, CreditCard, FileText, FolderOpen, BarChart3, PieChart, GitGraph, Sparkles, Menu, X, Shield } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
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
import { useAppStore } from '@/core/services/store';
import { ProfileDialog } from './ProfileDialog';
import { TokenTimer } from '@/presentation/components/TokenTimer';
import { useMediaQuery } from '@/presentation/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export const Navbar: React.FC = () => {
    const { isSidebarOpen, setSidebarOpen, openQueryTab, openInsightsTab, activeConnectionId, user, logout, isAiPanelOpen, toggleAiPanel, lang } = useAppStore();
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activeProfileTab, setActiveProfileTab] = useState('profile');
    const isMobile = useMediaQuery('(max-width: 768px)');
    const isSmallMobile = useMediaQuery('(max-width: 480px)');

    return (
        <div className="h-14 border-b flex items-center px-4 bg-card justify-between select-none shrink-0 sticky top-0 z-[60]">
            <ProfileDialog isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} initialTab={activeProfileTab} />

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

                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                    <div className="bg-primary/10 p-1.5 rounded-md">
                        <Database className="w-5 h-5 text-primary" />
                    </div>
                    {!isSmallMobile && (
                        <div>
                            <h1 className="font-semibold text-sm leading-none">Data Explorer</h1>
                            <span className="text-[10px] text-muted-foreground">v0.1.0-beta</span>
                        </div>
                    )}
                </div>

                {!isMobile && (
                    <div className="flex items-center gap-1 ml-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                            onClick={() => activeConnectionId && openInsightsTab(activeConnectionId)}
                            disabled={!activeConnectionId}
                        >
                            <BarChart3 className="w-4 h-4 text-purple-600" />
                            <span className="font-semibold">{lang === 'vi' ? 'Chi tiết' : 'Insights'}</span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                            onClick={() => navigate('/app/visualize')}
                        >
                            <PieChart className="w-4 h-4 text-emerald-500" />
                            <span className="font-semibold">{lang === 'vi' ? 'Trực quan' : 'Visualize'}</span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                            onClick={() => activeConnectionId && navigate('/app/erd')}
                            disabled={!activeConnectionId}
                        >
                            <GitGraph className="w-4 h-4 text-blue-500" />
                            <span className="font-semibold">{lang === 'vi' ? 'Sơ đồ' : 'Diagram'}</span>
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 md:gap-3">
                {!isMobile && (
                    <nav className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                                    {lang === 'vi' ? 'Tệp' : 'File'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuLabel>{lang === 'vi' ? 'Thao tác Tệp' : 'File Operations'}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openQueryTab()}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>{lang === 'vi' ? 'Truy vấn mới' : 'New Query'}</span>
                                    <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <FolderOpen className="mr-2 h-4 w-4" />
                                    <span>{lang === 'vi' ? 'Mở kết nối...' : 'Open Connection...'}</span>
                                    <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>{lang === 'vi' ? 'Thoát' : 'Exit'}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                                    {lang === 'vi' ? 'Sửa' : 'Edit'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem>{lang === 'vi' ? 'Hoàn tác' : 'Undo'} <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut></DropdownMenuItem>
                                <DropdownMenuItem>{lang === 'vi' ? 'Lấy lại' : 'Redo'} <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut></DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>{lang === 'vi' ? 'Cắt' : 'Cut'} <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut></DropdownMenuItem>
                                <DropdownMenuItem>{lang === 'vi' ? 'Sao chép' : 'Copy'} <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut></DropdownMenuItem>
                                <DropdownMenuItem>{lang === 'vi' ? 'Dán' : 'Paste'} <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                                    {lang === 'vi' ? 'Xem' : 'View'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem onClick={() => setSidebarOpen(!isSidebarOpen)}>
                                    {isSidebarOpen ? (lang === 'vi' ? "Ẩn thanh bên" : "Hide Sidebar") : (lang === 'vi' ? "Hiện thanh bên" : "Show Sidebar")}
                                    <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>{lang === 'vi' ? 'Cửa sổ toàn màn hình' : 'Toggle Full Screen'} <DropdownMenuShortcut>F11</DropdownMenuShortcut></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                                    {lang === 'vi' ? 'Trợ giúp' : 'Help'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem className="cursor-pointer" onClick={() => window.open('/docs', '_blank')}>
                                    <LifeBuoy className="mr-2 h-4 w-4" />
                                    <span>{lang === 'vi' ? 'Tài liệu hướng dẫn' : 'Documentation'}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer" onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}>
                                    <Github className="mr-2 h-4 w-4" />
                                    <span>GitHub</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled>
                                    <Cloud className="mr-2 h-4 w-4" />
                                    <span>{lang === 'vi' ? 'Kiểm tra cập nhật...' : 'Check for Updates...'}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </nav>
                )}

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
            </div>
        </div>
    );
};
