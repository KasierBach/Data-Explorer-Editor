import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { useDatabaseHierarchy } from '@/presentation/hooks/useDatabase';
import { TreeNodeItem } from './TreeNodeItem';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Plus, RefreshCw, Layers, Database, Globe, Loader2, Search } from 'lucide-react';
import { connectionService } from '@/core/services/ConnectionService';
import { MetadataService } from '@/core/services/MetadataService';
import { SearchService } from '@/core/services/SearchService';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ConnectionSelector } from './ConnectionSelector';
import { Input } from '@/presentation/components/ui/input';
import { SidebarContextMenu } from './SidebarContextMenu';
import { CreateDatabaseDialog } from '@/presentation/components/Dialogs/CreateDatabaseDialog';
import { DeleteDatabaseDialog } from '@/presentation/components/Dialogs/DeleteDatabaseDialog';
import { handleTreeAction as importedHandleTreeAction } from './treeActions';
import { toast } from 'sonner';
import type { SearchResult } from '@/core/services/SearchService';
import { getWorkspaceText } from '@/core/utils/workspaceText';

const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
);

export const ExplorerSidebar: React.FC = memo(() => {
    // Individual selectors to prevent the infinite loop issue
    const connections = useAppStore(state => state.connections);
    const activeConnectionId = useAppStore(state => state.activeConnectionId);
    const setActiveConnectionId = useAppStore(state => state.setActiveConnectionId);
    const activeDatabase = useAppStore(state => state.activeDatabase);
    const lang = useAppStore(state => state.lang);
    const text = getWorkspaceText(lang).explorerSidebar;
    const explorerSearchMode = useAppStore(state => state.explorerSearchMode);
    const setExplorerSearchMode = useAppStore(state => state.setExplorerSearchMode);
    
    // UI Local State
    const [searchTerm, setSearchTerm] = useState('');
    const [globalResults, setGlobalResults] = useState<SearchResult[]>([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const [isCreateDatabaseDialogOpen, setCreateDatabaseDialogOpen] = useState(false);
    const [isDeleteDatabaseDialogOpen, setDeleteDatabaseDialogOpen] = useState(false);
    const [databaseToDelete, setDatabaseToDelete] = useState<string | null>(null);
    
    const activeConnection = useMemo(() => connections.find(c => c.id === activeConnectionId), [connections, activeConnectionId]);
    const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv' || activeConnection?.type === 'redis';
    const schemaChangesDisabled = activeConnection?.readOnly || activeConnection?.allowSchemaChanges === false;
    const effectiveDatabase = activeConnection?.database || (!isNoSql ? activeDatabase : null);

    const queryClient = useQueryClient();

    const handleRefresh = useCallback(async () => {
        const t = toast.loading(text.refreshingHierarchy);
        if (activeConnectionId) {
            await MetadataService.refresh(activeConnectionId, effectiveDatabase || undefined).catch((err) => {
                console.warn('Failed to refresh metadata freshness', err);
            });
        }
        await queryClient.invalidateQueries({ queryKey: ['hierarchy'] });
        await queryClient.invalidateQueries({ queryKey: ['metadata'] });
        void SearchService.syncIndex().catch((err) => {
            console.warn('Failed to sync search index', err);
        });
        toast.success(text.refreshed, { id: t });
    }, [activeConnectionId, effectiveDatabase, queryClient, text.refreshed, text.refreshingHierarchy]);

    const handleSyncIndex = async () => {
        setIsSyncing(true);
        const t = toast.loading(text.syncingIndex);
        try {
            await SearchService.syncIndex();
            toast.success(text.indexSynced, { id: t });
        } catch (err) {
            toast.error(getErrorMessage(err, text.syncFailed), { id: t });
        } finally {
            setIsSyncing(false);
        }
    };

    // Hybrid Search Effect
    useEffect(() => {
        if (searchTerm.length >= 2) {
            const delayDebounceFn = setTimeout(async () => {
                setIsSearchingGlobal(true);
                try {
                    let results = await SearchService.search(searchTerm);
                    if (explorerSearchMode === 'local') {
                        results = results.filter(r => r.connectionId === activeConnectionId);
                    }
                    setGlobalResults(results);
                } catch (err) {
                    console.error('Search error:', err);
                } finally {
                    setIsSearchingGlobal(false);
                }
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setGlobalResults([]);
        }
    }, [searchTerm, explorerSearchMode, activeConnectionId]);

    useEffect(() => {
        const handleTreeAction = (e: CustomEvent<{ action: string, nodeId: string, nodeType: string }>) => {
            const { action, nodeId, nodeType } = e.detail;
            importedHandleTreeAction(action, nodeId, nodeType, {
                setDatabaseToDelete,
                setDeleteDatabaseDialogOpen,
                handleRefresh
            });
        };

        window.addEventListener('tree-node-action', handleTreeAction as EventListener);
        return () => window.removeEventListener('tree-node-action', handleTreeAction as EventListener);
    }, [handleRefresh]);

    useEffect(() => {
        if (connections.length > 0 && !connections.some(c => c.id === activeConnectionId)) {
            setActiveConnectionId(connections[0].id);
        }
    }, [activeConnectionId, connections, setActiveConnectionId]);

    useEffect(() => {
        if (activeConnection) {
            connectionService.setActiveConnection(activeConnection).catch(console.error);
        }
    }, [activeConnection]);

    const { data: rootNodes } = useDatabaseHierarchy(null);

    const filteredNodes = useMemo(() => {
        if (!rootNodes) return [];
        if (!searchTerm || explorerSearchMode === 'global') return rootNodes;
        return rootNodes.filter(node =>
            node.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rootNodes, searchTerm, explorerSearchMode]);

    const handleGlobalResultClick = useCallback((result: SearchResult) => {
        setActiveConnectionId(result.connectionId);
        toast.info(text.switchedToConnection(result.connectionName));
        setSearchTerm('');
        setExplorerSearchMode('local');
    }, [setActiveConnectionId, setExplorerSearchMode, text]);

    return (
        <div className="h-full flex flex-col border-r bg-card/40 backdrop-blur-xl overflow-hidden ring-1 ring-white/5 content-visibility-auto">
            {/* Header */}
            <div className="flex flex-col gap-3 p-4 bg-gradient-to-b from-muted/50 to-transparent border-b z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <h2 className="font-bold text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">{text.title}</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleSyncIndex} disabled={isSyncing}>
                            <Globe className={cn("h-3.5 w-3.5 text-muted-foreground/70", isSyncing && "animate-spin")} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleRefresh}>
                            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/70" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setCreateDatabaseDialogOpen(true)} disabled={!!schemaChangesDisabled}>
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <ConnectionSelector filter="sql" />
                    <div className="relative group flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-focus-within:text-blue-500" />
                            <Input
                                placeholder={explorerSearchMode === 'local'
                                  ? text.localSearchPlaceholder
                                  : text.globalSearchPlaceholder}
                                className="h-9 text-xs pl-9 pr-8 bg-muted/40 border-none ring-1 ring-border/50 focus:ring-blue-500/40 rounded-xl"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {isSearchingGlobal && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="h-3 w-3 animate-spin text-primary" /></div>}
                        </div>
                        <Button
                            variant="ghost" size="icon" 
                            className={cn("h-9 w-9 rounded-xl border transition-all", explorerSearchMode === 'global' ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-muted/40 border-transparent text-muted-foreground/70")}
                            onClick={() => setExplorerSearchMode(explorerSearchMode === 'local' ? 'global' : 'local')}
                        >
                            <Globe className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tree Area */}
            <div className="flex-1 overflow-auto custom-scrollbar pt-2 contain-strict">
                {searchTerm.length >= 2 ? (
                    <div className="px-2 space-y-1">
                        {globalResults.map((result, idx) => (
                            <div key={`${result.id}-${idx}`} onClick={() => handleGlobalResultClick(result)} className="group flex flex-col p-3 rounded-xl hover:bg-blue-500/5 transition-all cursor-pointer">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-xs font-bold text-foreground/90">{result.name}</span>
                                    </div>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-black uppercase">{result.type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-2">
                        <SidebarContextMenu type="connection" onAction={(action) => action === 'refresh' && handleRefresh()}>
                            <div className="flex items-center py-2 px-3 rounded-xl mb-1 bg-blue-500/5 border border-blue-500/10 text-blue-600/90 shadow-sm">
                                <Database className="w-4 h-4 mr-2.5 text-blue-500" />
                                <span className="truncate flex-1 font-bold">{activeConnection?.name || text.localInstance}</span>
                            </div>
                            <div className="space-y-0.5">
                                {filteredNodes.map(node => (
                                    <TreeNodeItem key={node.id} node={node} level={0} connectionId={activeConnectionId} />
                                ))}
                            </div>
                        </SidebarContextMenu>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-[9px] font-bold uppercase">
                <div className="flex items-center gap-1.5 opacity-70">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{text.connected}</span>
                </div>
                <span className="opacity-50 text-[8px]">DATA EXPLORER V3.6</span>
            </div>

            <CreateDatabaseDialog isOpen={isCreateDatabaseDialogOpen} onClose={() => setCreateDatabaseDialogOpen(false)} connectionId={activeConnectionId} onSuccess={handleRefresh} />
            <DeleteDatabaseDialog isOpen={isDeleteDatabaseDialogOpen} onClose={() => setDeleteDatabaseDialogOpen(false)} connectionId={activeConnectionId} databaseName={databaseToDelete} onSuccess={handleRefresh} />
        </div>
    );
});

ExplorerSidebar.displayName = 'ExplorerSidebar';
