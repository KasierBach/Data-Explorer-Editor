import React, { useMemo } from 'react';
import { Clock3, FolderOpen, Pin, PinOff, Play, LayoutGrid, Tag, LibraryBig } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import type { QueryHistoryEntry, SavedQuery } from '@/core/services/store';
import { cn } from '@/lib/utils';

interface QueryProjectPanelProps {
    lang: 'vi' | 'en';
    savedQueries: SavedQuery[];
    queryHistory: QueryHistoryEntry[];
    pinnedQueryIds: string[];
    currentSavedQueryId: string | null;
    onOpenQuery: (query: SavedQuery) => void;
    onRunQuery: (sql: string) => void;
    onTogglePinnedQuery: (queryId: string) => void;
    onOpenSavedQueries: () => void;
}

function formatRelativeTime(timestamp: number) {
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
}

function SectionCard({
    title,
    icon: Icon,
    count,
    children,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-lg border border-border/60 bg-background/90 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
                </div>
                {count !== undefined && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {count}
                    </span>
                )}
            </div>
            <div className="space-y-2">{children}</div>
        </section>
    );
}

export function QueryProjectPanel({
    lang,
    savedQueries,
    queryHistory,
    pinnedQueryIds,
    currentSavedQueryId,
    onOpenQuery,
    onRunQuery,
    onTogglePinnedQuery,
    onOpenSavedQueries,
}: QueryProjectPanelProps) {
    const pinnedQueries = useMemo(
        () => pinnedQueryIds
            .map((id) => savedQueries.find((query) => query.id === id))
            .filter((query): query is SavedQuery => Boolean(query)),
        [pinnedQueryIds, savedQueries],
    );

    const recentQueries = useMemo(() => {
        const seen = new Set<string>();
        const unique: QueryHistoryEntry[] = [];
        for (const entry of queryHistory) {
            const key = `${entry.sql}::${entry.database ?? ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(entry);
            if (unique.length >= 5) break;
        }
        return unique;
    }, [queryHistory]);

    const folderGroups = useMemo(() => {
        const grouped = new Map<string, SavedQuery[]>();
        for (const query of savedQueries) {
            const key = query.folderId?.trim() || (lang === 'vi' ? 'Khong thu muc' : 'No folder');
            const bucket = grouped.get(key) ?? [];
            bucket.push(query);
            grouped.set(key, bucket);
        }
        return Array.from(grouped.entries())
            .map(([folderName, items]) => ({ folderName, items }))
            .sort((a, b) => b.items.length - a.items.length);
    }, [savedQueries, lang]);

    const topTags = useMemo(() => {
        const counts = new Map<string, number>();
        for (const query of savedQueries) {
            for (const tag of query.tags) {
                counts.set(tag, (counts.get(tag) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
    }, [savedQueries]);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <LibraryBig className="h-4 w-4 text-primary" />
                        <div className="text-sm font-semibold">
                            {lang === 'vi' ? 'Project query' : 'Query project'}
                        </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        {lang === 'vi'
                            ? 'Lua chon, pin, va mo lai query nhu mot IDE nho gon.'
                            : 'Pin, group, and reopen queries like a lightweight IDE.'}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={onOpenSavedQueries} className="h-8 gap-1.5 px-3 text-xs">
                    <FolderOpen className="h-3.5 w-3.5" />
                    {lang === 'vi' ? 'Mo thu vien' : 'Open library'}
                </Button>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
                <SectionCard title={lang === 'vi' ? 'Da pin' : 'Pinned'} icon={Pin} count={pinnedQueries.length}>
                    {pinnedQueries.length === 0 ? (
                        <div className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                            {lang === 'vi'
                                ? 'Pin query de giu lai cac truy van quan trong.'
                                : 'Pin queries to keep the important ones nearby.'}
                        </div>
                    ) : (
                        pinnedQueries.map((query) => (
                            <div
                                key={query.id}
                                className={cn(
                                    'rounded-md border px-3 py-2 transition-colors',
                                    currentSavedQueryId === query.id ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-muted/20',
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <button
                                        type="button"
                                        className="min-w-0 text-left"
                                        onClick={() => onOpenQuery(query)}
                                    >
                                        <div className="truncate text-sm font-medium">{query.name}</div>
                                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                            {query.folderId || (lang === 'vi' ? 'Khong thu muc' : 'No folder')}
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTogglePinnedQuery(query.id)}>
                                            <PinOff className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenQuery(query)}>
                                            <Play className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </SectionCard>

                <SectionCard title={lang === 'vi' ? 'Gan day' : 'Recent'} icon={Clock3} count={recentQueries.length}>
                    {recentQueries.length === 0 ? (
                        <div className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                            {lang === 'vi'
                                ? 'Chua co lich su chay query.'
                                : 'No query runs yet.'}
                        </div>
                    ) : (
                        recentQueries.map((entry) => (
                            <div key={entry.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                <pre className="max-h-20 overflow-hidden whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground/80">
                                    {entry.sql}
                                </pre>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                        {formatRelativeTime(entry.executedAt)}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 px-2 text-[11px]"
                                        onClick={() => onRunQuery(entry.sql)}
                                    >
                                        <Play className="h-3 w-3" />
                                        {lang === 'vi' ? 'Chay' : 'Run'}
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </SectionCard>

                <SectionCard title={lang === 'vi' ? 'Thu muc' : 'Folders'} icon={LayoutGrid} count={folderGroups.length}>
                    {folderGroups.length === 0 ? (
                        <div className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                            {lang === 'vi'
                                ? 'Ban chua co saved query nao.'
                                : 'No saved queries yet.'}
                        </div>
                    ) : (
                        folderGroups.map((folder) => (
                            <div key={folder.folderName} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{folder.folderName}</div>
                                        <div className="text-[10px] text-muted-foreground">
                                            {folder.items.length} {lang === 'vi' ? 'query' : 'queries'}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {folder.items.slice(0, 3).map((query) => (
                                        <button
                                            key={query.id}
                                            type="button"
                                            onClick={() => onOpenQuery(query)}
                                            className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] hover:border-primary/40 hover:text-primary"
                                        >
                                            {query.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}

                    {topTags.length > 0 && (
                        <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                            <div className="mb-2 flex items-center gap-2">
                                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                    {lang === 'vi' ? 'Tag pho bien' : 'Top tags'}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {topTags.map(([tag, count]) => (
                                    <span
                                        key={tag}
                                        className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                                    >
                                        #{tag} · {count}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </SectionCard>
            </div>
        </div>
    );
}
