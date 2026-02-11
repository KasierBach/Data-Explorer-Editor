import React, { useState } from 'react';
import { useDatabaseHierarchy } from '@/presentation/hooks/useDatabase';
import { TreeNodeItem } from './TreeNodeItem';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { connectionService } from '@/core/services/ConnectionService';
import { ConnectionSelector } from './ConnectionSelector';
import { Input } from '@/presentation/components/ui/input';
import { SidebarContextMenu } from './SidebarContextMenu';
import { Database, ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export const ExplorerSidebar: React.FC = () => {
    const { activeConnectionId, setActiveConnectionId } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    React.useEffect(() => {
        const handleRefresh = () => {
            queryClient.invalidateQueries({ queryKey: ['database-hierarchy'] });
        };

        const handleTreeAction = (e: CustomEvent<{ action: string, nodeId: string, nodeType: string }>) => {
            const { action, nodeId, nodeType } = e.detail;

            if (nodeType === 'table') {
                if (action === 'selectTop') {
                    // Extract table name from ID (simplified)
                    // We need a better way to get the clean name, or TreeNodeItem should pass it.
                    // For now, let's use the ID which might be "db:mydb.schema:public.table:users"
                    // openTab can handle it if we pass type='query' and initialSQL
                    const tableName = nodeId.split(/[:.]/).pop(); // Rough extraction
                    useAppStore.getState().openTab({
                        id: `query-top-${nodeId}-${Date.now()}`,
                        title: `Top 1000 ${tableName}`,
                        type: 'query',
                        initialSql: `SELECT * FROM ${nodeId.includes('table:') ? nodeId.split('table:')[1] : nodeId} LIMIT 1000;`
                    });
                }
                if (action === 'countRows') {
                    const tableName = nodeId.split(/[:.]/).pop();
                    useAppStore.getState().openTab({
                        id: `query-count-${nodeId}-${Date.now()}`,
                        title: `Count ${tableName}`,
                        type: 'query',
                        initialSql: `SELECT COUNT(*) as total_rows FROM ${nodeId.includes('table:') ? nodeId.split('table:')[1] : nodeId};`
                    });
                }
                if (action === 'copyName') {
                    const name = nodeId.split(/[:.]/).pop();
                    if (name) navigator.clipboard.writeText(name);
                }
            }
        };

        window.addEventListener('refresh-explorer', handleRefresh);
        window.addEventListener('tree-node-action', handleTreeAction as EventListener);

        return () => {
            window.removeEventListener('refresh-explorer', handleRefresh);
            window.removeEventListener('tree-node-action', handleTreeAction as EventListener);
        };
    }, [queryClient]);

    React.useEffect(() => {
        if (!activeConnectionId) {
            // Auto-select first connection if none selected
            // This logic moves to store initialization or here
            setActiveConnectionId('conn-1');
        }
    }, [activeConnectionId, setActiveConnectionId]);

    const activeConnection = useAppStore(state => state.connections.find(c => c.id === state.activeConnectionId));

    // Update connection service when UI state changes
    React.useEffect(() => {
        if (activeConnection) {
            connectionService.setActiveConnection(activeConnection).catch(console.error);
        }
    }, [activeConnection]);


    const { data: rootNodes, isLoading } = useDatabaseHierarchy(null);

    // Basic client-side filtering for root nodes (databases)
    // In a real app, this might be server-side or recursive
    const filteredNodes = React.useMemo(() => {
        if (!rootNodes) return [];
        if (!searchTerm) return rootNodes;
        return rootNodes.filter(node =>
            node.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rootNodes, searchTerm]);

    return (
        <div className="h-full flex flex-col border-r bg-card">
            <div className="p-2 border-b space-y-2">
                <div className="flex items-center justify-between px-2">
                    <h2 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mr-2">Explorer</h2>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>

                <ConnectionSelector />

                <div className="px-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        className="h-7 text-xs pl-8 bg-muted/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-2">
                {isLoading && <div className="text-xs p-2 text-muted-foreground">Loading...</div>}

                {!isLoading && (
                    <>
                        {/* Root Connection Node - Supports Right Click */}
                        {/* Render Connection Node Manually to control children */}
                        <SidebarContextMenu
                            type="connection"
                            onAction={(action) => {
                                if (action === 'toggleShowAll') {
                                    // Toggle showAllDatabases
                                    const conn = useAppStore.getState().connections.find(c => c.id === activeConnectionId);
                                    if (conn) {
                                        useAppStore.getState().updateConnection(conn.id, {
                                            showAllDatabases: !conn.showAllDatabases
                                        });
                                        // Trigger refresh or update
                                        // The store update should trigger re-render if we subscribe to it
                                        // But we need to make sure Adapter config is updated. 
                                        // ExplorerSidebar useEffect handles adapter update.

                                        // Force UI refresh/reload
                                        // window.location.reload(); // Too aggressive?
                                        // Ideally useDatabaseHierarchy refetches.
                                    }
                                }
                                if (action === 'refresh') {
                                    // Invalidate queries?
                                    // queryClient.invalidateQueries(['database-hierarchy']);
                                    window.dispatchEvent(new CustomEvent('refresh-explorer'));
                                }
                            }}
                        >
                            <div className="flex items-center py-1 px-2 hover:bg-accent cursor-pointer select-none text-sm group font-semibold text-foreground/90">
                                <span className="mr-1 w-4 h-4 flex items-center justify-center">
                                    <ChevronDown className="w-3 h-3" />
                                </span>
                                <Database className="w-4 h-4 mr-2 text-blue-600" />
                                <span className="truncate">{useAppStore.getState().connections.find(c => c.id === activeConnectionId)?.name || 'Connection'}</span>
                            </div>

                            {/* Children (The actual Tree) */}
                            <div className="pl-4 border-l ml-3 border-border/40">
                                {filteredNodes.length === 0 && !isLoading && (
                                    <div className="text-xs p-2 text-muted-foreground">No databases found.</div>
                                )}
                                {filteredNodes.map(node => (
                                    <TreeNodeItem key={node.id} node={node} level={0} />
                                ))}
                            </div>
                        </SidebarContextMenu>
                    </>
                )}
            </div>
        </div>
    );
};

// Global event listener for tree node actions
// Ideally moved to a hook or the Sidebar component itself, but due to recursive Item structure,
// dispatching event is easier. We listen here in the Sidebar parent.
// Wait, Sidebar parent is already listening to 'refresh-explorer'.
// Let's add 'tree-node-action' listener.

