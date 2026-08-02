import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardService } from '@/core/services/DashboardService';
import type { DashboardEntity, DashboardWidget } from '@/core/domain/entities';
import { Button } from '@/presentation/components/ui/button';
import { LoadingState } from '@/presentation/components/shared/LoadingState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { toast } from 'sonner';
import { Loader2, LayoutDashboard, Pencil, Trash2, Share2 } from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function formatVisibility(visibility: DashboardEntity['visibility']) {
    if (visibility === 'team') return 'Team';
    if (visibility === 'workspace') return 'Workspace';
    return 'Private';
}

function DashboardWidgetCard({
    dashboardId,
    widget,
    canDelete,
    onDeleted,
}: {
    dashboardId: string;
    widget: DashboardWidget;
    canDelete: boolean;
    onDeleted: () => void;
}) {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const rows = Array.isArray(widget.dataSnapshot) ? widget.dataSnapshot : [];
    const xKey = widget.xAxis || widget.columns[0];
    const yKeys = widget.yAxis?.length ? widget.yAxis : widget.columns.filter((column) => column !== xKey).slice(0, 1);
    const pieData = rows.map((row, index) => ({
        name: String(row[xKey] ?? `Item ${index + 1}`),
        value: Number(row[yKeys[0]] ?? 0),
    }));

    const handleDelete = async () => {
        if (!confirm('Remove this widget from the dashboard?')) return;
        setIsDeleting(true);
        try {
            await DashboardService.deleteWidget(dashboardId, widget.id);
            toast.success('Widget removed');
            onDeleted();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to remove widget');
        } finally {
            setIsDeleting(false);
        }
    };

    const renderChart = () => {
        if (!rows.length) {
            return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No snapshot data</div>;
        }

        if (widget.chartType === 'table') {
            return (
                <div className="h-full overflow-auto rounded-lg border">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted">
                            <tr>
                                {widget.columns.map((column) => (
                                    <th key={column} className="px-3 py-2 text-left font-semibold">{column}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(0, 12).map((row, index) => (
                                <tr key={index} className="border-t">
                                    {widget.columns.map((column) => (
                                        <td key={column} className="px-3 py-2">{String(row[column] ?? '')}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (widget.chartType === 'pie' || widget.chartType === 'donut') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={widget.chartType === 'donut' ? 60 : 0}
                            outerRadius={110}
                            paddingAngle={4}
                        >
                            {pieData.map((_entry, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        if (widget.chartType === 'line') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey={xKey} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {yKeys.map((key, index) => (
                            <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        if (widget.chartType === 'area') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rows}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey={xKey} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {yKeys.map((key, index) => (
                            <Area key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.18} />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            );
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey={xKey} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {yKeys.map((key, index) => (
                        <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[6, 6, 0, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        );
    };

    return (
        <Card className="border-none shadow-lg bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div className="min-w-0">
                    <CardTitle className="text-base truncate">{widget.title}</CardTitle>
                    <CardDescription className="truncate">
                        {widget.chartType.toUpperCase()}
                        {widget.queryText ? ' · query snapshot' : ' · dashboard widget'}
                    </CardDescription>
                </div>
                {canDelete && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="h-[320px]">
                    {renderChart()}
                </div>
            </CardContent>
        </Card>
    );
}

export const SavedDashboardView: React.FC<{ dashboardId: string }> = ({ dashboardId }) => {
    const queryClient = useQueryClient();
    const closeTab = useAppStore((state) => state.closeTab);
    const lang = useAppStore((state) => state.lang);
    const [isMutating, setIsMutating] = React.useState(false);
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['dashboard', dashboardId],
        queryFn: () => DashboardService.getDashboard(dashboardId),
        enabled: !!dashboardId,
    });

    if (isLoading) {
        return <LoadingState label={lang === 'vi' ? 'Đang tải dashboard...' : 'Loading dashboard...'} variant="dashboard" />;
    }

    if (error || !data) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <LayoutDashboard className="h-10 w-10 text-muted-foreground/20" />
                <div>
                    <div className="font-semibold">Dashboard unavailable</div>
                    <div className="text-sm text-muted-foreground">{(error as Error | undefined)?.message || 'Unable to load dashboard.'}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>Retry</Button>
            </div>
        );
    }

    const handleRename = async () => {
        const name = prompt('Dashboard name', data.name)?.trim();
        if (!name || name === data.name) return;
        setIsMutating(true);
        try {
            const updated = await DashboardService.updateDashboard(data.id, { name });
            queryClient.setQueryData(['dashboard', dashboardId], updated);
            await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
            toast.success('Dashboard renamed');
        } catch (renameError) {
            toast.error(renameError instanceof Error ? renameError.message : 'Failed to rename dashboard');
        } finally {
            setIsMutating(false);
        }
    };

    const handleDeleteDashboard = async () => {
        if (!confirm(`Delete dashboard "${data.name}" and all of its widgets?`)) return;
        setIsMutating(true);
        try {
            await DashboardService.deleteDashboard(data.id);
            await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
            queryClient.removeQueries({ queryKey: ['dashboard', dashboardId] });
            closeTab(`dashboard-${dashboardId}`);
            toast.success('Dashboard deleted');
        } catch (deleteError) {
            toast.error(deleteError instanceof Error ? deleteError.message : 'Failed to delete dashboard');
            setIsMutating(false);
        }
    };

    return (
        <div className="h-full overflow-auto bg-background">
            <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-500">
                                <LayoutDashboard className="h-5 w-5" />
                            </div>
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {formatVisibility(data.visibility)}
                            </span>
                            {data.connectionId && (
                                <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    {data.database || 'Connected'}
                                </span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
                            <p className="text-sm text-muted-foreground">
                                {data.description || 'Saved query-driven dashboard'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
                            {data.widgets.length} widget{data.widgets.length === 1 ? '' : 's'}
                        </div>
                        {data.isOwner && (
                            <>
                                <Button variant="outline" size="sm" onClick={handleRename} disabled={isMutating}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Rename
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleDeleteDashboard} disabled={isMutating}>
                                    <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                    Delete
                                </Button>
                            </>
                        )}
                        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>
                </div>

                {data.widgets.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-16 text-center text-muted-foreground">
                            This dashboard does not have any widgets yet.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {data.widgets.map((widget) => (
                            <DashboardWidgetCard
                                key={widget.id}
                                dashboardId={data.id}
                                widget={widget}
                                canDelete={data.isOwner}
                                onDeleted={() => {
                                    queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
                                    queryClient.invalidateQueries({ queryKey: ['dashboards'] });
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
