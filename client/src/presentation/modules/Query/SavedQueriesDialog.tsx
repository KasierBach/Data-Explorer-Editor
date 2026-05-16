import React, { useState, useMemo } from 'react';
import { useAppStore, type SavedQuery } from '@/core/services/store';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Search, FileCode, Trash2, FolderOpen, Clock, Database, UserRound, Tags, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SavedQueryService } from '@/core/services/SavedQueryService';
import { toast } from 'sonner';
import { VersionHistoryDialog } from '@/presentation/components/version-history/VersionHistoryDialog';
import { VersionHistoryService } from '@/core/services/VersionHistoryService';

interface SavedQueriesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenQuery: (query: SavedQuery) => void;
    onRestoreQuery: (query: SavedQuery) => void | Promise<void>;
}

export const SavedQueriesDialog: React.FC<SavedQueriesDialogProps> = ({
    open,
    onOpenChange,
    onOpenQuery,
    onRestoreQuery,
}) => {
    const { savedQueries, deleteSavedQuery, lang, pinnedQueryIds, togglePinnedQuery } = useAppStore();
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

    const filtered = useMemo(() => {
        if (!search.trim()) return savedQueries;
        const term = search.toLowerCase();
        return savedQueries.filter(q =>
            q.name.toLowerCase().includes(term) ||
            q.sql.toLowerCase().includes(term) ||
            q.description?.toLowerCase().includes(term) ||
            q.tags.some(tag => tag.toLowerCase().includes(term))
        );
    }, [savedQueries, search]);

    // Sort by most recently updated
    const sorted = useMemo(() =>
        [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [filtered]
    );

    const selectedQuery = sorted.find(q => q.id === selectedId);

    const handleOpen = (query: SavedQuery) => {
        onOpenQuery(query);
        onOpenChange(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await SavedQueryService.deleteSavedQuery(id);
            deleteSavedQuery(id);
            if (selectedId === id) setSelectedId(null);
            toast.success('Saved query deleted');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete saved query');
        }
    };

    const formatDate = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getOwnerLabel = (query: SavedQuery) => {
        const owner = query.owner;
        if (!owner) return 'Unknown owner';
        return `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] max-h-[80vh] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="p-4 pb-2 border-b">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <FolderOpen className="w-4 h-4 text-blue-500" />
                        Saved Queries
                    </DialogTitle>
                </DialogHeader>

                {/* Search */}
                <div className="px-4 py-2 border-b">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search queries..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                </div>

                <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden md:flex-row">
                    {/* List */}
                    <div className="w-full overflow-y-auto border-b md:w-1/2 md:border-b-0 md:border-r">
                        {sorted.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 px-4">
                                <FileCode className="w-8 h-8 opacity-40" />
                                <p className="text-sm">
                                    {savedQueries.length === 0
                                        ? "No saved queries yet"
                                        : "No matches found"}
                                </p>
                                {savedQueries.length === 0 && (
                                    <p className="text-xs text-center opacity-60">
                                        Use Ctrl+S in the Query Editor to save your first query
                                    </p>
                                )}
                            </div>
                        ) : (
                            sorted.map((q) => (
                                <div
                                    key={q.id}
                                    onClick={() => setSelectedId(q.id)}
                                    onDoubleClick={() => handleOpen(q)}
                                    className={cn(
                                        "px-3 py-2.5 cursor-pointer border-b border-border/50 group transition-colors",
                                        "hover:bg-accent/50",
                                        selectedId === q.id && "bg-accent"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <FileCode className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <span className="text-sm font-medium truncate">{q.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePinnedQuery(q.id);
                                                }}
                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                                                title={pinnedQueryIds.includes(q.id) ? (lang === 'vi' ? 'Bo pin' : 'Unpin') : (lang === 'vi' ? 'Pin' : 'Pin')}
                                            >
                                                {pinnedQueryIds.includes(q.id) ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                                            </Button>
                                            {q.isOwner && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => void handleDelete(q.id, e)}
                                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatDate(q.updatedAt)}
                                        </span>
                                        {q.database && (
                                            <span className="flex items-center gap-1">
                                                <Database className="w-2.5 h-2.5" />
                                                {q.database}
                                            </span>
                                        )}
                                        <span className="rounded-full border border-border/50 px-1.5 py-0.5 uppercase tracking-wide">
                                            {q.visibility}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Preview */}
                    <div className="flex w-full flex-col overflow-hidden md:w-1/2">
                        {selectedQuery ? (
                            <>
                                <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</span>
                                    <div className="flex items-center gap-2">
                                        {selectedQuery.isOwner && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setIsVersionHistoryOpen(true)}
                                                className="h-6 px-3 text-xs gap-1"
                                            >
                                                <Clock className="w-3 h-3" />
                                                {lang === 'vi' ? 'Lich su' : 'History'}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => handleOpen(selectedQuery)}
                                            className="h-6 px-3 text-xs gap-1"
                                        >
                                            <FolderOpen className="w-3 h-3" />
                                            Open
                                        </Button>
                                    </div>
                                </div>
                                <div className="px-3 py-2 border-b bg-muted/10 text-xs space-y-2">
                                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                            <UserRound className="w-3 h-3" />
                                            {getOwnerLabel(selectedQuery)}
                                        </span>
                                        <span className="rounded-full border border-border/50 px-2 py-0.5 uppercase tracking-wide">
                                            {selectedQuery.visibility}
                                        </span>
                                        {selectedQuery.folderId && (
                                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-blue-400">
                                                {selectedQuery.folderId}
                                            </span>
                                        )}
                                    </div>
                                    {selectedQuery.tags.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Tags className="w-3 h-3 text-muted-foreground" />
                                            {selectedQuery.tags.map((tag) => (
                                                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {selectedQuery.description && (
                                        <p className="text-muted-foreground leading-relaxed">{selectedQuery.description}</p>
                                    )}
                                </div>
                                <pre className="flex-1 p-3 text-xs font-mono overflow-auto whitespace-pre-wrap text-foreground/80 bg-muted/10">
                                    {selectedQuery.sql}
                                </pre>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                Select a query to preview
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
            <VersionHistoryDialog<SavedQuery, {
                name: string;
                sql: string;
                database?: string | null;
                visibility: string;
                tags?: string[];
                description?: string | null;
            }>
                open={isVersionHistoryOpen}
                onOpenChange={setIsVersionHistoryOpen}
                lang={lang}
                title={lang === 'vi' ? 'Lich su saved query' : 'Saved Query History'}
                resourceType="QUERY"
                resourceId={selectedQuery?.id ?? null}
                emptyMessage={lang === 'vi' ? 'Chua co phien ban nao' : 'No versions yet'}
                restoreVersion={VersionHistoryService.restoreSavedQueryVersion}
                onRestored={onRestoreQuery}
                renderSnapshot={(snapshot) => (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {lang === 'vi' ? 'Ten' : 'Name'}
                            </div>
                            <div className="font-medium">{snapshot.name}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                            {snapshot.database && (
                                <span className="rounded-full border border-border/50 px-2 py-0.5">
                                    {snapshot.database}
                                </span>
                            )}
                            <span className="rounded-full border border-border/50 px-2 py-0.5 uppercase tracking-wide">
                                {snapshot.visibility}
                            </span>
                            {(snapshot.tags ?? []).map((tag) => (
                                <span key={tag} className="rounded-full bg-muted px-2 py-0.5">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        {snapshot.description && (
                            <p className="text-muted-foreground">{snapshot.description}</p>
                        )}
                        <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 font-mono text-[11px] text-foreground/80">
                            {snapshot.sql}
                        </pre>
                    </div>
                )}
            />
        </Dialog>
    );
};
