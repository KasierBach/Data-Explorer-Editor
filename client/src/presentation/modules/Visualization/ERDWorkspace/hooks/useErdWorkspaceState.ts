import { useState } from 'react';
import {
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
} from '@xyflow/react';
import {
    buildWorkspaceLayoutSnapshot,
    normalizeWorkspaceLayout,
    type BackgroundVariant,
    type DetailLevel,
    type EdgeRouting,
} from '../workspace-layout';

interface UseErdWorkspaceStateOptions {
    initialMetadata: Record<string, unknown>;
}

export function useErdWorkspaceState({ initialMetadata }: UseErdWorkspaceStateOptions) {
    const initialLayout = normalizeWorkspaceLayout(initialMetadata);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialLayout.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialLayout.edges);
    const [visibleTableNames, setVisibleTableNames] = useState<Set<string>>(new Set(initialLayout.visibleTables));
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(initialLayout.isSidebarCollapsed);
    const [detailLevel, setDetailLevel] = useState<DetailLevel>(initialLayout.detailLevel);
    const [schemaFilter, setSchemaFilter] = useState<string>(initialLayout.schemaFilter);
    const [showMinimap, setShowMinimap] = useState(initialLayout.showMinimap);
    const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set(initialLayout.collapsedTables));
    const [performanceMode, setPerformanceMode] = useState<boolean>(initialLayout.performanceMode);
    const [edgeRouting, setEdgeRouting] = useState<EdgeRouting>(initialLayout.edgeRouting);
    const [backgroundVariant, setBackgroundVariant] = useState<BackgroundVariant>(initialLayout.backgroundVariant);
    const [isEdgeAnimated, setIsEdgeAnimated] = useState<boolean>(initialLayout.isEdgeAnimated);
    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState<boolean>(initialLayout.isToolbarCollapsed);

    const buildWorkspaceLayout = () => buildWorkspaceLayoutSnapshot({
        visibleTables: visibleTableNames,
        nodes,
        edges,
        isSidebarCollapsed,
        detailLevel,
        schemaFilter,
        showMinimap,
        performanceMode,
        edgeRouting,
        backgroundVariant,
        isEdgeAnimated,
        isToolbarCollapsed,
        collapsedTables,
    });

    const applyWorkspaceLayout = (layout?: Record<string, unknown> | null) => {
        const normalized = normalizeWorkspaceLayout(layout);
        setVisibleTableNames(new Set(normalized.visibleTables));
        setNodes(normalized.nodes);
        setEdges(normalized.edges);
        setSidebarCollapsed(normalized.isSidebarCollapsed);
        setDetailLevel(normalized.detailLevel);
        setSchemaFilter(normalized.schemaFilter);
        setShowMinimap(normalized.showMinimap);
        setPerformanceMode(normalized.performanceMode);
        setEdgeRouting(normalized.edgeRouting);
        setBackgroundVariant(normalized.backgroundVariant);
        setIsEdgeAnimated(normalized.isEdgeAnimated);
        setIsToolbarCollapsed(normalized.isToolbarCollapsed);
        setCollapsedTables(new Set(normalized.collapsedTables));
    };

    const handleToggleCollapse = (name: string) => {
        setCollapsedTables((current) => {
            const next = new Set(current);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const handleSelectAll = (filteredHierarchy: Array<{ name: string }>) => {
        setVisibleTableNames(new Set(filteredHierarchy.map((entry) => entry.name)));
    };

    const handleDeselectAll = () => {
        setVisibleTableNames(new Set());
    };

    return {
        nodes,
        setNodes,
        onNodesChange,
        edges,
        setEdges,
        onEdgesChange,
        visibleTableNames,
        setVisibleTableNames,
        isSidebarCollapsed,
        setSidebarCollapsed,
        detailLevel,
        setDetailLevel,
        schemaFilter,
        setSchemaFilter,
        showMinimap,
        setShowMinimap,
        collapsedTables,
        setCollapsedTables,
        performanceMode,
        setPerformanceMode,
        edgeRouting,
        setEdgeRouting,
        backgroundVariant,
        setBackgroundVariant,
        isEdgeAnimated,
        setIsEdgeAnimated,
        isToolbarCollapsed,
        setIsToolbarCollapsed,
        buildWorkspaceLayout,
        applyWorkspaceLayout,
        handleToggleCollapse,
        handleSelectAll,
        handleDeselectAll,
    };
}
