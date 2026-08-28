import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryService, type ActiveQuery } from '@/core/services/QueryService';
import { Loader2, Play, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ActiveQueriesPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function formatElapsed(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;
    return `${minutes}m ${remainSeconds}s`;
}

export const ActiveQueriesPanel: React.FC<ActiveQueriesPanelProps> = ({
    open,
    onOpenChange,
}) => {
    const queryClient = useQueryClient();
    const [cancellingId, setCancellingId] = React.useState<string | null>(null);

    const { data: activeQueries, isLoading } = useQuery({
        queryKey: ['active-queries'],
        queryFn: () => queryService.getActiveQueries(),
        enabled: open,
        refetchInterval: 2000, // Poll while the panel is open
    });

    const handleCancel = async (queryId: string) => {
        setCancellingId(queryId);
        try {
            const cancelled = await queryService.cancelQuery(queryId);
            if (cancelled) {
                toast.success('Query cancellation issued');
            } else {
                toast.info(
                    'Query finished before cancellation, or the engine does not support cancellation',
                );
            }
            await queryClient.invalidateQueries({ queryKey: ['active-queries'] });
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Failed to cancel query',
            );
        } finally {
            setCancellingId(null);
        }
    };

    const queries: ActiveQuery[] = activeQueries ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        Active Queries
                    </DialogTitle>
                    <DialogDescription>
                        Queries currently running on your connections. Polls
                        every 2 seconds.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto space-y-2">
                    {isLoading && (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading active queries...
                        </div>
                    )}

                    {!isLoading && queries.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No queries are currently running.
                        </div>
                    )}

                    {queries.map((query) => (
                        <div
                            key={query.queryId}
                            className="flex items-start gap-3 rounded-md border p-3"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-mono">
                                        {query.connectionId.slice(0, 8)}
                                    </span>
                                    <span>•</span>
                                    <span>
                                        {formatElapsed(query.elapsedMs)}
                                    </span>
                                </div>
                                <pre className="mt-1 text-xs font-mono whitespace-pre-wrap break-all line-clamp-3">
                                    {query.sql}
                                </pre>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={cancellingId !== null}
                                onClick={() => handleCancel(query.queryId)}
                            >
                                {cancellingId === query.queryId ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <XCircle className="h-3 w-3" />
                                )}
                                Cancel
                            </Button>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
};
