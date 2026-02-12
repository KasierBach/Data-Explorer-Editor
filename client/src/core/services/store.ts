import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Tab {
    id: string;
    title: string;
    type: 'table' | 'query' | 'settings' | 'insights' | 'dashboard' | 'visualize' | 'erd';
    metadata?: any; // e.g. tableId, query content, ERD layout
    initialSql?: string; // For pre-filling query editor
}

export interface Connection {
    id: string;
    name: string;
    type: 'mysql' | 'postgres' | 'mssql' | 'clickhouse' | 'mock';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    showAllDatabases?: boolean;
}

export interface SavedQuery {
    id: string;
    name: string;
    sql: string;
    database?: string;
    createdAt: number;
    updatedAt: number;
}

interface AppState {
    // Sidebar State
    isSidebarOpen: boolean;
    sidebarWidth: number;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;
    setSidebarWidth: (width: number) => void;

    // Connection State
    connections: Connection[];
    activeConnectionId: string | null;
    isConnectionDialogOpen: boolean;
    openConnectionDialog: () => void;
    closeConnectionDialog: () => void;

    setActiveConnectionId: (id: string | null) => void;
    addConnection: (connection: Connection) => void;
    updateConnection: (id: string, connection: Partial<Connection>) => void;
    removeConnection: (id: string) => void;

    // Active Database
    activeDatabase: string | null;
    setActiveDatabase: (db: string | null) => void;

    // Auth State
    isAuthenticated: boolean;
    accessToken: string | null;
    login: (token: string, user: { name: string; email: string }) => void;
    logout: () => void;

    // User State
    user: { name: string; email: string } | null;
    updateUser: (user: { name: string; email: string }) => void;

    // Tabs State
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

    // Saved Queries
    savedQueries: SavedQuery[];
    saveQuery: (query: SavedQuery) => void;
    updateSavedQuery: (id: string, updates: Partial<SavedQuery>) => void;
    deleteSavedQuery: (id: string) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Sidebar
            isSidebarOpen: true,
            sidebarWidth: 20,
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
            setSidebarWidth: (width) => set({ sidebarWidth: width }),

            // Auth
            isAuthenticated: false,
            accessToken: null,
            user: null,
            login: (token, user) => set({
                isAuthenticated: true,
                accessToken: token,
                user,
                isConnectionDialogOpen: false
            }),
            logout: () => set({ isAuthenticated: false, accessToken: null, user: null }),
            updateUser: (user) => set({ user }),

            // Connection
            connections: [
                {
                    id: 'local-pg',
                    name: 'Local Postgres',
                    type: 'postgres',
                    host: 'localhost',
                    port: 5432,
                    username: 'postgres',
                    password: '123',
                    database: 'postgres'
                }
            ],
            activeConnectionId: null,
            activeDatabase: null,
            isConnectionDialogOpen: false,
            openConnectionDialog: () => set({ isConnectionDialogOpen: true }),
            closeConnectionDialog: () => set({ isConnectionDialogOpen: false }),

            setActiveConnectionId: (id) => set({ activeConnectionId: id, activeDatabase: null, isSidebarOpen: true }),
            setActiveDatabase: (db) => set({ activeDatabase: db }),

            addConnection: (connection) => set((state) => ({
                connections: [...state.connections, connection]
            })),

            updateConnection: (id, updatedFields) => set((state) => ({
                connections: state.connections.map(c =>
                    c.id === id ? { ...c, ...updatedFields } : c
                )
            })),

            removeConnection: (id) => set((state) => {
                const newConnections = state.connections.filter(c => c.id !== id);
                const newActiveId = state.activeConnectionId === id ? null : state.activeConnectionId;
                return { connections: newConnections, activeConnectionId: newActiveId };
            }),

            // Tabs
            tabs: [],
            activeTabId: null,

            openTab: (newTab) => set((state) => {
                const exists = state.tabs.find(t => t.id === newTab.id);
                if (exists) return { activeTabId: newTab.id };
                return {
                    tabs: [...state.tabs, newTab],
                    activeTabId: newTab.id
                };
            }),

            closeTab: (tabId) => set((state) => {
                const newTabs = state.tabs.filter(t => t.id !== tabId);
                let newActiveId = state.activeTabId;
                if (state.activeTabId === tabId) {
                    newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
                }
                return {
                    tabs: newTabs,
                    activeTabId: newActiveId
                };
            }),

            setActiveTab: (tabId) => set({ activeTabId: tabId }),

            updateTabMetadata: (tabId, metadata) => set((state) => ({
                tabs: state.tabs.map(t =>
                    t.id === tabId ? { ...t, metadata: { ...t.metadata, ...metadata } } : t
                )
            })),

            openQueryTab: () => set((state) => {
                const newTab: Tab = {
                    id: `query-${Date.now()}`,
                    title: 'New Query',
                    type: 'query',
                    metadata: {}
                };
                return {
                    tabs: [...state.tabs, newTab],
                    activeTabId: newTab.id
                };
            }),

            openInsightsTab: (connectionId, database) => set((state) => {
                const id = `insights-${connectionId}${database ? `-${database}` : ''}`;
                const exists = state.tabs.find(t => t.id === id);
                if (exists) return { activeTabId: id };

                const conn = state.connections.find(c => c.id === connectionId);
                const newTab: Tab = {
                    id,
                    title: `Insights: ${conn?.name || 'DB'}${database ? ` (${database})` : ''}`,
                    type: 'insights',
                    metadata: { connectionId, database }
                };

                return {
                    tabs: [...state.tabs, newTab],
                    activeTabId: id
                };
            }),

            openVisualizeTab: () => set((state) => {
                const id = 'visualize-hub';
                const exists = state.tabs.find(t => t.id === id);
                if (exists) return { activeTabId: id };

                const newTab: Tab = {
                    id,
                    title: 'Visualizer Hub',
                    type: 'visualize',
                };

                return {
                    tabs: [...state.tabs, newTab],
                    activeTabId: id
                };
            }),

            openErdTab: (connectionId, database) => set((state) => {
                const id = `erd-${connectionId}${database ? '-' + database : ''}`;
                const exists = state.tabs.find(t => t.id === id);
                if (exists) return { activeTabId: id };

                const conn = state.connections.find(c => c.id === connectionId);
                const newTab: Tab = {
                    id,
                    title: `ERD: ${conn?.name || 'Default'}${database ? ` (${database})` : ''}`,
                    type: 'erd',
                    metadata: { connectionId, database }
                };

                return {
                    tabs: [...state.tabs, newTab],
                    activeTabId: id
                };
            }),

            // Saved Queries
            savedQueries: [],
            saveQuery: (query) => set((state) => ({
                savedQueries: [...state.savedQueries, query]
            })),
            updateSavedQuery: (id, updates) => set((state) => ({
                savedQueries: state.savedQueries.map(q =>
                    q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q
                )
            })),
            deleteSavedQuery: (id) => set((state) => ({
                savedQueries: state.savedQueries.filter(q => q.id !== id)
            })),
        }),
        {
            name: 'data-explorer-storage',
            storage: createJSONStorage(() => localStorage),
            // Only persist essential state
            partialize: (state) => ({
                connections: state.connections,
                activeConnectionId: state.activeConnectionId,
                isAuthenticated: state.isAuthenticated,
                accessToken: state.accessToken,
                user: state.user,
                tabs: state.tabs,
                activeTabId: state.activeTabId,
                isSidebarOpen: state.isSidebarOpen,
                sidebarWidth: state.sidebarWidth,
                savedQueries: state.savedQueries,
            }),
        }
    )
);
