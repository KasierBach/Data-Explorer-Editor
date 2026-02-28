import React from 'react';
import {
    ChevronRight,
    ChevronDown,
    Database,
    Table,
    Folder,
    FileCode,
    Key,
    Eye,
    Zap,
    Box,
    Layers,
    Binary
} from 'lucide-react';
import type { TreeNode } from '@/core/domain/entities';
import { useDatabaseHierarchy } from '@/presentation/hooks/useDatabase';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/core/services/store';

import { SidebarContextMenu } from './SidebarContextMenu';

const FileIcon = ({ type, className }: { type: string, className?: string }) => {
    switch (type) {
        case 'database':
            return <Database className={cn("w-4 h-4 text-cyan-500 fill-cyan-500/10", className)} />;
        case 'schema':
            return <Layers className={cn("w-4 h-4 text-indigo-400", className)} />;
        case 'folder':
            if (className?.includes('Tables')) return <Table className={cn("w-4 h-4 text-amber-500", className.replace('Tables', ''))} />;
            if (className?.includes('Views')) return <Eye className={cn("w-4 h-4 text-amber-500", className.replace('Views', ''))} />;
            if (className?.includes('Functions')) return <Zap className={cn("w-4 h-4 text-amber-500", className.replace('Functions', ''))} />;
            return <Folder className={cn("w-4 h-4 text-amber-500 fill-amber-500/10", className)} />;
        case 'table':
            return <Table className={cn("w-4 h-4 text-blue-500", className)} />;
        case 'view':
            return <Eye className={cn("w-4 h-4 text-purple-400", className)} />;
        case 'function':
            return <Zap className={cn("w-4 h-4 text-yellow-500", className)} />;
        case 'procedure':
            return <FileCode className={cn("w-4 h-4 text-emerald-500", className)} />;
        case 'column':
            return <Binary className={cn("w-4 h-4 text-slate-400", className)} />;
        case 'primary_key':
            return <Key className={cn("w-4 h-4 text-amber-400 rotate-45", className)} />;
        default:
            return <Box className={cn("w-4 h-4 text-slate-400", className)} />;
    }
};

interface TreeNodeProps {
    node: TreeNode;
    level: number;
}

export const TreeNodeItem: React.FC<TreeNodeProps> = ({ node, level }) => {
    const isExpanded = useAppStore(state => state.expandedNodes.includes(node.id));
    const toggleExpansion = useAppStore(state => state.toggleNodeExpansion);

    const { data: children, isLoading } = useDatabaseHierarchy(isExpanded ? node.id : null);
    const openTab = useAppStore(state => state.openTab);
    const activeDatabase = useAppStore(state => state.activeDatabase);
    const setActiveDatabase = useAppStore(state => state.setActiveDatabase);

    const isActiveDb = node.type === 'database' && activeDatabase === node.name;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.type === 'database') {
            if (node.hasChildren) {
                toggleExpansion(node.id);
            }
            setActiveDatabase(node.name);
        } else {
            // Other nodes: normal toggle
            if (node.hasChildren) {
                toggleExpansion(node.id);
            }
        }
    };

    const handleDoubleClick = () => {
        if (node.type === 'table' || node.type === 'view') {
            openTab({
                id: node.id,
                title: node.name,
                type: 'table',
                metadata: { tableId: node.id }
            });
        }
    };

    return (
        <SidebarContextMenu type={node.type as any} onAction={(action) => {
            window.dispatchEvent(new CustomEvent('tree-node-action', {
                detail: { action, nodeId: node.id, nodeType: node.type }
            }));
        }}>
            <div
                className={cn(
                    "flex items-center py-1.5 px-2 hover:bg-accent/50 cursor-pointer select-none text-sm group transition-all duration-200 border-l-2 border-transparent",
                    isExpanded && node.hasChildren && "bg-accent/20",
                    isActiveDb && "border-l-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/15",
                    !isActiveDb && "hover:border-blue-500/50"
                )}
                style={{ paddingLeft: `${level * 12 + 4}px` }}
                onClick={handleToggle}
                onDoubleClick={handleDoubleClick}
            >
                <span className="mr-0.5 w-4 h-4 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    {node.hasChildren && (
                        isExpanded ?
                            <ChevronDown className="w-3 h-3 text-muted-foreground/70" /> :
                            <ChevronRight className="w-3 h-3 text-muted-foreground/70" />
                    )}
                </span>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileIcon type={node.type} className={cn("shrink-0 transition-all group-hover:drop-shadow-[0_0_3px_rgba(59,130,246,0.3)]", node.type === 'folder' ? node.name : '')} />
                    <span className={cn(
                        "truncate font-medium transition-colors",
                        node.type === 'database' || node.type === 'schema' ? "text-foreground/90 font-semibold text-xs uppercase tracking-tight" : "text-foreground/80 group-hover:text-foreground"
                    )}>
                        {node.name}
                    </span>

                    {/* Optional indicator for child count if we had it, or just small deco */}
                    {node.hasChildren && !isExpanded && !isActiveDb && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    {isActiveDb && (
                        <div className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-wider">
                            ACTIVE
                        </div>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="relative">
                    {/* Continuous vertical line for hierarchy depth */}
                    <div
                        className="absolute left-[13px] top-0 bottom-0 w-px bg-border/40"
                        style={{ left: `${level * 12 + 11}px` }}
                    />

                    {isLoading && (
                        <div className="pl-12 text-[10px] text-muted-foreground/60 py-1 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full border border-blue-500/30 border-t-blue-500 animate-spin" />
                            Loading...
                        </div>
                    )}
                    {children?.map(child => (
                        <TreeNodeItem key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </SidebarContextMenu>
    );
};
