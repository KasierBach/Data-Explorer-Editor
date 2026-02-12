import type { IDatabaseAdapter } from "../domain/database-adapter.interface";

import { ApiDatabaseAdapter } from "../adapters/ApiDatabaseAdapter";

/**
 * Service to manage database adapter instances.
 * Follows Singleton/Factory pattern logic.
 */
class ConnectionService {
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
    public getAdapter(connectionId: string, type: 'postgres' | 'mysql' | 'mssql' | 'clickhouse' | 'mock'): IDatabaseAdapter {
        if (this.adapters.has(connectionId)) {
            return this.adapters.get(connectionId)!;
        }

        console.log(`[ConnectionService] Creating ApiAdapter for ${type}`);
        const adapter = new ApiDatabaseAdapter();

        this.adapters.set(connectionId, adapter);
        return adapter;
    }

    public async setActiveConnection(connection: { id: string, type: 'postgres' | 'mysql' | 'mssql' | 'clickhouse' | 'mock' }): Promise<void> {
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
}

export const connectionService = ConnectionService.getInstance();
