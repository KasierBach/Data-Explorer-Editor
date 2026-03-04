import { useState, useEffect } from 'react';
import { adminService } from '@/core/services/AdminService';
import { useAppStore } from '@/core/services/store';
import { Activity, Clock } from 'lucide-react';
import { Badge } from '@/presentation/components/ui/badge';

export function AuditLogsView() {
    const { lang } = useAppStore();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const data = await adminService.getAuditLogs(100);
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

    if (loading) {
        return <div className="flex justify-center p-8 text-muted-foreground">Loading...</div>;
    }

    if (logs.length === 0) {
        return <div className="flex justify-center p-8 text-muted-foreground">
            {lang === 'vi' ? 'Không có nhật ký nào.' : 'No audit logs found.'}
        </div>;
    }

    return (
        <div className="bg-card rounded-md border shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="px-6 py-3">{lang === 'vi' ? 'Hành động' : 'Action'}</th>
                            <th className="px-6 py-3">{lang === 'vi' ? 'Người Dùng' : 'User'}</th>
                            <th className="px-6 py-3">{lang === 'vi' ? 'Chi tiết' : 'Details'}</th>
                            <th className="px-6 py-3">{lang === 'vi' ? 'Địa chỉ IP' : 'IP Address'}</th>
                            <th className="px-6 py-3 text-right">{lang === 'vi' ? 'Thời gian' : 'Time'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="px-6 py-4 font-medium flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-muted-foreground" />
                                    {log.action}
                                </td>
                                <td className="px-6 py-4">
                                    {log.user ? (
                                        <Badge variant="outline">{log.user.name}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground italic">System / Unknown</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs max-w-xs truncate text-muted-foreground">
                                    {log.details || '-'}
                                </td>
                                <td className="px-6 py-4 text-xs">
                                    {log.ipAddress || '-'}
                                </td>
                                <td className="px-6 py-4 text-right text-muted-foreground text-xs whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                        <Clock className="h-3 w-3" />
                                        {new Date(log.createdAt).toLocaleString()}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
