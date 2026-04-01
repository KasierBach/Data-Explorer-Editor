import { useState, useEffect, useMemo } from 'react';
import { adminService } from '@/core/services/AdminService';
import { useAppStore } from '@/core/services/store';
import { 
    Activity, Shield, Database, Users, 
    Settings, Search, Eye, Info
} from 'lucide-react';
import { Input } from '@/presentation/components/ui/input';
import { Button } from '@/presentation/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/presentation/components/ui/dialog";
import { cn } from '@/lib/utils';

export function AuditLogsView() {
    const { lang } = useAppStore();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'AUTH' | 'DB' | 'USER' | 'SYSTEM'>('all');
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
        if (action.startsWith('AUTH:')) return { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Shield, label: lang === 'vi' ? 'Bảo mật' : 'Security' };
        if (action.startsWith('DB:')) return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Database, label: lang === 'vi' ? 'Dữ liệu' : 'Data' };
        if (action.startsWith('USER:')) return { color: 'text-orange-500', bg: 'bg-orange-500/10', icon: Users, label: lang === 'vi' ? 'Người dùng' : 'User' };
        if (action.startsWith('SYSTEM:')) return { color: 'text-purple-500', bg: 'bg-purple-500/10', icon: Settings, label: lang === 'vi' ? 'Hệ thống' : 'System' };
        return { color: 'text-muted-foreground', bg: 'bg-muted/10', icon: Activity, label: lang === 'vi' ? 'Khác' : 'Other' };
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (log.user && `${log.user.firstName} ${log.user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = categoryFilter === 'all' || log.action.startsWith(`${categoryFilter}:`);
            return matchesSearch && matchesCategory;
        });
    }, [logs, searchTerm, categoryFilter]);

    if (loading) {
        return (
            <div className="p-12 text-center space-y-4">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-xs text-muted-foreground animate-pulse">
                    {lang === 'vi' ? 'Đang tải nhật ký...' : 'Loading audit logs...'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pb-2">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                    <Input 
                        placeholder={lang === 'vi' ? "Tìm kiếm hành động hoặc người dùng..." : "Search actions or users..."}
                        className="pl-9 h-9 text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 no-scrollbar">
                    {(['all', 'AUTH', 'DB', 'USER', 'SYSTEM'] as const).map((cat) => (
                        <Button 
                            key={cat}
                            variant={categoryFilter === cat ? 'secondary' : 'ghost'}
                            size="sm"
                            className="text-[10px] uppercase font-bold tracking-wider px-3 h-8"
                            onClick={() => setCategoryFilter(cat)}
                        >
                            {cat === 'all' ? (lang === 'vi' ? 'Tất cả' : 'All') : cat}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="bg-card/50 backdrop-blur-md rounded-xl border border-border/50 shadow-xl overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="border-b bg-muted/30">
                                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                                    {lang === 'vi' ? 'Hành động' : 'Action'}
                                </th>
                                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                                    {lang === 'vi' ? 'Người Dùng' : 'User'}
                                </th>
                                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                                    {lang === 'vi' ? 'IP & Thiết bị' : 'IP & Device'}
                                </th>
                                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground text-right">
                                    {lang === 'vi' ? 'Thời gian' : 'Time'}
                                </th>
                                <th className="px-3 py-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                        {lang === 'vi' ? 'Không tìm thấy nhật ký nào phù hợp.' : 'No matching audit logs found.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => {
                                    const meta = getLogMetadata(log.action);
                                    const Icon = meta.icon;
                                    return (
                                        <tr key={log.id} className="group hover:bg-primary/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-2 rounded-lg", meta.bg)}>
                                                        <Icon className={cn("h-4 w-4", meta.color)} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-foreground/90">{log.action.split(':').pop()?.replace(/_/g, ' ')}</div>
                                                        <div className={cn("text-[9px] uppercase font-black tracking-tight opacity-70", meta.color)}>{meta.label}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.user ? (
                                                    <div className="space-y-0.5">
                                                        <div className="font-medium text-foreground">{log.user.firstName} {log.user.lastName}</div>
                                                        <div className="text-[10px] text-muted-foreground/60">{log.user.email}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground/40 italic font-medium">System</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-mono text-[10px] text-muted-foreground">{log.ipAddress || 'unknown'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-flex flex-col items-end">
                                                    <div className="font-medium">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    <div className="text-[10px] text-muted-foreground/50">{new Date(log.createdAt).toLocaleDateString()}</div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-4">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
            </div>

            {/* Details Dialog */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" />
                            {lang === 'vi' ? 'Chi tiết Nhật ký' : 'Audit Log Details'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedLog?.action} - {new Date(selectedLog?.createdAt).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted/30 rounded-xl space-y-1">
                                <div className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">{lang === 'vi' ? 'Người dùng' : 'User'}</div>
                                <div className="text-sm font-bold">{selectedLog?.user ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : 'System'}</div>
                                <div className="text-xs text-muted-foreground">{selectedLog?.user?.email}</div>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-xl space-y-1">
                                <div className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">{lang === 'vi' ? 'Địa chỉ' : 'Location'}</div>
                                <div className="text-sm font-bold font-mono">{selectedLog?.ipAddress || 'unknown'}</div>
                                <div className="text-xs text-muted-foreground">ID: {selectedLog?.id?.substring(0, 8)}...</div>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="text-[9px] uppercase font-black text-muted-foreground tracking-widest px-1">{lang === 'vi' ? 'Dữ liệu chi tiết' : 'Extended Data'}</div>
                            <div className="p-4 bg-muted/50 rounded-2xl font-mono text-[11px] overflow-auto max-h-[300px] border border-border/30 custom-scrollbar whitespace-pre">
                                {selectedLog?.details ? (
                                    JSON.stringify(JSON.parse(selectedLog.details), null, 4)
                                ) : (
                                    <span className="italic opacity-50">{lang === 'vi' ? 'Không có dữ liệu chi tiết' : 'No extended data available'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
