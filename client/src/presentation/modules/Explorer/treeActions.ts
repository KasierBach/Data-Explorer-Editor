import { useAppStore } from '@/core/services/store';
import { parseNodeId, getFullyQualifiedTable, getQuotedIdentifier } from '@/core/utils/id-parser';

export const handleTreeAction = (
    action: string,
    nodeId: string,
    nodeType: string,
    options: {
        setDatabaseToDelete: (name: string) => void;
        setDeleteDatabaseDialogOpen: (open: boolean) => void;
        handleRefresh: () => void;
    }
) => {
    const { setDatabaseToDelete, setDeleteDatabaseDialogOpen, handleRefresh } = options;
    const store = useAppStore.getState();
    const activeConnectionId = store.activeConnectionId;
    const activeConnection = store.connections.find((c: any) => c.id === activeConnectionId);
    if (!activeConnection) return;

    const dialect: 'postgres' | 'mysql' | 'mssql' | 'clickhouse' | 'mock' = activeConnection.type;
    const { dbName, schema, table: tableName } = parseNodeId(nodeId);
    const qualifiedName = getFullyQualifiedTable(nodeId, dialect as any);

    // Cast dialect to 'postgres' | 'mysql' since getQuotedIdentifier only supports these currently
    // Defaulting to postgres if it's mssql or clickhouse for safe quoting fallback
    const qDialect = (dialect === 'mysql' ? 'mysql' : 'postgres') as 'postgres' | 'mysql';
    const q = (name: string) => getQuotedIdentifier(name, qDialect);

    // ─── Database actions ───
    if (nodeType === 'database') {
        const name = dbName || nodeId.replace('db:', '');
        if (action === 'deleteDatabase') {
            setDatabaseToDelete(name);
            setDeleteDatabaseDialogOpen(true);
        }
        if (action === 'refresh') handleRefresh();
        if (action === 'createSchema') {
            store.openTab({
                id: `query-createschema-${Date.now()}`,
                title: `Create Schema`,
                type: 'query',
                initialSql: `-- Create a new schema in ${name}\nCREATE SCHEMA "new_schema_name";\n\n-- Optionally set the owner:\n-- ALTER SCHEMA "new_schema_name" OWNER TO your_user;`
            });
        }
        return;
    }

    // ─── Schema actions ───
    if (nodeType === 'schema') {
        const schemaName = nodeId.match(/schema:(\w+)/)?.[1] || schema;
        if (action === 'refresh') handleRefresh();
        if (action === 'copyName') navigator.clipboard.writeText(schemaName);
        if (action === 'dropSchema') {
            store.openTab({
                id: `query-dropschema-${Date.now()}`,
                title: `Drop Schema ${schemaName}`,
                type: 'query',
                initialSql: `-- ⚠️ WARNING: This will drop the schema and ALL its objects!\nDROP SCHEMA ${q(schemaName)} CASCADE;`
            });
        }
        if (action === 'createTable') {
            store.openTab({
                id: `query-createtable-${Date.now()}`,
                title: `Create Table`,
                type: 'query',
                initialSql: `CREATE TABLE ${q(schemaName)}.${q('new_table')} (\n    id SERIAL PRIMARY KEY,\n    name VARCHAR(255) NOT NULL,\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);`
            });
        }
        return;
    }

    // ─── Table & View actions ───
    if (nodeType === 'table' || nodeType === 'view') {
        if (action === 'selectTop') {
            store.openTab({
                id: `query-top-${nodeId}-${Date.now()}`,
                title: `Top 1000 ${tableName || nodeId}`,
                type: 'query',
                initialSql: `SELECT * FROM ${qualifiedName} LIMIT 1000;`
            });
        }
        if (action === 'countRows') {
            store.openTab({
                id: `query-count-${nodeId}-${Date.now()}`,
                title: `Count ${tableName || nodeId}`,
                type: 'query',
                initialSql: `SELECT COUNT(*) AS total_rows FROM ${qualifiedName};`
            });
        }
        if (action === 'copyName') {
            if (tableName) navigator.clipboard.writeText(tableName);
        }
        if (action === 'copyQualifiedName') {
            navigator.clipboard.writeText(qualifiedName);
        }

        // ─── Script As ───
        if (action === 'scriptSelect') {
            store.openTab({
                id: `query-select-${Date.now()}`,
                title: `SELECT ${tableName}`,
                type: 'query',
                initialSql: `SELECT *\nFROM ${qualifiedName}\nWHERE 1=1\nORDER BY 1\nLIMIT 100;`
            });
        }
        if (action === 'scriptInsert') {
            store.openTab({
                id: `query-insert-${Date.now()}`,
                title: `INSERT ${tableName}`,
                type: 'query',
                initialSql: `INSERT INTO ${qualifiedName} (\n    column1,\n    column2\n)\nVALUES (\n    'value1',\n    'value2'\n);`
            });
        }
        if (action === 'scriptUpdate') {
            store.openTab({
                id: `query-update-${Date.now()}`,
                title: `UPDATE ${tableName}`,
                type: 'query',
                initialSql: `UPDATE ${qualifiedName}\nSET column1 = 'new_value'\nWHERE id = 1;`
            });
        }
        if (action === 'scriptDelete') {
            store.openTab({
                id: `query-delete-${Date.now()}`,
                title: `DELETE ${tableName}`,
                type: 'query',
                initialSql: `-- ⚠️ WARNING: Make sure to specify a WHERE clause!\nDELETE FROM ${qualifiedName}\nWHERE id = 1;`
            });
        }
        if (action === 'scriptCreate') {
            // Generate CREATE TABLE template
            store.openTab({
                id: `query-create-${Date.now()}`,
                title: `CREATE ${tableName}`,
                type: 'query',
                initialSql: `-- Script: CREATE TABLE for ${tableName}\n-- Generating from server metadata...\nSELECT\n    'CREATE TABLE ' || table_schema || '.' || table_name || ' (' ||\n    string_agg(\n        column_name || ' ' || data_type ||\n        CASE WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')' ELSE '' END ||\n        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,\n        ', ' ORDER BY ordinal_position\n    ) || ');' AS create_statement\nFROM information_schema.columns\nWHERE table_schema = '${schema}' AND table_name = '${tableName}'\nGROUP BY table_schema, table_name;`
            });
        }
        if (action === 'scriptDrop') {
            const objType = nodeType === 'view' ? 'VIEW' : 'TABLE';
            store.openTab({
                id: `query-drop-${Date.now()}`,
                title: `DROP ${tableName}`,
                type: 'query',
                initialSql: `-- ⚠️ WARNING: This will permanently delete the ${objType.toLowerCase()}!\nDROP ${objType} IF EXISTS ${qualifiedName};`
            });
        }

        // ─── Destructive table actions ───
        if (action === 'truncateTable') {
            store.openTab({
                id: `query-truncate-${Date.now()}`,
                title: `TRUNCATE ${tableName}`,
                type: 'query',
                initialSql: `-- ⚠️ WARNING: This will delete ALL rows from the table!\nTRUNCATE TABLE ${qualifiedName};`
            });
        }
        if (action === 'dropTable') {
            store.openTab({
                id: `query-droptable-${Date.now()}`,
                title: `DROP ${tableName}`,
                type: 'query',
                initialSql: `-- ⚠️ WARNING: This will permanently delete the table and all its data!\nDROP TABLE IF EXISTS ${qualifiedName} CASCADE;`
            });
        }

        // ─── Open table designer ───
        if (action === 'openDesigner') {
            store.openTab({
                id: `table-${nodeId}`,
                title: tableName || nodeId,
                type: 'table',
                metadata: { tableId: nodeId, viewMode: 'design' }
            });
        }
    }
};
