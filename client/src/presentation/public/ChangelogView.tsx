import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, ChevronDown, Code2, Database, FileCode, Globe, Link2, List, Search, Settings, ShieldCheck, Sparkles, TestTube, Users, X, Zap } from 'lucide-react';
import { getChangelogPageContent, type ChangelogIconKey, type ChangelogRelease } from '../pages/changelogContent';
import type { PublicLanguage } from '@/core/seo/publicRoutes';
import { releaseAnchorId } from '@/core/productRelease';

function normalizeSearch(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
}

function matchesRelease(release: ChangelogRelease, query: string): boolean {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
    const text = normalizeSearch([release.version, release.date, release.title, ...release.features.flatMap(feature => [feature.title, feature.description])].join(' '));
    return terms.every(term => text.includes(term));
}

const iconMap: Record<ChangelogIconKey, ReactNode> = {
    sparkles: <Sparkles />,
    database: <Database />,
    code2: <Code2 />,
    shieldCheck: <ShieldCheck />,
    zap: <Zap />,
    globe: <Globe />,
    testTube: <TestTube />,
    fileCode: <FileCode />,
    settings: <Settings />,
    users: <Users />,
};

export function ChangelogView({ lang }: { lang: PublicLanguage }) {
    const content = useMemo(() => getChangelogPageContent(lang), [lang]);
    const latest = content.releases[0];
    const [query, setQuery] = useState('');
    const [enhanced, setEnhanced] = useState(false);
    const [activeReleaseId, setActiveReleaseId] = useState(latest ? releaseAnchorId(latest.version) : '');
    const [expandedReleases, setExpandedReleases] = useState<Set<string>>(() => new Set());
    const releaseListRef = useRef<HTMLElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const searching = normalizeSearch(query).length > 0;
    const visibleReleases = content.releases.filter(release => matchesRelease(release, query));
    const selectedReleaseId = visibleReleases.some(release => releaseAnchorId(release.version) === activeReleaseId)
        ? activeReleaseId
        : visibleReleases[0] ? releaseAnchorId(visibleReleases[0].version) : '';
    const releaseKey = content.releases.map(release => releaseAnchorId(release.version)).join('|');
    const copy = lang === 'vi' ? {
        eyebrow: 'Ghi chú phát hành',
        latest: 'Bản mới nhất',
        index: 'Phiên bản',
        mobileIndex: 'Chọn phiên bản',
        history: 'Lịch sử phát hành',
        releases: 'bản phát hành',
        updates: 'cập nhật',
        permalink: 'Liên kết bản phát hành',
        details: 'Xem chi tiết',
        hideDetails: 'Thu gọn',
        readRelease: 'Đọc bản phát hành',
        search: 'Tìm phiên bản hoặc nội dung cập nhật',
        placeholder: 'Tìm phiên bản, tính năng hoặc bản sửa lỗi…',
        clear: 'Xóa tìm kiếm',
        emptyTitle: 'Không tìm thấy bản phát hành',
        empty: 'Thử một phiên bản hoặc từ khóa khác.',
        matches: 'bản phát hành phù hợp',
        all: 'Xem tất cả phiên bản',
    } : {
        eyebrow: 'Release notes',
        latest: 'Latest release',
        index: 'Versions',
        mobileIndex: 'Choose a release',
        history: 'Release history',
        releases: 'releases',
        updates: 'updates',
        permalink: 'Release permalink',
        details: 'Read details',
        hideDetails: 'Collapse',
        readRelease: 'Read release',
        search: 'Search releases and updates',
        placeholder: 'Find a version, feature, or fix…',
        clear: 'Clear search',
        emptyTitle: 'No matching releases',
        empty: 'Try another version or keyword.',
        matches: 'matching releases',
        all: 'View all releases',
    };

    const selectRelease = useCallback((id: string) => {
        const release = content.releases.find(entry => releaseAnchorId(entry.version) === id);
        if (!release) return;
        setActiveReleaseId(id);
        setExpandedReleases(current => current.has(id) ? current : new Set([...current, id]));
        setQuery(current => matchesRelease(release, current) ? current : '');
    }, [content]);

    useEffect(() => {
        const handleHash = () => {
            const id = window.location.hash.slice(1);
            const release = content.releases.find(entry => releaseAnchorId(entry.version) === id);
            if (!release) return;
            selectRelease(id);
            setQuery(current => matchesRelease(release, current) ? current : '');
        };
        const frame = requestAnimationFrame(() => {
            setEnhanced(true);
            handleHash();
        });
        window.addEventListener('hashchange', handleHash);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('hashchange', handleHash);
        };
    }, [content, selectRelease]);

    useEffect(() => {
        if (!enhanced) return;
        let active = true;
        let frame = 0;
        const alignRelease = () => {
            if (!active) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const id = window.location.hash.slice(1);
                if (!content.releases.some(release => releaseAnchorId(release.version) === id)) return;
                const article = document.getElementById(id);
                if (article && releaseListRef.current?.contains(article)) article.scrollIntoView?.({ block: 'start', behavior: 'instant' });
            });
        };
        alignRelease();
        void document.fonts?.ready.then(alignRelease);
        window.addEventListener('load', alignRelease);
        window.addEventListener('hashchange', alignRelease);
        return () => {
            active = false;
            cancelAnimationFrame(frame);
            window.removeEventListener('load', alignRelease);
            window.removeEventListener('hashchange', alignRelease);
        };
    }, [content, enhanced]);

    useEffect(() => {
        const list = releaseListRef.current;
        if (!list || typeof IntersectionObserver === 'undefined') return;
        const articles = Array.from(list.querySelectorAll<HTMLElement>('article[data-release-id]'));
        const visible = new Set<Element>();
        let observer: IntersectionObserver;
        const observe = () => {
            observer?.disconnect();
            visible.clear();
            const offset = parseFloat(getComputedStyle(list).getPropertyValue('--pe-reading-offset')) || 94;
            observer = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target);
                    else visible.delete(entry.target);
                }
                const current = articles.filter(article => !article.hidden && visible.has(article)).sort((left, right) => Math.abs(left.getBoundingClientRect().top - offset) - Math.abs(right.getBoundingClientRect().top - offset))[0];
                if (current) setActiveReleaseId(current.id);
            }, { rootMargin: `-${offset}px 0px -55% 0px`, threshold: 0 });
            articles.forEach(article => observer.observe(article));
        };
        observe();
        window.addEventListener('resize', observe);
        return () => {
            observer.disconnect();
            visible.clear();
            window.removeEventListener('resize', observe);
        };
    }, [releaseKey]);

    const clearSearch = () => {
        setQuery('');
        searchRef.current?.focus();
    };
    const indexLinks = visibleReleases.map(release => {
        const id = releaseAnchorId(release.version);
        return (
            <li key={release.version}>
                <a className="pc-index-link" href={`#${id}`} aria-current={selectedReleaseId === id ? 'location' : undefined} onClick={() => selectRelease(id)}>
                    <span className="pc-index-link-copy">
                        <span className="pc-index-version">{release.version}{release.badge && <span className="pc-index-badge">{release.badge}</span>}</span>
                        <span className="pc-index-date">{release.date}</span>
                    </span>
                    <ArrowUpRight aria-hidden="true" />
                </a>
            </li>
        );
    });

    return (
        <main className="public-changelog" id="changelog-top" data-enhanced={enhanced}>
            <div className="pe-container pc-container">
                <header className="pc-masthead">
                    <div>
                        <p className="pc-eyebrow">{copy.eyebrow}</p>
                        <h1>{content.heading}</h1>
                        <p className="pc-subtitle">{content.subtitle}</p>
                    </div>
                    {latest && <a className="pc-latest-link" href={`#${releaseAnchorId(latest.version)}`} onClick={() => selectRelease(releaseAnchorId(latest.version))}><span>{copy.latest}</span><strong>{latest.version}</strong><ArrowDown size={16} aria-hidden="true" /></a>}
                </header>

                <div className="pc-search-tools" hidden={!enhanced}>
                    <div className="pc-search">
                        <Search size={18} aria-hidden="true" />
                        <input ref={searchRef} type="search" aria-label={copy.search} placeholder={copy.placeholder} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') clearSearch(); }} />
                        {query && <button type="button" onClick={clearSearch} aria-label={copy.clear}><X size={17} aria-hidden="true" /></button>}
                    </div>
                    <p className="pc-result-count" role="status" aria-live="polite">{visibleReleases.length} {searching ? copy.matches : copy.releases}</p>
                </div>

                <div className="pc-journal">
                    <aside className="pc-index" id="release-index">
                        <div className="pc-index-desktop">
                            <h2>{copy.index}</h2>
                            <nav aria-label={copy.index}><ol>{indexLinks}</ol></nav>
                        </div>
                        <details className="pc-index-mobile">
                            <summary><List size={17} aria-hidden="true" /><span>{copy.mobileIndex}</span><span className="pc-selected-version">{content.releases.find(release => releaseAnchorId(release.version) === selectedReleaseId)?.version}</span><ChevronDown size={16} aria-hidden="true" /></summary>
                            <nav aria-label={`${copy.index} — ${copy.mobileIndex}`}><ol>{indexLinks}</ol></nav>
                        </details>
                    </aside>

                    <section className="pc-release-list" aria-label={copy.history} ref={releaseListRef}>
                        {visibleReleases.length === 0 && <div className="pc-empty"><Search size={24} aria-hidden="true" /><h2>{copy.emptyTitle}</h2><p>{copy.empty}</p><button type="button" className="pe-button" onClick={clearSearch}>{copy.all}</button></div>}
                        {content.releases.map((release, releaseIndex) => {
                            const id = releaseAnchorId(release.version);
                            const expanded = searching || expandedReleases.has(id);
                            const body = <>
                                <ul className="pc-features">
                                    {release.features.map((feature, featureIndex) => (
                                        <li className="pc-feature" key={`${release.version}-${featureIndex}`}>
                                            <span className="pc-feature-icon" data-palette={feature.icon} aria-hidden="true">{iconMap[feature.icon]}</span>
                                            <div><h4>{feature.title}</h4><p>{feature.description}</p></div>
                                        </li>
                                    ))}
                                </ul>
                                <footer className="pc-release-footer"><a className="pc-permalink" href={`#${id}`} aria-label={`${copy.permalink} ${release.version}`} onClick={() => selectRelease(id)}><Link2 size={15} aria-hidden="true" />{copy.permalink}</a></footer>
                            </>;
                            return (
                                <article className="pc-release" id={id} key={release.version} hidden={!matchesRelease(release, query)} data-release-id={id} data-latest={releaseIndex === 0} data-active={selectedReleaseId === id} aria-labelledby={`${id}-heading ${id}-title`}>
                                    <header className="pc-release-header">
                                        <div className="pc-release-meta"><h2 id={`${id}-heading`}>{release.version}</h2>{release.badge && <span className="pc-release-badge">{release.badge}</span>}<span className="pc-release-date">{release.date}</span></div>
                                        <h3 id={`${id}-title`}>{release.title}</h3>
                                    </header>
                                    {releaseIndex === 0 ? body : <details className="pc-release-details" open={expanded}><summary aria-label={`${copy.readRelease} ${release.version}`} onClick={event => {
                                        event.preventDefault();
                                        if (searching) return;
                                        setExpandedReleases(current => {
                                            const next = new Set(current);
                                            if (current.has(id)) next.delete(id);
                                            else next.add(id);
                                            return next;
                                        });
                                    }}><span>{release.features.length} {copy.updates}</span><span className="pc-details-action">{expanded ? copy.hideDetails : copy.details}<ChevronDown size={16} aria-hidden="true" /></span></summary>{body}</details>}
                                </article>
                            );
                        })}
                    </section>
                </div>
            </div>
        </main>
    );
}
