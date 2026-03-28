import React, { useState } from 'react';
import { useDatabaseHierarchy } from '@/presentation/hooks/useDatabase';
import { TreeNodeItem } from '../Explorer/TreeNodeItem';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Plus, Search, RefreshCw, Filter, Leaf, Database, ChevronDown } from 'lucide-react';
import { connectionService } from '@/core/services/ConnectionService';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ConnectionSelector } from '../Explorer/ConnectionSelector';
import { Input } from '@/presentation/components/ui/input';
import { SidebarContextMenu } from '../Explorer/SidebarContextMenu';
import { CreateDatabaseDialog } from '@/presentation/components/Dialogs/CreateDatabaseDialog';
import { DeleteDatabaseDialog } from '@/presentation/components/Dialogs/DeleteDatabaseDialog';
import { handleTreeAction as importedHandleTreeAction } from '../Explorer/treeActions';

export const NoSqlSidebar: React.FC = () => {
    const lang = useAppStore(state => state.lang);

    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateDatabaseDialogOpen, setCreateDatabaseDialogOpen] = useState(false);
    const [isDeleteDatabaseDialogOpen, setDeleteDatabaseDialogOpen] = useState(false);
    const [databaseToDelete, setDatabaseToDelete] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const handleRefresh = async () => {
        await queryClient.resetQueries({ queryKey: ['hierarchy'] });
    };

    const nosqlActiveConnectionId = useAppStore(state => state.nosqlActiveConnectionId);
    const activeConnection = useAppStore(state => state.connections.find((c: any) => c.id === nosqlActiveConnectionId));

    React.useEffect(() => {
        const handleTreeAction = (e: CustomEvent<{ action: string, nodeId: string, nodeType: string }>) => {
            const { action, nodeId, nodeType } = e.detail;
            importedHandleTreeAction(action, nodeId, nodeType, {
                setDatabaseToDelete,
                setDeleteDatabaseDialogOpen,
                handleRefresh,
                overrideConnectionId: nosqlActiveConnectionId
            });
        };

        window.addEventListener('tree-node-action', handleTreeAction as EventListener);
        return () => window.removeEventListener('tree-node-action', handleTreeAction as EventListener);
    }, [nosqlActiveConnectionId]);

    // Sync active connection with backend when nosqlActiveConnectionId changes
    React.useEffect(() => {
        if (activeConnection) {
            connectionService.setActiveConnection(activeConnection).catch(console.error);
        }
    }, [activeConnection]);

    const { data: rootNodes, isLoading } = useDatabaseHierarchy(null, nosqlActiveConnectionId);

    const filteredNodes = React.useMemo(() => {
        if (!rootNodes) return [];
        if (!searchTerm) return rootNodes;
        return rootNodes.filter(node =>
            node.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rootNodes, searchTerm]);

    const triggerRefresh = handleRefresh;

    const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv' || activeConnection?.type === 'redis';

    return (
        <div className="h-full flex flex-col border-r bg-card/50 backdrop-blur-md overflow-hidden ring-1 ring-white/5">
            <div className="flex flex-col gap-3 p-4 bg-gradient-to-b from-green-500/10 to-transparent border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center">
                            <Leaf className="w-3.5 h-3.5 text-green-500" />
                        </div>
                        <h2 className="font-bold text-[11px] uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
                            {lang === 'vi' ? 'Bộ sưu tập' : 'Collections'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:bg-green-500/20 hover:text-green-600"
                            onClick={triggerRefresh}
                        >
                            <RefreshCw className="h-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-green-500/20 hover:text-green-600">
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <ConnectionSelector filter="nosql" />

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 transition-colors group-focus-within:text-green-500" />
                        <Input
                            placeholder={lang === 'vi' ? "Tìm Document/Collection..." : "Find Documents..."}
                            className="h-9 text-xs pl-9 pr-8 bg-muted/40 border-none ring-1 ring-border/50 focus:ring-green-500/50 transition-all rounded-xl placeholder:text-muted-foreground/50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar pt-2">
                {!isNoSql && activeConnection && (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground opacity-60">
                        <Leaf className="w-12 h-12 mb-4 text-muted-foreground/30" />
                        <p className="text-sm font-medium">
                            {lang === 'vi' ? 'Chế độ Không gian NoSQL chỉ hỗ trợ kết nối MongoDB hoặc Redis.' : 'NoSQL Workspace only supports MongoDB or Redis connections.'}
                        </p>
                        <p className="text-xs mt-2">
                            {lang === 'vi' ? `Bạn đang chọn: ${activeConnection.type.toUpperCase()}` : `Current selection: ${activeConnection.type.toUpperCase()}`}
                        </p>
                    </div>
                )}

                {isNoSql && isLoading && (
                    <div className="flex flex-col items-center justify-center h-20 gap-3 opacity-40">
                        <div className="w-5 h-5 rounded-full border-2 border-green-500/20 border-t-green-500 animate-spin" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-green-600">
                            {lang === 'vi' ? 'Đang quét BSON' : 'Scanning BSON'}
                        </span>
                    </div>
                )}

                {isNoSql && !isLoading && (
                    <div className="px-2">
                        <SidebarContextMenu
                            type="connection"
                            connectionId={nosqlActiveConnectionId}
                            onAction={(action) => {
                                if (action === 'refresh') triggerRefresh();
                                if (action === 'createDatabase') setCreateDatabaseDialogOpen(true);
                            }}
                        >
                            <div className={cn(
                                "flex items-center py-2 px-3 rounded-xl mb-1 cursor-pointer select-none text-sm font-bold transition-all duration-300 min-w-0",
                                "bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 shadow-sm shadow-green-500/5",
                                "hover:bg-green-500/20 hover:border-green-500/30"
                            )}>
                                <span className="mr-2 w-4 h-4 flex items-center justify-center">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </span>
                                <Database className="w-4 h-4 mr-2.5 drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                                <span className="truncate flex-1">{activeConnection?.name}</span>
                                <div className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-[9px] font-black uppercase tracking-tighter">
                                    {activeConnection?.type}
                                </div>
                            </div>

                            <div className="space-y-0.5 animate-in fade-in slide-in-from-left-2 duration-500">
                                {filteredNodes.length === 0 && !isLoading && (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-2">
                                        <Filter className="h-8 w-8" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-center px-4">
                                            {lang === 'vi' ? 'Không tìm thấy collection' : 'No collections found'}
                                        </p>
                                    </div>
                                )}
                                {filteredNodes.map(node => (
                                    <TreeNodeItem key={node.id} node={node} level={0} connectionId={nosqlActiveConnectionId} />
                                ))}
                            </div>
                        </SidebarContextMenu>
                    </div>
                )}
            </div>
            
            <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-1.5 opacity-50 text-green-600 dark:text-green-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>{lang === 'vi' ? 'Document DB Active' : 'Document DB Active'}</span>
                </div>
            </div>

            <CreateDatabaseDialog
                isOpen={isCreateDatabaseDialogOpen}
                onClose={() => setCreateDatabaseDialogOpen(false)}
                connectionId={nosqlActiveConnectionId}
                onSuccess={triggerRefresh}
            />
            <DeleteDatabaseDialog
                isOpen={isDeleteDatabaseDialogOpen}
                onClose={() => setDeleteDatabaseDialogOpen(false)}
                connectionId={nosqlActiveConnectionId}
                databaseName={databaseToDelete}
                onSuccess={triggerRefresh}
            />
        </div>
    );
};
