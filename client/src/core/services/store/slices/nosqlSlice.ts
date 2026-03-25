import type { StateCreator } from 'zustand';

export interface NoSqlFilterState {
    action: string;
    filter: string;
    options: string;
}

export interface NoSqlSlice {
    nosqlActiveDatabase: string | null;
    nosqlActiveCollection: string | null;
    nosqlViewMode: 'tree' | 'grid';
    nosqlFilter: NoSqlFilterState;
    nosqlResult: any | null;
    nosqlIsQueryRunning: boolean;
    setNosqlDatabase: (db: string | null) => void;
    setNosqlCollection: (col: string | null) => void;
    setNosqlViewMode: (mode: 'tree' | 'grid') => void;
    setNosqlFilter: (filter: Partial<NoSqlFilterState>) => void;
    setNosqlResult: (result: any) => void;
    setNosqlQueryRunning: (isRunning: boolean) => void;
}

export const createNoSqlSlice: StateCreator<NoSqlSlice> = (set) => ({
    nosqlActiveDatabase: null,
    nosqlActiveCollection: null,
    nosqlViewMode: 'tree',
    nosqlFilter: { action: 'find', filter: '{\n  \n}', options: '{\n  "limit": 50\n}' },
    nosqlResult: null,
    nosqlIsQueryRunning: false,
    
    setNosqlDatabase: (db) => set({ nosqlActiveDatabase: db, nosqlActiveCollection: null, nosqlResult: null }),
    setNosqlCollection: (col) => set({ nosqlActiveCollection: col, nosqlResult: null }),
    setNosqlViewMode: (mode) => set({ nosqlViewMode: mode }),
    setNosqlFilter: (filter) => set((state) => ({ nosqlFilter: { ...state.nosqlFilter, ...filter } })),
    setNosqlResult: (result) => set({ nosqlResult: result }),
    setNosqlQueryRunning: (isRunning) => set({ nosqlIsQueryRunning: isRunning }),
});
