import React from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/presentation/components/ui/context-menu"; // Will need to ensure shadcn component is generated or import from radix directly if not using shadcn CLI
// Actually, let's assume we need to Create the UI component first if it doesn't exist.
// Checking if we have context-menu in UI components... likely not yet.
// So I will implement a basic wrapper using Radix primitive or just assume I need to create the UI component file first.

// Let's create the UI component first in a separate step if generic.
// For now, I'll put the specific logic here.

interface SidebarContextMenuProps {
    children: React.ReactNode;
    type: 'connection' | 'database' | 'table' | 'view' | 'function' | 'schema' | 'folder';
    onAction: (action: string) => void;
}

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({ children, type, onAction }) => {
    if (type !== 'connection' && type !== 'database' && type !== 'table') {
        // Only connection/database/table nodes have actions for now
        return <>{children}</>;
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                {type === 'connection' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>Refresh</ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('toggleShowAll')}>
                            Toggle "Show All DBs"
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('createDatabase')}>Create Database</ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('edit')}>Edit Connection</ContextMenuItem>
                        {/* <ContextMenuItem onSelect={() => onAction('disconnect')} className="text-red-600">Disconnect</ContextMenuItem> */}
                    </>
                )}
                {type === 'database' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>Refresh</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                            onSelect={() => onAction('deleteDatabase')}
                            className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                        >
                            Delete Database
                        </ContextMenuItem>
                    </>
                )}
                {type === 'table' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('selectTop')}>Select Top 1000</ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('countRows')}>Count Rows</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('copyName')}>Copy Name</ContextMenuItem>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
};
