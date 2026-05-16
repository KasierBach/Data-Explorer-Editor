import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardService } from '@/core/services/DashboardService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';

export interface SaveToDashboardFormValues {
    mode: 'new' | 'existing';
    dashboardId: string;
    dashboardName: string;
    dashboardDescription: string;
    visibility: 'private' | 'workspace';
    organizationId: string;
    widgetTitle: string;
    chartType: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'table';
    xAxis: string;
    yAxis: string[];
}

interface UseQueryDashboardOptions {
    results: { rows?: Record<string, unknown>[]; columns?: string[] } | null | undefined;
    executedQuery: string | null;
    query: string;
    resultColumns: string[];
    resultNumericColumns: string[];
    currentSavedQueryId: string | null;
    currentSavedQueryName?: string;
    tabTitle?: string;
}

export function useQueryDashboard({
    results,
    executedQuery,
    query,
    resultColumns,
    resultNumericColumns,
    currentSavedQueryId,
    currentSavedQueryName,
    tabTitle,
}: UseQueryDashboardOptions) {
    const queryClient = useQueryClient();
    const { activeConnectionId, connections, activeDatabase, openDashboardTab, lang } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const activeOrganizationId = activeConnection?.organizationId || undefined;

    const [isDashboardDialogOpen, setIsDashboardDialogOpen] = useState(false);
    const [dashboardDialogInitialValues, setDashboardDialogInitialValues] = useState<SaveToDashboardFormValues>({
        mode: 'new',
        dashboardId: '',
        dashboardName: '',
        dashboardDescription: '',
        visibility: 'private',
        organizationId: '',
        widgetTitle: '',
        chartType: 'bar',
        xAxis: '',
        yAxis: [],
    });

    const openDashboardDialog = () => {
        if (!results?.rows?.length) return;
        const defaultName = currentSavedQueryName || tabTitle || (lang === 'vi' ? 'Query Widget' : 'Query Widget');
        setDashboardDialogInitialValues({
            mode: 'new',
            dashboardId: '',
            dashboardName: activeConnection?.name ? `${activeConnection.name} Dashboard` : 'New Dashboard',
            dashboardDescription: '',
            visibility: 'private',
            organizationId: activeOrganizationId || '',
            widgetTitle: defaultName,
            chartType: resultNumericColumns.length ? 'bar' : 'table',
            xAxis: resultColumns[0] || '',
            yAxis: resultNumericColumns.slice(0, 1),
        });
        setIsDashboardDialogOpen(true);
    };

    const saveToDashboard = useCallback(async (values: SaveToDashboardFormValues) => {
        if (!results) return;

        let dashboardId = values.dashboardId;
        let dashboardName = values.dashboardName;

        if (values.mode === 'new') {
            const dashboard = await DashboardService.createDashboard({
                name: values.dashboardName,
                description: values.dashboardDescription || undefined,
                visibility: values.visibility,
                connectionId: activeConnection?.id,
                organizationId: values.visibility === 'workspace' ? values.organizationId : undefined,
                database: activeDatabase || activeConnection?.database || undefined,
            });
            dashboardId = dashboard.id;
            dashboardName = dashboard.name;
        }

        const updatedDashboard = await DashboardService.addWidget(dashboardId, {
            title: values.widgetTitle,
            chartType: values.chartType,
            queryText: executedQuery || query,
            connectionId: activeConnection?.id,
            database: activeDatabase || activeConnection?.database || undefined,
            columns: resultColumns,
            xAxis: values.chartType === 'table' ? undefined : values.xAxis,
            yAxis: values.chartType === 'table' ? [] : values.yAxis,
            config: {
                source: 'query-editor',
                savedQueryId: currentSavedQueryId || undefined,
            },
            dataSnapshot: (results.rows || []).slice(0, 200),
        });

        queryClient.invalidateQueries({ queryKey: ['dashboards'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
        openDashboardTab(updatedDashboard.id, dashboardName || updatedDashboard.name);
        toast.success(lang === 'vi' ? 'Da luu widget vao dashboard' : 'Widget saved to dashboard');
    }, [
        results,
        activeConnection?.id,
        activeConnection?.database,
        activeDatabase,
        executedQuery,
        query,
        resultColumns,
        currentSavedQueryId,
        queryClient,
        openDashboardTab,
        lang,
    ]);

    return {
        isDashboardDialogOpen,
        setIsDashboardDialogOpen,
        dashboardDialogInitialValues,
        openDashboardDialog,
        saveToDashboard,
    };
}
