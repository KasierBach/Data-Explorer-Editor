import type { StateCreator } from 'zustand';
import type { RowData } from '@/core/domain/entities';

export interface NoSqlFilterState {
    action: string;
    filter: string;
    options: string;
}

export interface NoSqlPipelineStage {
    id: string;
    type: string;
    value: string;
    enabled: boolean;
}

export interface NoSqlSchemaFieldStat {
    name: string;
    types: Record<string, number>;
    count: number;
    probability: number;
    sampleValues: unknown[];
}

export type NoSqlViewMode = 'tree' | 'grid' | 'schema' | 'aggregation';

export interface NoSqlWorkspaceState {
    mqlQuery: string;
    viewMode: NoSqlViewMode;
    pageIndex: number;
    pageSize: number;
    pipelineStages: NoSqlPipelineStage[];
}

export interface NoSqlSlice {
    nosqlActiveConnectionId: string | null;
    nosqlActiveDatabase: string | null;
    nosqlActiveCollection: string | null;
    nosqlViewMode: NoSqlViewMode;
    nosqlFilter: NoSqlFilterState;
    nosqlMqlQuery: string;
    nosqlResult: RowData[] | null;
    nosqlIsQueryRunning: boolean;
    nosqlPipelineStages: NoSqlPipelineStage[];
    nosqlSchemaStats: NoSqlSchemaFieldStat[] | null;
    nosqlPageIndex: number;
    nosqlPageSize: number;
    nosqlWorkspaceStates: Record<string, NoSqlWorkspaceState>;
    setNosqlActiveConnectionId: (id: string | null) => void;
    setNosqlDatabase: (db: string | null) => void;
    setNosqlCollection: (col: string | null) => void;
    setNosqlViewMode: (mode: NoSqlViewMode) => void;
    setNosqlPipelineStages: (stages: NoSqlPipelineStage[]) => void;
    setNosqlSchemaStats: (stats: NoSqlSchemaFieldStat[] | null) => void;
    setNosqlFilter: (filter: Partial<NoSqlFilterState>) => void;
    setNosqlMqlQuery: (query: string) => void;
    setNosqlResult: (result: RowData[] | null) => void;
    setNosqlQueryRunning: (isRunning: boolean) => void;
    setNosqlPagination: (pageIndex: number, pageSize?: number) => void;
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

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_PIPELINE_STAGES: NoSqlPipelineStage[] = [
    { id: '1', type: '$match', value: '{\n  \n}', enabled: true },
];

const getWorkspaceKey = (
    connectionId: string | null,
    database: string | null,
    collection: string | null,
) => connectionId && collection
    ? `${connectionId}:${database || 'default'}:${collection}`
    : null;

const saveCurrentWorkspace = (state: NoSqlSlice) => {
    const key = getWorkspaceKey(
        state.nosqlActiveConnectionId,
        state.nosqlActiveDatabase,
        state.nosqlActiveCollection,
    );
    if (!key) return state.nosqlWorkspaceStates;

    return {
        ...state.nosqlWorkspaceStates,
        [key]: {
            mqlQuery: state.nosqlMqlQuery,
            viewMode: state.nosqlViewMode,
            pageIndex: state.nosqlPageIndex,
            pageSize: state.nosqlPageSize,
            pipelineStages: state.nosqlPipelineStages,
        },
    };
};

const updateCurrentWorkspace = (
    state: NoSqlSlice,
    changes: Partial<NoSqlWorkspaceState>,
) => {
    const key = getWorkspaceKey(
        state.nosqlActiveConnectionId,
        state.nosqlActiveDatabase,
        state.nosqlActiveCollection,
    );
    if (!key) return state.nosqlWorkspaceStates;

    const current = state.nosqlWorkspaceStates[key] || {
        mqlQuery: state.nosqlMqlQuery,
        viewMode: state.nosqlViewMode,
        pageIndex: state.nosqlPageIndex,
        pageSize: state.nosqlPageSize,
        pipelineStages: state.nosqlPipelineStages,
    };
    return {
        ...state.nosqlWorkspaceStates,
        [key]: { ...current, ...changes },
    };
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
    nosqlPipelineStages: DEFAULT_PIPELINE_STAGES,
    nosqlSchemaStats: null,
    nosqlPageIndex: 0,
    nosqlPageSize: DEFAULT_PAGE_SIZE,
    nosqlWorkspaceStates: {},

    setNosqlActiveConnectionId: (id) => set((state) => ({
        nosqlWorkspaceStates: saveCurrentWorkspace(state),
        nosqlActiveConnectionId: id,
        nosqlActiveDatabase: null,
        nosqlActiveCollection: null,
        nosqlResult: null,
        nosqlPageIndex: 0,
    })),
    setNosqlDatabase: (db) => set((state) => ({
        nosqlWorkspaceStates: saveCurrentWorkspace(state),
        nosqlActiveDatabase: db,
        nosqlActiveCollection: null,
        nosqlResult: null,
        nosqlPageIndex: 0,
    })),
    setNosqlCollection: (col) => set((state) => {
        const workspaceStates = saveCurrentWorkspace(state);
        const key = getWorkspaceKey(state.nosqlActiveConnectionId, state.nosqlActiveDatabase, col);
        const restored = key ? workspaceStates[key] : undefined;

        return {
            nosqlWorkspaceStates: workspaceStates,
            nosqlActiveCollection: col,
            nosqlResult: null,
            nosqlMqlQuery: restored?.mqlQuery || buildDefaultMqlQuery(col),
            nosqlViewMode: restored?.viewMode || 'tree',
            nosqlPageIndex: restored?.pageIndex || 0,
            nosqlPageSize: restored?.pageSize || DEFAULT_PAGE_SIZE,
            nosqlPipelineStages: restored?.pipelineStages || DEFAULT_PIPELINE_STAGES,
        };
    }),
    setNosqlViewMode: (mode) => set((state) => ({
        nosqlViewMode: mode,
        nosqlWorkspaceStates: updateCurrentWorkspace(state, { viewMode: mode }),
    })),
    setNosqlPipelineStages: (stages) => set((state) => ({
        nosqlPipelineStages: stages,
        nosqlWorkspaceStates: updateCurrentWorkspace(state, { pipelineStages: stages }),
    })),
    setNosqlSchemaStats: (stats) => set({ nosqlSchemaStats: stats }),
    setNosqlFilter: (filter) => set((state) => ({ nosqlFilter: { ...state.nosqlFilter, ...filter } })),
    setNosqlMqlQuery: (query) => set((state) => ({
        nosqlMqlQuery: query,
        nosqlPageIndex: 0,
        nosqlWorkspaceStates: updateCurrentWorkspace(state, { mqlQuery: query, pageIndex: 0 }),
    })),
    setNosqlResult: (result) => set({ nosqlResult: result }),
    setNosqlQueryRunning: (isRunning) => set({ nosqlIsQueryRunning: isRunning }),
    setNosqlPagination: (pageIndex, pageSize) => set((state) => {
        const nextPageSize = pageSize || state.nosqlPageSize;
        const nextPageIndex = Math.max(0, Math.floor(pageIndex));
        return {
            nosqlPageIndex: nextPageIndex,
            nosqlPageSize: nextPageSize,
            nosqlWorkspaceStates: updateCurrentWorkspace(state, {
                pageIndex: nextPageIndex,
                pageSize: nextPageSize,
            }),
        };
    }),
});
