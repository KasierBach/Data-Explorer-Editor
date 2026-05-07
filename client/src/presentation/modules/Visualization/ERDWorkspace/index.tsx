import React, { useEffect } from 'react';
import { useERDLogic } from './useERDLogic';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';

// UI Components
import { ERDSidebar } from './components/ERDSidebar';
import { ERDToolbar } from './components/ERDToolbar';
import { ERDCanvas } from './components/ERDCanvas';
import { SaveErdWorkspaceDialog } from './components/SaveERDWorkspaceDialog';
import { OpenErdWorkspaceDialog } from './components/OpenERDWorkspaceDialog';
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
                globalSearchResults={state.globalSearchResults}
                isSearchingGlobal={state.isSearchingGlobal}
                onAddGlobalTable={(item) => {
                    // Logic to handle adding a table from another DB/Connection
                    toast.info(`Smart Add: ${item.name} (${item.connectionName})`);
                    // For now, toggle if it exists in local context, or show warning
                    actions.toggleTable(item.name);
                }}
                isRefreshing={state.isRefreshing}
                onRefresh={actions.handleRefreshMetadata}
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
                backgroundVariant={state.backgroundVariant}
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
                        backgroundVariant={state.backgroundVariant}
                        setBackgroundVariant={actions.setBackgroundVariant}
                        isEdgeAnimated={state.isEdgeAnimated}
                        setIsEdgeAnimated={actions.setIsEdgeAnimated}
                        isToolbarCollapsed={state.isToolbarCollapsed}
                        setIsToolbarCollapsed={actions.setIsToolbarCollapsed}
                        currentWorkspaceName={state.currentWorkspaceName}
                        onOpenSaveDialog={actions.openSaveDialog}
                        onOpenWorkspaceDialog={actions.openWorkspaceDialog}
                        onFitView={() => {}}
                    />
                )}
            />

            <SaveErdWorkspaceDialog
                open={state.isSaveDialogOpen}
                onOpenChange={actions.setIsSaveDialogOpen}
                lang={state.lang}
                currentWorkspaceName={state.currentWorkspaceName}
                initialValues={{
                    name: state.currentWorkspaceName || `${state.selectedDatabase || state.activeConnection?.name || 'ERD'} workspace`,
                    notes: state.currentWorkspaceNotes || '',
                }}
                onSubmit={actions.saveWorkspace}
            />

            <OpenErdWorkspaceDialog
                open={state.isOpenWorkspaceDialogOpen}
                onOpenChange={actions.setIsOpenWorkspaceDialogOpen}
                lang={state.lang}
                workspaces={state.erdWorkspaces}
                onOpenWorkspace={actions.loadWorkspace}
                onDeleteWorkspace={actions.deleteWorkspace}
                onRestoreWorkspace={actions.loadWorkspace}
            />
        </div>
    );
};
