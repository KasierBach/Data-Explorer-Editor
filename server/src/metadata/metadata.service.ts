import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import type { IDatabaseStrategy } from '../database-strategies/database-strategy.interface';

interface ConnectionContext {
    connection: any;
    pool: any;
    strategy: IDatabaseStrategy;
}

@Injectable()
export class MetadataService {
    constructor(
        private readonly connectionsService: ConnectionsService,
        private readonly strategyFactory: DatabaseStrategyFactory,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    private getCacheKey(prefix: string, connectionId: string, userId: string, identifier: string = 'default') {
        return `${prefix}:${userId}:${connectionId}:${identifier}`;
    }

    private async withCache<T>(cacheKey: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
        const cached = await this.cacheManager.get<T>(cacheKey);
        if (cached) return cached;
        const result = await fetchFn();
        await this.cacheManager.set(cacheKey, result, ttl);
        return result;
    }

    private async getConnectionContext(connectionId: string, userId: string, database?: string): Promise<ConnectionContext> {
        const connection = await this.connectionsService.findOne(connectionId, userId);
        const pool = await this.connectionsService.getPool(connectionId, database, userId);
        const strategy = this.strategyFactory.getStrategy(connection.type);
        return { connection, pool, strategy };
    }

    private parseNodeId(id: string) {
        const parts = id.split(':');
        return {
            dbName: parts.find(p => p.startsWith('db'))?.split(':')[1],
            schemaName: parts.find(p => p.startsWith('schema'))?.split(':')[1],
            tableName: parts.find(p => p.startsWith('table') || p.startsWith('view') || p.startsWith('collection'))?.split(':')[1],
        };
    }

    async getHierarchy(connectionId: string, parentId: string | null, userId: string) {
        const cacheKey = this.getCacheKey('hierarchy', connectionId, userId, parentId || 'root');
        return this.withCache(cacheKey, () => this._getHierarchyUncached(connectionId, parentId, userId));
    }

    private async _getHierarchyUncached(connectionId: string, parentId: string | null, userId: string) {
        const { connection, pool, strategy } = await this.getConnectionContext(connectionId, userId);
        const parsed = this.parseNodeId(parentId || '');

        if (!parentId) {
            return strategy.getHierarchyNodes(pool, null, parsed, connection);
        }

        if (parentId.includes('.folder:')) {
            const dbPool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
            const schema = parsed.schemaName || 'public';

            if (parentId.endsWith('folder:tables')) return strategy.getTables(dbPool, schema, parsed.dbName);
            if (parentId.endsWith('folder:views')) return strategy.getViews(dbPool, schema, parsed.dbName);
            if (parentId.endsWith('folder:functions')) return strategy.getFunctions(dbPool, schema, parsed.dbName);
        }

        if (parentId.includes('schema:') && !parentId.includes('.table:') && !parentId.includes('.view:') && !parentId.includes('.func:') && !parentId.includes('.collection:')) {
            if (connection.type === 'mongodb' || connection.type === 'mongodb+srv') {
                return strategy.getTables(pool, parsed.schemaName || 'public', parsed.dbName);
            }

            return [
                { id: `${parentId}.folder:tables`, name: 'Tables', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:views`, name: 'Views', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:functions`, name: 'Functions', type: 'folder', parentId, hasChildren: true },
            ];
        }

        if (parentId.startsWith('db:') && !parentId.includes('.schema:')) {
            return strategy.getSchemas(pool, parsed.dbName);
        }

        if (parentId.includes('.table:') || parentId.includes('.view:') || parentId.includes('.collection:')) {
            const columns = await this.getColumns(connectionId, parentId, userId);
            return columns.map(col => ({
                id: `${parentId}.column:${col.name}`,
                name: col.name,
                type: col.isPrimaryKey ? 'primary_key' : 'column',
                parentId,
                hasChildren: false,
                metadata: { dataType: col.type, isNullable: col.isNullable }
            }));
        }

        if (parentId.includes('.func:')) {
            const funcName = parentId.split('.func:')[1];
            const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
            const params = await strategy.getFunctionParameters(pool, schema, funcName);

            return params.map(col => ({
                id: `${parentId}.param:${col.name}`,
                name: col.name,
                type: 'column',
                parentId,
                hasChildren: false,
                metadata: { dataType: col.type, isNullable: col.isNullable }
            }));
        }

        return [];
    }

    async getDatabases(connectionId: string, userId: string) {
        const cacheKey = this.getCacheKey('databases', connectionId, userId);
        return this.withCache(cacheKey, async () => {
            const { pool, strategy } = await this.getConnectionContext(connectionId, userId);
            const nodes = await strategy.getDatabases(pool);
            return nodes.map(n => n.name);
        });
    }

    async getRelationships(connectionId: string, userId: string, database?: string) {
        const cacheKey = this.getCacheKey('relationships', connectionId, userId, database);
        return this.withCache(cacheKey, async () => {
            const { pool, strategy } = await this.getConnectionContext(connectionId, userId, database);
            return strategy.getRelationships(pool, database);
        });
    }

    async getColumns(connectionId: string, tableId: string, userId: string) {
        const cacheKey = this.getCacheKey('columns', connectionId, userId, tableId);
        return this.withCache(cacheKey, async () => {
            const { connection, strategy } = await this.getConnectionContext(connectionId, userId);
            const parsed = this.parseNodeId(tableId);
            const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
            const table = parsed.tableName || tableId;
            const pool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
            return strategy.getColumns(pool, schema, table, parsed.dbName);
        });
    }

    async getDatabaseMetrics(connectionId: string, userId: string, database?: string) {
        const cacheKey = this.getCacheKey('metrics', connectionId, userId, database);
        return this.withCache(cacheKey, async () => {
            const { pool, strategy } = await this.getConnectionContext(connectionId, userId, database);
            return strategy.getDatabaseMetrics(pool);
        });
    }

    async getFullMetadata(connectionId: string, tableId: string, userId: string) {
        const cacheKey = this.getCacheKey('fullmeta', connectionId, userId, tableId);
        return this.withCache(cacheKey, async () => {
            const { connection, strategy } = await this.getConnectionContext(connectionId, userId);
            const parsed = this.parseNodeId(tableId);
            const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
            const table = parsed.tableName || tableId;
            const pool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
            return strategy.getFullMetadata(pool, schema, table, parsed.dbName);
        });
    }
}
