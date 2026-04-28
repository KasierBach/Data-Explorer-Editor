import { useEffect, useMemo, useState } from 'react';
import { adminService } from '@/core/services/AdminService';
import { useAppStore } from '@/core/services/store';
import {
    Activity, Database, Eye, Info, MessageSquare, Search, Settings, Shield, Users,
} from 'lucide-react';
import { Input } from '@/presentation/components/ui/input';
import { Button } from '@/presentation/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/presentation/components/ui/dialog';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';

function getLogUserName(log: any) {
    if (!log.user) return '';

    const name = [log.user.firstName, log.user.lastName].filter(Boolean).join(' ').trim();
    return name || log.user.username || log.user.email || '';
}

export function AuditLogsView() {
    const { lang } = useAppStore();
    const { isCompactMobileLayout } = useResponsiveLayoutMode();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'AUTH' | 'DB' | 'TEAM' | 'USER' | 'SYSTEM'>('all');
    const [selectedLog, setSelectedLog] = useState<any>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const data = await adminService.getAuditLogs(200);
            setLogs(data);
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const getLogMetadata = (action: string) => {
        if (action.startsWith('AUTH:')) return { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Shield, label: lang === 'vi' ? 'Bao mat' : 'Security' };
        if (action.startsWith('DB:')) return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Database, label: lang === 'vi' ? 'Du lieu' : 'Data' };
        if (action.startsWith('TEAM:')) return { color: 'text-cyan-500', bg: 'bg-cyan-500/10', icon: MessageSquare, label: lang === 'vi' ? 'Nhom' : 'Team' };
        if (action.startsWith('USER:')) return { color: 'text-orange-500', bg: 'bg-orange-500/10', icon: Users, label: lang === 'vi' ? 'Nguoi dung' : 'User' };
        if (action.startsWith('SYSTEM:')) return { color: 'text-purple-500', bg: 'bg-purple-500/10', icon: Settings, label: lang === 'vi' ? 'He thong' : 'System' };
        return { color: 'text-muted-foreground', bg: 'bg-muted/10', icon: Activity, label: lang === 'vi' ? 'Khac' : 'Other' };
    };

    const filteredLogs = useMemo(() => (
        logs.filter((log) => {
            const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase())
                || getLogUserName(log).toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || log.action.startsWith(`${categoryFilter}:`);
            return matchesSearch && matchesCategory;
        })
    ), [logs, searchTerm, categoryFilter]);

    if (loading) {
        return (
            <div className="space-y-4 p-12 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <p className="animate-pulse text-xs text-muted-foreground">
                    {lang === 'vi' ? 'Dang tai nhat ky...' : 'Loading audit logs...'}
                </p>
            </div>
        );
    }

    return (
        <div className="animate-in space-y-4 fade-in duration-500">
            <div className="flex flex-col items-stretch justify-between gap-4 pb-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground opacity-50" />
                    <Input
                        placeholder={lang === 'vi' ? 'Tim kiem hanh dong hoac nguoi dung...' : 'Search actions or users...'}
                        className="h-9 pl-9 text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="no-scrollbar flex w-full gap-2 overflow-x-auto pb-1 sm:w-auto">
                    {(['all', 'AUTH', 'DB', 'TEAM', 'USER', 'SYSTEM'] as const).map((cat) => (
                        <Button
                            key={cat}
                            variant={categoryFilter === cat ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider"
                            onClick={() => setCategoryFilter(cat)}
                        >
                            {cat === 'all' ? (lang === 'vi' ? 'Tat ca' : 'All') : cat}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 shadow-xl backdrop-blur-md">
                {isCompactMobileLayout ? (
                    <div className="divide-y divide-border/30">
                        {filteredLogs.length === 0 ? (
                            <div className="px-6 py-12 text-center italic text-muted-foreground">
                                {lang === 'vi' ? 'Khong tim thay nhat ky nao phu hop.' : 'No matching audit logs found.'}
                            </div>
                        ) : (
                            filteredLogs.map((log) => {
                                const meta = getLogMetadata(log.action);
                                const Icon = meta.icon;
                                return (
                                    <div key={log.id} className="space-y-3 px-4 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className={cn('rounded-lg p-2', meta.bg)}>
                                                <Icon className={cn('h-4 w-4', meta.color)} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="break-words font-bold text-foreground/90">
                                                    {log.action.split(':').pop()?.replace(/_/g, ' ')}
                                                </div>
                                                <div className={cn('text-[10px] font-black uppercase tracking-tight opacity-70', meta.color)}>
                                                    {meta.label}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedLog(log)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                    {lang === 'vi' ? 'Nguoi dung' : 'User'}
                                                </div>
                                                {log.user ? (
                                                    <div className="mt-1">
                                                        <div className="font-medium text-foreground">
                                                            {getLogUserName(log)}
                                                        </div>
                                                        <div className="break-all text-xs text-muted-foreground/70">{log.user.email}</div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 italic text-muted-foreground/50">System</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                    {lang === 'vi' ? 'IP va thoi gian' : 'IP and time'}
                                                </div>
                                                <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                                                    {log.ipAddress || 'unknown'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="custom-scrollbar overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {lang === 'vi' ? 'Hanh dong' : 'Action'}
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {lang === 'vi' ? 'Nguoi dung' : 'User'}
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {lang === 'vi' ? 'IP va thiet bi' : 'IP & Device'}
                                    </th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {lang === 'vi' ? 'Thoi gian' : 'Time'}
                                    </th>
                                    <th className="w-10 px-3 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center italic text-muted-foreground">
                                            {lang === 'vi' ? 'Khong tim thay nhat ky nao phu hop.' : 'No matching audit logs found.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => {
                                        const meta = getLogMetadata(log.action);
                                        const Icon = meta.icon;
                                        return (
                                            <tr key={log.id} className="group transition-colors hover:bg-primary/5">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn('rounded-lg p-2', meta.bg)}>
                                                            <Icon className={cn('h-4 w-4', meta.color)} />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-foreground/90">
                                                                {log.action.split(':').pop()?.replace(/_/g, ' ')}
                                                            </div>
                                                            <div className={cn('text-[9px] font-black uppercase tracking-tight opacity-70', meta.color)}>
                                                                {meta.label}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {log.user ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-medium text-foreground">{getLogUserName(log)}</div>
                                                            <div className="text-[10px] text-muted-foreground/60">{log.user.email}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="font-medium italic text-muted-foreground/40">System</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-[10px] text-muted-foreground">{log.ipAddress || 'unknown'}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="inline-flex flex-col items-end">
                                                        <div className="font-medium">
                                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground/50">{new Date(log.createdAt).toLocaleDateString()}</div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                                                        onClick={() => setSelectedLog(log)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-[calc(100vw-1rem)] bg-card border-border/50 sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" />
                            {lang === 'vi' ? 'Chi tiet nhat ky' : 'Audit Log Details'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedLog?.action} - {selectedLog?.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : ''}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1 rounded-xl bg-muted/30 p-3">
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                    {lang === 'vi' ? 'Nguoi dung' : 'User'}
                                </div>
                                <div className="text-sm font-bold">
                                    {selectedLog?.user ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : 'System'}
                                </div>
                                <div className="break-all text-xs text-muted-foreground">{selectedLog?.user?.email}</div>
                            </div>
                            <div className="space-y-1 rounded-xl bg-muted/30 p-3">
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                    {lang === 'vi' ? 'Dia chi' : 'Location'}
                                </div>
                                <div className="break-all font-mono text-sm font-bold">{selectedLog?.ipAddress || 'unknown'}</div>
                                <div className="text-xs text-muted-foreground">ID: {selectedLog?.id?.substring(0, 8)}...</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="px-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                {lang === 'vi' ? 'Du lieu chi tiet' : 'Extended Data'}
                            </div>
                            <div className="custom-scrollbar max-h-[300px] overflow-auto rounded-2xl border border-border/30 bg-muted/50 p-4 font-mono text-[11px] whitespace-pre-wrap break-words">
                                {selectedLog?.details ? (
                                    JSON.stringify(JSON.parse(selectedLog.details), null, 4)
                                ) : (
                                    <span className="italic opacity-50">
                                        {lang === 'vi' ? 'Khong co du lieu chi tiet' : 'No extended data available'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
