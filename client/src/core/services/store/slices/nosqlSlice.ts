import type { StateCreator } from 'zustand';

export interface NoSqlFilterState {
    action: string;
    filter: string;
    options: string;
}

export interface NoSqlSlice {
    nosqlActiveConnectionId: string | null;
    nosqlActiveDatabase: string | null;
    nosqlActiveCollection: string | null;
    nosqlViewMode: 'tree' | 'grid' | 'charts' | 'schema' | 'aggregation';
    nosqlFilter: NoSqlFilterState;
    nosqlMqlQuery: string;
    nosqlResult: any | null;
    nosqlIsQueryRunning: boolean;
    nosqlPipelineStages: Array<{ id: string, type: string, value: string, enabled: boolean }>;
    nosqlSchemaStats: any | null;
    setNosqlActiveConnectionId: (id: string | null) => void;
    setNosqlDatabase: (db: string | null) => void;
    setNosqlCollection: (col: string | null) => void;
    setNosqlViewMode: (mode: 'tree' | 'grid' | 'charts' | 'schema' | 'aggregation') => void;
    setNosqlPipelineStages: (stages: Array<{ id: string, type: string, value: string, enabled: boolean }>) => void;
    setNosqlSchemaStats: (stats: any) => void;
    setNosqlFilter: (filter: Partial<NoSqlFilterState>) => void;
    setNosqlMqlQuery: (query: string) => void;
    setNosqlResult: (result: any) => void;
    setNosqlQueryRunning: (isRunning: boolean) => void;
}

const buildDefaultMqlQuery = (collection: string | null): string => {
    const col = collection || 'yourCollection';
    return JSON.stringify({
        action: 'find',
        collection: col,
        filter: {},
        options: {},
        limit: 50
    }, null, 2);
};

export const createNoSqlSlice: StateCreator<NoSqlSlice> = (set) => ({
    nosqlActiveConnectionId: null,
    nosqlActiveDatabase: null,
    nosqlActiveCollection: null,
    nosqlViewMode: 'tree',
    nosqlFilter: { action: 'find', filter: '{\n  \n}', options: '{\n  "limit": 50\n}' },
    nosqlMqlQuery: buildDefaultMqlQuery(null),
    nosqlResult: null,
    nosqlIsQueryRunning: false,
    nosqlPipelineStages: [{ id: '1', type: '$match', value: '{\n  \n}', enabled: true }],
    nosqlSchemaStats: null,

    setNosqlActiveConnectionId: (id) => set({ nosqlActiveConnectionId: id }),
    setNosqlDatabase: (db) => set({ nosqlActiveDatabase: db, nosqlActiveCollection: null, nosqlResult: null }),
    setNosqlCollection: (col) => set({
        nosqlActiveCollection: col,
        nosqlResult: null,
        nosqlMqlQuery: buildDefaultMqlQuery(col),
    }),
    setNosqlViewMode: (mode) => set({ nosqlViewMode: mode }),
    setNosqlPipelineStages: (stages) => set({ nosqlPipelineStages: stages }),
    setNosqlSchemaStats: (stats) => set({ nosqlSchemaStats: stats }),
    setNosqlFilter: (filter) => set((state) => ({ nosqlFilter: { ...state.nosqlFilter, ...filter } })),
    setNosqlMqlQuery: (query) => set({ nosqlMqlQuery: query }),
    setNosqlResult: (result) => set({ nosqlResult: result }),
    setNosqlQueryRunning: (isRunning) => set({ nosqlIsQueryRunning: isRunning }),
});
