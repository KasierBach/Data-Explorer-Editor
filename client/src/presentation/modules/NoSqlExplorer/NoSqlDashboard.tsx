import React, { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Plus, Database, Search, Clock, BoxSelect, Trash, Loader2 } from 'lucide-react';
import { ConnectionService } from '@/core/services/ConnectionService';
import { LanguageSwitcher } from '@/presentation/components/shared/LanguageSwitcher';

export const NoSqlDashboard: React.FC = () => {
    const { connections, setSidebarOpen, openConnectionDialog, removeConnection, setNosqlActiveConnectionId, lang } = useAppStore();
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm(lang === 'vi' ? 'Bạn có chắc chắn muốn xóa kết nối này?' : 'Are you sure you want to delete this connection?')) return;

        setIsDeleting(id);
        try {
            await ConnectionService.deleteConnection(id);
            removeConnection(id);
        } catch (error: any) {
            console.error('Error deleting connection:', error);
            alert(error.message || 'Error deleting connection');
        } finally {
            setIsDeleting(null);
        }
    };

    // Filter only NoSQL connections
    const noSqlConnections = connections.filter(c => c.type === 'mongodb' || c.type === 'mongodb+srv' || c.type === 'redis');

    return (
        <div className="h-full w-full bg-background p-4 md:p-8 overflow-auto animate-in fade-in duration-300">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header / Welcome Banner */}
                <div className="flex flex-col gap-3 relative">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                                {lang === 'vi' ? 'Chào mừng bạn đến với Data Explorer' : 'Welcome to Data Explorer'}
                            </h1>
                            <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] md:text-xs font-bold uppercase tracking-widest border border-green-500/20 whitespace-nowrap items-center gap-1.5">
                                <Database className="w-3.5 h-3.5" /> NoSQL
                            </span>
                        </div>
                        <LanguageSwitcher />
                    </div>
                    <p className="text-muted-foreground text-base md:text-lg max-w-3xl">
                        {lang === 'vi'
                            ? 'Làm việc trơn tru với MongoDB, chạy các truy vấn MQL và xử lý khối lượng dữ liệu JSON khổng lồ một cách dễ dàng.'
                            : 'Work seamlessly with MongoDB, run MQL queries and handle massive JSON datasets with ease.'}
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer hover:border-green-500/50" onClick={() => setSidebarOpen(true)}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                                <BoxSelect className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{lang === 'vi' ? 'Chọn Collection' : 'Select Collection'}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {lang === 'vi' ? 'Mở thanh bên trái để chọn kết nối và collection làm việc.' : 'Open left sidebar to select a connection and collection.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => openConnectionDialog()}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                                <Plus className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{lang === 'vi' ? 'Kết nối mới' : 'New Connection'}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {lang === 'vi' ? 'Thêm một cụm MongoDB Atlas hoặc Redis mới vào quản lý.' : 'Add a new MongoDB Atlas or Redis cluster for management.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => setSidebarOpen(true)}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                                <Search className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{lang === 'vi' ? 'Duyệt Document' : 'Browse Documents'}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {lang === 'vi' ? 'Khám phá các CSDL và collection thuộc về kết nối hiện tại.' : 'Explore databases and collections of the current connection.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent NoSQL Connections */}
                <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-4 max-w-4xl">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            {lang === 'vi' ? 'Kết nối NoSQL gần đây' : 'Recent NoSQL Connections'}
                        </h2>

                        <div className="rounded-lg border bg-card">
                            {noSqlConnections.length > 0 ? (
                                <div className="divide-y">
                                    {noSqlConnections.map((conn) => (
                                        <div key={conn.id} className="p-3 md:p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                                            <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                                                <div className="p-2 rounded-full bg-green-500/10 text-green-500 shrink-0">
                                                    <Database className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{conn.name}</p>
                                                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                                                        {conn.type} • {conn.host}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                <Button variant="outline" size="sm" className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-xs" onClick={() => { setNosqlActiveConnectionId(conn.id); setSidebarOpen(true); }}>
                                                    {lang === 'vi' ? 'Mở' : 'Open'}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"
                                                    onClick={(e) => handleDelete(e, conn.id)}
                                                    disabled={isDeleting === conn.id}
                                                >
                                                    {isDeleting === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    {lang === 'vi' ? 'Chưa có kết nối nào. Hãy tạo một cái để bắt đầu.' : 'No connections yet. Create one to get started.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
