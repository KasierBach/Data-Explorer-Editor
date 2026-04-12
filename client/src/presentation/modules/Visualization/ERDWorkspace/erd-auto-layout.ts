import type { Edge, Node, Position } from '@xyflow/react';
import dagre from 'dagre';

type LayoutDirection = 'TB' | 'LR';

const NODE_WIDTH = 300;
const COLLAPSED_NODE_HEIGHT = 60;
const BASE_NODE_HEIGHT = 70;
const COLUMN_HEIGHT = 30;

const buildNodeHeight = (node: Node) => {
    const tableInfo = node.data as { columns?: unknown[]; isCollapsed?: boolean };
    if (tableInfo.isCollapsed) return COLLAPSED_NODE_HEIGHT;
    return BASE_NODE_HEIGHT + ((tableInfo.columns?.length || 0) * COLUMN_HEIGHT);
};

const buildNodePorts = (direction: LayoutDirection) => ({
    targetPosition: (direction === 'LR' ? 'left' : 'top') as Position,
    sourcePosition: (direction === 'LR' ? 'right' : 'bottom') as Position,
});

export const applyAutoLayout = (
    nodes: Node[],
    edges: Edge[],
    direction: LayoutDirection = 'LR',
): Node[] => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: direction === 'LR' ? 100 : 150,
        ranksep: direction === 'LR' ? 200 : 150,
        align: 'DL',
        ranker: 'tight-tree',
    });

    const connectedNodeIds = new Set<string>();
    edges.forEach((edge) => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
    });

    const connectedNodes = nodes.filter((node) => connectedNodeIds.has(node.id));
    const standaloneNodes = nodes.filter((node) => !connectedNodeIds.has(node.id));

    connectedNodes.forEach((node) => {
        dagreGraph.setNode(node.id, {
            width: NODE_WIDTH,
            height: buildNodeHeight(node),
        });
    });

    edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
    dagre.layout(dagreGraph);

    let maxX = -Infinity;
    let minX = Infinity;
    let maxY = -Infinity;
    let minY = Infinity;

    const laidOutNodes = nodes.map((node) => {
        if (!connectedNodeIds.has(node.id)) return node;

        const positionedNode = dagreGraph.node(node.id);
        const x = positionedNode.x - (NODE_WIDTH / 2);
        const y = positionedNode.y - 25;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + NODE_WIDTH);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + 100);

        return {
            ...node,
            ...buildNodePorts(direction),
            position: { x, y },
        };
    });

    if (standaloneNodes.length === 0) {
        return laidOutNodes;
    }

    const startX = direction === 'LR' ? (maxX === -Infinity ? 0 : maxX + 200) : (minX === Infinity ? 0 : minX);
    const startY = direction === 'LR' ? (minY === Infinity ? 0 : minY) : (maxY === -Infinity ? 0 : maxY + 200);
    const columns = direction === 'LR' ? 3 : 5;

    standaloneNodes.forEach((node, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const targetIndex = laidOutNodes.findIndex((entry) => entry.id === node.id);
        if (targetIndex === -1) return;

        laidOutNodes[targetIndex] = {
            ...laidOutNodes[targetIndex],
            position: {
                x: startX + (column * 350),
                y: startY + (row * 150),
            },
        };
    });

    return laidOutNodes;
};
