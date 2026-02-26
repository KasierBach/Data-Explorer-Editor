import type { StateCreator } from 'zustand';

export interface Tab {
    id: string;
    title: string;
    type: 'table' | 'query' | 'settings' | 'insights' | 'dashboard' | 'visualize' | 'erd';
    metadata?: any;
    initialSql?: string;
}

export interface TabSlice {
    tabs: Tab[];
    activeTabId: string | null;
    openTab: (tab: Tab) => void;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    updateTabMetadata: (tabId: string, metadata: any) => void;
    openQueryTab: () => void;
    openInsightsTab: (connectionId: string, database?: string) => void;
    openVisualizeTab: () => void;
    openErdTab: (connectionId: string, database?: string) => void;
}

// Helper type for cross-slice access (connection name lookup)
interface ConnectionLookup {
    connections: { id: string; name: string }[];
}

export const createTabSlice: StateCreator<TabSlice & ConnectionLookup, [], [], TabSlice> = (set, get) => ({
    tabs: [],
    activeTabId: null,

    openTab: (newTab) => set((state) => {
        const exists = state.tabs.find(t => t.id === newTab.id);
        if (exists) return { activeTabId: newTab.id };
        return { tabs: [...state.tabs, newTab], activeTabId: newTab.id };
    }),

    closeTab: (tabId) => set((state) => {
        const newTabs = state.tabs.filter(t => t.id !== tabId);
        let newActiveId = state.activeTabId;
        if (state.activeTabId === tabId) {
            newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }
        return { tabs: newTabs, activeTabId: newActiveId };
    }),

    setActiveTab: (tabId) => set({ activeTabId: tabId }),

    updateTabMetadata: (tabId, metadata) => set((state) => ({
        tabs: state.tabs.map(t =>
            t.id === tabId ? { ...t, metadata: { ...t.metadata, ...metadata } } : t
        ),
    })),

    openQueryTab: () => set((state) => {
        const newTab: Tab = {
            id: `query-${Date.now()}`,
            title: 'New Query',
            type: 'query',
            metadata: {},
        };
        return { tabs: [...state.tabs, newTab], activeTabId: newTab.id };
    }),

    openInsightsTab: (connectionId, database) => set((state) => {
        const id = `insights-${connectionId}${database ? `-${database}` : ''}`;
        const exists = state.tabs.find(t => t.id === id);
        if (exists) return { activeTabId: id };

        const conn = (get() as any).connections?.find((c: any) => c.id === connectionId);
        const newTab: Tab = {
            id,
            title: `Insights: ${conn?.name || 'DB'}${database ? ` (${database})` : ''}`,
            type: 'insights',
            metadata: { connectionId, database },
        };
        return { tabs: [...state.tabs, newTab], activeTabId: id };
    }),

    openVisualizeTab: () => set((state) => {
        const id = 'visualize-hub';
        const exists = state.tabs.find(t => t.id === id);
        if (exists) return { activeTabId: id };
        const newTab: Tab = { id, title: 'Visualizer Hub', type: 'visualize' };
        return { tabs: [...state.tabs, newTab], activeTabId: id };
    }),

    openErdTab: (connectionId, database) => set((state) => {
        const id = `erd-${connectionId}${database ? '-' + database : ''}`;
        const exists = state.tabs.find(t => t.id === id);
        if (exists) return { activeTabId: id };

        const conn = (get() as any).connections?.find((c: any) => c.id === connectionId);
        const newTab: Tab = {
            id,
            title: `ERD: ${conn?.name || 'Default'}${database ? ` (${database})` : ''}`,
            type: 'erd',
            metadata: { connectionId, database },
        };
        return { tabs: [...state.tabs, newTab], activeTabId: id };
    }),
});
