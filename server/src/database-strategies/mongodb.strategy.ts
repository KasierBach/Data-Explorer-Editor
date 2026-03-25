import { MongoClient, ObjectId } from 'mongodb';
import {
    IDatabaseStrategy,
    QueryResult,
    TreeNodeResult,
    ColumnInfo,
    FullTableMetadata,
    Relationship,
    DatabaseMetrics,
    UpdateRowParams
} from './database-strategy.interface';

const inferType = (value: any): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') {
        if (value._bsontype === 'ObjectId') return 'objectId';
        return 'object';
    }
    return typeof value;
};

export class MongoDbStrategy implements IDatabaseStrategy {
    async createPool(connectionConfig: any, databaseOverride?: string): Promise<MongoClient> {
        let uri = connectionConfig.url || '';
        if (!uri) {
            const auth = connectionConfig.user 
                ? `${encodeURIComponent(connectionConfig.user)}:${encodeURIComponent(connectionConfig.password || '')}@` 
                : '';
            const host = connectionConfig.host || 'localhost';
            const port = connectionConfig.port || 27017;
            const db = databaseOverride || connectionConfig.database || '';
            const params = connectionConfig.ssl ? '?tls=true' : '';
            const protocol = connectionConfig.type === 'mongodb+srv' ? 'mongodb+srv' : 'mongodb';
            uri = protocol === 'mongodb+srv'
                ? `${protocol}://${auth}${host}/${db}${params}`
                : `${protocol}://${auth}${host}:${port}/${db}${params}`;
        }

        const client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
        });

        await client.connect();
        return client;
    }

    async closePool(client: MongoClient): Promise<void> {
        if (client) {
            await client.close();
        }
    }

    async executeQuery(client: MongoClient, queryPayloadStr: string): Promise<QueryResult> {
        let payload: any;
        try {
            payload = JSON.parse(queryPayloadStr);
        } catch (e) {
            throw new Error(`Invalid MongoDB query payload (must be valid JSON). Received: ${queryPayloadStr}`);
        }

        const db = client.db();
        const col = db.collection(payload.collection);

        let result: any;
        let rows: any[] = [];
        let columns: string[] = [];

        switch (payload.action) {
            case 'find':
                result = await col.find(payload.filter || {}, payload.options || {}).limit(payload.limit || 100).toArray();
                rows = result;
                break;
            case 'aggregate':
                result = await col.aggregate(payload.pipeline || []).toArray();
                rows = result;
                break;
            case 'insertOne':
                result = await col.insertOne(payload.document);
                rows = [{ insertedId: result.insertedId.toString() }];
                break;
            case 'insertMany':
                result = await col.insertMany(payload.documents);
                rows = [{ insertedCount: result.insertedCount }];
                break;
            case 'updateOne':
                result = await col.updateOne(payload.filter, payload.update, payload.options || {});
                rows = [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
                break;
            case 'updateMany':
                result = await col.updateMany(payload.filter, payload.update, payload.options || {});
                rows = [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
                break;
            case 'deleteOne':
                result = await col.deleteOne(payload.filter);
                rows = [{ deletedCount: result.deletedCount }];
                break;
            case 'deleteMany':
                result = await col.deleteMany(payload.filter);
                rows = [{ deletedCount: result.deletedCount }];
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
        
        // Remove _id from updates to avoid immutable field error
        const updatesCpy = { ...params.updates };
        delete updatesCpy._id;

        try {
            const filter = params.pkColumn === '_id' ? { _id: new ObjectId(params.pkValue) } : { [params.pkColumn]: params.pkValue };
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
        const adminDb = client.db().admin();
        const result = await adminDb.listDatabases();
        return result.databases.map((db: any) => ({
            id: `db:${db.name}`,
            name: db.name,
            type: 'database',
            parentId: 'root',
            hasChildren: true
        }));
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

    async getColumns(client: MongoClient, schema: string, table: string): Promise<ColumnInfo[]> {
        const db = client.db();
        const docs = await db.collection(table).find({}).limit(20).toArray();
        const colsMap = new Map<string, ColumnInfo>();

        for (const doc of docs) {
            for (const key of Object.keys(doc)) {
                if (!colsMap.has(key)) {
                    colsMap.set(key, {
                        name: key,
                        type: inferType(doc[key]),
                        isNullable: true,
                        defaultValue: null,
                        isPrimaryKey: key === '_id',
                        pkConstraintName: key === '_id' ? 'PK' : null
                    });
                }
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

    async getFullMetadata(client: MongoClient, schema: string, table: string): Promise<FullTableMetadata> {
        const db = client.db();
        const cols = await this.getColumns(client, schema, table);
        
        let count = 0;
        let indexes: any[] = [];
        try {
            count = await db.collection(table).estimatedDocumentCount();
            indexes = await db.collection(table).indexes();
        } catch (e) {
            // ignore
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

    async getRelationships(client: MongoClient): Promise<Relationship[]> {
        return [];
    }

    async getDatabaseMetrics(client: MongoClient): Promise<DatabaseMetrics> {
        const db = client.db();
        let tableCount = 0;
        let sizeBytes = 0;
        try {
             const stats = await db.command({ dbStats: 1 });
             tableCount = stats.collections || 0;
             sizeBytes = stats.dataSize || 0;
        } catch (e) {}

        return {
            tableCount,
            sizeBytes,
            activeConnections: 1,
            topTables: [],
            tableTypes: [{ type: 'Collection', count: tableCount }]
        };
    }
}
