import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Database, Table, Folder, List } from 'lucide-react';
import type { TreeNode } from '@/core/domain/entities';
import { useDatabaseHierarchy } from '@/presentation/hooks/useDatabase';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/core/services/store';

import { SidebarContextMenu } from './SidebarContextMenu';

const FileIcon = ({ type, className }: { type: string, className?: string }) => {
    switch (type) {
        case 'database': return <Database className={cn("w-4 h-4 text-blue-500", className)} />;
        case 'schema': return <Folder className={cn("w-4 h-4 text-yellow-500", className)} />;
        case 'folder': return <Folder className={cn("w-4 h-4 text-yellow-500/80", className)} />;
        case 'table': return <Table className={cn("w-4 h-4 text-blue-400", className)} />;
        case 'view': return <div className="w-4 h-4 flex items-center justify-center text-purple-500"><Table className="w-3 h-3" /></div>; // Eye icon better? using Table for now with color distinction
        case 'function': return <div className="w-4 h-4 flex items-center justify-center text-orange-500"><List className="w-3 h-3" /></div>;
        default: return <List className={cn("w-4 h-4 text-gray-400", className)} />;
    }
};

interface TreeNodeProps {
    node: TreeNode;
    level: number;
}

export const TreeNodeItem: React.FC<TreeNodeProps> = ({ node, level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { data: children, isLoading } = useDatabaseHierarchy(isExpanded ? node.id : null);
    const openTab = useAppStore(state => state.openTab);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.hasChildren) {
            setIsExpanded(!isExpanded);
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
            // We need to pass this up or handle it via a custom hook/store action
            // For now, let's dispatch a custom event or use a global handler if needed
            // But cleaner: TreeNodeItem needs access to some context or props for actions
            // Let's dispatch a window event for simplicity in this short term, or update props
            // Actually, dispatching a custom event is decent for decoupling deep trees
            window.dispatchEvent(new CustomEvent('tree-node-action', {
                detail: { action, nodeId: node.id, nodeType: node.type }
            }));
        }}>
            <div
                className={cn(
                    "flex items-center py-1 px-2 hover:bg-accent cursor-pointer select-none text-sm group",
                    // Add some visual indicator for context menu availability?
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleToggle}
                onDoubleClick={handleDoubleClick}
                onContextMenu={() => {
                    // console.log("Right clicked", node.name);
                }}
            >
                <span className="mr-1 w-4 h-4 flex items-center justify-center">
                    {node.hasChildren && (
                        isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                    )}
                </span>
                <FileIcon type={node.type} className="mr-2" />
                <span className="truncate flex-1">{node.name}</span>
            </div>

            {isExpanded && (
                <div>
                    {isLoading && <div className="pl-8 text-xs text-muted-foreground py-1">Loading...</div>}
                    {children?.map(child => (
                        <TreeNodeItem key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </SidebarContextMenu>
    );
};
