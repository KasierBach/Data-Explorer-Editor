import { create } from 'zustand';

interface Tab {
    id: string;
    title: string;
    type: 'table' | 'query' | 'settings';
    metadata?: any; // e.g. tableId, query content
    initialSql?: string; // For pre-filling query editor
}

export interface Connection {
    id: string;
    name: string;
    type: 'mysql' | 'postgres' | 'clickhouse' | 'mock';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    showAllDatabases?: boolean;
}

interface AppState {
    // Sidebar State
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;

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
    openQueryTab: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Auth
    isAuthenticated: localStorage.getItem('isAuthenticated') === 'true' && !!localStorage.getItem('accessToken'),
    accessToken: localStorage.getItem('accessToken'),
    login: (token, user) => {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({
            isAuthenticated: true,
            accessToken: token,
            user,
            isConnectionDialogOpen: false // Ensure dialog is closed on login
        });
    },
    logout: () => {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        set({ isAuthenticated: false, accessToken: null, user: null });
    },

    // User
    user: (() => {
        try {
            const saved = localStorage.getItem('user');
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            console.error('Failed to parse user', e);
            return null;
        }
    })(),
    updateUser: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        set({ user });
    },

    // Sidebar
    isSidebarOpen: true,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

    // Connection
    connections: (() => {
        try {
            const saved = localStorage.getItem('connections');
            if (!saved) return [
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
            ];
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to parse connections', e);
            return [];
        }
    })(),
    activeConnectionId: localStorage.getItem('activeConnectionId') || null,

    isConnectionDialogOpen: false,
    openConnectionDialog: () => set({ isConnectionDialogOpen: true }),
    closeConnectionDialog: () => set({ isConnectionDialogOpen: false }),

    setActiveConnectionId: (id) => set({ activeConnectionId: id, isSidebarOpen: true }),

    addConnection: (connection) => set((state) => {
        const newConnections = [...state.connections, connection];
        localStorage.setItem('connections', JSON.stringify(newConnections)); // Persist
        return { connections: newConnections };
    }),

    updateConnection: (id, updatedFields) => set((state) => {
        const newConnections = state.connections.map(c =>
            c.id === id ? { ...c, ...updatedFields } : c
        );
        localStorage.setItem('connections', JSON.stringify(newConnections));
        return { connections: newConnections };
    }),

    removeConnection: (id) => set((state) => {
        const newConnections = state.connections.filter(c => c.id !== id);
        localStorage.setItem('connections', JSON.stringify(newConnections));

        // If active connection is removed, deselect it
        const newActiveId = state.activeConnectionId === id ? null : state.activeConnectionId;

        return { connections: newConnections, activeConnectionId: newActiveId };
    }),

    // Tabs
    tabs: [],
    activeTabId: null,

    openTab: (newTab) => set((state) => {
        // If tab already exists, just activate it
        const exists = state.tabs.find(t => t.id === newTab.id);
        if (exists) {
            return { activeTabId: newTab.id };
        }
        return {
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id
        };
    }),

    closeTab: (tabId) => set((state) => {
        const newTabs = state.tabs.filter(t => t.id !== tabId);
        let newActiveId = state.activeTabId;

        // If closing active tab, switch to the last one
        if (state.activeTabId === tabId) {
            newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }

        return {
            tabs: newTabs,
            activeTabId: newActiveId
        };
    }),

    setActiveTab: (tabId) => set({ activeTabId: tabId }),

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
}));
