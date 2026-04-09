import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, ArrowLeft } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/presentation/components/shared/LanguageSwitcher';

interface LandingHeaderProps {
    lang: string;
    isAuthenticated: boolean;
    logout: () => void | Promise<void>;
    isMobileNavOpen: boolean;
    setIsMobileNavOpen: (open: boolean) => void;
    hideSectionLinks?: boolean;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
    lang,
    isAuthenticated,
    logout,
    isMobileNavOpen,
    setIsMobileNavOpen,
    hideSectionLinks
}) => {
    const navigate = useNavigate();

    return (
        <header className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-white/5 supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                <button 
                    className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-lg p-1" 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    aria-label="Back to top"
                >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Database className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Data<span className="text-blue-500">Explorer</span></span>
                </button>

                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground absolute left-1/2 -translate-x-1/2">
                    {!hideSectionLinks && (
                        <>
                            <a href="#features" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                                {lang === 'vi' ? 'Tính năng' : 'Features'}
                            </a>
                            <a href="#demo" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                                {lang === 'vi' ? 'Bản demo' : 'Live Demo'}
                            </a>
                            <a href="#pricing" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                                {lang === 'vi' ? 'Giá cả' : 'Pricing'}
                            </a>
                        </>
                    )}
                    <button onClick={() => navigate('/docs')} className="relative group hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                        {lang === 'vi' ? 'Tài liệu' : 'Docs'}
                    </button>
                    <button onClick={() => navigate('/changelog')} className="relative group hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                        {lang === 'vi' ? 'Cập nhật' : 'Changelog'}
                        <span className="absolute -top-3 -right-4 bg-blue-600 text-[8px] px-1 rounded-sm text-white font-bold animate-pulse group-hover:scale-110 transition-transform">NEW</span>
                    </button>
                </nav>

                <div className="flex items-center gap-2 sm:gap-4">
                    {hideSectionLinks && (
                        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="hidden md:flex text-[10px] h-8 items-center gap-1.5 text-muted-foreground uppercase tracking-widest hover:text-blue-500 hover:bg-transparent">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            {lang === 'vi' ? 'Quay lại' : 'Go Back'}
                        </Button>
                    )}
                    <LanguageSwitcher />
                    {isAuthenticated ? (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { void logout(); navigate('/login'); }} className="hidden sm:flex hover:bg-red-500/10 hover:text-red-500 text-xs uppercase tracking-wider">
                                Logout
                            </Button>
                            <Button size="sm" onClick={() => navigate('/sql-explorer')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 text-xs uppercase tracking-widest font-bold">
                                Workspace
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:flex hover:bg-blue-500/10 hover:text-blue-500 text-xs uppercase tracking-wider">
                                {lang === 'vi' ? 'Đăng nhập' : 'Login'}
                            </Button>
                            <Button size="sm" onClick={() => navigate('/login')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 text-xs uppercase tracking-widest font-bold px-3 sm:px-5">
                                {lang === 'vi' ? 'Bắt đầu' : 'Start Analysis'}
                            </Button>
                        </>
                    )}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
                        onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                        aria-label="Toggle menu"
                    >
                        <div className="w-5 flex flex-col gap-1">
                            <span className={cn("h-0.5 bg-foreground rounded transition-all", isMobileNavOpen && "rotate-45 translate-y-1.5")} />
                            <span className={cn("h-0.5 bg-foreground rounded transition-all", isMobileNavOpen && "opacity-0")} />
                            <span className={cn("h-0.5 bg-foreground rounded transition-all", isMobileNavOpen && "-rotate-45 -translate-y-1.5")} />
                        </div>
                    </button>
                </div>
            </div>

            {isMobileNavOpen && (
                <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl animate-in slide-in-from-top duration-200">
                    <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
                        {!hideSectionLinks && (
                            <>
                                <a href="#features" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5">
                                    {lang === 'vi' ? 'Tính năng' : 'Features'}
                                </a>
                                <a href="#demo" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5">
                                    {lang === 'vi' ? 'Bản demo' : 'Live Demo'}
                                </a>
                                <a href="#pricing" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5">
                                    {lang === 'vi' ? 'Giá cả' : 'Pricing'}
                                </a>
                            </>
                        )}
                        {hideSectionLinks && (
                            <button onClick={() => { navigate('/'); setIsMobileNavOpen(false); }} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5 text-left flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                {lang === 'vi' ? 'Quay lại' : 'Go Back'}
                            </button>
                        )}
                        <button onClick={() => { navigate('/docs'); setIsMobileNavOpen(false); }} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5 text-left">
                            {lang === 'vi' ? 'Tài liệu' : 'Docs'}
                        </button>
                        <button onClick={() => { navigate('/changelog'); setIsMobileNavOpen(false); }} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 text-left flex items-center justify-between">
                            {lang === 'vi' ? 'Cập nhật' : 'Changelog'}
                            <span className="bg-blue-600 text-[8px] px-1 rounded-sm text-white font-bold">NEW</span>
                        </button>
                    </nav>
                </div>
            )}
        </header>
    );
};
