import { apiService } from './api.service';

export type AdminRole = 'user' | 'admin';

export interface AdminUser {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    role: AdminRole;
    createdAt: string;
    isOnboarded: boolean;
    isBanned: boolean;
}

export interface AdminUserIdentity {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    email?: string | null;
}

export interface AuditLogEntry {
    id: string;
    action: string;
    details?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: string;
    user?: AdminUserIdentity | null;
}

export interface AiTokenUsage {
    /** Observed subtotals only; absent coverage never establishes measured zero. */
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    trackedRequests?: number | null;
    attempts?: number | null;
    measuredAttempts?: number | null;
    unmeasuredAttempts?: number | null;
    usageCoverage?: 'complete' | 'partial' | 'unavailable' | null;
    observedOnly?: true | null;
    costCoverage?: 'unavailable' | null;
}

export interface AiQualityMetrics {
    days: number;
    generations: number | null;
    success: number | null;
    failed: number | null;
    /** Transport/response-contract outcome, not semantic accuracy. */
    successRate: number | null;
    averageLatencyMs: number | null;
    p95LatencyMs: number | null;
    feedback?: { up: number | null; down: number | null; total: number | null } | null;
    tokens?: AiTokenUsage | null;
    models?: Array<{ model: string; success: number | null; failed: number | null; total: number | null }> | null;
}

export interface AiMyUsage {
    days: number;
    generations: number | null;
    success: number | null;
    failed: number | null;
    tokens?: AiTokenUsage | null;
}

interface MessageResponse {
    message: string;
}

/**
 * Service to manage administrative operations.
 * Uses apiService for consistent fetching and error handling.
 */
class AdminService {
    // --- Users Management ---

    async getUsers(): Promise<AdminUser[]> {
        return await apiService.get<AdminUser[]>('/users');
    }

    async updateRole(userId: string, role: AdminRole): Promise<Partial<AdminUser>> {
        return await apiService.patch<Partial<AdminUser>>(`/users/${userId}/role`, { role });
    }

    async resetPassword(userId: string, newPassword: string): Promise<MessageResponse> {
        return await apiService.post<MessageResponse>(`/users/${userId}/reset-password`, { newPassword });
    }

    async deleteUser(userId: string): Promise<MessageResponse> {
        return await apiService.delete<MessageResponse>(`/users/${userId}`);
    }

    async toggleBan(userId: string): Promise<MessageResponse> {
        return await apiService.patch<MessageResponse>(`/users/${userId}/ban`, {});
    }

    // --- Audit Logs ---

    async getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
        return await apiService.get<AuditLogEntry[]>(`/audit?limit=${limit}`);
    }

    async getMyAuditLogs(limit: number = 200): Promise<AuditLogEntry[]> {
        return await apiService.get<AuditLogEntry[]>(`/audit/me?limit=${limit}`);
    }

    async getAiQualityMetrics(days: number = 30): Promise<AiQualityMetrics> {
        return await apiService.get<AiQualityMetrics>(`/admin/ai-quality?days=${days}`);
    }

    async getMyAiUsage(days: number = 30): Promise<AiMyUsage> {
        return await apiService.get<AiMyUsage>(`/ai-quality/my-usage?days=${days}`);
    }
}

export const adminService = new AdminService();
