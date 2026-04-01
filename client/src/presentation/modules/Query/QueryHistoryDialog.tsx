import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { useAppStore } from '@/core/services/store';
import { adminService } from '@/core/services/AdminService';
import { useQuery } from '@tanstack/react-query';
import { 
    Trash2, Play, Copy, Search, Clock, 
    CheckCircle, XCircle, RefreshCw, Database
} from 'lucide-react';

interface QueryHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRunQuery: (sql: string) => void;
}

export const QueryHistoryDialog: React.FC<QueryHistoryDialogProps> = ({
    open,
    onOpenChange,
    onRunQuery,
}) => {
    const { lang, queryHistory, clearQueryHistory } = useAppStore();
    const [search, setSearch] = useState('');

    // Fetch persistent history from server Audit Logs
    const { data: serverLogs, isLoading, refetch } = useQuery({
        queryKey: ['query-history-server'],
        queryFn: () => adminService.getMyAuditLogs(200),
        enabled: open,
    });

    // Map server logs back to QueryHistoryEntry format
    const serverHistory = useMemo(() => {
        if (!serverLogs) return [];
        return serverLogs.map((log: any) => {
            let details = {};
            try { details = JSON.parse(log.details || '{}'); } catch (e) {}
            
            return {
                id: log.id,
                sql: (details as any).sqlSnippet || (details as any).sql || 'Unknown Query',
                database: (details as any).database,
                connectionName: (details as any).connectionName || 'Database',
                executedAt: new Date(log.createdAt).getTime(),
                status: 'success' as const, // For now assume successful if in logs
                isServerPersisted: true
            };
        });
    }, [serverLogs]);

    // Combine local (very recent) and server (permanent) history
    const mergedHistory = useMemo(() => {
        const combined = [...queryHistory];
        
        // Add server entries that aren't already in local history (rough deduplication by SQL)
        serverHistory.forEach(sEntry => {
            const isAlreadyLocal = combined.some(lEntry => 
                lEntry.sql === sEntry.sql && 
                Math.abs(lEntry.executedAt - sEntry.executedAt) < 5000 // Within 5 seconds
            );
            if (!isAlreadyLocal) {
                combined.push(sEntry);
            }
        });
        
        return combined.sort((a, b) => b.executedAt - a.executedAt);
    }, [queryHistory, serverHistory]);

    const filtered = mergedHistory.filter(h =>
        h.sql.toLowerCase().includes(search.toLowerCase()) ||
        (h.connectionName || '').toLowerCase().includes(search.toLowerCase())
    );

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {lang === 'vi' ? 'Lịch sử Truy vấn' : 'Query History'}
                        <span className="text-xs text-muted-foreground font-normal ml-2">
                            ({mergedHistory.length} {lang === 'vi' ? 'mục' : 'entries'})
                        </span>
                        {isLoading && <RefreshCw className="w-3 h-3 animate-spin ml-auto" />}
                        {!isLoading && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 ml-auto" 
                                onClick={() => refetch()}
                                title={lang === 'vi' ? 'Tải lại' : 'Refresh'}
                            >
                                <RefreshCw className="w-3 h-3" />
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder={lang === 'vi' ? "Tìm kiếm truy vấn..." : "Search queries..."}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-8 text-xs"
                        />
                    </div>
                    {mergedHistory.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearQueryHistory}
                            className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1"
                        >
                            <Trash2 className="w-3 h-3" />
                            {lang === 'vi' ? 'Xóa tất cả' : 'Clear All'}
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-auto space-y-1 min-h-0">
                    {isLoading && mergedHistory.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center gap-2 text-muted-foreground text-sm">
                            <RefreshCw className="w-6 h-6 animate-spin" />
                            <span>{lang === 'vi' ? 'Đang tải lịch sử...' : 'Loading history...'}</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            {mergedHistory.length === 0 ? (lang === 'vi' ? 'Chưa có truy vấn nào' : 'No queries executed yet') : (lang === 'vi' ? 'Không tìm thấy kết quả' : 'No matching queries')}
                        </div>
                    ) : (
                        filtered.map((entry) => (
                            <div
                                key={entry.id}
                                className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/50 transition-colors"
                            >
                                <div className="mt-0.5">
                                    {entry.status === 'success' ? (
                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <pre className="text-xs font-mono bg-muted/30 rounded p-2 overflow-hidden text-ellipsis whitespace-pre-wrap max-h-[60px] text-foreground/80">
                                        {entry.sql}
                                    </pre>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground shrink-0 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatTime(entry.executedAt)}
                                        </span>
                                        {entry.durationMs !== undefined && <span>{entry.durationMs}ms</span>}
                                        {entry.rowCount !== undefined && <span>{entry.rowCount} rows</span>}
                                        {entry.connectionName && (
                                            <span className="flex items-center gap-1 text-blue-500">
                                                <Database className="w-2.5 h-2.5" />
                                                {entry.connectionName}
                                            </span>
                                        )}
                                        {entry.database && <span>({entry.database})</span>}
                                        {(entry as any).isServerPersisted && (
                                            <span className="bg-green-500/10 text-green-600 px-1 rounded border border-green-500/20 text-[9px]">Synced</span>
                                        )}
                                        {entry.errorMessage && (
                                            <span className="text-red-400 truncate max-w-[200px]">{entry.errorMessage}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                            onRunQuery(entry.sql);
                                            onOpenChange(false);
                                        }}
                                        title="Open in Query Editor"
                                    >
                                        <Play className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => navigator.clipboard.writeText(entry.sql)}
                                        title="Copy SQL"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
