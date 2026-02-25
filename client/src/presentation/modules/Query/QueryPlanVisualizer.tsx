import React, { useMemo, useState } from 'react';
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
    Hash,
    Info,
    ChevronDown,
    ChevronRight
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

// ─── Node explanations ───
const getNodeExplanation = (node: PlanNode): { description: string; tip: string; performance: 'good' | 'neutral' | 'warning' | 'bad' } => {
    const t = node['Node Type'].toLowerCase();
    const rows = node['Actual Rows'] ?? node['Plan Rows'];

    if (t.includes('seq scan') || t === 'seq scan') {
        const perf = rows > 10000 ? 'bad' : rows > 1000 ? 'warning' : 'neutral';
        return {
            description: `Sequential Scan đọc toàn bộ bảng "${node['Relation Name'] || '?'}" từ đầu đến cuối, kiểm tra từng hàng một. Trả về ${rows.toLocaleString()} hàng.${node['Filter'] ? ` Lọc theo điều kiện: ${node['Filter']}.` : ''}`,
            tip: rows > 1000
                ? `⚡ Bảng có ${rows.toLocaleString()} hàng — nên tạo INDEX trên cột được dùng trong WHERE/JOIN để tránh quét toàn bộ bảng.`
                : `✅ Bảng nhỏ (${rows.toLocaleString()} hàng) — Seq Scan là đủ hiệu quả, không cần tối ưu thêm.`,
            performance: perf
        };
    }

    if (t.includes('index scan')) {
        return {
            description: `Index Scan sử dụng index "${node['Index Name'] || ''}" để tìm nhanh các hàng phù hợp trong bảng "${node['Relation Name'] || ''}", sau đó đọc dữ liệu từ bảng. Trả về ${rows.toLocaleString()} hàng.`,
            tip: '✅ Sử dụng index — đây là cách truy vấn hiệu quả. Nếu chỉ cần các cột trong index, xem xét dùng Index Only Scan.',
            performance: 'good'
        };
    }

    if (t.includes('index only scan')) {
        return {
            description: `Index Only Scan đọc dữ liệu trực tiếp từ index "${node['Index Name'] || ''}" mà KHÔNG cần truy cập bảng gốc. Đây là phương pháp nhanh nhất.`,
            tip: '🚀 Tuyệt vời! Tất cả dữ liệu cần thiết đều nằm trong index — không cần đọc bảng.',
            performance: 'good'
        };
    }

    if (t.includes('bitmap')) {
        return {
            description: `Bitmap Scan tạo bitmap (bản đồ bit) từ index, sau đó quét bảng theo thứ tự vật lý. Hiệu quả khi cần đọc nhiều hàng rải rác.`,
            tip: '👍 Tốt cho truy vấn trả về nhiều hàng từ index. Hiệu quả hơn Index Scan khi tỷ lệ selectivity trung bình.',
            performance: 'good'
        };
    }

    if (t.includes('hash join')) {
        return {
            description: `Hash Join tạo bảng hash từ tập dữ liệu nhỏ hơn (inner), sau đó duyệt tập lớn hơn (outer) và so khớp qua hash.${node['Hash Cond'] ? ` Điều kiện JOIN: ${node['Hash Cond']}` : ''}`,
            tip: '📊 Hash Join hiệu quả cho JOIN giữa 2 tập dữ liệu lớn. Nếu tốn nhiều memory, hãy kiểm tra work_mem setting.',
            performance: 'neutral'
        };
    }

    if (t.includes('merge join')) {
        return {
            description: `Merge Join sắp xếp cả 2 tập dữ liệu rồi merge chúng lại. Rất hiệu quả khi dữ liệu đã được sắp xếp sẵn (ví dụ: từ index).${node['Merge Cond'] ? ` Điều kiện: ${node['Merge Cond']}` : ''}`,
            tip: '✅ Merge Join rất hiệu quả nếu dữ liệu đã sorted. Nếu thấy Sort node phía dưới, có thể index sẽ giúp loại bỏ bước sort.',
            performance: 'good'
        };
    }

    if (t.includes('nested loop')) {
        return {
            description: `Nested Loop lặp qua từng hàng của tập ngoài (outer), cho mỗi hàng tìm kiếm hàng khớp trong tập trong (inner). Tổng iterations = outer_rows × inner_lookups.`,
            tip: rows > 1000
                ? '⚠️ Nested Loop với nhiều hàng có thể chậm. Kiểm tra xem inner table có sử dụng index không.'
                : '✅ Nested Loop ổn với tập dữ liệu nhỏ, nhất là khi inner side dùng index.',
            performance: rows > 1000 ? 'warning' : 'good'
        };
    }

    if (t.includes('sort')) {
        return {
            description: `Sort sắp xếp dữ liệu theo${node['Sort Key'] ? ': ' + node['Sort Key'].join(', ') : ' cột được chỉ định'}. ${node['Sort Method'] ? `Phương pháp: ${node['Sort Method']}.` : ''}`,
            tip: rows > 10000
                ? '⚠️ Sort trên tập dữ liệu lớn tốn memory/CPU. Tạo INDEX phù hợp để tránh sort.'
                : '✅ Sort trên tập nhỏ — ảnh hưởng không đáng kể.',
            performance: rows > 10000 ? 'warning' : 'neutral'
        };
    }

    if (t.includes('aggregate') || t.includes('group')) {
        return {
            description: `Aggregate nhóm và tính toán dữ liệu (COUNT, SUM, AVG, MAX, MIN...).${node['Strategy'] ? ` Strategy: ${node['Strategy']}.` : ''} ${node['Group Key'] ? `Nhóm theo: ${node['Group Key'].join(', ')}.` : ''}`,
            tip: '📊 Nếu aggregate chậm, kiểm tra xem input data đã được lọc đủ chưa — WHERE clause hẹp hơn sẽ giảm số hàng cần aggregate.',
            performance: 'neutral'
        };
    }

    if (t.includes('limit')) {
        return {
            description: `Limit giới hạn số hàng trả về. PostgreSQL sẽ dừng xử lý ngay khi đủ số hàng cần thiết.`,
            tip: '✅ LIMIT giúp giảm lượng dữ liệu cần xử lý — nhất là khi kết hợp với ORDER BY.',
            performance: 'good'
        };
    }

    if (t.includes('hash')) {
        return {
            description: `Hash node tạo bảng hash từ dữ liệu input — được sử dụng bởi Hash Join ở node cha.`,
            tip: '📦 Là bước chuẩn bị cho Hash Join. Nếu tốn nhiều memory, kiểm tra work_mem.',
            performance: 'neutral'
        };
    }

    if (t.includes('materialize')) {
        return {
            description: `Materialize lưu kết quả của subquery vào memory/disk để có thể đọc lại nhiều lần mà không cần tính toán lại.`,
            tip: '📦 Thường xuất hiện khi subquery được tham chiếu nhiều lần. Nếu tập dữ liệu lớn, có thể tốn memory.',
            performance: 'neutral'
        };
    }

    if (t.includes('append')) {
        return {
            description: `Append nối kết quả từ nhiều nguồn lại với nhau (thường gặp trong UNION hoặc table inheritance).`,
            tip: '✅ Là thao tác bình thường cho UNION/UNION ALL queries.',
            performance: 'neutral'
        };
    }

    if (t.includes('result')) {
        return {
            description: `Result node trả về kết quả được tính toán mà không cần đọc từ bảng (ví dụ: SELECT 1+1, hoặc values list).`,
            tip: '✅ Không truy cập bảng — rất nhanh.',
            performance: 'good'
        };
    }

    return {
        description: `Node "${node['Node Type']}" xử lý ${rows.toLocaleString()} hàng với chi phí ${node['Total Cost'].toFixed(2)}.`,
        tip: '💡 Xem thêm PostgreSQL documentation để hiểu rõ node type này.',
        performance: 'neutral'
    };
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
    const [showExplanation, setShowExplanation] = useState(depth === 0);
    const costPct = maxCost > 0 ? (node['Total Cost'] / maxCost) * 100 : 0;
    const timePct = node['Actual Total Time'] && maxCost > 0
        ? Math.min(100, (node['Actual Total Time'] / (maxCost * 0.1 + 1)) * 10)
        : costPct;
    const warnings = getWarnings(node);
    const explanation = getNodeExplanation(node);
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

                    {/* Expand explanation toggle */}
                    <button
                        onClick={() => setShowExplanation(!showExplanation)}
                        className="ml-auto flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/30"
                    >
                        <Info className="w-3 h-3" />
                        {showExplanation ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                    </button>
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

                {/* Explanation section */}
                {showExplanation && (
                    <div className={`mt-2 pt-2 border-t border-border/20 text-[10px] space-y-1.5 rounded-md p-2 ${explanation.performance === 'good' ? 'bg-green-500/5' :
                            explanation.performance === 'bad' ? 'bg-red-500/5' :
                                explanation.performance === 'warning' ? 'bg-yellow-500/5' :
                                    'bg-muted/10'
                        }`}>
                        <div className="text-foreground/80 leading-relaxed">
                            {explanation.description}
                        </div>
                        <div className={`font-medium ${explanation.performance === 'good' ? 'text-green-400' :
                                explanation.performance === 'bad' ? 'text-red-400' :
                                    explanation.performance === 'warning' ? 'text-yellow-400' :
                                        'text-blue-400'
                            }`}>
                            {explanation.tip}
                        </div>
                    </div>
                )}
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
