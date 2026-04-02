import React, { useEffect } from 'react';
import { useERDLogic } from './useERDLogic';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';

// UI Components
import { ERDSidebar } from './components/ERDSidebar';
import { ERDToolbar } from './components/ERDToolbar';
import { ERDCanvas } from './components/ERDCanvas';
import '@xyflow/react/dist/style.css'; // Added CSS import

interface ERDWorkspaceProps {
    tabId: string;
    connectionId: string;
    database?: string;
}

export const ERDWorkspace: React.FC<ERDWorkspaceProps> = ({ tabId, connectionId, database: databaseProp }) => {
    const { state, actions } = useERDLogic(tabId, connectionId, databaseProp);
    const connections = useAppStore(state => state.connections);
    const activeConnection = connections.find(c => c.id === connectionId);

    // Ensure adapter is connected
    useEffect(() => {
        if (connectionId && activeConnection) {
            connectionService.setActiveConnection(activeConnection);
        }
    }, [connectionId, activeConnection]); // Changed activeConnectionId to connectionId

    return (
        <div className="h-full w-full bg-background relative flex overflow-hidden">
            <ERDSidebar
                isCollapsed={state.isSidebarCollapsed}
                setCollapsed={actions.setSidebarCollapsed}
                lang={state.lang}
                selectedDatabase={state.selectedDatabase}
                setSelectedDatabase={(val) => {
                    actions.setSelectedDatabase(val);
                    actions.handleDeselectAll();
                }}
                allDatabases={state.allDatabases || []}
                hierarchy={state.hierarchy || []}
                filteredHierarchy={state.filteredHierarchy || []}
                visibleTableNames={state.visibleTableNames}
                toggleTable={actions.toggleTable}
                searchTerm={state.searchTerm}
                setSearchTerm={actions.setSearchTerm}
                schemaFilter={state.schemaFilter}
                setSchemaFilter={actions.setSchemaFilter}
                handleSelectAll={actions.handleSelectAll}
                handleDeselectAll={actions.handleDeselectAll}
                isLoadingHierarchy={state.isLoadingHierarchy}
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
                handleEdgeMouseEnter={actions.handleEdgeMouseEnter}
                handleEdgeMouseLeave={actions.handleEdgeMouseLeave}
                hoverPosition={state.hoverPosition}
                hoveredEdgeId={state.hoveredEdgeId}
                toolbar={(
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
                        performanceMode={state.performanceMode}
                        setPerformanceMode={actions.setPerformanceMode}
                        edgeRouting={state.edgeRouting}
                        setEdgeRouting={actions.setEdgeRouting}
                        onFitView={() => {}}
                    />
                )}
            />
        </div>
    );
};
