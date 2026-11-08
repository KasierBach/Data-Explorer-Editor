import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, BookOpen, ChevronRight, Code, Database, HelpCircle, Layers, Leaf, Terminal, Users } from 'lucide-react';
import { DOCS_CATALOG } from '@/core/docs/docsCatalog';
import { CURRENT_RELEASE, releaseAnchorId } from '@/core/productRelease';
import { publicPath } from '@/core/seo/publicRoutes';
import { getDocsText, getLocalizedDocTitle } from './docsI18n';

export interface DocItem {
    id: string;
    title: string;
    titleEn?: string;
}

export interface DocSection {
    id: string;
    title: string;
    titleEn?: string;
    icon?: React.ReactNode;
    items?: DocItem[];
}

const SECTION_ICONS = {
    'getting-started': Terminal,
    connections: Database,
    'nosql-workspace': Leaf,
    'sql-workspace': Code,
    'ai-assistant': BookOpen,
    visualization: Layers,
    'workspace-operations': Users,
    'architecture-tech': Activity,
} as const;

/** Compatibility export for presentation consumers; the catalog is the source of truth. */
export const DOCS_STRUCTURE: DocSection[] = DOCS_CATALOG.map(section => {
    const Icon = SECTION_ICONS[section.id];
    return { ...section, icon: <Icon className="w-4 h-4" />, items: section.items.map(item => ({ ...item })) };
});

interface DocSidebarProps {
    activeId: string;
    onSelect: (id: string) => void;
    lang: 'vi' | 'en';
    className?: string;
    hrefFor?: (id: string) => string;
}

export function DocSidebar({ activeId, onSelect, lang, className, hrefFor }: DocSidebarProps) {
    const Item = hrefFor ? 'a' : 'button';
    const text = getDocsText(lang);

    return (
        <aside className={cn('doc-sidebar w-64 border-r bg-card/30 backdrop-blur-md flex flex-col h-full overflow-hidden', className)}>
            <div className="flex-1 flex flex-col min-h-0">
                <div className="p-6 pb-0">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="bg-primary/10 p-1.5 rounded-lg">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">{text.documentation}</span>
                    </div>
                </div>

                <nav className="doc-sidebar-nav flex-1 overflow-y-auto px-6 py-2 custom-scrollbar space-y-6" aria-label={text.navigation}>
                    {DOCS_STRUCTURE.map((section) => (
                        <div key={section.id} className="space-y-2">
                            <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                                {section.icon}
                                {getLocalizedDocTitle(lang, section)}
                            </h4>
                            <div className="space-y-1">
                                {section.items?.map((item) => (
                                    <Item
                                        key={item.id}
                                        href={hrefFor?.(item.id)}
                                        aria-current={hrefFor && activeId === item.id ? 'page' : undefined}
                                        onClick={() => { if (!hrefFor) onSelect(item.id); }}
                                        className={cn(
                                            'doc-sidebar-link w-full text-left flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all group',
                                            activeId === item.id
                                                ? 'bg-primary/10 text-primary font-medium'
                                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                                        )}
                                    >
                                        <span className="truncate">{getLocalizedDocTitle(lang, item)}</span>
                                        <ChevronRight className={cn('w-3 h-3 shrink-0 transition-transform duration-200', activeId === item.id ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100')} />
                                    </Item>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

            <div className="mt-auto p-4 border-t border-border/50 bg-muted/20">
                <a href={`${publicPath(lang, '/changelog')}#${releaseAnchorId(CURRENT_RELEASE.tag)}`} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <BookOpen className="w-4 h-4" aria-hidden="true" />
                    <span>{CURRENT_RELEASE.tag} · {text.latestRelease}</span>
                </a>
                <a href="https://github.com/KasierBach/Data-Explorer-Editor/issues/new/choose" target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="w-4 h-4" />
                    <span>{text.support}</span>
                </a>
            </div>
        </aside>
    );
}
