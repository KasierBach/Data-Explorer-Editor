import { apiService } from './api.service';
import { assertAiEnabled } from './aiAccountPolicy';
import type { AiProviderOverrideConfig } from '@/core/domain/database-adapter.interface';

export interface AutocompleteResponse {
    completion: string;
}

export interface AiProviderStatusResponse {
    providers: Record<string, boolean>;
}

/**
 * AI Service for copilot and autocomplete features.
 * Standardized to use apiService.
 */
class AiService {
    getProviderStatus(): Promise<AiProviderStatusResponse> {
        return apiService.get<AiProviderStatusResponse>('/ai/providers/status');
    }

    async getAutocomplete(params: {
        connectionId: string;
        database?: string;
        beforeCursor: string;
        afterCursor?: string;
        context?: string;
        model?: string;
        providerOverride?: AiProviderOverrideConfig;
        disabledProviders?: string[];
        fallbackProvider?: string;
    }, signal?: AbortSignal): Promise<string> {
        assertAiEnabled();
        try {
            const data = await apiService.request<AutocompleteResponse>('/ai/autocomplete', {
                method: 'POST',
                body: JSON.stringify(params),
                signal,
            }, false);
            return data.completion || '';
        } catch (error) {
            console.error('[AiService] Autocomplete request failed:', error);
            return '';
        }
    }
}

export const aiService = new AiService();
