import { apiService } from "./api.service";

export interface SearchResult {
    id: string;
    name: string;
    type: 'table' | 'view' | 'collection' | 'function';
    connectionId: string;
    connectionName: string;
    database?: string;
    schema?: string;
}

export class SearchService {
    public static async search(query: string): Promise<SearchResult[]> {
        if (!query || query.length < 2) return [];
        return await apiService.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`);
    }

    public static async syncIndex(): Promise<void> {
        await apiService.post('/search/sync', {});
    }
}
