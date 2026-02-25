import React, { useMemo } from 'react';
import {
    ArrowDown,
    ScanLine,
    Search,
    GitMerge,
    Layers,
    Filter,
    ArrowUpDown,
    Database,
    Zap,
    AlertTriangle,
    Clock,
    Hash
} from 'lucide-react';

// ─── Types ───
interface PlanNode {
    'Node Type': string;
    'Relation Name'?: string;
    'Schema'?: string;
    'Alias'?: string;
    'Join Type'?: string;
    'Index Name'?: string;
    'Index Cond'?: string;
    'Filter'?: string;
    'Hash Cond'?: string;
    'Merge Cond'?: string;
    'Sort Key'?: string[];
    'Strategy'?: string;
    'Startup Cost': number;
    'Total Cost': number;
    'Plan Rows': number;
    'Plan Width': number;
    'Actual Startup Time'?: number;
    'Actual Total Time'?: number;
    'Actual Rows'?: number;
    'Actual Loops'?: number;
    'Shared Hit Blocks'?: number;
    'Shared Read Blocks'?: number;
    Plans?: PlanNode[];
    [key: string]: any;
}

interface QueryPlan {
    Plan: PlanNode;
    'Planning Time'?: number;
    'Execution Time'?: number;
    'Triggers'?: any[];
}

interface QueryPlanVisualizerProps {
    planData: any; // raw query result rows
}

// ─── Icon for node type ───
const getNodeIcon = (nodeType: string) => {
    const t = nodeType.toLowerCase();
    if (t.includes('seq scan')) return <ScanLine className="w-3.5 h-3.5 text-orange-400" />;
    if (t.includes('index scan') || t.includes('index only'))
        return <Search className="w-3.5 h-3.5 text-green-400" />;
    if (t.includes('bitmap'))
        return <Hash className="w-3.5 h-3.5 text-cyan-400" />;
    if (t.includes('hash join') || t.includes('merge join') || t.includes('nested loop'))
        return <GitMerge className="w-3.5 h-3.5 text-purple-400" />;
    if (t.includes('aggregate') || t.includes('group'))
        return <Layers className="w-3.5 h-3.5 text-blue-400" />;
    if (t.includes('sort'))
        return <ArrowUpDown className="w-3.5 h-3.5 text-yellow-400" />;
    if (t.includes('filter') || t.includes('subquery'))
        return <Filter className="w-3.5 h-3.5 text-pink-400" />;
    if (t.includes('result') || t.includes('append') || t.includes('limit'))
        return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
    return <Database className="w-3.5 h-3.5 text-slate-400" />;
};

// ─── Color for node type ───
const getNodeColor = (nodeType: string): string => {
    const t = nodeType.toLowerCase();
    if (t.includes('seq scan')) return 'border-orange-500/40 bg-orange-500/5';
    if (t.includes('index')) return 'border-green-500/40 bg-green-500/5';
    if (t.includes('join') || t.includes('nested loop')) return 'border-purple-500/40 bg-purple-500/5';
    if (t.includes('aggregate') || t.includes('group')) return 'border-blue-500/40 bg-blue-500/5';
    if (t.includes('sort')) return 'border-yellow-500/40 bg-yellow-500/5';
    return 'border-border/50 bg-muted/20';
};

// ─── Warnings ───
const getWarnings = (node: PlanNode): string[] => {
    const warnings: string[] = [];
    if (node['Node Type'].toLowerCase().includes('seq scan') && (node['Actual Rows'] ?? node['Plan Rows']) > 1000) {
        warnings.push('Sequential scan on large result — consider adding an index');
    }
    if (node['Actual Rows'] !== undefined && node['Plan Rows'] > 0) {
        const ratio = node['Actual Rows'] / node['Plan Rows'];
        if (ratio > 10 || ratio < 0.1) {
            warnings.push(`Row estimate off by ${ratio > 1 ? ratio.toFixed(0) + 'x more' : (1 / ratio).toFixed(0) + 'x fewer'} than planned — consider ANALYZE`);
        }
    }
    return warnings;
};

// ─── Format helpers ───
const fmtTime = (ms?: number) => ms !== undefined ? (ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : ms < 1000 ? `${ms.toFixed(2)}ms` : `${(ms / 1000).toFixed(2)}s`) : '-';
const fmtRows = (n?: number) => n !== undefined ? n.toLocaleString() : '-';
const fmtCost = (n?: number) => n !== undefined ? n.toFixed(2) : '-';

// ─── Plan Node Component ───
const PlanNodeView: React.FC<{
    node: PlanNode;
    maxCost: number;
    depth: number;
}> = ({ node, maxCost, depth }) => {
    const costPct = maxCost > 0 ? (node['Total Cost'] / maxCost) * 100 : 0;
    const timePct = node['Actual Total Time'] && maxCost > 0
        ? Math.min(100, (node['Actual Total Time'] / (maxCost * 0.1 + 1)) * 10)
        : costPct;
    const warnings = getWarnings(node);
    const nodeColor = getNodeColor(node['Node Type']);

    const relation = node['Relation Name']
        ? `${node['Schema'] ? node['Schema'] + '.' : ''}${node['Relation Name']}`
        : '';
    const condition = node['Index Cond'] || node['Filter'] || node['Hash Cond'] || node['Merge Cond'] || '';
    const sortKeys = node['Sort Key']?.join(', ') || '';

    return (
        <div className="relative">
            {/* Connector line */}
            {depth > 0 && (
                <div className="absolute left-4 -top-2 w-px h-2 bg-border/40" />
            )}

            <div className={`border rounded-lg p-2.5 mb-1.5 ${nodeColor} transition-all hover:shadow-md hover:shadow-black/5`}>
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5">
                    {getNodeIcon(node['Node Type'])}
                    <span className="text-xs font-bold text-foreground/90">{node['Node Type']}</span>
                    {node['Join Type'] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
                            {node['Join Type']}
                        </span>
                    )}
                    {node['Strategy'] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                            {node['Strategy']}
                        </span>
                    )}
                    {relation && (
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                            {relation}
                        </span>
                    )}
                </div>

                {/* Cost bar */}
                <div className="relative h-1.5 bg-muted/30 rounded-full mb-2 overflow-hidden">
                    <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{
                            width: `${Math.max(2, timePct)}%`,
                            background: costPct > 80 ? '#ef4444' : costPct > 50 ? '#f59e0b' : '#22c55e'
                        }}
                    />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 text-[10px]">
                    <div>
                        <span className="text-muted-foreground">Cost: </span>
                        <span className="font-mono text-foreground/80">{fmtCost(node['Startup Cost'])}..{fmtCost(node['Total Cost'])}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Rows: </span>
                        <span className="font-mono text-foreground/80">
                            {fmtRows(node['Plan Rows'])}
                            {node['Actual Rows'] !== undefined && (
                                <span className={node['Actual Rows'] !== node['Plan Rows'] ? ' text-yellow-400' : ' text-green-400'}>
                                    {' → '}{fmtRows(node['Actual Rows'])}
                                </span>
                            )}
                        </span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Time: </span>
                        <span className="font-mono text-foreground/80">{fmtTime(node['Actual Total Time'])}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Width: </span>
                        <span className="font-mono text-foreground/80">{node['Plan Width']}B</span>
                    </div>
                </div>

                {/* Condition */}
                {(condition || sortKeys || node['Index Name']) && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/20 text-[10px] space-y-0.5">
                        {node['Index Name'] && (
                            <div>
                                <span className="text-green-400/80">Index: </span>
                                <span className="font-mono text-foreground/60">{node['Index Name']}</span>
                            </div>
                        )}
                        {condition && (
                            <div>
                                <span className="text-blue-400/80">Cond: </span>
                                <span className="font-mono text-foreground/60">{condition}</span>
                            </div>
                        )}
                        {sortKeys && (
                            <div>
                                <span className="text-yellow-400/80">Sort: </span>
                                <span className="font-mono text-foreground/60">{sortKeys}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Warnings */}
                {warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5 mt-1.5 text-[10px] text-orange-400 bg-orange-500/10 rounded px-2 py-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {w}
                    </div>
                ))}
            </div>

            {/* Children */}
            {node.Plans && node.Plans.length > 0 && (
                <div className="ml-6 pl-4 border-l border-border/30 relative">
                    {node.Plans.map((child, i) => (
                        <div key={i} className="relative">
                            <div className="absolute left-[-16px] top-4 w-4 h-px bg-border/40" />
                            <ArrowDown className="absolute left-[-22px] top-1 w-3 h-3 text-muted-foreground/30" />
                            <PlanNodeView node={child} maxCost={maxCost} depth={depth + 1} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Main Component ───
export const QueryPlanVisualizer: React.FC<QueryPlanVisualizerProps> = ({ planData }) => {
    const plan = useMemo<QueryPlan | null>(() => {
        if (!planData) return null;
        try {
            // Helper: extract QueryPlan from any structure
            const extractPlan = (obj: any): QueryPlan | null => {
                if (!obj) return null;
                // Direct plan object { Plan: { ... } }
                if (obj.Plan && obj.Plan['Node Type']) return obj as QueryPlan;
                // Array of plan objects [{ Plan: { ... } }]
                if (Array.isArray(obj) && obj[0]?.Plan) return obj[0] as QueryPlan;
                return null;
            };

            if (Array.isArray(planData) && planData.length > 0) {
                const firstRow = planData[0];

                // Case 1: Direct plan - row IS the plan
                const directPlan = extractPlan(firstRow);
                if (directPlan) return directPlan;

                // Case 2: { "QUERY PLAN": <value> } — PG returns this
                for (const key of Object.keys(firstRow)) {
                    if (key.toUpperCase().includes('QUERY PLAN') || key === 'QUERY PLAN') {
                        let val = firstRow[key];
                        // If string, parse it
                        if (typeof val === 'string') {
                            try { val = JSON.parse(val); } catch { /* not JSON */ }
                        }
                        const fromVal = extractPlan(val);
                        if (fromVal) return fromVal;
                    }
                }

                // Case 3: Nested array [[{ Plan: {...} }]]
                if (Array.isArray(firstRow)) {
                    const nested = extractPlan(firstRow);
                    if (nested) return nested;
                    if (firstRow[0] && Array.isArray(firstRow[0])) {
                        const deeper = extractPlan(firstRow[0]);
                        if (deeper) return deeper;
                    }
                }

                // Case 4: All rows together form the JSON string
                // (some drivers split the JSON across multiple rows)
                const allText = planData.map((r: any) => {
                    const val = Object.values(r)[0];
                    return typeof val === 'string' ? val : JSON.stringify(val);
                }).join('');
                try {
                    const parsed = JSON.parse(allText);
                    const fromParsed = extractPlan(parsed);
                    if (fromParsed) return fromParsed;
                } catch { /* not valid combined JSON */ }
            }
        } catch (e) {
            console.error('Failed to parse query plan:', e);
        }
        return null;
    }, [planData]);

    if (!plan) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                <div className="text-sm mb-2">Unable to parse query plan</div>
                <div className="text-xs">Make sure you're using PostgreSQL. MySQL query plans are not yet supported.</div>
                <pre className="mt-4 text-left text-[10px] bg-muted/30 p-3 rounded overflow-auto max-h-[300px]">
                    {JSON.stringify(planData, null, 2)}
                </pre>
            </div>
        );
    }

    const maxCost = plan.Plan['Total Cost'];

    return (
        <div className="p-4 overflow-auto h-full">
            {/* Summary bar */}
            <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-muted-foreground">Planning:</span>
                    <span className="font-mono font-bold text-foreground">{fmtTime(plan['Planning Time'])}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-2 text-xs">
                    <Zap className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-muted-foreground">Execution:</span>
                    <span className="font-mono font-bold text-foreground">{fmtTime(plan['Execution Time'])}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-2 text-xs">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-muted-foreground">Total Cost:</span>
                    <span className="font-mono font-bold text-foreground">{fmtCost(maxCost)}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-2 text-xs">
                    <ScanLine className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-muted-foreground">Rows:</span>
                    <span className="font-mono font-bold text-foreground">
                        {fmtRows(plan.Plan['Actual Rows'] ?? plan.Plan['Plan Rows'])}
                    </span>
                </div>
            </div>

            {/* Plan tree */}
            <PlanNodeView node={plan.Plan} maxCost={maxCost} depth={0} />
        </div>
    );
};
