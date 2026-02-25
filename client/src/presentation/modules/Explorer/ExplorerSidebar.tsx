import React, { useState } from 'react';
import { useDatabaseHierarchy } from '@/presentation/hooks/useDatabase';
import { TreeNodeItem } from './TreeNodeItem';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Plus, Search, RefreshCw, Filter, Layers } from 'lucide-react';
import { connectionService } from '@/core/services/ConnectionService';
import { ConnectionSelector } from './ConnectionSelector';
import { Input } from '@/presentation/components/ui/input';
import { SidebarContextMenu } from './SidebarContextMenu';
import { Database, ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { parseNodeId, getFullyQualifiedTable, getQuotedIdentifier } from '@/core/utils/id-parser';
import { CreateDatabaseDialog } from '@/presentation/components/Dialogs/CreateDatabaseDialog';
import { DeleteDatabaseDialog } from '@/presentation/components/Dialogs/DeleteDatabaseDialog';

export const ExplorerSidebar: React.FC = () => {
    const connections = useAppStore(state => state.connections);
    const activeConnectionId = useAppStore(state => state.activeConnectionId);
    const setActiveConnectionId = useAppStore(state => state.setActiveConnectionId);
    const activeDatabase = useAppStore(state => state.activeDatabase);

    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateDatabaseDialogOpen, setCreateDatabaseDialogOpen] = useState(false);
    const [isDeleteDatabaseDialogOpen, setDeleteDatabaseDialogOpen] = useState(false);
    const [databaseToDelete, setDatabaseToDelete] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const handleRefresh = async () => {
        console.log("♻️ Sidebar triggering manual refresh");
        await queryClient.resetQueries({ queryKey: ['hierarchy'] });
    };

    React.useEffect(() => {
        const handleTreeAction = (e: CustomEvent<{ action: string, nodeId: string, nodeType: string }>) => {
            const { action, nodeId, nodeType } = e.detail;
            const store = useAppStore.getState();
            const activeConnection = store.connections.find(c => c.id === activeConnectionId);
            const dialect: 'postgres' | 'mysql' | 'mssql' = (activeConnection?.type as any) || 'postgres';
            const { dbName, schema, table: tableName } = parseNodeId(nodeId);
            const qualifiedName = getFullyQualifiedTable(nodeId, dialect);
            const q = (name: string) => getQuotedIdentifier(name, dialect);

            // ─── Database actions ───
            if (nodeType === 'database') {
                const name = dbName || nodeId.replace('db:', '');
                if (action === 'deleteDatabase') {
                    setDatabaseToDelete(name);
                    setDeleteDatabaseDialogOpen(true);
                }
                if (action === 'refresh') handleRefresh();
                if (action === 'createSchema') {
                    const schemaName = prompt('Enter new schema name:');
                    if (schemaName) {
                        store.openTab({
                            id: `query-createschema-${Date.now()}`,
                            title: `Create Schema`,
                            type: 'query',
                            initialSql: `CREATE SCHEMA ${q(schemaName)};`
                        });
                    }
                }
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

        window.addEventListener('tree-node-action', handleTreeAction as EventListener);
        return () => window.removeEventListener('tree-node-action', handleTreeAction as EventListener);
    }, [activeConnectionId]);

    React.useEffect(() => {
        if (!activeConnectionId && connections.length > 0) {
            setActiveConnectionId(connections[0].id);
        }
    }, [activeConnectionId, connections, setActiveConnectionId]);

    const activeConnection = useAppStore(state => state.connections.find(c => c.id === state.activeConnectionId));

    React.useEffect(() => {
        if (activeConnection) {
            connectionService.setActiveConnection(activeConnection).catch(console.error);
        }
    }, [activeConnection]);

    const { data: rootNodes, isLoading } = useDatabaseHierarchy(null);

    const filteredNodes = React.useMemo(() => {
        if (!rootNodes) return [];
        if (!searchTerm) return rootNodes;
        return rootNodes.filter(node =>
            node.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rootNodes, searchTerm]);

    const triggerRefresh = handleRefresh;

    return (
        <div className="h-full flex flex-col border-r bg-card/50 backdrop-blur-md overflow-hidden ring-1 ring-white/5">
            {/* Premium Header */}
            <div className="flex flex-col gap-3 p-4 bg-gradient-to-b from-muted/50 to-transparent border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <h2 className="font-bold text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Navigator</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:bg-accent/50"
                            onClick={triggerRefresh}
                        >
                            <RefreshCw className="h-3.5 h-3.5 text-muted-foreground/70" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-accent/50 text-muted-foreground/70">
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <ConnectionSelector />

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-focus-within:text-blue-500" />
                        <Input
                            placeholder="Find entities..."
                            className="h-9 text-xs pl-9 pr-8 bg-muted/40 border-none ring-1 ring-border/50 focus:ring-blue-500/30 transition-all rounded-xl placeholder:text-muted-foreground/30"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <Filter className="h-3 w-3 text-muted-foreground/30 hover:text-muted-foreground cursor-pointer" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tree Area */}
            <div className="flex-1 overflow-auto custom-scrollbar pt-2">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-20 gap-3 opacity-40">
                        <div className="w-5 h-5 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                        <span className="text-[10px] uppercase tracking-widest font-black">Scanning Node</span>
                    </div>
                )}

                {!isLoading && (
                    <div className="px-2">
                        <SidebarContextMenu
                            type="connection"
                            onAction={(action) => {
                                if (action === 'toggleShowAll') {
                                    const conn = useAppStore.getState().connections.find(c => c.id === activeConnectionId);
                                    if (conn) {
                                        useAppStore.getState().updateConnection(conn.id, {
                                            showAllDatabases: !conn.showAllDatabases
                                        });
                                    }
                                }
                                if (action === 'refresh') {
                                    triggerRefresh();
                                }
                                if (action === 'createDatabase') {
                                    setCreateDatabaseDialogOpen(true);
                                }
                            }}
                        >
                            {/* Active Connection Root Node */}
                            <div className={cn(
                                "flex items-center py-2 px-3 rounded-xl mb-1 cursor-pointer select-none text-sm font-bold transition-all duration-300",
                                "bg-blue-500/5 border border-blue-500/10 text-blue-600/90 shadow-sm shadow-blue-500/5",
                                "hover:bg-blue-500/10 hover:border-blue-500/20"
                            )}>
                                <span className="mr-2 w-4 h-4 flex items-center justify-center">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </span>
                                <Database className="w-4 h-4 mr-2.5 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                                <span className="truncate flex-1">{activeConnection?.name || 'Local Instance'}</span>
                                <div className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-[9px] font-black uppercase tracking-tighter">
                                    {activeConnection?.type || 'pg'}
                                </div>
                            </div>

                            {/* Tree Content */}
                            <div className="space-y-0.5 animate-in fade-in slide-in-from-left-2 duration-500">
                                {filteredNodes.length === 0 && !isLoading && (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-2">
                                        <Filter className="h-8 w-8" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-center px-4">No results for "{searchTerm}"</p>
                                    </div>
                                )}
                                {filteredNodes.map(node => (
                                    <TreeNodeItem key={node.id} node={node} level={0} />
                                ))}
                            </div>
                        </SidebarContextMenu>
                    </div>
                )}
            </div>

            {/* Optional Sidebar Footer/Status */}
            <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-1.5 opacity-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Connected</span>
                </div>
                {activeDatabase && (
                    <div className="flex items-center gap-1 text-emerald-500/80 text-[8px]">
                        <Database className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[100px]">{activeDatabase}</span>
                    </div>
                )}
                <span className="opacity-50">v1.0.0-PRO</span>
            </div>
            {/* Dialogs */}
            <CreateDatabaseDialog
                isOpen={isCreateDatabaseDialogOpen}
                onClose={() => setCreateDatabaseDialogOpen(false)}
                connectionId={activeConnectionId}
                onSuccess={triggerRefresh}
            />
            <DeleteDatabaseDialog
                isOpen={isDeleteDatabaseDialogOpen}
                onClose={() => setDeleteDatabaseDialogOpen(false)}
                connectionId={activeConnectionId}
                databaseName={databaseToDelete}
                onSuccess={triggerRefresh}
            />
        </div >
    );
};
