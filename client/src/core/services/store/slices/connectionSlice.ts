import type { StateCreator } from 'zustand';

export interface Connection {
    id: string;
    name: string;
    type: 'postgres' | 'cockroach' | 'mysql' | 'mariadb' | 'mssql' | 'sqlite' | 'clickhouse' | 'mock' | 'mongodb' | 'mongodb+srv' | 'redis';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    tls?: boolean;
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
    sshHost?: string;
    sshPort?: number;
    sshUsername?: string;
    sshPrivateKey?: string;
    sshPassphrase?: string;
    environment?: 'development' | 'staging' | 'production' | 'none';
}

export interface ConnectionSlice {
    connections: Connection[];
    activeConnectionId: string | null;
    activeDatabase: string | null;
    isConnectionDialogOpen: boolean;
    editingConnectionId: string | null;
    openConnectionDialog: (connectionId?: string | null) => void;
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
    editingConnectionId: null,
    openConnectionDialog: (connectionId?: string | null) => set({ isConnectionDialogOpen: true, editingConnectionId: connectionId ?? null }),
    closeConnectionDialog: () => set({ isConnectionDialogOpen: false, editingConnectionId: null }),
    setActiveConnectionId: (id) => set({ activeConnectionId: id, activeDatabase: null }),
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
