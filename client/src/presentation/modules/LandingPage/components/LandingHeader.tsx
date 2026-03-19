import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Database } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/presentation/components/shared/LanguageSwitcher';

interface LandingHeaderProps {
    lang: string;
    isAuthenticated: boolean;
    logout: () => void;
    isMobileNavOpen: boolean;
    setIsMobileNavOpen: (open: boolean) => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
    lang,
    isAuthenticated,
    logout,
    isMobileNavOpen,
    setIsMobileNavOpen
}) => {
    const navigate = useNavigate();

    return (
        <header className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-white/5 supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Database className="w-4 h-4 text-white" />
                    </div>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Data<span className="text-blue-500">Explorer</span></span>
                </div>

                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground absolute left-1/2 -translate-x-1/2">
                    <a href="#features" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                        {lang === 'vi' ? 'Tính năng' : 'Features'}
                    </a>
                    <a href="#demo" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                        {lang === 'vi' ? 'Bản demo' : 'Live Demo'}
                    </a>
                    <button onClick={() => navigate('/docs')} className="relative group hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                        {lang === 'vi' ? 'Tài liệu' : 'Docs'}
                        <span className="absolute -top-3 -right-4 bg-blue-600 text-[8px] px-1 rounded-sm text-white font-bold animate-pulse group-hover:scale-110 transition-transform">NEW</span>
                    </button>
                    <a href="#pricing" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                        {lang === 'vi' ? 'Giá cả' : 'Pricing'}
                    </a>
                </nav>

                <div className="flex items-center gap-2 sm:gap-4">
                    <LanguageSwitcher />
                    {isAuthenticated ? (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/login'); }} className="hidden sm:flex hover:bg-red-500/10 hover:text-red-500 text-xs uppercase tracking-wider">
                                Logout
                            </Button>
                            <Button size="sm" onClick={() => navigate('/app')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 text-xs uppercase tracking-widest font-bold">
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
                        <a href="#features" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5">
                            {lang === 'vi' ? 'Tính năng' : 'Features'}
                        </a>
                        <a href="#demo" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5">
                            {lang === 'vi' ? 'Bản demo' : 'Live Demo'}
                        </a>
                        <button onClick={() => { navigate('/docs'); setIsMobileNavOpen(false); }} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5 text-left">
                            {lang === 'vi' ? 'Tài liệu' : 'Docs'}
                        </button>
                        <a href="#pricing" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2">
                            {lang === 'vi' ? 'Giá cả' : 'Pricing'}
                        </a>
                    </nav>
                </div>
            )}
        </header>
    );
};
