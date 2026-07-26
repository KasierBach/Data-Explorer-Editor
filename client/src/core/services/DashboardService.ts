import { apiService } from './api.service';
import type { DashboardEntity } from '@/core/domain/entities';

export interface CreateDashboardPayload {
    name: string;
    description?: string;
    visibility?: 'private' | 'workspace';
    connectionId?: string;
    organizationId?: string;
    database?: string;
}

export interface AddDashboardWidgetPayload {
    title: string;
    chartType: string;
    queryText?: string;
    connectionId?: string;
    database?: string;
    columns: string[];
    xAxis?: string;
    yAxis: string[];
    config?: Record<string, unknown>;
    dataSnapshot: Record<string, unknown>[];
}

export type UpdateDashboardPayload = Partial<CreateDashboardPayload>;

export class DashboardService {
    static async getDashboards(): Promise<DashboardEntity[]> {
        return apiService.get<DashboardEntity[]>('/dashboards');
    }

    static async getDashboard(id: string): Promise<DashboardEntity> {
        return apiService.get<DashboardEntity>(`/dashboards/${id}`);
    }

    static async createDashboard(payload: CreateDashboardPayload): Promise<DashboardEntity> {
        return apiService.post<DashboardEntity>('/dashboards', payload);
    }

    static async addWidget(dashboardId: string, payload: AddDashboardWidgetPayload): Promise<DashboardEntity> {
        return apiService.post<DashboardEntity>(`/dashboards/${dashboardId}/widgets`, payload);
    }

    static async updateDashboard(id: string, payload: UpdateDashboardPayload): Promise<DashboardEntity> {
        return apiService.patch<DashboardEntity>(`/dashboards/${id}`, payload);
    }

    static async deleteDashboard(id: string): Promise<{ success: true }> {
        return apiService.delete<{ success: true }>(`/dashboards/${id}`);
    }

    static async deleteWidget(dashboardId: string, widgetId: string): Promise<{ success: true }> {
        return apiService.delete<{ success: true }>(`/dashboards/${dashboardId}/widgets/${widgetId}`);
    }
}
