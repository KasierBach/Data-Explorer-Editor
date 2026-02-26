import type { StateCreator } from 'zustand';

export interface SavedQuery {
    id: string;
    name: string;
    sql: string;
    database?: string;
    createdAt: number;
    updatedAt: number;
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
    saveQuery: (query: SavedQuery) => void;
    updateSavedQuery: (id: string, updates: Partial<SavedQuery>) => void;
    deleteSavedQuery: (id: string) => void;
    queryHistory: QueryHistoryEntry[];
    addQueryHistory: (entry: QueryHistoryEntry) => void;
    clearQueryHistory: () => void;
}

export const createQuerySlice: StateCreator<QuerySlice> = (set) => ({
    savedQueries: [],
    saveQuery: (query) => set((state) => ({
        savedQueries: [...state.savedQueries, query],
    })),
    updateSavedQuery: (id, updates) => set((state) => ({
        savedQueries: state.savedQueries.map(q =>
            q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q
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
