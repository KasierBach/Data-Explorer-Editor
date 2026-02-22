import { Injectable } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';

@Injectable()
export class MetadataService {
    constructor(
        private readonly connectionsService: ConnectionsService,
        private readonly strategyFactory: DatabaseStrategyFactory,
    ) { }

    private parseNodeId(id: string) {
        const parts = id.split('.');
        let dbName: string | undefined;
        let schemaName: string | undefined;
        let tableName: string | undefined;

        for (const part of parts) {
            if (part.startsWith('db:')) dbName = part.split(':')[1];
            if (part.startsWith('schema:')) schemaName = part.split(':')[1];
            if (part.startsWith('table:') || part.startsWith('view:')) tableName = part.split(':')[1];
        }

        return { dbName, schemaName, tableName };
    }

    async getHierarchy(connectionId: string, parentId: string | null) {
        const connection = await this.connectionsService.findOne(connectionId);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        // 1. Root Level
        if (!parentId) {
            if (connection.type === 'postgres') {
                const pool = await this.connectionsService.getPool(connectionId);
                if (connection.showAllDatabases) return strategy.getDatabases(pool);
                return strategy.getSchemas(pool);
            }
            if (connection.type === 'mysql') {
                const pool = await this.connectionsService.getPool(connectionId);
                return strategy.getDatabases(pool);
            }
            if (connection.type === 'mssql') {
                const pool = await this.connectionsService.getPool(connectionId);
                if (connection.showAllDatabases) return strategy.getDatabases(pool);
                return strategy.getSchemas(pool);
            }
            return [];
        }

        const parsed = this.parseNodeId(parentId);

        // 2. Folder Level → delegate to strategy
        if (parentId.includes('.folder:')) {
            const dbPool = await this.connectionsService.getPool(connectionId, parsed.dbName);
            const schema = parsed.schemaName || 'public';

            if (parentId.endsWith('folder:tables')) return strategy.getTables(dbPool, schema, parsed.dbName);
            if (parentId.endsWith('folder:views')) return strategy.getViews(dbPool, schema, parsed.dbName);
            if (parentId.endsWith('folder:functions')) return strategy.getFunctions(dbPool, schema, parsed.dbName);
        }

        // 3. Schema Level → List Folders
        if (parentId.includes('schema:') && !parentId.includes('.table:') && !parentId.includes('.view:')) {
            return [
                { id: `${parentId}.folder:tables`, name: 'Tables', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:views`, name: 'Views', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:functions`, name: 'Functions', type: 'folder', parentId, hasChildren: true },
            ];
        }

        // 4. Database Level → Get Schemas
        if (parentId.startsWith('db:') && !parentId.includes('.schema:')) {
            const dbPool = await this.connectionsService.getPool(connectionId, parsed.dbName);
            return strategy.getSchemas(dbPool, parsed.dbName);
        }

        return [];
    }

    async getDatabases(connectionId: string) {
        const connection = await this.connectionsService.findOne(connectionId);
        const pool = await this.connectionsService.getPool(connectionId);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        const nodes = await strategy.getDatabases(pool);
        return nodes.map(n => n.name);
    }

    async getRelationships(connectionId: string, database?: string) {
        const connection = await this.connectionsService.findOne(connectionId);
        const pool = await this.connectionsService.getPool(connectionId, database);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        return strategy.getRelationships(pool);
    }

    async getColumns(connectionId: string, tableId: string) {
        const connection = await this.connectionsService.findOne(connectionId);
        const parsed = this.parseNodeId(tableId);

        const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
        const table = parsed.tableName || tableId;

        const pool = await this.connectionsService.getPool(connectionId, parsed.dbName);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        return strategy.getColumns(pool, schema, table);
    }

    async getDatabaseMetrics(connectionId: string, database?: string) {
        const connection = await this.connectionsService.findOne(connectionId);
        const pool = await this.connectionsService.getPool(connectionId, database);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        return strategy.getDatabaseMetrics(pool);
    }
}
