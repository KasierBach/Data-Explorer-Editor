import { MongoClient, ObjectId } from 'mongodb';
import { Injectable, Logger } from '@nestjs/common';
import {
    IDatabaseStrategy,
    QueryResult,
    TreeNodeResult,
    ColumnInfo,
    FullTableMetadata,
    Relationship,
    DatabaseMetrics,
    UpdateRowParams,
    ConnectionConfig,
    InsertRowParams,
} from './database-strategy.interface';
import { sanitizeNoSql, validateNoSqlPayload } from '../common/utils/nosql-sanitizer.util';

const inferType = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') {
        if ((value as { _bsontype?: string })._bsontype === 'ObjectId') return 'objectId';
        return 'object';
    }
    return typeof value;
};

@Injectable()
export class MongoDbStrategy implements IDatabaseStrategy {
    private readonly logger = new Logger(MongoDbStrategy.name);
    async createPool(connectionConfig: any, databaseOverride?: string): Promise<MongoClient> {
        let uri = connectionConfig.url || '';
        if (!uri && connectionConfig.host && connectionConfig.host.includes('://')) {
            uri = connectionConfig.host;
        }

        if (!uri) {
            let host = connectionConfig.host?.trim();
            if (!host) {
                throw new Error('Host is required for MongoDB connections.');
            }

            // DB schema stores 'username', not 'user'
            const user = connectionConfig.username || connectionConfig.user;
            const auth = user 
                ? `${encodeURIComponent(user)}:${encodeURIComponent(connectionConfig.password || '')}@` 
                : '';
            
            // Strip protocol if present in host field (common error with Atlas URIs)
            if (host.includes('://')) {
                host = host.split('://')[1];
            }
            
            const port = connectionConfig.port || 27017;
            const db = databaseOverride || connectionConfig.database || '';
            const protocol = connectionConfig.type === 'mongodb+srv' ? 'mongodb+srv' : 'mongodb';
            
            // Build query params
            const params: string[] = [];
            if (connectionConfig.ssl) params.push('tls=true');
            if (protocol === 'mongodb+srv') {
                params.push('retryWrites=true', 'w=majority');
            }
            const queryString = params.length > 0 ? `?${params.join('&')}` : '';
            
            const dbName = db ? `/${db}` : '/';
            uri = protocol === 'mongodb+srv'
                ? `${protocol}://${auth}${host}${dbName}${queryString}`
                : `${protocol}://${auth}${host}:${port}${dbName}${queryString}`;
        }

        this.logger.log(`[MongoDbStrategy] Connecting to: ${uri.replace(/\/\/[^@]+@/, '//***:***@')}`);

        // Support timeout overrides for migration pools (0 = unlimited)
        const socketTimeout = connectionConfig.socketTimeout ?? 30000;

        const client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: socketTimeout || 0,
        });

        await client.connect();
        this.logger.log(`[MongoDbStrategy] Connected successfully.`);
        return client;
    }

    async closePool(client: MongoClient): Promise<void> {
        if (client) {
            await client.close();
        }
    }

    async executeQuery(client: MongoClient, queryPayloadStr: string, options?: { limit?: number; offset?: number }): Promise<QueryResult> {
        let payload: any;
        try {
            payload = JSON.parse(queryPayloadStr);
        } catch (e) {
            throw new Error(`Invalid MongoDB query payload (must be valid JSON). Received: ${queryPayloadStr}`);
        }

        // Validate top-level structure and sanitize nested operators
        validateNoSqlPayload(payload);
        const filter = sanitizeNoSql(payload.filter || {});
        const update = sanitizeNoSql(payload.update || {});
        const document = sanitizeNoSql(payload.document || {});
        const documents = Array.isArray(payload.documents) ? payload.documents.map(d => sanitizeNoSql(d)) : [];
        const pipeline = Array.isArray(payload.pipeline) ? payload.pipeline.map(p => sanitizeNoSql(p)) : [];

        const db = client.db();
        const col = db.collection(payload.collection);

        let result: any;
        let rows: any[] = [];
        let columns: string[] = [];

        switch (payload.action) {
            case 'find':
                const limit = options?.limit || Math.min(payload.limit || 50000, 50000);
                const skip = options?.offset || 0;
                result = await col.find(filter, payload.options || {}).skip(skip).limit(limit).maxTimeMS(30000).toArray();
                rows = result;
                break;
            case 'aggregate':
                result = await col.aggregate(pipeline).maxTimeMS(30000).toArray();
                rows = result.slice(0, 50000); // Slice aggregation result to avoid OOM
                break;
            case 'count':
                result = await col.countDocuments(filter, payload.options || {});
                rows = [{ count: result }];
                break;
            case 'insertOne':
                result = await col.insertOne(document);
                rows = [{ insertedId: result.insertedId.toString() }];
                break;
            case 'insertMany':
                result = await col.insertMany(documents);
                rows = [{ insertedCount: result.insertedCount }];
                break;
            case 'updateOne':
                result = await col.updateOne(filter, update, payload.options || {});
                rows = [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
                break;
            case 'updateMany':
                result = await col.updateMany(filter, update, payload.options || {});
                rows = [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
                break;
            case 'deleteOne':
                result = await col.deleteOne(filter);
                rows = [{ deletedCount: result.deletedCount }];
                break;
            case 'deleteMany':
                result = await col.deleteMany(filter);
                rows = [{ deletedCount: result.deletedCount }];
                break;
            case 'distinct':
                const distinctField = payload.field;
                if (!distinctField || typeof distinctField !== 'string') {
                    throw new Error('Distinct action requires a "field" parameter.');
                }
                result = await col.distinct(distinctField, filter, payload.options || {});
                rows = result.map((value: unknown) => ({ value }));
                break;
            default:
                throw new Error(`Unsupported MongoDB action: ${payload.action}`);
        }

        const colSet = new Set<string>();
        for (const row of rows.slice(0, 50)) {
            Object.keys(row).forEach(k => colSet.add(k));
        }
        columns = Array.from(colSet);

        // Serialize ObjectIds
        rows = rows.map(row => {
            const cleanRow = { ...row };
            for (const key of Object.keys(cleanRow)) {
                 if (cleanRow[key] && cleanRow[key]._bsontype === 'ObjectId') {
                     cleanRow[key] = cleanRow[key].toString();
                 }
            }
            return cleanRow;
        });

        return { rows, columns, rowCount: rows.length };
    }

    async updateRow(client: MongoClient, params: UpdateRowParams): Promise<{ success: boolean; rowCount: number }> {
        const db = client.db();
        const col = db.collection(params.table);
        
        const updatesCpy = { ...params.updates };
        delete updatesCpy._id;

        try {
            const pkValue = params.pkValue;
            const filter = params.pkColumn === '_id' 
                ? { _id: new ObjectId(pkValue as string) } 
                : { [params.pkColumn]: pkValue };
            const result = await col.updateOne(filter, { $set: updatesCpy });
            return {
                success: result.acknowledged,
                rowCount: result.modifiedCount
            };
        } catch (error) {
            const filter = { [params.pkColumn]: params.pkValue };
            const result = await col.updateOne(filter, { $set: updatesCpy });
            return {
                success: result.acknowledged,
                rowCount: result.modifiedCount
            };
        }
    }

    async insertRow(client: MongoClient, params: InsertRowParams): Promise<{ success: boolean; rowCount: number }> {
        const db = client.db();
        const col = db.collection(params.table);
        const res = await col.insertOne(params.data);
        return { success: res.acknowledged, rowCount: res.acknowledged ? 1 : 0 };
    }

    async deleteRows(client: MongoClient, params: any): Promise<{ success: boolean; rowCount: number }> {
        const db = client.db();
        const col = db.collection(params.table);
        const values = params.pkValues.map(v => {
            if (params.pkColumn === '_id' && typeof v === 'string' && ObjectId.isValid(v)) {
                return new ObjectId(v);
            }
            return v;
        });
        const filter = { [params.pkColumn]: { $in: values } };
        const res = await col.deleteMany(filter);
        return { success: res.acknowledged, rowCount: res.deletedCount };
    }

    async importData(client: MongoClient, params: { schema: string; table: string; data: any[] }): Promise<{ success: boolean; rowCount: number }> {
        const db = client.db();
        const col = db.collection(params.table);
        
        if (!params.data || params.data.length === 0) return { success: true, rowCount: 0 };
        
        const res = await col.insertMany(params.data);
        return { success: res.acknowledged, rowCount: res.insertedCount };
    }

    async exportStream(client: MongoClient, schema: string, table: string): Promise<any> {
        const db = client.db();
        const col = db.collection(table);
        return col.find().stream();
    }

    buildAlterTableSql(quotedTable: string, op: any): string {
        throw new Error('Not applicable for MongoDB');
    }

    quoteIdentifier(name: string): string {
        return name;
    }

    quoteTable(schema: string | undefined, table: string): string {
        return table; 
    }

    async createDatabase(client: MongoClient, name: string): Promise<void> {
        const db = client.db(name);
        await db.createCollection('_init');
        await db.collection('_init').drop();
    }

    async dropDatabase(client: MongoClient, name: string): Promise<void> {
        await client.db(name).dropDatabase();
    }

    async getDatabases(client: MongoClient): Promise<TreeNodeResult[]> {
        try {
            const adminDb = client.db().admin();
            const result = await adminDb.listDatabases();
            return result.databases.map((db: any) => ({
                id: `db:${db.name}`,
                name: db.name,
                type: 'database',
                parentId: 'root',
                hasChildren: true
            }));
        } catch (error) {
            this.logger.warn('[MongoDbStrategy] listDatabases failed, falling back to current db:', error instanceof Error ? error.message : 'Unknown error');
            const currentDb = client.db().databaseName;
            return [{
                id: `db:${currentDb}`,
                name: currentDb,
                type: 'database',
                parentId: 'root',
                hasChildren: true
            }];
        }
    }

    async getSchemas(client: MongoClient, dbName?: string): Promise<TreeNodeResult[]> {
        // Pseudo schema 'public' to satisfy the client's current tree structure expectation
        const dbId = `db:${dbName || 'default'}`;
        return [{
            id: `${dbId}.schema:public`,
            name: 'public',
            type: 'schema',
            parentId: dbId,
            hasChildren: true
        }];
    }

    async getTables(client: MongoClient, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const db = dbName ? client.db(dbName) : client.db();
        const collections = await db.listCollections().toArray();
        const parentId = `db:${dbName || 'default'}.schema:${schema}`;
        return collections.map(col => ({
            id: `${parentId}.collection:${col.name}`,
            name: col.name,
            type: 'collection',
            parentId: parentId,
            hasChildren: true // For MongoDB, tables (collections) have columns/fields as children in this app's architecture
        }));
    }

    async getViews(client: MongoClient, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        return [];
    }

    async getFunctions(client: MongoClient, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        return [];
    }

    async getFunctionParameters(client: MongoClient, schema: string, func: string): Promise<ColumnInfo[]> {
        return [];
    }

    async getColumns(client: MongoClient, schema: string, table: string, dbName?: string): Promise<ColumnInfo[]> {
        const db = dbName ? client.db(dbName) : client.db();
        const MAX_DEPTH = 2;
        const MAX_COLUMNS = 40;
        const SAMPLE_SIZE = 20;

        const docs = await db.collection(table).find({}).limit(SAMPLE_SIZE).toArray();
        const colsMap = new Map<string, ColumnInfo>();

        const processValue = (prefix: string, value: any, depth: number) => {
            if (value === null || value === undefined) return;
            if (colsMap.size >= MAX_COLUMNS) return;
            const type = inferType(value);
            
            if (!colsMap.has(prefix)) {
                colsMap.set(prefix, {
                    name: prefix,
                    type: type,
                    isNullable: true,
                    defaultValue: null,
                    isPrimaryKey: prefix === '_id',
                    pkConstraintName: prefix === '_id' ? 'PK' : null
                });
            }

            if (depth >= MAX_DEPTH) return;

            if (type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && value._bsontype !== 'ObjectId') {
                for (const key of Object.keys(value)) {
                    if (colsMap.size >= MAX_COLUMNS) break;
                    processValue(`${prefix}.${key}`, value[key], depth + 1);
                }
            } else if (type === 'array' && Array.isArray(value) && value.length > 0) {
                const firstObj = value.find((item: any) => item && typeof item === 'object' && !Array.isArray(item));
                if (firstObj) {
                    for (const key of Object.keys(firstObj)) {
                        if (colsMap.size >= MAX_COLUMNS) break;
                        processValue(`${prefix}[].${key}`, firstObj[key], depth + 1);
                    }
                }
            }
        };

        for (const doc of docs) {
            for (const key of Object.keys(doc)) {
                if (colsMap.size >= MAX_COLUMNS) break;
                processValue(key, doc[key], 0);
            }
        }
        
        if (!colsMap.has('_id')) {
             colsMap.set('_id', {
                 name: '_id',
                 type: 'objectId',
                 isNullable: false,
                 defaultValue: null,
                 isPrimaryKey: true,
                 pkConstraintName: 'PK'
             });
        }

        return Array.from(colsMap.values());
    }

    async getIndexes(client: MongoClient, _schema: string, table: string, dbName?: string): Promise<TreeNodeResult[]> {
        const db = dbName ? client.db(dbName) : client.db();
        const indexes = await db.collection(table).indexes();
        const parentId = dbName 
            ? `db:${dbName}.schema:public.collection:${table}.folder:indexes`
            : `schema:public.collection:${table}.folder:indexes`;

        return indexes.map(idx => ({
            id: `${parentId}.index:${idx.name}`,
            name: idx.name || 'unnamed',
            type: 'index',
            parentId,
            hasChildren: false,
            metadata: {
                unique: !!idx.unique,
                key: idx.key
            }
        }));
    }

    async getTriggers(_client: MongoClient, _schema: string, _table: string, _dbName?: string): Promise<TreeNodeResult[]> {
        return [];
    }

    async getConstraints(_client: MongoClient, _schema: string, _table: string, _dbName?: string): Promise<TreeNodeResult[]> {
        return [];
    }

    async getFullMetadata(client: MongoClient, schema: string, table: string, dbName?: string): Promise<FullTableMetadata> {
        const db = dbName ? client.db(dbName) : client.db();
        const cols = await this.getColumns(client, schema, table, dbName);
        
        let count = 0;
        let indexes: any[] = [];
        try {
            count = await db.collection(table).estimatedDocumentCount();
            indexes = await db.collection(table).indexes();
        } catch (e) {
            // Collection may not exist or be inaccessible; proceed with defaults
        }

        return {
            columns: cols,
            indices: indexes.map(idx => ({
                name: idx.name,
                columns: Object.keys(idx.key),
                isUnique: !!idx.unique,
                isPrimary: idx.name === '_id_'
            })),
            rowCount: count
        };
    }

    async getRelationships(client: MongoClient, dbName?: string): Promise<Relationship[]> {
        const db = dbName ? client.db(dbName) : client.db();
        const relationships: Relationship[] = [];
        
        try {
            const collections = await db.listCollections().toArray();
            const collectionNames = collections.map(c => c.name);
            
            // Process collections in parallel batches of 3, with only 10 docs each
            // (we only need field name patterns, not full data)
            const batchSize = 3;
            for (let i = 0; i < collectionNames.length; i += batchSize) {
                const batch = collectionNames.slice(i, i + batchSize);
                await Promise.all(batch.map(async (colName) => {
                const docs = await db.collection(colName).find({}).limit(10).toArray();
                const possibleRelations = new Map<string, string>(); // column -> target table

                for (const doc of docs) {
                    for (const key of Object.keys(doc)) {
                        const val = doc[key];
                        // Heuristic: Key ends with 'Id' or '_id', and type is objectId or string
                        if (key.length >= 3 && (key.endsWith('Id') || key.endsWith('_id')) && key !== '_id') {
                            const prefix = key.replace(/Id$/, '').replace(/_id$/, '').toLowerCase();
                            // Look for matching collection (exact prefix, or prefix + 's', or prefix + 'es')
                            const targetMatch = collectionNames.find(c => c.toLowerCase() === prefix || c.toLowerCase() === prefix + 's' || c.toLowerCase() === prefix + 'es');
                            
                            if (targetMatch && !possibleRelations.has(key)) {
                                possibleRelations.set(key, targetMatch);
                            }
                        }
                    }
                }

                // Push inferred relations
                for (const [colKey, targetTable] of possibleRelations.entries()) {
                    relationships.push({
                        constraint_name: `vfk_${colName}_${colKey}`,
                        source_table: colName,
                        source_column: colKey,
                        target_table: targetTable,
                        target_column: '_id'
                    });
                }
                }));
            }
        } catch (e) {
            this.logger.warn('[MongoDbStrategy] Failed to infer MongoDB relationships', e instanceof Error ? e.message : 'Unknown error');
        }

        return relationships;
    }

    async getDatabaseMetrics(client: MongoClient): Promise<DatabaseMetrics> {
        const db = client.db();
        let tableCount = 0;
        let sizeBytes = 0;
        try {
             const stats = await db.command({ dbStats: 1 });
             tableCount = stats.collections || 0;
             sizeBytes = stats.dataSize || 0;
        } catch (e) {
            // dbStats may fail on restricted databases; keep defaults
        }

        return {
            tableCount,
            sizeBytes,
            activeConnections: 1,
            topTables: [],
            tableTypes: [{ type: 'Collection', count: tableCount }]
        };
    }

    // ─── Polymorphic Tree & Seed ───

    async getHierarchyNodes(client: MongoClient, parentId: string | null, parsedParams: any, connectionInfo: any): Promise<TreeNodeResult[]> {
        if (!parentId) {
            return this.getDatabases(client);
        }
        return [];
    }

    async seedData(client: MongoClient): Promise<QueryResult> {
        const db = client.db();
        const usersCol = db.collection('users');
        const productsCol = db.collection('products');

        const existingUsers = await usersCol.countDocuments();
        if (existingUsers === 0) {
            await usersCol.insertMany([
                { name: 'Alice Johnson', email: 'alice@example.com', created_at: new Date() },
                { name: 'Bob Smith', email: 'bob@example.com', created_at: new Date() },
                { name: 'Charlie Brown', email: 'charlie@example.com', created_at: new Date() },
            ]);
        }

        const existingProducts = await productsCol.countDocuments();
        if (existingProducts === 0) {
            await productsCol.insertMany([
                { name: 'Laptop', price: 999.99, stock: 10 },
                { name: 'Mouse', price: 25.50, stock: 100 },
                { name: 'Keyboard', price: 50.00, stock: 50 },
            ]);
        }

        return { rows: [{ message: 'Seed data inserted successfully' }], columns: ['message'], rowCount: 1 };
    }
}
