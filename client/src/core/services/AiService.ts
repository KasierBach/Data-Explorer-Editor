import { apiService } from './api.service';

export interface AutocompleteResponse {
    completion: string;
}

/**
 * AI Service for copilot and autocomplete features.
 * Standardized to use apiService.
 */
class AiService {
    async getAutocomplete(params: {
        connectionId: string;
        database?: string;
        beforeCursor: string;
        afterCursor?: string;
    }, signal?: AbortSignal): Promise<string> {
        try {
            const data = await apiService.request<AutocompleteResponse>('/ai/autocomplete', {
                method: 'POST',
                body: JSON.stringify(params),
                signal,
            });
            return data.completion || '';
        } catch (error) {
            console.error('[AiService] Autocomplete request failed:', error);
            return '';
        }
    }
}

export const aiService = new AiService();
