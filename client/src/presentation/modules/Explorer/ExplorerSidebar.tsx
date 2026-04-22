import React, { useState, useEffect, useMemo } from 'react';
import { useDatabaseHierarchy } from '@/presentation/hooks/useDatabase';
import { TreeNodeItem } from './TreeNodeItem';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Plus, Search, RefreshCw, Layers, Database, ChevronDown, Globe, Loader2 } from 'lucide-react';
import { ConnectionService, connectionService } from '@/core/services/ConnectionService';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ConnectionSelector } from './ConnectionSelector';
import { Input } from '@/presentation/components/ui/input';
import { SidebarContextMenu } from './SidebarContextMenu';
import { CreateDatabaseDialog } from '@/presentation/components/Dialogs/CreateDatabaseDialog';
import { DeleteDatabaseDialog } from '@/presentation/components/Dialogs/DeleteDatabaseDialog';
import { handleTreeAction as importedHandleTreeAction } from './treeActions';
import { toast } from 'sonner';

export const ExplorerSidebar: React.FC = () => {
    const connections = useAppStore(state => state.connections);
    const activeConnectionId = useAppStore(state => state.activeConnectionId);
    const setActiveConnectionId = useAppStore(state => state.setActiveConnectionId);
    const activeDatabase = useAppStore(state => state.activeDatabase);
    const lang = useAppStore(state => state.lang);
    
    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchMode, setSearchMode] = useState<'local' | 'global'>('local');
    const [globalResults, setGlobalResults] = useState<any[]>([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const [isCreateDatabaseDialogOpen, setCreateDatabaseDialogOpen] = useState(false);
    const [isDeleteDatabaseDialogOpen, setDeleteDatabaseDialogOpen] = useState(false);
    const [databaseToDelete, setDatabaseToDelete] = useState<string | null>(null);
    
    const queryClient = useQueryClient();

    const handleRefresh = async () => {
        const t = toast.loading(lang === 'vi' ? 'Đang làm mới dữ liệu...' : 'Refreshing hierarchy...');
        await queryClient.resetQueries({ queryKey: ['hierarchy'] });
        toast.success(lang === 'vi' ? 'Đã cập nhật' : 'Refreshed', { id: t });
    };

    const handleSyncIndex = async () => {
        setIsSyncing(true);
        const t = toast.loading(lang === 'vi' ? 'Đang đồng bộ index...' : 'Syncing index...');
        try {
            const { SearchService } = await import('@/core/services/SearchService');
            await SearchService.syncIndex();
            toast.success(lang === 'vi' ? 'Đã đồng bộ!' : 'Index synced!', { id: t });
        } catch (err: any) {
            toast.error(err.message || 'Sync failed', { id: t });
        } finally {
            setIsSyncing(false);
        }
    };

    // Global Search Effect
    useEffect(() => {
        if (searchMode === 'global' && searchTerm.length >= 2) {
            const delayDebounceFn = setTimeout(async () => {
                setIsSearchingGlobal(true);
                try {
                    const { SearchService } = await import('@/core/services/SearchService');
                    const results = await SearchService.search(searchTerm);
                    setGlobalResults(results);
                } catch (err) {
                    console.error('Global search error:', err);
                } finally {
                    setIsSearchingGlobal(false);
                }
            }, 300);

            return () => clearTimeout(delayDebounceFn);
        } else if (searchMode === 'local' || searchTerm.length < 2) {
            setGlobalResults([]);
        }
    }, [searchTerm, searchMode]);

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
    }, [activeConnectionId]);

    useEffect(() => {
        if (connections.length > 0) {
            const isValidConnection = connections.some(c => c.id === activeConnectionId);
            if (!isValidConnection) {
                setActiveConnectionId(connections[0].id);
            }
        }
    }, [activeConnectionId, connections, setActiveConnectionId]);

    const activeConnection = connections.find((c: any) => c.id === activeConnectionId);
    const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv' || activeConnection?.type === 'redis';
    const schemaChangesDisabled = activeConnection?.readOnly || activeConnection?.allowSchemaChanges === false;
    const effectiveDatabase = activeConnection?.database || (!isNoSql ? activeDatabase : null);

    useEffect(() => {
        if (activeConnection) {
            connectionService.setActiveConnection(activeConnection).catch(console.error);
        }
    }, [activeConnection]);

    const { data: rootNodes, isLoading } = useDatabaseHierarchy(null);

    const filteredNodes = useMemo(() => {
        if (!rootNodes) return [];
        if (!searchTerm || searchMode === 'global') return rootNodes;
        return rootNodes.filter(node =>
            node.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rootNodes, searchTerm, searchMode]);

    const handleGlobalResultClick = (result: any) => {
        setActiveConnectionId(result.connectionId);
        // We could also trigger opening the entity here, but switching connection is the main part
        toast.info(lang === 'vi' ? `Đã chuyển sang kết nối ${result.connectionName}` : `Switched to ${result.connectionName}`);
        setSearchTerm('');
        setSearchMode('local');
    };

    const triggerRefresh = handleRefresh;

    return (
        <div className="h-full flex flex-col border-r bg-card/50 backdrop-blur-md overflow-hidden ring-1 ring-white/5">
            {/* Header */}
            <div className="flex flex-col gap-3 p-4 bg-gradient-to-b from-muted/50 to-transparent border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <h2 className="font-bold text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
                            SQL
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:bg-accent/50"
                            onClick={handleSyncIndex}
                            disabled={isSyncing}
                        >
                            <Globe className={cn("h-3.5 w-3.5 text-muted-foreground/70", isSyncing && "animate-spin")} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:bg-accent/50"
                            onClick={triggerRefresh}
                        >
                            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/70" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 rounded-lg hover:bg-accent/50 text-muted-foreground/70"
                            onClick={() => setCreateDatabaseDialogOpen(true)}
                            disabled={!!schemaChangesDisabled}
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <ConnectionSelector filter="sql" />

                    <div className="relative group flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 transition-colors group-focus-within:text-blue-500" />
                            <Input
                                placeholder={searchMode === 'local' 
                                    ? (lang === 'vi' ? "Tìm thực thể..." : "Find entities...") 
                                    : (lang === 'vi' ? "Tìm kiếm toàn cầu..." : "Global search...")}
                                className="h-9 text-xs pl-9 pr-8 bg-muted/40 border-none ring-1 ring-border/50 focus:ring-blue-500/30 transition-all rounded-xl placeholder:text-muted-foreground/50"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {isSearchingGlobal && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-9 w-9 rounded-xl transition-all border",
                                searchMode === 'global' ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-muted/40 border-transparent text-muted-foreground/70"
                            )}
                            onClick={() => setSearchMode(prev => prev === 'local' ? 'global' : 'local')}
                            title={lang === 'vi' ? "Chế độ tìm kiếm toàn cầu" : "Global Search Mode"}
                        >
                            <Globe className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tree/Results Area */}
            <div className="flex-1 overflow-auto custom-scrollbar pt-2">
                {searchMode === 'global' && searchTerm.length >= 2 ? (
                    <div className="px-2 space-y-1">
                        <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold">
                            {lang === 'vi' ? 'Kết quả toàn cục' : 'Global Results'}
                        </div>
                        {globalResults.length === 0 && !isSearchingGlobal && (
                            <div className="py-10 text-center opacity-30 text-[10px] uppercase font-bold tracking-widest">
                                {lang === 'vi' ? 'Không có kết quả' : 'No results found'}
                            </div>
                        )}
                        {globalResults.map((result, idx) => (
                            <div 
                                key={`${result.id}-${idx}`}
                                onClick={() => handleGlobalResultClick(result)}
                                className="group flex flex-col p-3 rounded-xl hover:bg-blue-500/5 transition-all cursor-pointer border border-transparent hover:border-blue-500/10"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-xs font-bold text-foreground/90">{result.name}</span>
                                    </div>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-black uppercase tracking-tighter">
                                        {result.type}
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/60 whitespace-nowrap overflow-hidden">
                                    <Globe className="w-3 h-3" />
                                    <span className="truncate">{result.connectionName}</span>
                                    {result.schema && <span className="opacity-40">• {result.schema}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center h-20 gap-3 opacity-40">
                                <div className="w-5 h-5 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                                <span className="text-[10px] uppercase tracking-widest font-black">
                                    {lang === 'vi' ? 'Đang quét dữ liệu' : 'Scanning Node'}
                                </span>
                            </div>
                        )}

                        {!isLoading && (
                            <div className="px-2">
                                <SidebarContextMenu
                                    type="connection"
                                    onAction={(action) => {
                                        if (action === 'toggleShowAll') {
                                            const conn = connections.find(c => c.id === activeConnectionId);
                                            if (conn) {
                                                const newValue = !conn.showAllDatabases;
                                                useAppStore.getState().updateConnection(conn.id, { showAllDatabases: newValue });
                                                ConnectionService.updateConnection(conn.id, { showAllDatabases: newValue }).then(async () => {
                                                    await connectionService.setActiveConnection({ ...conn, showAllDatabases: newValue } as any);
                                                    triggerRefresh();
                                                });
                                            }
                                        }
                                        if (action === 'refresh') triggerRefresh();
                                        if (action === 'createDatabase') setCreateDatabaseDialogOpen(true);
                                    }}
                                >
                                    <div className={cn(
                                        "flex items-center py-2 px-3 rounded-xl mb-1 cursor-pointer select-none text-sm font-bold transition-all duration-300 min-w-0",
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

                                    <div className="space-y-0.5 animate-in fade-in slide-in-from-left-2 duration-500">
                                        {filteredNodes.length === 0 && !isLoading && (
                                            <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-2">
                                                <Search className="h-8 w-8" />
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-center px-4">
                                                    {lang === 'vi' ? `Không tìm thấy nội bộ` : `No local results`}
                                                </p>
                                            </div>
                                        )}
                                        {filteredNodes.map(node => (
                                            <TreeNodeItem key={node.id} node={node} level={0} connectionId={activeConnectionId} />
                                        ))}
                                    </div>
                                </SidebarContextMenu>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-1.5 opacity-70">
                    <div className={`w-1.5 h-1.5 rounded-full ${activeConnection?.lastHealthStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                    <span>{activeConnection?.lastHealthStatus === 'error' ? (lang === 'vi' ? 'Cần kiểm tra' : 'Needs attention') : (lang === 'vi' ? 'Đang kết nối' : 'Connected')}</span>
                </div>
                {!isNoSql && effectiveDatabase && (
                    <div className="flex items-center gap-1 text-blue-500/80 text-[8px]">
                        <Database className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[100px]">{effectiveDatabase}</span>
                    </div>
                )}
                <span className="opacity-50">V3.5.0-REDIS</span>
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
        </div>
    );
};
