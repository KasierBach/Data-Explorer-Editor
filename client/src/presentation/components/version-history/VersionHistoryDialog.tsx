import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, History, RefreshCw, RotateCcw, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type {
    RestoreVersionResponse,
    VersionHistoryDetail,
    VersionHistoryEntry,
    VersionedResourceType,
} from '@/core/domain/entities';
import { ApiError } from '@/core/services/api.service';
import { VersionHistoryService } from '@/core/services/VersionHistoryService';
import { Button } from '@/presentation/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/dialog';
import { cn } from '@/lib/utils';

interface VersionHistoryDialogProps<TResource, TSnapshot = Record<string, unknown>> {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang: 'vi' | 'en';
    title: string;
    resourceType: VersionedResourceType;
    resourceId: string | null;
    emptyMessage: string;
    renderSnapshot: (snapshot: TSnapshot) => React.ReactNode;
    restoreVersion: (resourceId: string, versionId: string) => Promise<RestoreVersionResponse<TResource>>;
    onRestored: (resource: TResource) => void | Promise<void>;
}

export function VersionHistoryDialog<TResource, TSnapshot = Record<string, unknown>>({
    open,
    onOpenChange,
    lang,
    title,
    resourceType,
    resourceId,
    emptyMessage,
    renderSnapshot,
    restoreVersion,
    onRestored,
}: VersionHistoryDialogProps<TResource, TSnapshot>) {
    const queryClient = useQueryClient();
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

    const versionsQuery = useQuery<VersionHistoryEntry[], Error>({
        queryKey: ['version-history', resourceType, resourceId],
        queryFn: () => VersionHistoryService.listVersions(resourceType, resourceId!),
        enabled: open && !!resourceId,
    });

    const versions = versionsQuery.data ?? [];

    useEffect(() => {
        if (!open) {
            setSelectedVersionId(null);
            return;
        }

        if (!versions.some((entry) => entry.id === selectedVersionId)) {
            setSelectedVersionId(versions[0]?.id ?? null);
        }
    }, [open, selectedVersionId, versions]);

    const detailQuery = useQuery<VersionHistoryDetail<TSnapshot>, Error>({
        queryKey: ['version-history', resourceType, resourceId, selectedVersionId],
        queryFn: () => VersionHistoryService.getVersion<TSnapshot>(resourceType, resourceId!, selectedVersionId!),
        enabled: open && !!resourceId && !!selectedVersionId,
    });

    const restoreMutation = useMutation({
        mutationFn: async (version: VersionHistoryEntry) => restoreVersion(resourceId!, version.id),
        onSuccess: async ({ resource, restoredFromVersionNumber }) => {
            await onRestored(resource);
            await queryClient.invalidateQueries({ queryKey: ['version-history', resourceType, resourceId] });
            toast.success(
                lang === 'vi'
                    ? `Da phuc hoi ve ban ${restoredFromVersionNumber}`
                    : `Restored version ${restoredFromVersionNumber}`,
            );
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : 'Failed to restore version';
            toast.error(message);
        },
    });

    const selectedVersion = useMemo(
        () => versions.find((entry) => entry.id === selectedVersionId) ?? null,
        [selectedVersionId, versions],
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

    const ownerLabel = (version: VersionHistoryEntry) =>
        `${version.author.firstName || ''} ${version.author.lastName || ''}`.trim() || version.author.email;

    const unavailableReason =
        versionsQuery.error instanceof ApiError &&
        versionsQuery.error.reason === 'VERSION_HISTORY_STORAGE_UNAVAILABLE';

    const handleRestore = () => {
        if (!selectedVersion || !resourceId) return;
        const confirmed = window.confirm(
            lang === 'vi'
                ? `Phuc hoi ve ban ${selectedVersion.versionNumber}?`
                : `Restore version ${selectedVersion.versionNumber}?`,
        );
        if (!confirmed) return;
        restoreMutation.mutate(selectedVersion);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] max-h-[80vh] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                <DialogHeader className="p-4 pb-2 border-b">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <History className="w-4 h-4 text-blue-500" />
                        {title}
                        {versionsQuery.isFetching && <RefreshCw className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden md:flex-row">
                    <div className="w-full overflow-y-auto border-b md:w-1/2 md:border-b-0 md:border-r">
                        {!resourceId ? (
                            <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                                {lang === 'vi' ? 'Hay chon mot muc da duoc luu truoc.' : 'Select a saved item first.'}
                            </div>
                        ) : versionsQuery.isLoading ? (
                            <div className="flex h-full items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                {lang === 'vi' ? 'Dang tai lich su phien ban...' : 'Loading version history...'}
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                                {emptyMessage}
                            </div>
                        ) : (
                            versions.map((version) => (
                                <div
                                    key={version.id}
                                    onClick={() => setSelectedVersionId(version.id)}
                                    className={cn(
                                        'cursor-pointer border-b border-border/50 px-3 py-2.5 transition-colors',
                                        'hover:bg-accent/50',
                                        selectedVersionId === version.id && 'bg-accent',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium">v{version.versionNumber}</span>
                                        <span className="text-[10px] text-muted-foreground">{formatDate(version.createdAt)}</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                            <UserRound className="h-2.5 w-2.5" />
                                            {ownerLabel(version)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex w-full flex-col overflow-hidden md:w-1/2">
                        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                {lang === 'vi' ? 'Chi tiet' : 'Details'}
                            </span>
                            <Button
                                size="sm"
                                onClick={handleRestore}
                                disabled={!selectedVersion || detailQuery.isLoading || restoreMutation.isPending}
                                className="h-6 gap-1 px-3 text-xs"
                            >
                                {restoreMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                {lang === 'vi' ? 'Phuc hoi' : 'Restore'}
                            </Button>
                        </div>

                        {versionsQuery.error ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
                                <Clock className="h-6 w-6 opacity-40" />
                                <p>{versionsQuery.error.message}</p>
                                {unavailableReason && (
                                    <p className="text-xs opacity-70">
                                        {lang === 'vi'
                                            ? 'Can sync schema backend de kich hoat kho version history.'
                                            : 'Sync the backend schema to enable version history storage.'}
                                    </p>
                                )}
                            </div>
                        ) : detailQuery.isLoading ? (
                            <div className="flex h-full items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                {lang === 'vi' ? 'Dang tai ban chup...' : 'Loading snapshot...'}
                            </div>
                        ) : detailQuery.data ? (
                            <div className="flex-1 overflow-auto bg-muted/10 p-3 text-xs">
                                {renderSnapshot(detailQuery.data.snapshot)}
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
                                {lang === 'vi' ? 'Chon mot phien ban de xem.' : 'Select a version to preview.'}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
