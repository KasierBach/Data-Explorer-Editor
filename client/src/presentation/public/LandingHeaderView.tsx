import React, { useEffect, useRef } from "react";
import { Database, ArrowLeft, ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
import { SiGithub } from "react-icons/si";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/lib/utils";
import { getWorkspaceText } from "@/core/utils/workspaceText";
import { useLandingAppearance } from "../modules/LandingPage/hooks/useLandingAppearance";

interface LandingHeaderViewProps {
    lang: string;
    isAuthenticated: boolean;
    logout: () => void | Promise<void>;
    isMobileNavOpen: boolean;
    setIsMobileNavOpen: (open: boolean) => void;
    hideSectionLinks?: boolean;
    appearance?: "default" | "landing";
    language: React.ReactNode;
    navigate: (path: string) => void;
    hrefFor?: (path: string) => string;
}

export function LandingHeaderView({ lang, isAuthenticated, logout, isMobileNavOpen, setIsMobileNavOpen, hideSectionLinks, appearance = "default", language, navigate, hrefFor = path => path }: LandingHeaderViewProps) {
    const text = getWorkspaceText(lang).landingHeader;
    const isLanding = appearance === 'landing';
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const { theme, setTheme } = useLandingAppearance();

    useEffect(() => {
        if (!isLanding || !isMobileNavOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            setIsMobileNavOpen(false);
            menuButtonRef.current?.focus();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isLanding, isMobileNavOpen, setIsMobileNavOpen]);

    const sectionLinks = (
        <>
            <a href="#features" className={isLanding ? 'lp-header-link' : 'hover:text-white text-muted-foreground/80 transition-colors uppercase tracking-[0.15em] text-[10px] font-semibold'}>{text.features}</a>
            <a href="#demo" className={isLanding ? 'lp-header-link' : 'hover:text-white text-muted-foreground/80 transition-colors uppercase tracking-[0.15em] text-[10px] font-semibold'}>{isLanding ? text.interface : text.liveDemo}</a>
            <a href="#pricing" className={isLanding ? 'lp-header-link' : 'hover:text-white text-muted-foreground/80 transition-colors uppercase tracking-[0.15em] text-[10px] font-semibold'}>{isLanding ? text.landingPricing : text.pricing}</a>
        </>
    );

    const headerClass = isLanding
        ? 'lp-chrome fixed top-0 w-full z-50 transition-all duration-300'
        : 'fixed top-0 w-full z-50 bg-background/40 backdrop-blur-2xl border-b border-white/[0.04] supports-[backdrop-filter]:bg-background/40 transition-all duration-300';

    const navBreakpoint = isLanding ? 'hidden lg:flex' : 'hidden md:flex';

    if (isLanding) {
        const vi = lang === 'vi';
        const workspaceHref = isAuthenticated ? '/sql-explorer' : '/login';
        return (
            <header className="lp-chrome lp-landing-header">
                <div className="lp-container lp-header-inner">
                    <a href={hrefFor('/')} className="lp-brand"><span className="lp-brand-icon"><Database className="h-4 w-4" aria-hidden="true" /></span><span>Data<span className="lp-brand-accent">Explorer</span></span></a>
                    <nav className="lp-desktop-nav" aria-label={vi ? 'Điều hướng chính' : 'Main navigation'}>{sectionLinks}<a href={hrefFor('/docs')} className="lp-header-link">{text.docs}</a></nav>
                    <div className="lp-header-actions">
                        <div className="lp-header-language">{language}</div>
                        <a href="https://github.com/KasierBach/Data-Explorer-Editor" target="_blank" rel="noopener noreferrer" className="lp-icon-button lp-github-link" aria-label="GitHub"><SiGithub className="h-5 w-5" aria-hidden="true" /></a>
                        <button type="button" className="lp-icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? (vi ? 'Chuyển sang giao diện sáng' : 'Switch to light theme') : (vi ? 'Chuyển sang giao diện tối' : 'Switch to dark theme')}>
                            {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
                        </button>
                        <a href={workspaceHref} className="lp-button lp-button-primary lp-header-cta">{text.workspace}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
                        <button ref={menuButtonRef} type="button" className="lp-icon-button lp-menu-button" onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} aria-label={text.toggleMenuAria} aria-expanded={isMobileNavOpen} aria-controls="landing-mobile-nav">
                            {isMobileNavOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
                        </button>
                    </div>
                </div>
                {isMobileNavOpen && (
                    <nav id="landing-mobile-nav" className="lp-mobile-nav lp-container" aria-label={vi ? 'Điều hướng di động' : 'Mobile navigation'}>
                        <a href="#features" onClick={() => setIsMobileNavOpen(false)}>{text.features}</a>
                        <a href="#demo" onClick={() => setIsMobileNavOpen(false)}>{text.interface}</a>
                        <a href="#pricing" onClick={() => setIsMobileNavOpen(false)}>{text.landingPricing}</a>
                        <a href={hrefFor('/docs')}>{text.docs}</a>
                        <a href="#get-started" onClick={() => setIsMobileNavOpen(false)}>{vi ? 'Chạy local' : 'Run locally'}</a>
                        <div className="lp-mobile-utilities">{language}<a href={workspaceHref} className="lp-button lp-button-primary">{text.workspace}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a></div>
                        {isAuthenticated && <button type="button" onClick={() => { void logout(); }}>{text.logout}</button>}
                    </nav>
                )}
            </header>
        );
    }

    return (
        <header className={headerClass}>
            <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                <button
                    className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-lg p-1"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    aria-label={text.backToTopAria}
                >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Database className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <span className={cn('hidden min-[480px]:inline', isLanding ? 'lp-brand-word' : 'bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70')}>Data<span className="text-blue-500">Explorer</span></span>
                </button>

                <nav className={cn(navBreakpoint, 'items-center gap-8 text-sm font-medium text-muted-foreground absolute left-1/2 -translate-x-1/2')}>
                    {!hideSectionLinks && sectionLinks}
                    {isLanding ? (
                        <a href={hrefFor('/docs')} className="lp-header-link text-sm font-semibold transition-colors">{text.docs}</a>
                    ) : (
                        <button onClick={() => navigate('/docs')} className="relative group hover:text-white text-muted-foreground/80 transition-colors uppercase tracking-[0.15em] text-[10px] font-semibold">
                            {text.docs}
                        </button>
                    )}
                    {!isLanding && (
                        <button onClick={() => navigate('/changelog')} className="relative group hover:text-white text-muted-foreground/80 transition-colors uppercase tracking-[0.15em] text-[10px] font-semibold">
                            {text.changelog}
                            <span className="absolute -top-3 -right-4 bg-blue-600 text-[8px] px-1 rounded-sm text-white font-bold animate-pulse group-hover:scale-110 transition-transform">NEW</span>
                        </button>
                    )}
                </nav>

                <div className="flex items-center gap-2 sm:gap-4">
                    {hideSectionLinks && (
                        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="hidden md:flex text-[10px] h-8 items-center gap-1.5 text-muted-foreground uppercase tracking-widest hover:text-blue-500 hover:bg-transparent">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            {text.goBack}
                        </Button>
                    )}
                    {language}
                    {isAuthenticated ? (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { void logout(); }} className="hidden sm:flex hover:bg-red-500/10 hover:text-red-500 text-xs uppercase tracking-wider">
                                {text.logout}
                            </Button>
                            <Button size="sm" onClick={() => navigate('/sql-explorer')} className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-400/20 transition-all hover:scale-105 active:scale-95 text-[10px] uppercase tracking-widest font-bold rounded-lg px-4 hidden sm:flex">
                                {text.workspace}
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:flex hover:bg-blue-500/10 hover:text-blue-500 text-xs uppercase tracking-wider">
                                {text.login}
                            </Button>
                            <Button size="sm" onClick={() => navigate('/login')} className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-400/20 transition-all hover:scale-105 active:scale-95 text-[10px] uppercase tracking-widest font-bold px-4 sm:px-5 rounded-lg">
                                {text.startAnalysis}
                            </Button>
                        </>
                    )}
                    <button
                        ref={menuButtonRef}
                        className={cn(isLanding ? 'lg:hidden' : 'md:hidden', 'p-2 rounded-lg hover:bg-white/10 transition-colors')}
                        onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                        aria-label={text.toggleMenuAria}
                        aria-expanded={isMobileNavOpen}
                        aria-controls="landing-mobile-nav"
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
                <div id="landing-mobile-nav" className={cn('border-t border-white/5 backdrop-blur-xl animate-in slide-in-from-top duration-200', isLanding ? 'lg:hidden lp-chrome' : 'md:hidden bg-background/95')}>
                    <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
                        {!hideSectionLinks && (
                            <>
                                <a href="#features" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5">
                                    {text.features}
                                </a>
                                <a href="#demo" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5">
                                    {isLanding ? text.interface : text.liveDemo}
                                </a>
                                <a href="#pricing" onClick={() => setIsMobileNavOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5">
                                    {isLanding ? text.landingPricing : text.pricing}
                                </a>
                            </>
                        )}
                        {hideSectionLinks && (
                            <button onClick={() => { navigate('/'); setIsMobileNavOpen(false); }} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5 text-left flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                {text.goBack}
                            </button>
                        )}
                        <button onClick={() => { navigate('/docs'); setIsMobileNavOpen(false); }} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 border-b border-white/5 text-left">
                            {text.docs}
                        </button>
                        {!isLanding && (
                            <button onClick={() => { navigate('/changelog'); setIsMobileNavOpen(false); }} className="text-sm font-medium text-muted-foreground hover:text-blue-500 transition-colors py-2 text-left flex items-center justify-between">
                                {text.changelog}
                                <span className="bg-blue-600 text-[8px] px-1 rounded-sm text-white font-bold">NEW</span>
                            </button>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
}
