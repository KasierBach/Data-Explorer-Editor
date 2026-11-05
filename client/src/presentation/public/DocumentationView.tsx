import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Database, Github, Menu, Search, X } from 'lucide-react';
import { DocSidebar, DOCS_STRUCTURE } from '../components/docs/DocSidebar';
import { DocContent } from '../components/docs/DocContent';
import { DocBreadcrumbs } from '../components/docs/DocBreadcrumbs';
import { DocNavigation } from '../components/docs/DocNavigation';
import { LanguageControl } from '../components/shared/LanguageControl';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { getLocalizedDocTitle } from '../components/docs/docsI18n';
import type { PublicRoute } from '@/core/seo/publicRoutes';
import { usePublicNavigation } from './PublicNavigationContext';
import { cn } from '@/lib/utils';

export function DocumentationView({ route, isAuthenticated = false }: { route: PublicRoute; isAuthenticated?: boolean }) {
    const lang = route.lang;
    const activeSection = route.sectionId ?? 'introduction';
    const navigation = usePublicNavigation();
    const text = getWorkspaceText(lang).documentationPage;
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
    const menuButton = useRef<HTMLButtonElement>(null);
    const entries = useMemo(() => DOCS_STRUCTURE.flatMap(section => section.items?.map(item => ({ ...item, title: getLocalizedDocTitle(lang, item), sectionTitle: getLocalizedDocTitle(lang, section) })) ?? []), [lang]);
    const currentIndex = entries.findIndex(item => item.id === activeSection);
    const current = entries[currentIndex];
    const results = search.trim() ? entries.filter(item => `${item.title} ${item.sectionTitle}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8) : [];
    const href = (id: string) => navigation.path(`/docs/${id}`);
    const select = (id: string) => { window.location.assign(href(id)); };
    const language = <LanguageControl lang={lang} onChange={() => {}} hrefs={navigation.languageUrls} touch />;
    useEffect(() => {
        const frame = requestAnimationFrame(() => setHeadings(Array.from(document.querySelectorAll('.public-docs main h2,.public-docs main h3'), (element, index) => {
            const id = element.id || `heading-${index}`;
            element.id = id;
            return { id, text: element.textContent ?? '', level: element.tagName === 'H2' ? 2 : 3 };
        })));
        return () => cancelAnimationFrame(frame);
    }, [activeSection, lang]);
    useEffect(() => {
        if (!open) return;
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            setOpen(false);
            menuButton.current?.focus();
        };
        window.addEventListener('keydown', escape);
        return () => window.removeEventListener('keydown', escape);
    }, [open]);
    return (
        <div className="public-docs h-dvh min-h-screen bg-background text-foreground flex flex-col overflow-hidden">
            <header className="h-14 border-b bg-card/50 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-6 min-w-0">
                    <a href={navigation.path('/')} aria-label={lang === 'vi' ? 'Data Explorer — Trang chủ' : 'Data Explorer — Home'} className="flex items-center gap-2.5 min-w-0"><span className="bg-primary/10 p-1.5 rounded-lg border border-primary/20"><Database className="w-5 h-5 text-primary" aria-hidden="true" /></span><span className="font-bold text-sm tracking-tight hidden sm:block truncate">Data Explorer <span className="text-muted-foreground font-normal ml-1">{text.docsLabel}</span></span></a>
                    <div className="hidden sm:block">{language}</div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative hidden md:block text-slate-500"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" aria-hidden="true" /><input aria-label={text.quickSearch} placeholder={text.quickSearch} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && results[0]) select(results[0].id); }} className="bg-muted/50 border rounded-full pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground w-48 lg:w-64 focus:outline-none focus:ring-1 focus:ring-primary/50" />{results.length > 0 && <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border bg-card shadow-2xl">{results.map(item => <a key={item.id} href={href(item.id)} className="block px-4 py-3 hover:bg-muted/60 text-sm text-foreground">{item.title}<span className="block text-[11px] text-muted-foreground">{item.sectionTitle}</span></a>)}</div>}</div>
                    <div className="sm:hidden">{language}</div>
                    <a href={navigation.path('/')} className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{text.goBack}</a>
                    <a href={isAuthenticated ? '/sql-explorer' : '/login'} className="hidden min-[380px]:inline-flex text-xs px-3 py-2">{text.launchApp}</a>
                    <button ref={menuButton} className="md:hidden h-11 w-11 inline-flex items-center justify-center" onClick={() => setOpen(value => !value)} aria-label={open ? 'Close documentation menu' : 'Open documentation menu'} aria-expanded={open} aria-controls="public-docs-menu">{open ? <X /> : <Menu />}</button>
                </div>
            </header>
            <div className="flex-1 flex overflow-hidden relative">
                <DocSidebar activeId={activeSection} onSelect={select} hrefFor={href} lang={lang} className="hidden md:flex" />
                {open && <><div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden" onClick={() => setOpen(false)} /><div id="public-docs-menu" className="fixed top-14 bottom-0 left-0 z-50 w-72 max-w-[90vw] md:hidden"><DocSidebar activeId={activeSection} onSelect={select} hrefFor={href} lang={lang} /></div></>}
                <main className="flex-1 min-w-0 overflow-y-auto bg-background/50 selection:bg-primary/20 custom-scrollbar relative scroll-smooth">
                    <div className="max-w-3xl mx-auto w-full py-12 px-6">
                        <DocBreadcrumbs sectionTitle={current?.sectionTitle ?? ''} itemTitle={current?.title ?? ''} onHomeClick={() => select('introduction')} lang={lang} />
                        <DocContent sectionId={activeSection} lang={lang} />
                        <DocNavigation prev={entries[currentIndex - 1]} next={entries[currentIndex + 1]} onNavigate={select} hrefFor={href} lang={lang} />
                        <footer className="mt-24 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-6"><a href="https://github.com/KasierBach/Data-Explorer-Editor" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground"><Github className="h-4 w-4" aria-hidden="true" />{text.editPage}</a><span className="text-xs text-muted-foreground">v1.6.7 • {text.releaseDate}</span></footer>
                    </div>
                    <div className="border-t bg-muted/10 p-8 text-center space-y-4"><h2 className="text-xl font-bold">{text.readyTitle}</h2><p className="text-muted-foreground max-w-md mx-auto text-sm">{text.readyDescription}</p><a href={isAuthenticated ? '/sql-explorer' : '/login'} className="inline-flex min-h-11 items-center bg-primary text-primary-foreground rounded-lg px-4 text-sm">{text.launchApp}</a></div>
                </main>
                <aside className="hidden lg:block w-64 border-l bg-card/10 p-6 overflow-y-auto custom-scrollbar"><h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6">{text.tableOfContents}</h2>{headings.map(heading => <a key={heading.id} href={`#${heading.id}`} className={cn('w-full text-left text-xs py-1.5 block text-muted-foreground hover:text-primary', heading.level === 3 && 'pl-4')}>{heading.text}</a>)}</aside>
            </div>
        </div>
    );
}
