import React, { useState, useMemo, useSyncExternalStore } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Badge } from '@/presentation/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/presentation/components/ui/select';
import { useAppStore, type QueryHistoryEntry } from '@/core/services/store';
import { adminService, type AuditLogEntry } from '@/core/services/AdminService';
import { useQuery } from '@tanstack/react-query';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Trash2,
    Play,
    Copy,
    Search,
    Clock,
    CheckCircle,
    XCircle,
    RefreshCw,
    Database,
    Sparkles,
    FilterX,
    Code2,
    Activity,
    Layers,
} from 'lucide-react';

// External "current time" store so relative time filters can read a timestamp
// without calling Date.now() during render (React purity rule).
let cachedNow = Date.now();
let nowTimer: ReturnType<typeof setInterval> | null = null;
const nowListeners = new Set<() => void>();
const MINUTE_MS = 60_000;

function subscribeNow(onChange: () => void): () => void {
    if (nowListeners.size === 0) {
        cachedNow = Date.now();
        nowTimer = setInterval(() => {
            cachedNow = Date.now();
            nowListeners.forEach((listener) => listener());
        }, MINUTE_MS);
    }
    nowListeners.add(onChange);
    return () => {
        nowListeners.delete(onChange);
        if (nowListeners.size === 0 && nowTimer !== null) {
            clearInterval(nowTimer);
            nowTimer = null;
        }
    };
}

const getSnapshotNow = () => cachedNow;

interface QueryHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRunQuery: (sql: string) => void;
    onExplainQuery?: (sql: string) => void;
}

type ExtendedHistoryEntry = QueryHistoryEntry & { isServerPersisted?: boolean };

function parseAuditDetails(log: AuditLogEntry): Record<string, unknown> {
    try {
        return JSON.parse(log.details || '{}') as Record<string, unknown>;
    } catch {
        return {};
    }
}

export const QueryHistoryDialog: React.FC<QueryHistoryDialogProps> = ({
    open,
    onOpenChange,
    onRunQuery,
    onExplainQuery,
}) => {
    const { lang, queryHistory, clearQueryHistory } = useAppStore();
    const text = getWorkspaceText(lang).queryHistory;

    // Filters state
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
    const [connectionFilter, setConnectionFilter] = useState<string>('all');
    const [timeRange, setTimeRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'slowest' | 'fastest' | 'mostRows'>('newest');
    const nowTs = useSyncExternalStore(subscribeNow, getSnapshotNow, () => 0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeDetailTab, setActiveDetailTab] = useState<'sql' | 'error'>('sql');


    // Fetch persistent history from server Audit Logs
    const { data: serverLogs, isLoading, refetch } = useQuery({
        queryKey: ['query-history-server'],
        queryFn: () => adminService.getMyAuditLogs(200),
        enabled: open,
    });

    // Map server logs back to QueryHistoryEntry format
    const serverHistory = useMemo<ExtendedHistoryEntry[]>(() => {
        if (!serverLogs) return [];
        return serverLogs.map((log) => {
            const details = parseAuditDetails(log);

            const durationMs =
                typeof details.durationMs === 'number'
                    ? details.durationMs
                    : typeof details.duration === 'number'
                        ? details.duration
                        : typeof details.executionTime === 'number'
                            ? details.executionTime
                            : undefined;

            const rowCount =
                typeof details.rowCount === 'number'
                    ? details.rowCount
                    : typeof details.rows === 'number'
                        ? details.rows
                        : undefined;

            const database = String(details.database || details.db || details.dbName || '');
            const connectionName = String(details.connectionName || details.connName || text.databaseFallback);

            return {
                id: log.id,
                sql: String(details.sql || details.sqlSnippet || text.unknownQuery),
                database: database || undefined,
                connectionName: connectionName,
                executedAt: new Date(log.createdAt).getTime(),
                durationMs,
                rowCount,
                status: 'success' as const,
                isServerPersisted: true,
            };
        });
    }, [serverLogs, text.databaseFallback, text.unknownQuery]);

    // Combine local (recent) and server history with rough deduplication
    const mergedHistory = useMemo<ExtendedHistoryEntry[]>(() => {
        const combined: ExtendedHistoryEntry[] = [...queryHistory];

        serverHistory.forEach((sEntry) => {
            const isAlreadyLocal = combined.some(
                (lEntry) =>
                    lEntry.sql === sEntry.sql &&
                    Math.abs(lEntry.executedAt - sEntry.executedAt) < 5000
            );
            if (!isAlreadyLocal) {
                combined.push(sEntry);
            }
        });

        return combined;
    }, [queryHistory, serverHistory]);

    // Extract unique connection names for filter dropdown
    const availableConnections = useMemo(() => {
        const set = new Set<string>();
        mergedHistory.forEach((item) => {
            if (item.connectionName) set.add(item.connectionName);
        });
        return Array.from(set).sort();
    }, [mergedHistory]);

    // Filter & Sort
    const filteredHistory = useMemo(() => {
        const now = nowTs;
        const startOfToday = new Date(nowTs).setHours(0, 0, 0, 0);

        return mergedHistory
            .filter((item) => {
                // Search filter
                if (search.trim()) {
                    const term = search.toLowerCase();
                    const matchSql = item.sql.toLowerCase().includes(term);
                    const matchConn = (item.connectionName || '').toLowerCase().includes(term);
                    const matchDb = (item.database || '').toLowerCase().includes(term);
                    const matchErr = (item.errorMessage || '').toLowerCase().includes(term);
                    if (!matchSql && !matchConn && !matchDb && !matchErr) return false;
                }

                // Status filter
                if (statusFilter !== 'all' && item.status !== statusFilter) {
                    return false;
                }

                // Connection filter
                if (connectionFilter !== 'all' && item.connectionName !== connectionFilter) {
                    return false;
                }

                // Time range filter
                if (timeRange === 'today' && item.executedAt < startOfToday) {
                    return false;
                }
                if (timeRange === '7days' && item.executedAt < now - 7 * 86400000) {
                    return false;
                }
                if (timeRange === '30days' && item.executedAt < now - 30 * 86400000) {
                    return false;
                }

                return true;
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'oldest':
                        return a.executedAt - b.executedAt;
                    case 'slowest':
                        return (b.durationMs || 0) - (a.durationMs || 0);
                    case 'fastest':
                        return (a.durationMs || 0) - (b.durationMs || 0);
                    case 'mostRows':
                        return (b.rowCount || 0) - (a.rowCount || 0);
                    case 'newest':
                    default:
                        return b.executedAt - a.executedAt;
                }
            });
    }, [mergedHistory, search, statusFilter, connectionFilter, timeRange, sortBy, nowTs]);

    // Active selected query
    const selectedQuery = useMemo(() => {
        if (!filteredHistory.length) return null;
        if (selectedId) {
            const found = filteredHistory.find((item) => item.id === selectedId);
            if (found) return found;
        }
        return filteredHistory[0];
    }, [filteredHistory, selectedId]);

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleString(text.timeLocale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const handleCopy = (sql: string) => {
        void navigator.clipboard.writeText(sql);
        toast.success(text.copied);
    };

    const handleOpenInEditor = (sql: string) => {
        onRunQuery(sql);
        onOpenChange(false);
    };

    const handleExplainWithAi = (sql: string) => {
        if (onExplainQuery) {
            onExplainQuery(sql);
            onOpenChange(false);
        }
    };

    const hasActiveFilters =
        search.trim() !== '' ||
        statusFilter !== 'all' ||
        connectionFilter !== 'all' ||
        timeRange !== 'all' ||
        sortBy !== 'newest';

    const resetFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setConnectionFilter('all');
        setTimeRange('all');
        setSortBy('newest');
    };

    const selectedLines = selectedQuery?.sql ? selectedQuery.sql.split('\n') : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[92vw] max-w-[1140px] top-[75px] sm:top-[75px] translate-y-0 h-[calc(100vh-160px)] max-h-[740px] min-h-[580px] flex flex-col gap-0 overflow-hidden p-0 rounded-2xl shadow-2xl border border-border/80">
                {/* Header */}
                <DialogHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <div>
                            <DialogTitle className="text-base flex items-center gap-2">
                                {text.title}
                                <Badge variant="secondary" className="text-xs font-normal">
                                    {text.entryCount(filteredHistory.length)}
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                {text.description}
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 mr-6">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isLoading}
                            className="h-8 px-2.5 text-xs gap-1.5"
                            title={text.refresh}
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                            <span className="hidden sm:inline">{text.refresh}</span>
                        </Button>
                        {mergedHistory.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearQueryHistory}
                                className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{text.clearAll}</span>
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                {/* Filter Toolbar */}
                <div className="p-3 border-b bg-muted/20 flex flex-wrap items-center gap-2 text-xs">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[170px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder={text.searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-xs bg-background"
                        />
                    </div>

                    {/* Status Filter */}
                    <Select
                        value={statusFilter}
                        onValueChange={(val) => setStatusFilter(val as 'all' | 'success' | 'error')}
                    >
                        <SelectTrigger className="h-8 text-xs w-[145px] bg-background">
                            <SelectValue placeholder={text.statusFilter} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{text.statusAll}</SelectItem>
                            <SelectItem value="success">
                                <span className="flex items-center gap-1.5 text-green-600">
                                    <CheckCircle className="w-3 h-3" />
                                    {text.statusSuccess}
                                </span>
                            </SelectItem>
                            <SelectItem value="error">
                                <span className="flex items-center gap-1.5 text-red-500">
                                    <XCircle className="w-3 h-3" />
                                    {text.statusError}
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Time Range Filter */}
                    <Select
                        value={timeRange}
                        onValueChange={(val) => setTimeRange(val as 'all' | 'today' | '7days' | '30days')}
                    >
                        <SelectTrigger className="h-8 text-xs w-[115px] bg-background">
                            <SelectValue placeholder={text.timeRange} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{text.timeAll}</SelectItem>
                            <SelectItem value="today">{text.timeToday}</SelectItem>
                            <SelectItem value="7days">{text.time7Days}</SelectItem>
                            <SelectItem value="30days">{text.time30Days}</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Connection Filter */}
                    {availableConnections.length > 0 && (
                        <Select value={connectionFilter} onValueChange={setConnectionFilter}>
                            <SelectTrigger className="h-8 text-xs w-[150px] bg-background truncate">
                                <SelectValue placeholder={text.connectionFilter} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{text.connectionFilter}</SelectItem>
                                {availableConnections.map((conn) => (
                                    <SelectItem key={conn} value={conn}>
                                        {conn}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Sort By */}
                    <Select
                        value={sortBy}
                        onValueChange={(val) =>
                            setSortBy(val as 'newest' | 'oldest' | 'slowest' | 'fastest' | 'mostRows')
                        }
                    >
                        <SelectTrigger className="h-8 text-xs w-[120px] bg-background">
                            <SelectValue placeholder={text.sortBy} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">{text.sortNewest}</SelectItem>
                            <SelectItem value="oldest">{text.sortOldest}</SelectItem>
                            <SelectItem value="slowest">{text.sortSlowest}</SelectItem>
                            <SelectItem value="fastest">{text.sortFastest}</SelectItem>
                            <SelectItem value="mostRows">{text.sortMostRows}</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Reset Filters */}
                    {hasActiveFilters && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetFilters}
                            className="h-8 px-2.5 text-xs text-muted-foreground gap-1 hover:text-foreground"
                            title={text.clearFilters}
                        >
                            <FilterX className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{text.clearFilters}</span>
                        </Button>
                    )}
                </div>

                {/* Master-Detail Layout */}
                <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
                    {/* Left: List of Queries */}
                    <div className="w-full md:w-[38%] overflow-y-auto border-b md:border-b-0 md:border-r bg-muted/5">
                        {isLoading && mergedHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-muted-foreground text-sm">
                                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                                <span>{text.loading}</span>
                            </div>
                        ) : filteredHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-muted-foreground text-sm px-4 text-center">
                                <Code2 className="w-8 h-8 opacity-40" />
                                <span>{mergedHistory.length === 0 ? text.empty : text.noMatches}</span>
                                {hasActiveFilters && (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={resetFilters}
                                        className="text-xs h-auto p-0 mt-1"
                                    >
                                        {text.clearFilters}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {filteredHistory.map((item) => {
                                    const isSelected = selectedQuery?.id === item.id;
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedId(item.id)}
                                            onDoubleClick={() => handleOpenInEditor(item.sql)}
                                            className={cn(
                                                'group p-3 cursor-pointer transition-colors relative',
                                                'hover:bg-accent/40',
                                                isSelected && 'bg-accent/80 border-l-2 border-primary'
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className="mt-0.5 shrink-0">
                                                    {item.status === 'success' ? (
                                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                                    ) : (
                                                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-mono text-foreground/90 line-clamp-2 leading-relaxed break-all">
                                                        {item.sql}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-2.5 h-2.5" />
                                                            {formatTime(item.executedAt)}
                                                        </span>
                                                        {item.durationMs !== undefined && (
                                                            <span className="font-mono">{item.durationMs}ms</span>
                                                        )}
                                                        {item.rowCount !== undefined && (
                                                            <span>
                                                                {item.rowCount} {text.rowsLabel}
                                                            </span>
                                                        )}
                                                        {item.connectionName && (
                                                            <span className="flex items-center gap-1 text-blue-500 font-medium">
                                                                <Database className="w-2.5 h-2.5" />
                                                                {item.connectionName}
                                                            </span>
                                                        )}
                                                        {item.isServerPersisted && (
                                                            <span className="bg-green-500/10 text-green-600 px-1 rounded text-[9px] border border-green-500/20">
                                                                {text.synced}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right: Full Detail & SQL Inspection */}
                    <div className="w-full md:w-[62%] flex flex-col overflow-hidden bg-background">
                        {selectedQuery ? (
                            <>
                                {/* Top Detail Toolbar */}
                                <div className="p-3 border-b bg-muted/30 flex items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'text-[11px] font-medium gap-1 px-2 py-0.5 shrink-0',
                                                selectedQuery.status === 'success'
                                                    ? 'border-green-500/30 text-green-600 bg-green-500/5'
                                                    : 'border-red-500/30 text-red-500 bg-red-500/5'
                                            )}
                                        >
                                            {selectedQuery.status === 'success' ? (
                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <XCircle className="w-3 h-3 text-red-500" />
                                            )}
                                            {selectedQuery.status === 'success'
                                                ? text.statusSuccess
                                                : text.statusError}
                                        </Badge>
                                        <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                                            {formatTime(selectedQuery.executedAt)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {onExplainQuery && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleExplainWithAi(selectedQuery.sql)}
                                                className="h-7.5 px-2.5 text-xs gap-1 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                                                title={text.explainWithAi}
                                            >
                                                <Sparkles className="w-3 h-3" />
                                                <span className="hidden sm:inline">{text.explainWithAi}</span>
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCopy(selectedQuery.sql)}
                                            className="h-7.5 px-2.5 text-xs gap-1"
                                            title={text.copySql}
                                        >
                                            <Copy className="w-3 h-3" />
                                            <span className="hidden sm:inline">{text.copySql}</span>
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleOpenInEditor(selectedQuery.sql)}
                                            className="h-7.5 px-2.5 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                                            title={text.openInEditor}
                                        >
                                            <Play className="w-3 h-3" />
                                            <span>{text.openInEditor}</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Metadata metrics strip */}
                                <div className="px-4 py-2 border-b bg-muted/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            {text.duration}
                                        </span>
                                        <div className="font-mono font-medium flex items-center gap-1">
                                            <Activity className="w-3 h-3 text-muted-foreground" />
                                            {selectedQuery.durationMs !== undefined
                                                ? `${selectedQuery.durationMs}ms`
                                                : '—'}
                                        </div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            {text.rowCount}
                                        </span>
                                        <div className="font-mono font-medium flex items-center gap-1">
                                            <Layers className="w-3 h-3 text-muted-foreground" />
                                            {selectedQuery.rowCount !== undefined
                                                ? `${selectedQuery.rowCount} ${text.rowsLabel}`
                                                : '—'}
                                        </div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            {text.connection}
                                        </span>
                                        <div className="font-medium text-blue-500 truncate flex items-center gap-1">
                                            <Database className="w-3 h-3 shrink-0" />
                                            <span className="truncate">
                                                {selectedQuery.connectionName || text.databaseFallback}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                            {text.database}
                                        </span>
                                        <div className="font-medium text-muted-foreground truncate">
                                            {selectedQuery.database || '—'}
                                        </div>
                                    </div>
                                </div>

                                {/* Detail Content: Tab Navigation (SQL vs Full Error) */}
                                {(() => {
                                    const effectiveDetailTab =
                                        selectedQuery.errorMessage && activeDetailTab === 'error' ? 'error' : 'sql';

                                    return (
                                        <div className="flex-1 p-3 overflow-hidden min-h-0 flex flex-col">
                                            <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden flex flex-col flex-1 min-h-0">
                                                {/* Header Tabs */}
                                                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/50 bg-muted/40 text-[11px] text-muted-foreground shrink-0">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveDetailTab('sql')}
                                                            className={cn(
                                                                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                                                                effectiveDetailTab === 'sql'
                                                                    ? 'bg-background text-foreground shadow-xs'
                                                                    : 'text-muted-foreground hover:text-foreground'
                                                            )}
                                                        >
                                                            <Code2 className="w-3.5 h-3.5 text-blue-500" />
                                                            <span>{text.fullSql}</span>
                                                            <span className="text-[10px] text-muted-foreground ml-0.5">
                                                                ({selectedLines.length})
                                                            </span>
                                                        </button>

                                                        {selectedQuery.errorMessage && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveDetailTab('error')}
                                                                className={cn(
                                                                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                                                                    effectiveDetailTab === 'error'
                                                                        ? 'bg-destructive/15 text-destructive border border-destructive/30 shadow-xs'
                                                                        : 'text-destructive/80 hover:text-destructive hover:bg-destructive/10'
                                                                )}
                                                            >
                                                                <XCircle className="w-3.5 h-3.5 text-destructive" />
                                                                <span>{lang === 'vi' ? 'Chi tiết lỗi' : 'Error details'}</span>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {effectiveDetailTab === 'error' && selectedQuery.errorMessage ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-5 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 gap-1"
                                                            onClick={() => handleCopy(selectedQuery.errorMessage!)}
                                                            title={text.copyErrorTitle}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                            <span>{lang === 'vi' ? 'Sao chép lỗi' : 'Copy error'}</span>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground pr-1">
                                                            {selectedLines.length} lines
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Tab Body */}
                                                {effectiveDetailTab === 'sql' ? (
                                                    <div className="overflow-auto flex-1 min-h-0">
                                                        <div className="grid min-w-full grid-cols-[48px_minmax(0,1fr)] font-mono text-xs leading-6 select-text">
                                                            {selectedLines.map((line, index) => (
                                                                <React.Fragment key={`${index + 1}-${line}`}>
                                                                    <div className="select-none border-r border-border/40 bg-muted/30 px-2.5 text-right text-[11px] text-muted-foreground">
                                                                        {index + 1}
                                                                    </div>
                                                                    <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-0 text-foreground font-mono">
                                                                        {line || '\u00A0'}
                                                                    </pre>
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="overflow-auto flex-1 min-h-0 p-3.5 font-mono text-xs text-destructive/95 leading-relaxed bg-destructive/5 select-text">
                                                        <div className="flex items-start gap-2.5">
                                                            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                                            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed flex-1">
                                                                {selectedQuery.errorMessage}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground text-xs gap-2">
                                <Code2 className="w-10 h-10 opacity-30" />
                                <span>{text.selectToPreview}</span>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

