import { API_BASE_URL } from '@/core/config/env';

export interface AutocompleteResponse {
    completion: string;
}

class AiService {
    private getAuthToken(): string | null {
        try {
            const raw = localStorage.getItem('data-explorer-storage');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed?.state?.accessToken || null;
        } catch {
            return null;
        }
    }

    private getHeaders(): Record<string, string> {
        const token = this.getAuthToken();
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
    }

    async getAutocomplete(params: {
        connectionId: string;
        database?: string;
        beforeCursor: string;
        afterCursor?: string;
    }, signal?: AbortSignal): Promise<string> {
        try {
            console.log('[AiService] Sending autocomplete request...');
            const response = await fetch(`${API_BASE_URL}/ai/autocomplete`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(params),
                signal,
            });

            if (!response.ok) {
                console.warn(`[AiService] Response not OK: ${response.status} ${response.statusText}`);
                return '';
            }

            const rawData = await response.json();
            const data: AutocompleteResponse = (rawData && typeof rawData === 'object' && 'success' in rawData && 'data' in rawData) ? rawData.data : rawData;
            console.log('[AiService] Got completion:', data.completion?.slice(0, 50));
            return data.completion || '';
        } catch (error) {
            console.error('[AiService] Autocomplete request failed:', error);
            return '';
        }
    }
}

export const aiService = new AiService();
