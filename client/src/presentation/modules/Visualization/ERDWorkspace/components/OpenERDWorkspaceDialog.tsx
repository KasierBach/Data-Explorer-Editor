import React, { useEffect, useMemo, useState } from 'react';
import { Search, FolderOpen, Trash2, Clock, Database, UserRound, StickyNote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import type { ErdWorkspaceEntity } from '@/core/domain/entities';
import { cn } from '@/lib/utils';

interface OpenErdWorkspaceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang: 'vi' | 'en';
    workspaces: ErdWorkspaceEntity[];
    onOpenWorkspace: (workspace: ErdWorkspaceEntity) => Promise<void> | void;
    onDeleteWorkspace: (workspace: ErdWorkspaceEntity) => Promise<void> | void;
}

export const OpenErdWorkspaceDialog: React.FC<OpenErdWorkspaceDialogProps> = ({
    open,
    onOpenChange,
    lang,
    workspaces,
    onOpenWorkspace,
    onDeleteWorkspace,
}) => {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
                ? `Xóa workspace "${workspace.name}"?`
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
                        {lang === 'vi' ? 'ERD Workspaces' : 'ERD Workspaces'}
                    </DialogTitle>
                </DialogHeader>

                <div className="px-4 py-2 border-b">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder={lang === 'vi' ? 'Tìm workspace...' : 'Search workspaces...'}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                </div>

                <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden md:flex-row">
                    <div className="w-full overflow-y-auto border-b md:w-1/2 md:border-b-0 md:border-r">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 px-4">
                                <FolderOpen className="w-8 h-8 opacity-40" />
                                <p className="text-sm">
                                    {workspaces.length === 0
                                        ? (lang === 'vi' ? 'Chưa có workspace ERD nào' : 'No ERD workspaces yet')
                                        : (lang === 'vi' ? 'Không tìm thấy workspace nào' : 'No matches found')}
                                </p>
                            </div>
                        ) : (
                            filtered.map((workspace) => (
                                <div
                                    key={workspace.id}
                                    onClick={() => setSelectedId(workspace.id)}
                                    onDoubleClick={() => void handleOpen(workspace)}
                                    className={cn(
                                        'px-3 py-2.5 cursor-pointer border-b border-border/50 group transition-colors',
                                        'hover:bg-accent/50',
                                        selectedId === workspace.id && 'bg-accent',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <span className="text-sm font-medium truncate">{workspace.name}</span>
                                        </div>
                                        {workspace.isOwner && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={pendingDeleteId === workspace.id}
                                                onClick={(event) => void handleDelete(workspace, event)}
                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatDate(workspace.updatedAt)}
                                        </span>
                                        {workspace.database && (
                                            <span className="flex items-center gap-1">
                                                <Database className="w-2.5 h-2.5" />
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
                                <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {lang === 'vi' ? 'Chi tiết' : 'Preview'}
                                    </span>
                                    <Button
                                        size="sm"
                                        onClick={() => void handleOpen(selectedWorkspace)}
                                        className="h-6 px-3 text-xs gap-1"
                                    >
                                        <FolderOpen className="w-3 h-3" />
                                        {lang === 'vi' ? 'Mở' : 'Open'}
                                    </Button>
                                </div>
                                <div className="px-3 py-2 border-b bg-muted/10 text-xs space-y-2">
                                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                            <UserRound className="w-3 h-3" />
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
                                                <StickyNote className="w-3 h-3" />
                                                {lang === 'vi' ? 'Ghi chú' : 'Notes'}
                                            </div>
                                            <p className="leading-relaxed text-muted-foreground">{selectedWorkspace.notes}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 p-3 text-xs overflow-auto text-muted-foreground bg-muted/10 space-y-2">
                                    <div>
                                        <span className="font-medium text-foreground">{lang === 'vi' ? 'Bảng hiển thị' : 'Visible tables'}:</span>{' '}
                                        {Array.isArray(selectedWorkspace.layout?.visibleTables)
                                            ? selectedWorkspace.layout.visibleTables.length
                                            : 0}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">{lang === 'vi' ? 'Node tùy chỉnh' : 'Saved nodes'}:</span>{' '}
                                        {Array.isArray(selectedWorkspace.layout?.nodes) ? selectedWorkspace.layout.nodes.length : 0}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">{lang === 'vi' ? 'Liên kết thủ công' : 'Manual edges'}:</span>{' '}
                                        {Array.isArray(selectedWorkspace.layout?.edges) ? selectedWorkspace.layout.edges.length : 0}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                {lang === 'vi' ? 'Chọn workspace để xem trước' : 'Select a workspace to preview'}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
