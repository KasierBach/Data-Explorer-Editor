import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { useAppStore } from '@/core/services/store';
import { Trash2, Play, Copy, Search, Clock, CheckCircle, XCircle } from 'lucide-react';

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
    const { queryHistory, clearQueryHistory } = useAppStore();
    const [search, setSearch] = useState('');

    const filtered = queryHistory.filter(h =>
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
                        Query History
                        <span className="text-xs text-muted-foreground font-normal ml-2">
                            ({queryHistory.length} entries)
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search queries..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-8 text-xs"
                        />
                    </div>
                    {queryHistory.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearQueryHistory}
                            className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1"
                        >
                            <Trash2 className="w-3 h-3" />
                            Clear All
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-auto space-y-1 min-h-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            {queryHistory.length === 0 ? 'No queries executed yet' : 'No matching queries'}
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
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                                        <span>{formatTime(entry.executedAt)}</span>
                                        {entry.durationMs !== undefined && <span>{entry.durationMs}ms</span>}
                                        {entry.rowCount !== undefined && <span>{entry.rowCount} rows</span>}
                                        {entry.connectionName && <span className="text-blue-500">{entry.connectionName}</span>}
                                        {entry.database && <span>({entry.database})</span>}
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
