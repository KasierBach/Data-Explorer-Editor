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
import { parseNodeId, getFullyQualifiedTable } from '@/core/utils/id-parser';
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

    React.useEffect(() => {
        const handleRefresh = () => {
            queryClient.invalidateQueries({ queryKey: ['database-hierarchy'] });
        };

        const handleTreeAction = (e: CustomEvent<{ action: string, nodeId: string, nodeType: string }>) => {
            const { action, nodeId, nodeType } = e.detail;
            const activeConnection = useAppStore.getState().connections.find(c => c.id === activeConnectionId);
            const dialect = activeConnection?.type === 'mysql' ? 'mysql' : 'postgres';

            if (nodeType === 'database') {
                const { dbName } = parseNodeId(nodeId);
                const name = dbName || nodeId.replace('db:', '');

                if (action === 'deleteDatabase') {
                    setDatabaseToDelete(name);
                    setDeleteDatabaseDialogOpen(true);
                }
            }

            if (nodeType === 'table' || nodeType === 'view') {
                const { table: tableName } = parseNodeId(nodeId);
                const qualifiedName = getFullyQualifiedTable(nodeId, dialect);

                if (action === 'selectTop') {
                    useAppStore.getState().openTab({
                        id: `query-top-${nodeId}-${Date.now()}`,
                        title: `Top 1000 ${tableName || nodeId}`,
                        type: 'query',
                        initialSql: `SELECT * FROM ${qualifiedName} LIMIT 1000;`
                    });
                }
                if (action === 'countRows') {
                    useAppStore.getState().openTab({
                        id: `query-count-${nodeId}-${Date.now()}`,
                        title: `Count ${tableName || nodeId}`,
                        type: 'query',
                        initialSql: `SELECT COUNT(*) as total_rows FROM ${qualifiedName};`
                    });
                }
                if (action === 'copyName') {
                    if (tableName) navigator.clipboard.writeText(tableName);
                }
            }
        };

        window.addEventListener('refresh-explorer', handleRefresh);
        window.addEventListener('tree-node-action', handleTreeAction as EventListener);

        return () => {
            window.removeEventListener('refresh-explorer', handleRefresh);
            window.removeEventListener('tree-node-action', handleTreeAction as EventListener);
        };
    }, [queryClient, activeConnectionId]);

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

    const handleRefresh = () => {
        window.dispatchEvent(new CustomEvent('refresh-explorer'));
    };

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
                            onClick={handleRefresh}
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
                                    handleRefresh();
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
                onSuccess={handleRefresh}
            />
            <DeleteDatabaseDialog
                isOpen={isDeleteDatabaseDialogOpen}
                onClose={() => setDeleteDatabaseDialogOpen(false)}
                connectionId={activeConnectionId}
                databaseName={databaseToDelete}
                onSuccess={handleRefresh}
            />
        </div >
    );
};
