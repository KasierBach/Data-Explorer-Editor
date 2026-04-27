import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/presentation/components/ui/select';
import { DashboardService } from '@/core/services/DashboardService';
import type { DashboardEntity } from '@/core/domain/entities';

export interface SaveToDashboardFormValues {
    mode: 'existing' | 'new';
    dashboardId: string;
    dashboardName: string;
    dashboardDescription: string;
    visibility: 'private' | 'team' | 'workspace';
    widgetTitle: string;
    chartType: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'table';
    xAxis: string;
    yAxis: string[];
}

interface SaveToDashboardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    columns: string[];
    numericColumns: string[];
    initialValues: SaveToDashboardFormValues;
    onSubmit: (values: SaveToDashboardFormValues) => Promise<void> | void;
}

const CHART_OPTIONS: Array<{ value: SaveToDashboardFormValues['chartType']; label: string }> = [
    { value: 'bar', label: 'Bar' },
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
    { value: 'pie', label: 'Pie' },
    { value: 'donut', label: 'Donut' },
    { value: 'table', label: 'Table' },
];

export const SaveToDashboardDialog: React.FC<SaveToDashboardDialogProps> = ({
    open,
    onOpenChange,
    columns,
    numericColumns,
    initialValues,
    onSubmit,
}) => {
    const [form, setForm] = useState<SaveToDashboardFormValues>(initialValues);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { data: dashboards = [] } = useQuery<DashboardEntity[]>({
        queryKey: ['dashboards'],
        queryFn: () => DashboardService.getDashboards(),
        enabled: open,
    });

    useEffect(() => {
        if (open) {
            setForm(initialValues);
            setError(null);
            setIsSaving(false);
        }
    }, [open, initialValues]);

    const availableDashboards = useMemo(
        () => dashboards.filter((dashboard) => dashboard.isOwner),
        [dashboards],
    );

    const effectiveXAxisOptions = columns.length ? columns : ['__value'];
    const effectiveYOptions = numericColumns.length ? numericColumns : columns;
    const needsSingleMetric = form.chartType === 'pie' || form.chartType === 'donut';

    useEffect(() => {
        if (!form.xAxis && effectiveXAxisOptions[0]) {
            setForm((prev) => ({ ...prev, xAxis: effectiveXAxisOptions[0] }));
        }
        if (form.yAxis.length === 0 && effectiveYOptions[0]) {
            setForm((prev) => ({ ...prev, yAxis: [effectiveYOptions[0]] }));
        }
    }, [form.xAxis, form.yAxis.length, effectiveXAxisOptions, effectiveYOptions]);

    const toggleYAxis = (column: string) => {
        setForm((prev) => {
            if (needsSingleMetric) {
                return { ...prev, yAxis: [column] };
            }
            const exists = prev.yAxis.includes(column);
            return {
                ...prev,
                yAxis: exists ? prev.yAxis.filter((entry) => entry !== column) : [...prev.yAxis, column],
            };
        });
    };

    const handleSubmit = async () => {
        if (!form.widgetTitle.trim()) return;
        if (form.mode === 'existing' && !form.dashboardId) return;
        if (form.mode === 'new' && !form.dashboardName.trim()) return;
        if (!form.xAxis && form.chartType !== 'table') return;
        if (form.chartType !== 'table' && form.yAxis.length === 0) return;

        setIsSaving(true);
        setError(null);
        try {
            await onSubmit({
                ...form,
                dashboardName: form.dashboardName.trim(),
                dashboardDescription: form.dashboardDescription.trim(),
                widgetTitle: form.widgetTitle.trim(),
            });
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save widget');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Save to Dashboard</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {error && (
                        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Target</Label>
                            <Select
                                value={form.mode}
                                onValueChange={(value: SaveToDashboardFormValues['mode']) => setForm((prev) => ({ ...prev, mode: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="existing">Existing dashboard</SelectItem>
                                    <SelectItem value="new">New dashboard</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Chart type</Label>
                            <Select
                                value={form.chartType}
                                onValueChange={(value: SaveToDashboardFormValues['chartType']) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        chartType: value,
                                        yAxis: prev.yAxis.length ? (value === 'pie' || value === 'donut' ? [prev.yAxis[0]] : prev.yAxis) : prev.yAxis,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CHART_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {form.mode === 'existing' ? (
                        <div className="space-y-1.5">
                            <Label>Dashboard</Label>
                            <Select
                                value={form.dashboardId}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, dashboardId: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a dashboard" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableDashboards.map((dashboard) => (
                                        <SelectItem key={dashboard.id} value={dashboard.id}>
                                            {dashboard.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Dashboard name</Label>
                                <Input
                                    value={form.dashboardName}
                                    onChange={(e) => setForm((prev) => ({ ...prev, dashboardName: e.target.value }))}
                                    placeholder="Revenue board"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Visibility</Label>
                                <Select
                                    value={form.visibility}
                                    onValueChange={(value: SaveToDashboardFormValues['visibility']) => setForm((prev) => ({ ...prev, visibility: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="private">Private</SelectItem>
                                        <SelectItem value="team">Team</SelectItem>
                                        <SelectItem value="workspace">Workspace</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label>Description</Label>
                                <textarea
                                    className="w-full min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.dashboardDescription}
                                    onChange={(e) => setForm((prev) => ({ ...prev, dashboardDescription: e.target.value }))}
                                    placeholder="Optional context for this dashboard"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Widget title</Label>
                        <Input
                            value={form.widgetTitle}
                            onChange={(e) => setForm((prev) => ({ ...prev, widgetTitle: e.target.value }))}
                            placeholder="Top revenue by customer"
                        />
                    </div>

                    {form.chartType !== 'table' && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>X axis</Label>
                                <Select value={form.xAxis} onValueChange={(value) => setForm((prev) => ({ ...prev, xAxis: value }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a dimension" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {effectiveXAxisOptions.map((column) => (
                                            <SelectItem key={column} value={column}>{column}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>{needsSingleMetric ? 'Metric' : 'Metrics'}</Label>
                                <div className="rounded-md border p-2 space-y-1 max-h-36 overflow-auto">
                                    {effectiveYOptions.map((column) => {
                                        const active = form.yAxis.includes(column);
                                        return (
                                            <button
                                                key={column}
                                                type="button"
                                                onClick={() => toggleYAxis(column)}
                                                className={`w-full rounded px-2 py-1.5 text-left text-sm transition ${
                                                    active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                                }`}
                                            >
                                                {column}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save widget'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
