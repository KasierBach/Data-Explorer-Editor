import type { StateCreator } from 'zustand';

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

export interface ConnectionSlice {
    connections: Connection[];
    activeConnectionId: string | null;
    activeDatabase: string | null;
    isConnectionDialogOpen: boolean;
    openConnectionDialog: () => void;
    closeConnectionDialog: () => void;
    setActiveConnectionId: (id: string | null) => void;
    setActiveDatabase: (db: string | null) => void;
    addConnection: (connection: Connection) => void;
    updateConnection: (id: string, updatedFields: Partial<Connection>) => void;
    removeConnection: (id: string) => void;
}

export const createConnectionSlice: StateCreator<ConnectionSlice> = (set) => ({
    connections: [
        {
            id: 'b115ca80-e468-40bc-b5ae-e03cfab8ac7d',
            name: 'Local Postgres',
            type: 'postgres',
            host: 'localhost',
            port: 5432,
            username: 'postgres',
            password: '123',
            database: 'postgres',
        }
    ],
    activeConnectionId: null,
    activeDatabase: null,
    isConnectionDialogOpen: false,
    openConnectionDialog: () => set({ isConnectionDialogOpen: true }),
    closeConnectionDialog: () => set({ isConnectionDialogOpen: false }),
    setActiveConnectionId: (id) => set({ activeConnectionId: id, activeDatabase: null, isSidebarOpen: true } as any),
    setActiveDatabase: (db) => set({ activeDatabase: db }),
    addConnection: (connection) => set((state) => ({
        connections: [...state.connections, connection],
    })),
    updateConnection: (id, updatedFields) => set((state) => ({
        connections: state.connections.map(c =>
            c.id === id ? { ...c, ...updatedFields } : c
        ),
        activeConnectionId: (updatedFields as any).id && state.activeConnectionId === id
            ? (updatedFields as any).id
            : state.activeConnectionId,
    })),
    removeConnection: (id) => set((state) => {
        const newConnections = state.connections.filter(c => c.id !== id);
        const newActiveId = state.activeConnectionId === id ? null : state.activeConnectionId;
        return { connections: newConnections, activeConnectionId: newActiveId };
    }),
});
