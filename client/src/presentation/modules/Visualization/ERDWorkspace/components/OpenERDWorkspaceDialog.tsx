import React, { useEffect, useMemo, useState } from 'react';
import { Search, FolderOpen, Trash2, Clock, Database, UserRound, StickyNote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import type { ErdWorkspaceEntity } from '@/core/domain/entities';
import { VersionHistoryDialog } from '@/presentation/components/version-history/VersionHistoryDialog';
import { VersionHistoryService } from '@/core/services/VersionHistoryService';
import { cn } from '@/lib/utils';
import { useResourcePresence } from '@/presentation/hooks/useResourcePresence';
import { PresenceBadge } from '@/presentation/components/presence/PresenceBadge';

interface OpenErdWorkspaceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang: 'vi' | 'en';
    workspaces: ErdWorkspaceEntity[];
    onOpenWorkspace: (workspace: ErdWorkspaceEntity) => Promise<void> | void;
    onDeleteWorkspace: (workspace: ErdWorkspaceEntity) => Promise<void> | void;
    onRestoreWorkspace: (workspace: ErdWorkspaceEntity) => Promise<void> | void;
}

export const OpenErdWorkspaceDialog: React.FC<OpenErdWorkspaceDialogProps> = ({
    open,
    onOpenChange,
    lang,
    workspaces,
    onOpenWorkspace,
    onDeleteWorkspace,
    onRestoreWorkspace,
}) => {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

    useEffect(() => {
        if (open) {
            setSearch('');
            setPendingDeleteId(null);
            setSelectedId((prev) => prev ?? workspaces[0]?.id ?? null);
        }
    }, [open, workspaces]);

    const filtered = useMemo(() => {
        if (!search.trim()) return workspaces;
        const term = search.toLowerCase();
        return workspaces.filter((workspace) =>
            workspace.name.toLowerCase().includes(term) ||
            workspace.database?.toLowerCase().includes(term) ||
            workspace.notes?.toLowerCase().includes(term) ||
            workspace.owner.email.toLowerCase().includes(term),
        );
    }, [search, workspaces]);

    useEffect(() => {
        if (!filtered.some((workspace) => workspace.id === selectedId)) {
            setSelectedId(filtered[0]?.id ?? null);
        }
    }, [filtered, selectedId]);

    const selectedWorkspace = filtered.find((workspace) => workspace.id === selectedId) ?? filtered[0] ?? null;
    const workspacePresence = useResourcePresence(
        selectedWorkspace?.organizationId && selectedWorkspace?.id
            ? {
                organizationId: selectedWorkspace.organizationId,
                resourceType: 'ERD',
                resourceId: selectedWorkspace.id,
            }
            : null,
        {
            enabled: Boolean(selectedWorkspace?.organizationId && selectedWorkspace?.id),
            intervalMs: 20_000,
        },
    );

    const formatDate = (value: string) => {
        const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
        return new Date(value).toLocaleString(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const ownerLabel = (workspace: ErdWorkspaceEntity) =>
        `${workspace.owner.firstName || ''} ${workspace.owner.lastName || ''}`.trim() || workspace.owner.email;

    const handleDelete = async (workspace: ErdWorkspaceEntity, event: React.MouseEvent) => {
        event.stopPropagation();
        const confirmed = window.confirm(
            lang === 'vi'
                ? `Xoa workspace "${workspace.name}"?`
                : `Delete workspace "${workspace.name}"?`,
        );
        if (!confirmed) return;

        setPendingDeleteId(workspace.id);
        try {
            await onDeleteWorkspace(workspace);
        } finally {
            setPendingDeleteId(null);
        }
    };

    const handleOpen = async (workspace: ErdWorkspaceEntity) => {
        await onOpenWorkspace(workspace);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] max-h-[80vh] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                <DialogHeader className="p-4 pb-2 border-b">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <FolderOpen className="w-4 h-4 text-blue-500" />
                        ERD Workspaces
                    </DialogTitle>
                </DialogHeader>

                <div className="px-4 py-2 border-b">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder={lang === 'vi' ? 'Tim workspace...' : 'Search workspaces...'}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                </div>

                <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden md:flex-row">
                    <div className="w-full overflow-y-auto border-b md:w-1/2 md:border-b-0 md:border-r">
                        {filtered.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-muted-foreground">
                                <FolderOpen className="h-8 w-8 opacity-40" />
                                <p className="text-sm">
                                    {workspaces.length === 0
                                        ? (lang === 'vi' ? 'Chua co workspace ERD nao' : 'No ERD workspaces yet')
                                        : (lang === 'vi' ? 'Khong tim thay workspace nao' : 'No matches found')}
                                </p>
                            </div>
                        ) : (
                            filtered.map((workspace) => (
                                <div
                                    key={workspace.id}
                                    onClick={() => setSelectedId(workspace.id)}
                                    onDoubleClick={() => void handleOpen(workspace)}
                                    className={cn(
                                        'cursor-pointer border-b border-border/50 px-3 py-2.5 transition-colors group',
                                        'hover:bg-accent/50',
                                        selectedId === workspace.id && 'bg-accent',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                            <span className="truncate text-sm font-medium">{workspace.name}</span>
                                        </div>
                                        {workspace.isOwner && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={pendingDeleteId === workspace.id}
                                                onClick={(event) => void handleDelete(workspace, event)}
                                                className="h-6 w-6 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" />
                                            {formatDate(workspace.updatedAt)}
                                        </span>
                                        {workspace.database && (
                                            <span className="flex items-center gap-1">
                                                <Database className="h-2.5 w-2.5" />
                                                {workspace.database}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex w-full flex-col overflow-hidden md:w-1/2">
                        {selectedWorkspace ? (
                            <>
                                <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        {lang === 'vi' ? 'Chi tiet' : 'Preview'}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {selectedWorkspace.organizationId && (
                                            <PresenceBadge
                                                entries={workspacePresence.entries}
                                                isLoading={workspacePresence.isLoading}
                                                label={lang === 'vi' ? 'ERD live' : 'ERD live'}
                                                emptyLabel={lang === 'vi' ? 'Chua co ai mo ERD nay' : 'No one on this ERD'}
                                                className="max-w-[260px]"
                                            />
                                        )}
                                        {selectedWorkspace.isOwner && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setIsVersionHistoryOpen(true)}
                                                className="h-6 gap-1 px-3 text-xs"
                                            >
                                                <Clock className="h-3 w-3" />
                                                {lang === 'vi' ? 'Lich su' : 'History'}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => void handleOpen(selectedWorkspace)}
                                            className="h-6 gap-1 px-3 text-xs"
                                        >
                                            <FolderOpen className="h-3 w-3" />
                                            {lang === 'vi' ? 'Mo' : 'Open'}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2 border-b bg-muted/10 px-3 py-2 text-xs">
                                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                            <UserRound className="h-3 w-3" />
                                            {ownerLabel(selectedWorkspace)}
                                        </span>
                                        {selectedWorkspace.database && (
                                            <span className="rounded-full border border-border/50 px-2 py-0.5">
                                                {selectedWorkspace.database}
                                            </span>
                                        )}
                                    </div>
                                    {selectedWorkspace.notes && (
                                        <div className="space-y-1">
                                            <div className="inline-flex items-center gap-1 text-muted-foreground">
                                                <StickyNote className="h-3 w-3" />
                                                {lang === 'vi' ? 'Ghi chu' : 'Notes'}
                                            </div>
                                            <p className="leading-relaxed text-muted-foreground">{selectedWorkspace.notes}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-2 overflow-auto bg-muted/10 p-3 text-xs text-muted-foreground">
                                    <div>
                                        <span className="font-medium text-foreground">{lang === 'vi' ? 'Bang hien thi' : 'Visible tables'}:</span>{' '}
                                        {Array.isArray(selectedWorkspace.layout?.visibleTables)
                                            ? selectedWorkspace.layout.visibleTables.length
                                            : 0}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">{lang === 'vi' ? 'Node tuy chinh' : 'Saved nodes'}:</span>{' '}
                                        {Array.isArray(selectedWorkspace.layout?.nodes) ? selectedWorkspace.layout.nodes.length : 0}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">{lang === 'vi' ? 'Lien ket thu cong' : 'Manual edges'}:</span>{' '}
                                        {Array.isArray(selectedWorkspace.layout?.edges) ? selectedWorkspace.layout.edges.length : 0}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                {lang === 'vi' ? 'Chon workspace de xem truoc' : 'Select a workspace to preview'}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>

            <VersionHistoryDialog<ErdWorkspaceEntity, {
                name: string;
                notes?: string | null;
                database?: string | null;
                layout?: {
                    visibleTables?: string[];
                    nodes?: unknown[];
                    edges?: unknown[];
                };
            }>
                open={isVersionHistoryOpen}
                onOpenChange={setIsVersionHistoryOpen}
                lang={lang}
                title={lang === 'vi' ? 'Lich su workspace ERD' : 'ERD Workspace History'}
                resourceType="ERD"
                resourceId={selectedWorkspace?.id ?? null}
                emptyMessage={lang === 'vi' ? 'Chua co phien ban nao' : 'No versions yet'}
                restoreVersion={VersionHistoryService.restoreErdWorkspaceVersion}
                onRestored={onRestoreWorkspace}
                renderSnapshot={(snapshot) => (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {lang === 'vi' ? 'Ten workspace' : 'Workspace name'}
                            </div>
                            <div className="font-medium">{snapshot.name}</div>
                        </div>
                        {snapshot.database && (
                            <div className="text-[11px] text-muted-foreground">{snapshot.database}</div>
                        )}
                        {snapshot.notes && (
                            <p className="text-muted-foreground">{snapshot.notes}</p>
                        )}
                        <div className="space-y-1 text-[11px] text-muted-foreground">
                            <div>
                                {lang === 'vi' ? 'Visible tables' : 'Visible tables'}: {snapshot.layout?.visibleTables?.length ?? 0}
                            </div>
                            <div>
                                {lang === 'vi' ? 'Saved nodes' : 'Saved nodes'}: {snapshot.layout?.nodes?.length ?? 0}
                            </div>
                            <div>
                                {lang === 'vi' ? 'Manual edges' : 'Manual edges'}: {snapshot.layout?.edges?.length ?? 0}
                            </div>
                        </div>
                    </div>
                )}
            />
        </Dialog>
    );
};
