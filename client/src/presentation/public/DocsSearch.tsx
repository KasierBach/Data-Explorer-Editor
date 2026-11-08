import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { getDocsText } from '../components/docs/docsI18n';
import type { PublicLanguage } from '@/core/seo/publicRoutes';
import { usePublicNavigation } from './PublicNavigationContext';

interface DocsSearchEntry { id: string; title: string; sectionTitle: string; groupId: string }
interface DocsSearchGroup { id: string; title: string }

export function DocsSearch({ entries, groups, lang, hrefFor }: { entries: DocsSearchEntry[]; groups: DocsSearchGroup[]; lang: PublicLanguage; hrefFor: (id: string) => string }) {
    const text = getDocsText(lang);
    const navigation = usePublicNavigation();
    const vi = lang === 'vi';
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(0);
    const [groupId, setGroupId] = useState('all');
    const [mode, setMode] = useState<'include' | 'exclude'>('include');
    const [filterOpen, setFilterOpen] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const focusSearchOnClose = useRef(false);
    const id = useId();
    const activeGroup = groups.find(group => group.id === groupId);
    const scope = activeGroup?.id ?? 'all';
    const matching = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase(lang);
        return entries.filter(entry => (scope === 'all' || (mode === 'include' ? entry.groupId === scope : entry.groupId !== scope)) && (!needle || `${entry.title} ${entry.sectionTitle}`.toLocaleLowerCase(lang).includes(needle)));
    }, [entries, lang, query, scope, mode]);
    const results = matching.slice(0, 8);
    const activeIndex = selected < results.length ? selected : 0;
    const expanded = open && !filterOpen;
    useEffect(() => {
        if (expanded) list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    }, [expanded, activeIndex, matching]);
    const applyFilter = () => {
        setSelected(0);
        focusSearchOnClose.current = true;
        setFilterOpen(false);
    };
    const resetFilter = () => {
        setGroupId('all');
        setMode('include');
        if (filterOpen) {
            applyFilter();
        } else {
            setSelected(0);
            setOpen(true);
            input.current?.focus();
        }
    };
    const filterLabel = vi ? 'Bộ lọc' : 'Filter';
    const includeLabel = vi ? 'Chỉ hiển thị' : 'Include only';
    const excludeLabel = vi ? 'Loại trừ' : 'Exclude';
    const scopeLabel = activeGroup ? `${mode === 'include' ? includeLabel : excludeLabel} · ${activeGroup.title}` : text.searchScope;
    return (
        <div className="pe-doc-search-tools">
            <div className="pe-doc-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
                <Search size={16} aria-hidden="true" />
                <input ref={input} role="combobox" aria-label={text.searchTopics} aria-expanded={expanded} aria-controls={expanded && results.length ? `${id}-results` : undefined} aria-autocomplete="list" aria-activedescendant={expanded && results[activeIndex] ? `${id}-${results[activeIndex].id}` : undefined}
                    placeholder={text.searchTopics} value={query} onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setSelected(0); setOpen(true); }}
                    onKeyDown={event => {
                        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
                        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
                            event.preventDefault();
                            setOpen(true);
                            setSelected((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
                        }
                        if (event.key === 'Enter' && expanded && results[activeIndex] && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                            event.preventDefault();
                            const href = hrefFor(results[activeIndex].id);
                            setOpen(false);
                            if (!navigation.navigateDocs?.(href)) window.location.assign(href);
                        }
                    }} />
                {query && <button type="button" className="pe-search-clear" aria-label={text.clearSearch} onClick={() => { setQuery(''); setSelected(0); setOpen(true); input.current?.focus(); }}><X size={15} aria-hidden="true" /></button>}
                {expanded && <div className="pe-search-popover">
                    <div className="pe-search-summary"><p className="pe-search-caption">{scopeLabel}</p><p className="pe-search-count" role="status">{results.length}/{matching.length} {vi ? 'chủ đề' : 'topics'}{!matching.length && <span className="sr-only"> · {text.noResults}</span>}</p></div>
                    {activeGroup && <button type="button" className="pe-filter-reset" onPointerDown={event => event.preventDefault()} onClick={resetFilter}>{vi ? 'Đặt lại bộ lọc' : 'Reset filter'}</button>}
                    {results.length ? <div ref={list} role="listbox" id={`${id}-results`} aria-label={text.searchResults}>
                        {results.map((entry, index) => <a key={entry.id} id={`${id}-${entry.id}`} role="option" aria-selected={activeIndex === index} href={hrefFor(entry.id)} onPointerDown={event => event.preventDefault()} onPointerMove={() => setSelected(index)} className="pe-search-option"><span><strong>{entry.title}</strong><small>{entry.sectionTitle}</small></span><ArrowUpRight size={15} aria-hidden="true" /></a>)}
                    </div> : <p className="pe-search-empty">{text.noResults}</p>}
                </div>}
            </div>
            <DropdownMenu modal={false} open={filterOpen} onOpenChange={value => { setFilterOpen(value); if (value) { focusSearchOnClose.current = false; setOpen(false); } }}>
                <DropdownMenuTrigger asChild><button type="button" className="pe-doc-filter" data-active={Boolean(activeGroup)} aria-label={activeGroup ? `${filterLabel}: ${scopeLabel}` : filterLabel} title={activeGroup ? scopeLabel : undefined}><SlidersHorizontal size={16} aria-hidden="true" /><span className="pe-filter-label-desktop">{filterLabel}</span><span className="pe-filter-label-mobile" aria-hidden="true">{vi ? 'Lọc' : 'Filter'}</span>{activeGroup && <span className="pe-filter-active" aria-hidden="true">1</span>}</button></DropdownMenuTrigger>
                <DropdownMenuContent className="public-experience pe-doc-filter-menu" align="end" sideOffset={8} onCloseAutoFocus={event => {
                    if (!focusSearchOnClose.current) return;
                    event.preventDefault();
                    focusSearchOnClose.current = false;
                    input.current?.focus();
                    setOpen(true);
                }}>
                    <DropdownMenuItem className="pe-doc-filter-option pe-doc-filter-clear" disabled={!activeGroup} onSelect={resetFilter}><X size={15} aria-hidden="true" />{vi ? 'Bỏ lọc' : 'Clear filter'}</DropdownMenuItem>
                    <DropdownMenuSeparator className="pe-doc-filter-separator" />
                    <DropdownMenuLabel className="pe-doc-filter-heading">{vi ? 'Cách lọc' : 'Filter mode'}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup aria-label={vi ? 'Cách lọc' : 'Filter mode'} value={mode} onValueChange={value => { setMode(value === 'exclude' ? 'exclude' : 'include'); applyFilter(); }}>
                        <DropdownMenuRadioItem value="include" className="pe-doc-filter-option">{includeLabel}</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="exclude" className="pe-doc-filter-option">{excludeLabel}</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator className="pe-doc-filter-separator" />
                    <DropdownMenuLabel className="pe-doc-filter-heading">{vi ? 'Nhóm tài liệu' : 'Documentation groups'}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup aria-label={vi ? 'Nhóm tài liệu' : 'Documentation groups'} value={scope} onValueChange={value => { if (value !== 'all') { setGroupId(value); applyFilter(); } }}>
                        <DropdownMenuRadioItem value="all" className="pe-doc-filter-option" onSelect={resetFilter}>{vi ? 'Tất cả chủ đề' : 'All topics'}<span className="pe-filter-count">{entries.length}</span></DropdownMenuRadioItem>
                        {groups.map(group => <DropdownMenuRadioItem key={group.id} value={group.id} className="pe-doc-filter-option">{group.title}<span className="pe-filter-count">{entries.filter(entry => entry.groupId === group.id).length}</span></DropdownMenuRadioItem>)}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
