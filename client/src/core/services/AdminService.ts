import { apiService } from './api.service';

/**
 * Service to manage administrative operations.
 * Uses apiService for consistent fetching and error handling.
 */
class AdminService {
    // --- Users Management ---

    async getUsers() {
        return await apiService.get<any[]>('/users');
    }

    async updateRole(userId: string, role: 'user' | 'admin') {
        return await apiService.patch<any>(`/users/${userId}/role`, { role });
    }

    async resetPassword(userId: string, newPassword: string) {
        return await apiService.post<any>(`/users/${userId}/reset-password`, { newPassword });
    }

    async deleteUser(userId: string) {
        return await apiService.delete<any>(`/users/${userId}`);
    }

    async toggleBan(userId: string) {
        return await apiService.patch<any>(`/users/${userId}/ban`, {});
    }

    // --- Audit Logs ---

    async getAuditLogs(limit: number = 100) {
        return await apiService.get<any[]>(`/audit?limit=${limit}`);
    }
}

export const adminService = new AdminService();
