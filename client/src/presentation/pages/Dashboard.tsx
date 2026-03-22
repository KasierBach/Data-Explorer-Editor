import React, { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Plus, Database, Search, Clock, FileText, BarChart3, ArrowLeft, Trash, Loader2 } from 'lucide-react';
import { InsightsDashboard } from '../modules/Dashboard/InsightsDashboard';
import { ConnectionService } from '@/core/services/ConnectionService';
import { LanguageSwitcher } from '@/presentation/components/shared/LanguageSwitcher';

export const Dashboard: React.FC = () => {
    const { connections, openQueryTab, setSidebarOpen, openConnectionDialog, activeConnectionId, removeConnection, setActiveConnectionId, lang } = useAppStore();
    const [view, setView] = useState<'welcome' | 'insights'>('welcome');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this connection?')) return;

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

    const queryHistory = useAppStore(state => state.queryHistory);
    const expandedNodes = useAppStore(state => state.expandedNodes);

    // Dynamic stats from local state
    const queryCount = queryHistory ? queryHistory.length : 0;
    // Estimate tables accessed by counting the number of expanded tree nodes in the sidebar
    const tableCount = expandedNodes ? expandedNodes.length : 0;

    if (view === 'insights') {
        return (
            <div className="h-full w-full bg-background overflow-auto animate-in fade-in duration-300">
                <div className="max-w-7xl mx-auto">
                    <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                        <Button variant="ghost" size="sm" onClick={() => setView('welcome')} className="gap-2">
                            <ArrowLeft className="h-4 w-4" /> {lang === 'vi' ? 'Quay lại Chào mừng' : 'Back to Welcome'}
                        </Button>
                        <div className="flex items-center gap-6">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                {lang === 'vi' ? 'Thông tin Cơ sở dữ liệu' : 'Database Intelligence'}
                            </h2>
                            <LanguageSwitcher />
                        </div>
                    </div>
                    <InsightsDashboard />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-background p-4 md:p-8 overflow-auto animate-in fade-in duration-300">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header / Welcome Banner */}
                <div className="flex flex-col gap-2 relative">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                            {lang === 'vi' ? 'Chào mừng bạn đến với Data Explorer' : 'Welcome to Data Explorer'}
                        </h1>
                        <LanguageSwitcher />
                    </div>
                    <p className="text-muted-foreground text-base md:text-lg">
                        {lang === 'vi'
                            ? 'Quản lý cơ sở dữ liệu, thực hiện truy vấn và trực quan hóa dữ liệu một cách dễ dàng.'
                            : 'Manage your databases, execute queries, and visualize data with ease.'}
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => openQueryTab()}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-blue-100 text-blue-600">
                                <FileText className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{lang === 'vi' ? 'Truy vấn mới' : 'New Query'}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {lang === 'vi' ? 'Mở trình chỉnh sửa SQL để chạy các truy vấn tùy ý.' : 'Open a SQL editor to run arbitrary queries.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => openConnectionDialog()}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-green-100 text-green-600">
                                <Plus className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{lang === 'vi' ? 'Kết nối mới' : 'New Connection'}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {lang === 'vi' ? 'Kết nối với cơ sở dữ liệu PostgreSQL hoặc MySQL mới.' : 'Connect to a new PostgreSQL or MySQL database.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => setSidebarOpen(true)}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-orange-100 text-orange-600">
                                <Search className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{lang === 'vi' ? 'Duyệt dữ liệu' : 'Browse Data'}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {lang === 'vi' ? 'Khám phá các bảng và lược đồ trong thanh bên.' : 'Explore tables and schemas in the sidebar.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer ${!activeConnectionId ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                        onClick={() => activeConnectionId && setView('insights')}
                    >
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-purple-100 text-purple-600">
                                <BarChart3 className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{lang === 'vi' ? 'Thông tin chuyên sâu' : 'Database Insights'}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {lang === 'vi' ? 'Xem các chỉ số, mức sử dụng bộ nhớ và xu hướng.' : 'View metrics, storage usage, and trends.'}
                                </p>
                            </div>
                        </div>
                        {!activeConnectionId && (
                            <div className="absolute inset-x-0 bottom-0 bg-purple-600 text-[10px] text-white text-center py-1 font-bold uppercase tracking-widest">
                                {lang === 'vi' ? 'Chọn một kết nối trước' : 'Select a connection first'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Connections & Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Recent Connections List */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            {lang === 'vi' ? 'Kết nối gần đây' : 'Recent Connections'}
                        </h2>

                        <div className="rounded-lg border bg-card">
                            {connections.length > 0 ? (
                                <div className="divide-y">
                                    {connections.map((conn) => (
                                        <div key={conn.id} className="p-3 md:p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                                            <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                                                <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
                                                    <Database className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{conn.name}</p>
                                                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                                                        {conn.type} • {conn.host}:{conn.port} • {conn.database}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                <Button variant="outline" size="sm" className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-xs" onClick={() => { setActiveConnectionId(conn.id); setSidebarOpen(true); }}>
                                                    {lang === 'vi' ? 'Kết nối' : 'Connect'}
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

                    {/* Quick Stats Sidebar */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">{lang === 'vi' ? 'Thống kê nhanh' : 'Quick Stats'}</h2>
                        <div className="rounded-lg border bg-card p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{lang === 'vi' ? 'Kết nối đang hoạt động' : 'Active Connections'}</span>
                                <span className="text-2xl font-bold">{connections.length}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{lang === 'vi' ? 'Truy vấn đã chạy' : 'Queries Run'}</span>
                                <span className="text-2xl font-bold">{queryCount}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{lang === 'vi' ? 'Bảng đã truy cập' : 'Tables Accessed'}</span>
                                <span className="text-2xl font-bold">{tableCount}</span>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                            <h3 className="font-semibold mb-2 text-primary">{lang === 'vi' ? 'Mẹo hữu ích' : 'Pro Tip'}</h3>
                            <p className="text-sm text-muted-foreground">
                                {lang === 'vi'
                                    ? <>Bạn có thể sử dụng <code className="bg-primary/10 px-1 rounded text-primary">Ctrl+N</code> để mở nhanh một tab truy vấn mới từ bất kỳ đâu trong ứng dụng.</>
                                    : <>You can use <code className="bg-primary/10 px-1 rounded text-primary">Ctrl+N</code> to quickly open a new query tab from anywhere in the application.</>}
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
