import type { StateCreator } from 'zustand';

export interface SavedQuery {
    id: string;
    name: string;
    sql: string;
    connectionId?: string | null;
    database?: string;
    visibility: 'private' | 'team' | 'workspace';
    folderId?: string | null;
    tags: string[];
    description?: string | null;
    createdAt: string;
    updatedAt: string;
    owner?: {
        id: string;
        email: string;
        firstName?: string | null;
        lastName?: string | null;
    };
    isOwner?: boolean;
}

export interface QueryHistoryEntry {
    id: string;
    sql: string;
    database?: string;
    connectionName?: string;
    executedAt: number;
    durationMs?: number;
    rowCount?: number;
    status: 'success' | 'error';
    errorMessage?: string;
}

export interface QuerySlice {
    savedQueries: SavedQuery[];
    setSavedQueries: (queries: SavedQuery[]) => void;
    saveQuery: (query: SavedQuery) => void;
    updateSavedQuery: (id: string, updates: Partial<SavedQuery>) => void;
    deleteSavedQuery: (id: string) => void;
    queryHistory: QueryHistoryEntry[];
    addQueryHistory: (entry: QueryHistoryEntry) => void;
    clearQueryHistory: () => void;
}

export const createQuerySlice: StateCreator<QuerySlice> = (set) => ({
    savedQueries: [],
    setSavedQueries: (queries) => set({ savedQueries: queries }),
    saveQuery: (query) => set((state) => ({
        savedQueries: [query, ...state.savedQueries.filter(existing => existing.id !== query.id)],
    })),
    updateSavedQuery: (id, updates) => set((state) => ({
        savedQueries: state.savedQueries.map(q =>
            q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
        ),
    })),
    deleteSavedQuery: (id) => set((state) => ({
        savedQueries: state.savedQueries.filter(q => q.id !== id),
    })),
    queryHistory: [],
    addQueryHistory: (entry) => set((state) => ({
        queryHistory: [entry, ...state.queryHistory].slice(0, 100),
    })),
    clearQueryHistory: () => set({ queryHistory: [] }),
});
