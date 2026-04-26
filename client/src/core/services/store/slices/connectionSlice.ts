import type { StateCreator } from 'zustand';

export interface Connection {
    id: string;
    name: string;
    type: 'postgres' | 'mysql' | 'mssql' | 'sqlite' | 'clickhouse' | 'mock' | 'mongodb' | 'mongodb+srv' | 'redis';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    showAllDatabases?: boolean;
    readOnly?: boolean;
    allowSchemaChanges?: boolean;
    allowImportExport?: boolean;
    allowQueryExecution?: boolean;
    lastHealthCheckAt?: string;
    lastHealthStatus?: 'healthy' | 'error';
    lastHealthError?: string | null;
    lastConnectedAt?: string;
    lastConnectionLatencyMs?: number | null;
    organizationId?: string | null;
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
    setConnections: (connections: Connection[]) => void;
}

export const createConnectionSlice: StateCreator<ConnectionSlice> = (set) => ({
    connections: [],
    activeConnectionId: null,
    activeDatabase: null,
    isConnectionDialogOpen: false,
    openConnectionDialog: () => set({ isConnectionDialogOpen: true }),
    closeConnectionDialog: () => set({ isConnectionDialogOpen: false }),
    setActiveConnectionId: (id) => set({ activeConnectionId: id, activeDatabase: null } as any),
    setActiveDatabase: (db) => set({ activeDatabase: db }),
    addConnection: (connection) => set((state) => ({
        connections: [...state.connections, connection],
    })),
    updateConnection: (id, updatedFields) => set((state) => {
        const newConnections = state.connections.map(c => c.id === id ? { ...c, ...updatedFields } : c);
        const newActiveId = updatedFields.id && state.activeConnectionId === id ? updatedFields.id : state.activeConnectionId;
        return { connections: newConnections, activeConnectionId: newActiveId };
    }),
    removeConnection: (id) => set((state) => {
        const newConnections = state.connections.filter(c => c.id !== id);
        const newActiveId = state.activeConnectionId === id ? null : state.activeConnectionId;
        return { connections: newConnections, activeConnectionId: newActiveId };
    }),
    setConnections: (connections: Connection[]) => set({ connections }),
});
