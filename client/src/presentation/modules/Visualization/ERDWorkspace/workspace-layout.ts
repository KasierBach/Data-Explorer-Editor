import type { Edge, Node } from '@xyflow/react';

export type DetailLevel = 'all' | 'keys' | 'name';
export type EdgeRouting = 'smoothstep' | 'step' | 'straight';
export type BackgroundVariant = 'dots' | 'lines' | 'cross';

export interface ErdWorkspaceLayout {
    visibleTables: string[];
    nodes: Node[];
    edges: Edge[];
    isSidebarCollapsed: boolean;
    detailLevel: DetailLevel;
    schemaFilter: string;
    showMinimap: boolean;
    performanceMode: boolean;
    edgeRouting: EdgeRouting;
    backgroundVariant: BackgroundVariant;
    isEdgeAnimated: boolean;
    isToolbarCollapsed: boolean;
    collapsedTables: string[];
}

export const createDefaultWorkspaceLayout = (): ErdWorkspaceLayout => ({
    visibleTables: [],
    nodes: [],
    edges: [],
    isSidebarCollapsed: false,
    detailLevel: 'all',
    schemaFilter: 'all',
    showMinimap: true,
    performanceMode: false,
    edgeRouting: 'smoothstep',
    backgroundVariant: 'dots',
    isEdgeAnimated: true,
    isToolbarCollapsed: false,
    collapsedTables: [],
});

export const normalizeWorkspaceLayout = (layout?: Partial<ErdWorkspaceLayout> | null): ErdWorkspaceLayout => {
    const defaults = createDefaultWorkspaceLayout();
    return {
        visibleTables: Array.isArray(layout?.visibleTables) ? layout.visibleTables : defaults.visibleTables,
        nodes: Array.isArray(layout?.nodes) ? layout.nodes : defaults.nodes,
        edges: Array.isArray(layout?.edges) ? layout.edges : defaults.edges,
        isSidebarCollapsed: Boolean(layout?.isSidebarCollapsed),
        detailLevel: layout?.detailLevel || defaults.detailLevel,
        schemaFilter: layout?.schemaFilter || defaults.schemaFilter,
        showMinimap: layout?.showMinimap ?? defaults.showMinimap,
        performanceMode: Boolean(layout?.performanceMode),
        edgeRouting: layout?.edgeRouting || defaults.edgeRouting,
        backgroundVariant: layout?.backgroundVariant || defaults.backgroundVariant,
        isEdgeAnimated: layout?.isEdgeAnimated ?? defaults.isEdgeAnimated,
        isToolbarCollapsed: Boolean(layout?.isToolbarCollapsed),
        collapsedTables: Array.isArray(layout?.collapsedTables) ? layout.collapsedTables : defaults.collapsedTables,
    };
};

export const buildWorkspaceLayoutSnapshot = (params: {
    visibleTables: Set<string>;
    nodes: Node[];
    edges: Edge[];
    isSidebarCollapsed: boolean;
    detailLevel: DetailLevel;
    schemaFilter: string;
    showMinimap: boolean;
    performanceMode: boolean;
    edgeRouting: EdgeRouting;
    backgroundVariant: BackgroundVariant;
    isEdgeAnimated: boolean;
    isToolbarCollapsed: boolean;
    collapsedTables: Set<string>;
}): ErdWorkspaceLayout => ({
    visibleTables: Array.from(params.visibleTables),
    nodes: params.nodes,
    edges: params.edges.filter((edge) => !edge.id.startsWith('db-e-')),
    isSidebarCollapsed: params.isSidebarCollapsed,
    detailLevel: params.detailLevel,
    schemaFilter: params.schemaFilter,
    showMinimap: params.showMinimap,
    performanceMode: params.performanceMode,
    edgeRouting: params.edgeRouting,
    backgroundVariant: params.backgroundVariant,
    isEdgeAnimated: params.isEdgeAnimated,
    isToolbarCollapsed: params.isToolbarCollapsed,
    collapsedTables: Array.from(params.collapsedTables),
});
