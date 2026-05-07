import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import type { IDatabaseStrategy } from '../database-strategies/database-strategy.interface';
import { FreshnessService } from '../common/freshness/freshness.service';

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
        private readonly freshnessService: FreshnessService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    private async getCacheKey(prefix: string, connectionId: string, identifier: string = 'default') {
        return this.freshnessService.buildKey(
            prefix,
            [connectionId],
            [identifier],
        );
    }

    private async withCache<T>(cacheKey: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
        const cached = await this.cacheManager.get<T>(cacheKey);
        if (cached) return cached;
        const result = await fetchFn();
        // TTL is in milliseconds for redisStore in recent versions
        await this.cacheManager.set(cacheKey, result, ttl as any);
        return result;
    }

    private async getConnectionContext(connectionId: string, userId: string, database?: string): Promise<ConnectionContext> {
        const connection = await this.connectionsService.findOne(connectionId, userId);
        const pool = await this.connectionsService.getPool(connectionId, database, userId);
        const strategy = this.strategyFactory.getStrategy(connection.type);
        return { connection, pool, strategy };
    }

    private parseNodeId(id: string) {
        return {
            dbName: id.match(/db:([^.]+)/)?.[1],
            schemaName: id.match(/schema:([^.]+)/)?.[1],
            tableName: id.match(/(?:table|view|collection):([^.]+)/)?.[1],
        };
    }

    async getHierarchy(connectionId: string, parentId: string | null, userId: string) {
        const cacheKey = await this.getCacheKey('hierarchy', connectionId, parentId || 'root');
        return this.withCache(cacheKey, () => this._getHierarchyUncached(connectionId, parentId, userId), 3600000);
    }

    private async _getHierarchyUncached(connectionId: string, parentId: string | null, userId: string) {
        const parsed = this.parseNodeId(parentId || '');
        const { connection, pool, strategy } = await this.getConnectionContext(connectionId, userId, parsed.dbName);

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
        const cacheKey = await this.getCacheKey('databases', connectionId);
        return this.withCache(cacheKey, async () => {
            const { pool, strategy } = await this.getConnectionContext(connectionId, userId);
            const nodes = await strategy.getDatabases(pool);
            return nodes.map(n => n.name);
        }, 3600000);
    }

    async getRelationships(connectionId: string, userId: string, database?: string) {
        const cacheKey = await this.getCacheKey('relationships', connectionId, database || 'default');
        return this.withCache(cacheKey, async () => {
            const { pool, strategy } = await this.getConnectionContext(connectionId, userId, database);
            return strategy.getRelationships(pool, database);
        }, 3600000);
    }

    async getColumns(connectionId: string, tableId: string, userId: string) {
        const cacheKey = await this.getCacheKey('columns', connectionId, tableId);
        return this.withCache(cacheKey, async () => {
            const { connection, strategy } = await this.getConnectionContext(connectionId, userId);
            const parsed = this.parseNodeId(tableId);
            const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
            const table = parsed.tableName || tableId;
            const pool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
            return strategy.getColumns(pool, schema, table, parsed.dbName);
        }, 3600000);
    }

    async getDatabaseMetrics(connectionId: string, userId: string, database?: string) {
        const cacheKey = await this.getCacheKey('metrics', connectionId, database || 'default');
        return this.withCache(cacheKey, async () => {
            const { pool, strategy } = await this.getConnectionContext(connectionId, userId, database);
            return strategy.getDatabaseMetrics(pool);
        }, 300000); // 5 mins
    }

    async getFullMetadata(connectionId: string, tableId: string, userId: string) {
        const cacheKey = await this.getCacheKey('fullmeta', connectionId, tableId);
        return this.withCache(cacheKey, async () => {
            const { connection, strategy } = await this.getConnectionContext(connectionId, userId);
            const parsed = this.parseNodeId(tableId);
            const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
            const table = parsed.tableName || tableId;
            const pool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
            return strategy.getFullMetadata(pool, schema, table, parsed.dbName);
        }, 3600000);
    }

    async refresh(connectionId: string, userId: string, database?: string) {
        await this.connectionsService.findOne(connectionId, userId);
        await this.freshnessService.bump('hierarchy', [connectionId]);
        await this.freshnessService.bump('databases', [connectionId]);
        await this.freshnessService.bump('relationships', [connectionId]);
        await this.freshnessService.bump('columns', [connectionId]);
        await this.freshnessService.bump('metrics', [connectionId]);
        await this.freshnessService.bump('fullmeta', [connectionId]);
        await this.freshnessService.bump('ai-schema', [connectionId, database || 'default']);
        return { success: true };
    }
}
