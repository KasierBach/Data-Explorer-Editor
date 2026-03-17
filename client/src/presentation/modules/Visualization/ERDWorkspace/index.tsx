import React, { useCallback } from 'react';
import { useERDLogic } from './useERDLogic';

// UI Components
import { ERDSidebar } from './components/ERDSidebar';
import { ERDToolbar } from './components/ERDToolbar';
import { ERDCanvas } from './components/ERDCanvas';

interface ERDWorkspaceProps {
    tabId: string;
    connectionId: string;
    database?: string;
}

export const ERDWorkspace: React.FC<ERDWorkspaceProps> = ({ tabId, connectionId, database: databaseProp }) => {
    const { state, actions } = useERDLogic(tabId, connectionId, databaseProp);

    const handleSelectAll = useCallback(() => {
        if (!state.hierarchy) return;
        actions.setVisibleTableNames(new Set(state.hierarchy.map(h => h.name)));
    }, [state.hierarchy, actions]);

    const handleDeselectAll = useCallback(() => {
        actions.setVisibleTableNames(new Set());
        actions.setNodes([]);
        actions.setEdges([]);
    }, [actions]);

    return (
        <div className="h-full w-full bg-background relative flex overflow-hidden">
            <ERDSidebar
                isCollapsed={state.isSidebarCollapsed}
                setCollapsed={actions.setSidebarCollapsed}
                lang={state.lang}
                selectedDatabase={state.selectedDatabase}
                setSelectedDatabase={(val) => {
                    actions.setSelectedDatabase(val);
                    handleDeselectAll();
                }}
                allDatabases={state.allDatabases || []}
                hierarchy={state.hierarchy || []}
                visibleTableNames={state.visibleTableNames}
                toggleTable={actions.toggleTable}
                searchTerm={state.searchTerm}
                setSearchTerm={actions.setSearchTerm}
                schemaFilter={state.schemaFilter}
                setSchemaFilter={actions.setSchemaFilter}
                handleSelectAll={handleSelectAll}
                handleDeselectAll={handleDeselectAll}
            />

            <ERDCanvas
                nodes={state.nodes}
                edges={state.edges}
                onNodesChange={actions.onNodesChange}
                onEdgesChange={actions.handleEdgesChange}
                onConnect={actions.onConnect}
                isLoading={state.isLoadingHierarchy || state.isLoadingCols}
                effectiveDatabase={state.effectiveDatabase}
                lang={state.lang}
                showMinimap={state.showMinimap}
                pendingConnection={state.pendingConnection}
                setPendingConnection={actions.setPendingConnection}
                handleCreateForeignKey={actions.handleCreateForeignKey}
            />

            <ERDToolbar
                isSidebarCollapsed={state.isSidebarCollapsed}
                setSidebarCollapsed={actions.setSidebarCollapsed}
                lang={state.lang}
                activeConnectionName={state.activeConnection?.name}
                selectedDatabase={state.selectedDatabase}
                detailLevel={state.detailLevel}
                setDetailLevel={actions.setDetailLevel}
                showMinimap={state.showMinimap}
                setShowMinimap={actions.setShowMinimap}
                handleAutoLayout={actions.handleAutoLayout}
                handleExportPNG={actions.handleExportPNG}
                handleExportSQL={actions.handleExportSQL}
                onFitView={() => {
                    // This is handled by ReactFlow internally but we can call fitView if we had the instance
                    // For now, let's just use the toolbar as a trigger.
                    // Actually, we could use the useReactFlow hook in ERDCanvas and expose an action.
                }}
            />
        </div>
    );
};
