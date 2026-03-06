import { API_BASE_URL } from '../config/env';
import { useAppStore } from './store';

class AdminService {
    private baseUrl = API_BASE_URL;

    private getHeaders() {
        const token = useAppStore.getState().accessToken;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    private async handleResponse(response: Response) {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error(`Admin access denied: ${response.status}`);
            }
            const errorText = await response.text();
            let errorMessage = `Operation failed: ${response.statusText}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorMessage;
            } catch (e) {
                // Not JSON, just append the raw text if available
                if (errorText) errorMessage += ` - ${errorText}`;
            }
            throw new Error(errorMessage);
        }
        return await response.json();
    }

    // --- Users Management ---

    async getUsers() {
        const response = await fetch(`${this.baseUrl}/users`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        return this.handleResponse(response);
    }

    async updateRole(userId: string, role: 'user' | 'admin') {
        const response = await fetch(`${this.baseUrl}/users/${userId}/role`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({ role }),
        });
        return this.handleResponse(response);
    }

    async resetPassword(userId: string, newPassword: string) {
        const response = await fetch(`${this.baseUrl}/users/${userId}/reset-password`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ newPassword }),
        });
        return this.handleResponse(response);
    }

    // --- Audit Logs ---

    async getAuditLogs(limit: number = 100) {
        const response = await fetch(`${this.baseUrl}/audit?limit=${limit}`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        return this.handleResponse(response);
    }
}

export const adminService = new AdminService();
