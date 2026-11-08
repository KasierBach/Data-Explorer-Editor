import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ArrowUpRight, BookOpen, ChevronDown, Compass, Database, Github, List, Menu } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DocSidebar } from '../components/docs/DocSidebar';
import { DOCS_CATALOG, getDocTopic } from '@/core/docs/docsCatalog';
import { CURRENT_RELEASE, getReleaseDate, releaseAnchorId } from '@/core/productRelease';
import { DocContent } from '../components/docs/DocContent';
import { DocBreadcrumbs } from '../components/docs/DocBreadcrumbs';
import { DocNavigation } from '../components/docs/DocNavigation';
import { LanguageControl } from '../components/shared/LanguageControl';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { getDocsText, getLocalizedDocTitle } from '../components/docs/docsI18n';
import type { PublicRoute } from '@/core/seo/publicRoutes';
import { usePublicNavigation } from './PublicNavigationContext';
import { usePublicExperience } from './PublicExperienceContext';
import { DocsSearch } from './DocsSearch';
import { useDocsOutline } from './useDocsOutline';
import { PublicPageLinks } from './PublicPageLinks';

export function DocumentationView({ route, isAuthenticated = false }: { route: PublicRoute; isAuthenticated?: boolean }) {
    const lang = route.lang;
    const activeSection = route.sectionId ?? 'introduction';
    const navigation = usePublicNavigation();
    const text = getWorkspaceText(lang).documentationPage;
    const docs = getDocsText(lang);
    const { paused } = usePublicExperience();
    const [open, setOpen] = useState(false);
    const [enhanced, setEnhanced] = useState(false);
    const drawerNavigation = useRef(false);
    const explore = useRef<HTMLDetailsElement>(null);
    const exploreTrigger = useRef<HTMLElement>(null);
    const closeExplore = () => { if (explore.current) explore.current.open = false; };
    useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            if (explore.current?.open && !explore.current.contains(event.target as Node)) explore.current.open = false;
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented || !explore.current?.open) return;
            explore.current.open = false;
            exploreTrigger.current?.focus();
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, []);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setEnhanced(true));
        return () => cancelAnimationFrame(frame);
    }, []);
    const article = useRef<HTMLElement>(null);
    const scroll = useRef<HTMLElement>(null);
    const entries = useMemo(() => DOCS_CATALOG.flatMap(section => section.items.map(item => ({ ...item, groupId: section.id, title: getLocalizedDocTitle(lang, item), sectionTitle: getLocalizedDocTitle(lang, section) }))), [lang]);
    const groups = useMemo(() => DOCS_CATALOG.map(section => ({ id: section.id, title: getLocalizedDocTitle(lang, section) })), [lang]);
    const currentIndex = entries.findIndex(item => item.id === activeSection);
    const current = entries[currentIndex];
    const topic = getDocTopic(activeSection);
    const editUrl = topic ? `https://github.com/KasierBach/Data-Explorer-Editor/edit/main/${topic.sourcePath}` : 'https://github.com/KasierBach/Data-Explorer-Editor';
    const reviewedDate = topic ? new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${topic.updatedAt}T00:00:00Z`)) : undefined;
    const href = (id: string) => navigation.path(`/docs/${id}`);
    const select = (id: string) => {
        if (!navigation.navigateDocs?.(href(id))) window.location.assign(href(id));
        else { drawerNavigation.current = open; setOpen(false); closeExplore(); }
    };
    const onTopicClick = (event: MouseEvent<HTMLDivElement>) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !navigation.navigateDocs) return;
        const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
        if (!anchor || anchor.hasAttribute('download') || anchor.getAttribute('href')?.startsWith('#') || (anchor.target && anchor.target !== '_self')) return;
        if (!navigation.navigateDocs(anchor.href)) return;
        event.preventDefault();
        drawerNavigation.current = open;
        setOpen(false);
        closeExplore();
    };
    const { headings, activeHeading } = useDocsOutline(article, scroll, `${activeSection}:${lang}`);
    const articleKey = `${activeSection}:${lang}`;
    const previousArticle = useRef({ key: articleKey, hash: navigation.hash });
    useEffect(() => {
        const previous = previousArticle.current;
        if (previous.key === articleKey && previous.hash === navigation.hash) return;
        previousArticle.current = { key: articleKey, hash: navigation.hash };
        const changedTopic = previous.key !== articleKey;
        if (changedTopic && scroll.current) scroll.current.scrollTop = 0;
        const frame = requestAnimationFrame(() => {
            if (changedTopic) {
                const heading = article.current?.querySelector<HTMLElement>('h1');
                if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
            }
            let fragment = '';
            try { fragment = decodeURIComponent(navigation.hash.slice(1)); } catch { return; }
            if (!fragment) return;
            const target = document.getElementById(fragment);
            if (target && article.current?.contains(target)) target.scrollIntoView?.({ block: 'start', behavior: 'instant' });
        });
        return () => cancelAnimationFrame(frame);
    }, [articleKey, navigation.hash]);
    const language = <LanguageControl lang={lang} onChange={() => {}} hrefs={navigation.languageUrls} appearance="pill" />;
    const outline = headings.map(heading => <a key={heading.id} href={`#${heading.id}`} className={heading.level === 3 ? 'pe-outline-sub' : undefined} aria-current={activeHeading === heading.id ? 'location' : undefined}>{heading.text}</a>);
    return (
        <div className="public-docs public-experience" onClick={onTopicClick} data-motion={paused ? 'paused' : 'active'} data-doc-page={activeSection} data-enhanced={enhanced}>
            <header className="pe-doc-header">
                <div className="pe-doc-brand-row"><a href={navigation.path('/')} aria-label={lang === 'vi' ? 'Data Explorer — Trang chủ' : 'Data Explorer — Home'} className="pe-brand"><span className="pe-brand-mark"><Database size={17} aria-hidden="true" /></span><span>Data<span>Explorer</span></span></a></div>
                <div className="pe-doc-search-slot"><DocsSearch entries={entries} groups={groups} lang={lang} hrefFor={href} /></div>
                <details ref={explore} className="pe-doc-explore">
                    <summary ref={exploreTrigger} aria-label={lang === 'vi' ? 'Khám phá' : 'Explore'}><Compass size={16} aria-hidden="true" /><span>{lang === 'vi' ? 'Khám phá' : 'Explore'}</span><ChevronDown size={14} aria-hidden="true" /></summary>
                    <div className="pe-doc-explore-panel">
                        <nav className="pe-doc-pages pe-doc-compact-pages" aria-label={lang === 'vi' ? 'Điều hướng chính' : 'Main navigation'}><PublicPageLinks lang={lang} currentPage="docs" className="pe-nav-link" onNavigate={closeExplore} /></nav>
                        <a href={isAuthenticated ? '/sql-explorer' : '/login'} onClick={closeExplore} className="pe-doc-explore-workspace">{text.launchApp}<ArrowUpRight size={14} aria-hidden="true" /></a>
                        <details className="pe-doc-native-nav"><summary><BookOpen size={16} aria-hidden="true" />{docs.navigation}</summary><nav>{entries.map(entry => <a key={entry.id} href={href(entry.id)} onClick={closeExplore} aria-current={entry.id === activeSection ? 'page' : undefined}>{entry.title}</a>)}</nav></details>
                    </div>
                </details>
                <nav className="pe-doc-pages pe-doc-desktop-pages" aria-label={lang === 'vi' ? 'Điều hướng chính' : 'Main navigation'}><PublicPageLinks lang={lang} currentPage="docs" className="pe-nav-link" /></nav>
                <div className="pe-doc-header-actions"><div className="pe-doc-language">{language}</div><a href={isAuthenticated ? '/sql-explorer' : '/login'} className="pe-button pe-doc-workspace">{text.launchApp}<ArrowUpRight size={14} aria-hidden="true" /></a>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild><button className="pe-doc-menu" type="button" aria-label={open ? docs.closeMenu : docs.openMenu} aria-expanded={open} aria-controls="public-docs-menu"><Menu size={20} aria-hidden="true" /></button></DialogTrigger>
                        <DialogContent id="public-docs-menu" className="public-experience pe-doc-drawer" closeLabel={docs.closeMenu} overlayClassName="pe-doc-drawer-overlay" onCloseAutoFocus={event => {
                            if (!drawerNavigation.current) return;
                            event.preventDefault();
                            drawerNavigation.current = false;
                            const heading = article.current?.querySelector<HTMLElement>('h1');
                            if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
                        }}>
                            <DialogTitle className="pe-drawer-title">{docs.navigation}</DialogTitle><DialogDescription className="sr-only">{docs.choosePage}</DialogDescription>
                            <DocSidebar activeId={activeSection} onSelect={select} hrefFor={href} lang={lang} />
                        </DialogContent>
                    </Dialog>
                </div>
            </header>
            <div className="pe-doc-body">
                <DocSidebar activeId={activeSection} onSelect={select} hrefFor={href} lang={lang} className="pe-doc-sidebar" />
                <main ref={scroll} className="pe-doc-scroll">
                    <article ref={article} className={activeSection === 'introduction' ? 'pe-doc-article pe-doc-intro' : 'pe-doc-article'}>
                        <div className="pe-doc-breadcrumb"><DocBreadcrumbs sectionTitle={current?.sectionTitle ?? ''} itemTitle={current?.title ?? ''} onHomeClick={() => select('introduction')} lang={lang} /></div>
                        {activeSection !== 'introduction' && <div className="pe-topic-banner" aria-hidden="true"><span className="pe-kicker"><BookOpen size={13} />{current?.sectionTitle}</span><span className="pe-topic-motif"><i /><i /><i /></span></div>}
                        {headings.length > 0 && <details className="pe-doc-inline-outline" data-doc-outline-exclude><summary><List size={16} aria-hidden="true" />{docs.onThisPage}<span>{headings.length}</span></summary><nav>{outline}</nav></details>}
                        <DocContent sectionId={activeSection} lang={lang} />
                    </article>
                    <div className="pe-doc-after"><DocNavigation prev={entries[currentIndex - 1]} next={entries[currentIndex + 1]} onNavigate={select} hrefFor={href} lang={lang} />
                        <footer className="pe-doc-footer"><a href={editUrl} target="_blank" rel="noopener noreferrer"><Github size={15} aria-hidden="true" />{text.editPage}</a><span>{topic && <>{docs.lastReviewed}: <time dateTime={topic.updatedAt}>{reviewedDate}</time> · </>}{CURRENT_RELEASE.tag} / {docs.releasePublished}: <time dateTime={CURRENT_RELEASE.date}>{getReleaseDate(lang)}</time></span></footer>
                        <nav className="pe-doc-page-shortcuts" aria-label={lang === 'vi' ? 'Khám phá Data Explorer' : 'Explore Data Explorer'}><a href={navigation.path('/')} className="pe-button">{lang === 'vi' ? 'Trang chủ' : 'Home'}</a><a href={navigation.path('/changelog')} className="pe-button">{lang === 'vi' ? 'Cập nhật sản phẩm' : 'Product updates'}<ArrowUpRight size={14} aria-hidden="true" /></a></nav>
                        <section className="pe-doc-next-step"><div><span className="pe-kicker">{lang === 'vi' ? 'ĐẾN LƯỢT BẠN KHÁM PHÁ' : 'YOUR TURN TO EXPLORE'}</span><h2>{text.readyTitle}</h2><p>{text.readyDescription}</p></div><a href={isAuthenticated ? '/sql-explorer' : '/login'} className="pe-button pe-button-primary">{text.launchApp}<ArrowUpRight size={15} aria-hidden="true" /></a></section>
                    </div>
                </main>
                <aside className="pe-doc-outline"><span className="pe-kicker">{docs.onThisPage}</span><nav aria-label={docs.onThisPage}>{outline}</nav><a href={`${navigation.path('/changelog')}#${releaseAnchorId(CURRENT_RELEASE.tag)}`} className="pe-outline-release"><span>{CURRENT_RELEASE.tag}</span>{lang === 'vi' ? 'Khám phá bản phát hành' : 'Explore the release'}<ArrowUpRight size={14} aria-hidden="true" /></a></aside>
            </div>
        </div>
    );
}
