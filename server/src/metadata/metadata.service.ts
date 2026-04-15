import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';

@Injectable()
export class MetadataService {
    constructor(
        private readonly connectionsService: ConnectionsService,
        private readonly strategyFactory: DatabaseStrategyFactory,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    private parseNodeId(id: string) {
        const parts = id.split('.');
        let dbName: string | undefined;
        let schemaName: string | undefined;
        let tableName: string | undefined;

        for (const part of parts) {
            if (part.startsWith('db:')) dbName = part.split(':')[1];
            if (part.startsWith('schema:')) schemaName = part.split(':')[1];
            if (part.startsWith('table:') || part.startsWith('view:') || part.startsWith('collection:')) tableName = part.split(':')[1];
        }

        return { dbName, schemaName, tableName };
    }

    private getCacheKey(prefix: string, connectionId: string, userId: string, identifier: string = 'default') {
        return `${prefix}:${userId}:${connectionId}:${identifier}`;
    }

    async getHierarchy(connectionId: string, parentId: string | null, userId: string) {
        const cacheKey = this.getCacheKey('hierarchy', connectionId, userId, parentId || 'root');
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const result = await this._getHierarchyUncached(connectionId, parentId, userId);
        await this.cacheManager.set(cacheKey, result);
        return result;
    }

    private async _getHierarchyUncached(connectionId: string, parentId: string | null, userId: string) {
        const connection = await this.connectionsService.findOne(connectionId, userId);
        const strategy = this.strategyFactory.getStrategy(connection.type);
        const parsed = this.parseNodeId(parentId || '');

        // 1. Root Level — delegate to each strategy's own polymorphic method (OCP)
        if (!parentId) {
            const pool = await this.connectionsService.getPool(connectionId, undefined, userId);
            return strategy.getHierarchyNodes(pool, null, parsed, connection);
        }



        // 2. Folder Level → delegate to strategy
        if (parentId.includes('.folder:')) {
            const dbPool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
            const schema = parsed.schemaName || 'public';

            if (parentId.endsWith('folder:tables')) return strategy.getTables(dbPool, schema, parsed.dbName);
            if (parentId.endsWith('folder:views')) return strategy.getViews(dbPool, schema, parsed.dbName);
            if (parentId.endsWith('folder:functions')) return strategy.getFunctions(dbPool, schema, parsed.dbName);
        }

        // 3. Schema Level → List Folders
        if (parentId.includes('schema:') && !parentId.includes('.table:') && !parentId.includes('.view:') && !parentId.includes('.func:') && !parentId.includes('.collection:')) {
            // MongoDB schemas don't have views or functions in this app
            if (connection.type === 'mongodb' || connection.type === 'mongodb+srv') {
                return strategy.getTables(await this.connectionsService.getPool(connectionId, parsed.dbName, userId), parsed.schemaName || 'public', parsed.dbName);
            }
            
            return [
                { id: `${parentId}.folder:tables`, name: 'Tables', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:views`, name: 'Views', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:functions`, name: 'Functions', type: 'folder', parentId, hasChildren: true },
            ];
        }

        // 4. Database Level → Get Schemas
        if (parentId.startsWith('db:') && !parentId.includes('.schema:')) {
            const dbPool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
            return strategy.getSchemas(dbPool, parsed.dbName);
        }

        // 5. Table/View/Collection Level → Get Columns
        if (parentId.includes('.table:') || parentId.includes('.view:') || parentId.includes('.collection:')) {
            const columns = await this.getColumns(connectionId, parentId, userId);
            return columns.map(col => ({
                id: `${parentId}.column:${col.name}`,
                name: col.name,
                type: col.isPrimaryKey ? 'primary_key' : 'column',
                parentId,
                hasChildren: false,
                metadata: {
                    dataType: col.type,
                    isNullable: col.isNullable
                }
            }));
        }

        // 6. Function Level → Get Parameters
        if (parentId.includes('.func:')) {
            const funcName = parentId.split('.func:')[1];
            const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
            const dbPool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
            const params = await strategy.getFunctionParameters(dbPool, schema, funcName);

            return params.map(col => ({
                id: `${parentId}.param:${col.name}`,
                name: col.name,
                type: 'column',
                parentId,
                hasChildren: false,
                metadata: {
                    dataType: col.type,
                    isNullable: col.isNullable
                }
            }));
        }

        return [];
    }

    async getDatabases(connectionId: string, userId: string) {
        const cacheKey = this.getCacheKey('databases', connectionId, userId);
        const cached = await this.cacheManager.get<string[]>(cacheKey);
        if (cached) return cached;

        const connection = await this.connectionsService.findOne(connectionId, userId);
        const pool = await this.connectionsService.getPool(connectionId, undefined, userId);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        const nodes = await strategy.getDatabases(pool);
        const result = nodes.map(n => n.name);
        
        await this.cacheManager.set(cacheKey, result);
        return result;
    }

    async getRelationships(connectionId: string, userId: string, database?: string) {
        const cacheKey = this.getCacheKey('relationships', connectionId, userId, database);
        const cached = await this.cacheManager.get<any>(cacheKey);
        if (cached) return cached;

        const connection = await this.connectionsService.findOne(connectionId, userId);
        const pool = await this.connectionsService.getPool(connectionId, database, userId);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        const result = await strategy.getRelationships(pool, database);
        await this.cacheManager.set(cacheKey, result);
        return result;
    }

    async getColumns(connectionId: string, tableId: string, userId: string) {
        const cacheKey = this.getCacheKey('columns', connectionId, userId, tableId);
        const cached = await this.cacheManager.get<any>(cacheKey);
        if (cached) return cached;

        const connection = await this.connectionsService.findOne(connectionId, userId);
        const parsed = this.parseNodeId(tableId);

        const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
        const table = parsed.tableName || tableId;

        const pool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        const result = await strategy.getColumns(pool, schema, table, parsed.dbName);
        await this.cacheManager.set(cacheKey, result);
        return result;
    }

    async getDatabaseMetrics(connectionId: string, userId: string, database?: string) {
        const cacheKey = this.getCacheKey('metrics', connectionId, userId, database);
        const cached = await this.cacheManager.get<any>(cacheKey);
        if (cached) return cached;

        const connection = await this.connectionsService.findOne(connectionId, userId);
        const pool = await this.connectionsService.getPool(connectionId, database, userId);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        const result = await strategy.getDatabaseMetrics(pool);
        await this.cacheManager.set(cacheKey, result);
        return result;
    }

    async getFullMetadata(connectionId: string, tableId: string, userId: string) {
        const cacheKey = this.getCacheKey('fullmeta', connectionId, userId, tableId);
        const cached = await this.cacheManager.get<any>(cacheKey);
        if (cached) return cached;

        const connection = await this.connectionsService.findOne(connectionId, userId);
        const parsed = this.parseNodeId(tableId);

        const schema = parsed.schemaName || (connection.type === 'mssql' ? 'dbo' : 'public');
        const table = parsed.tableName || tableId;

        const pool = await this.connectionsService.getPool(connectionId, parsed.dbName, userId);
        const strategy = this.strategyFactory.getStrategy(connection.type);

        const result = await strategy.getFullMetadata(pool, schema, table, parsed.dbName);
        await this.cacheManager.set(cacheKey, result);
        return result;
    }
}
