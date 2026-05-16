import type { IDatabaseAdapter } from "../domain/database-adapter.interface";

import { ApiDatabaseAdapter } from "../adapters/ApiDatabaseAdapter";
import { apiService } from "./api.service";
import { SearchService } from "./SearchService";
import type { Connection } from "./store/slices/connectionSlice";

type CreateConnectionPayload = Omit<Connection, 'id'>;
type UpdateConnectionPayload = Partial<Omit<Connection, 'id'>>;

interface ConnectionHealthResult {
    status: 'healthy' | 'error';
    checkedAt?: string;
    latencyMs: number;
    error: string | null;
}

/**
 * Service to manage database adapter instances.
 * Follows Singleton/Factory pattern logic.
 */
export class ConnectionService {
    private static instance: ConnectionService;
    private activeAdapter: IDatabaseAdapter | null = null;
    private adapters: Map<string, IDatabaseAdapter> = new Map();

    private constructor() { }

    public static getInstance(): ConnectionService {
        if (!ConnectionService.instance) {
            ConnectionService.instance = new ConnectionService();
        }
        return ConnectionService.instance;
    }

    /**
     * Factory method to get or create an adapter for a connection.
     */
    public getAdapter(connectionId: string, _type: Connection['type']): IDatabaseAdapter {
        void _type;

        if (this.adapters.has(connectionId)) {
            return this.adapters.get(connectionId)!;
        }

        const adapter = new ApiDatabaseAdapter();

        this.adapters.set(connectionId, adapter);
        return adapter;
    }

    public async setActiveConnection(connection: Connection): Promise<void> {
        const adapter = this.getAdapter(connection.id, connection.type);

        // Always connect to ensure config is updated (e.g. showAllDatabases flag)
        // The adapter should handle efficient re-connection or no-op if identical
        if (this.activeAdapter !== adapter) {
            if (this.activeAdapter) {
                // Optional: await this.activeAdapter.disconnect(); 
            }
            this.activeAdapter = adapter;
        }

        await adapter.connect(connection);
    }

    public getActiveAdapter(): IDatabaseAdapter | null {
        return this.activeAdapter;
    }

    // ─── API Methods ───

    public static async getConnections(): Promise<Connection[]> {
        return await apiService.get<Connection[]>('/connections');
    }

    public static async testConnection(data: CreateConnectionPayload): Promise<ConnectionHealthResult> {
        return await apiService.post<ConnectionHealthResult>('/connections/test', data);

    }

    public static async createConnection(data: CreateConnectionPayload): Promise<Connection> {
        const result = await apiService.post<Connection>('/connections', data);
        void SearchService.syncIndex().catch(() => undefined);
        return result;
    }

    public static async updateConnection(id: string, updates: UpdateConnectionPayload): Promise<void> {
        await apiService.patch(`/connections/${id}`, updates);
        void SearchService.syncIndex().catch(() => undefined);
    }

    public static async checkConnectionHealth(id: string): Promise<ConnectionHealthResult> {
        return await apiService.post(`/connections/${id}/health-check`, {});
    }

    public static async deleteConnection(id: string): Promise<void> {
        await apiService.delete(`/connections/${id}`);
        void SearchService.syncIndex().catch(() => undefined);
    }
}

export const connectionService = ConnectionService.getInstance();
