import React from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
    ContextMenuSub,
    ContextMenuSubTrigger,
    ContextMenuSubContent,
} from "@/presentation/components/ui/context-menu";

import { useAppStore } from '@/core/services/store';

interface SidebarContextMenuProps {
    children: React.ReactNode;
    type: 'connection' | 'database' | 'table' | 'view' | 'function' | 'schema' | 'folder' | 'collection' | 'column' | 'primary_key' | 'index' | 'trigger' | 'constraint';
    onAction: (action: string) => void;
    connectionId?: string | null;
}

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({ children, type, onAction, connectionId }) => {
    const store = useAppStore();
    const activeId = connectionId || store.activeConnectionId || store.nosqlActiveConnectionId;
    const connection = store.connections.find(c => c.id === activeId);
    const isNoSql = connection?.type === 'mongodb' || connection?.type === 'mongodb+srv' || connection?.type === 'redis';

    const hasMenu = [
        'connection', 'database', 'table', 'view', 'schema', 'collection',
        'folder', 'column', 'primary_key', 'index', 'trigger', 'constraint'
    ].includes(type);
    if (!hasMenu) return <>{children}</>;

    return (
        <ContextMenu>
            <ContextMenuTrigger>{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-56">
                {/* ─── Connection ─── */}
                {type === 'connection' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>
                            Refresh
                        </ContextMenuItem>
                        {!isNoSql && (
                            <ContextMenuItem onSelect={() => onAction('toggleShowAll')}>
                                Toggle "Show All DBs"
                            </ContextMenuItem>
                        )}
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('createDatabase')}>
                            Create Database...
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('edit')}>
                            Edit Connection...
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Database ─── */}
                {type === 'database' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>
                            Refresh
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        {!isNoSql && (
                            <ContextMenuItem onSelect={() => onAction('createSchema')}>
                                Create Schema...
                            </ContextMenuItem>
                        )}
                        {!isNoSql && <ContextMenuSeparator />}
                        <ContextMenuItem
                            onSelect={() => onAction('deleteDatabase')}
                            className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                        >
                            Drop Database
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Schema ─── */}
                {type === 'schema' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>
                            Refresh
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('createTable')}>
                            Create Table...
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('copyName')}>
                            Copy Name
                        </ContextMenuItem>
                        <ContextMenuItem
                            onSelect={() => onAction('dropSchema')}
                            className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                        >
                            Drop Schema
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Table ─── */}
                {type === 'table' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('selectTop')}>
                            SELECT TOP 1000 Rows
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('countRows')}>
                            Count Rows
                        </ContextMenuItem>
                        <ContextMenuSeparator />

                        <ContextMenuSub>
                            <ContextMenuSubTrigger>Script As</ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-48">
                                <ContextMenuItem onSelect={() => onAction('scriptCreate')}>
                                    CREATE TABLE
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => onAction('scriptInsert')}>
                                    INSERT INTO
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => onAction('scriptSelect')}>
                                    SELECT
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => onAction('scriptUpdate')}>
                                    UPDATE
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => onAction('scriptDelete')}>
                                    DELETE
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => onAction('scriptDrop')}>
                                    DROP TABLE
                                </ContextMenuItem>
                            </ContextMenuSubContent>
                        </ContextMenuSub>

                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('openDesigner')}>
                            Design Table
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('copyName')}>
                            Copy Name
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('copyQualifiedName')}>
                            Copy Qualified Name
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('truncateTable')}
                            className="text-orange-600 focus:text-orange-600 focus:bg-orange-500/10"
                        >
                            Truncate Table
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('dropTable')}
                            className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                        >
                            Drop Table
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── View ─── */}
                {type === 'view' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('selectTop')}>
                            SELECT TOP 1000 Rows
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('countRows')}>
                            Count Rows
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuSub>
                            <ContextMenuSubTrigger>Script As</ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-48">
                                <ContextMenuItem onSelect={() => onAction('scriptSelect')}>
                                    SELECT
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => onAction('scriptDrop')}>
                                    DROP VIEW
                                </ContextMenuItem>
                            </ContextMenuSubContent>
                        </ContextMenuSub>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('copyName')}>
                            Copy Name
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('copyQualifiedName')}>
                            Copy Qualified Name
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Collection (NoSQL) ─── */}
                {type === 'collection' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>
                            Refresh
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('deleteCollection')} className="text-red-600">
                            Drop Collection
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Folder ─── */}
                {type === 'folder' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>
                            Refresh
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Column / PK ─── */}
                {(type === 'column' || type === 'primary_key') && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('openDesigner')}>
                            Design Column...
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('copyName')}>
                            Copy Name
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('dropColumn')} className="text-red-600">
                            Drop Column
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Index ─── */}
                {type === 'index' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>
                            Refresh
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuSub>
                            <ContextMenuSubTrigger>Script As</ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-48">
                                <ContextMenuItem onSelect={() => onAction('scriptCreate')}>
                                    CREATE INDEX
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => onAction('scriptDrop')}>
                                    DROP INDEX
                                </ContextMenuItem>
                            </ContextMenuSubContent>
                        </ContextMenuSub>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('copyName')}>
                            Copy Name
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('dropIndex')} className="text-red-600">
                            Drop Index
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Trigger ─── */}
                {type === 'trigger' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>
                            Refresh
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuSub>
                            <ContextMenuSubTrigger>Script As</ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-48">
                                <ContextMenuItem onSelect={() => onAction('scriptCreate')}>
                                    CREATE TRIGGER
                                </ContextMenuItem>
                                <ContextMenuItem onSelect={() => onAction('scriptDrop')}>
                                    DROP TRIGGER
                                </ContextMenuItem>
                            </ContextMenuSubContent>
                        </ContextMenuSub>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('copyName')}>
                            Copy Name
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('dropTrigger')} className="text-red-600">
                            Drop Trigger
                        </ContextMenuItem>
                    </>
                )}

                {/* ─── Constraint ─── */}
                {type === 'constraint' && (
                    <>
                        <ContextMenuItem onSelect={() => onAction('refresh')}>
                            Refresh
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => onAction('copyName')}>
                            Copy Name
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onAction('dropConstraint')} className="text-red-600">
                            Drop Constraint
                        </ContextMenuItem>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
};
