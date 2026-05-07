import React, { useState, useEffect } from 'react';
import { SearchCode, Info, Activity, Database, CheckCircle2, RefreshCw, Loader2, Zap } from 'lucide-react';
import { Badge } from '@/presentation/components/ui/badge';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';

interface FieldStat {
    name: string;
    types: Record<string, number>;
    count: number;
    probability: number;
    sampleValues: any[];
}

export const NoSqlSchemaAnalysisView: React.FC = () => {
    const { 
        nosqlActiveConnectionId, 
        nosqlActiveCollection, 
        activeDatabase,
        setNosqlSchemaStats 
    } = useAppStore();
    
    const [stats, setStats] = useState<FieldStat[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCached, setIsCached] = useState(false);

    const analyzeSchema = async (forceRefresh = false) => {
        if (!nosqlActiveConnectionId || !nosqlActiveCollection) return;
        
        setIsLoading(true);
        try {
            const result = await apiService.post<FieldStat[]>('/nosql/analyze-schema', {
                connectionId: nosqlActiveConnectionId,
                database: activeDatabase,
                collection: nosqlActiveCollection,
                sampleSize: 100,
                refresh: forceRefresh
            });
            
            setStats(result);
            setNosqlSchemaStats(result);
            setIsCached(!forceRefresh); // If we forced a refresh, it's "fresh", otherwise it was cached
        } catch (error) {
            console.error('Failed to analyze schema:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Initial load from backend (will be fast if cached in Redis)
        analyzeSchema();
    }, [nosqlActiveConnectionId, nosqlActiveCollection, activeDatabase]);

    if (isLoading && stats.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <div className="text-center">
                    <p className="text-lg font-bold tracking-tight">Analyzing Collection Schema...</p>
                    <p className="text-xs text-muted-foreground">Sampling documents and identifying types via Backend & Redis</p>
                </div>
            </div>
        );
    }

    if (stats.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40 gap-4">
                <Activity className="w-16 h-16" />
                <p className="text-lg font-medium tracking-tight whitespace-pre-wrap text-center">No schema data found for this collection.\nRun analysis to discover fields.</p>
                <Button variant="outline" size="sm" onClick={() => analyzeSchema(true)} className="mt-4 gap-2">
                    <RefreshCw className="w-4 h-4" /> Run Initial Analysis
                </Button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-700 p-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <SearchCode className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            Schema Inference
                            {isCached && <Badge className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border-none text-[10px] gap-1 px-1.5 h-4"><Zap className="w-2.5 h-2.5 fill-current" /> Redis Cached</Badge>}
                        </h3>
                        <p className="text-xs text-muted-foreground">Analyzing structure from server-side samples</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full border text-xs mr-2">
                        <Database className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-medium">{stats.length} Fields Found</span>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs gap-2" 
                        onClick={() => analyzeSchema(true)}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Refresh Analysis
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border bg-card/30">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
                        <tr className="border-b uppercase tracking-wider text-[10px] text-muted-foreground font-bold">
                            <th className="px-6 py-4">Field Name</th>
                            <th className="px-6 py-4">Type Distribution</th>
                            <th className="px-6 py-4">Appearance</th>
                            <th className="px-6 py-4">Sample Values</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                        {stats.map(field => (
                            <tr key={field.name} className="hover:bg-muted/30 transition-colors group">
                                <td className="px-6 py-4 align-top">
                                    <div className="flex items-center gap-2">
                                        <code className="text-indigo-500 font-bold bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                                            {field.name}
                                        </code>
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                                        {Object.entries(field.types).map(([type, count]) => (
                                            <Badge key={type} variant="secondary" className={cn(
                                                "text-[9px] h-4 font-bold uppercase",
                                                type === 'string' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                                                type === 'number' && "bg-green-500/10 text-green-500 border-green-500/20",
                                                type === 'object' && "bg-orange-500/10 text-orange-500 border-orange-500/20",
                                                type === 'array' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
                                                type === 'null' && "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                            )}>
                                                {type} ({Math.round((count / field.count) * 100)}%)
                                            </Badge>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                            <span className={field.probability === 100 ? "text-green-500" : "text-amber-500"}>
                                                {field.probability.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className={cn("h-full transition-all duration-1000", field.probability === 100 ? "bg-green-500" : "bg-amber-500")}
                                                style={{ width: `${field.probability}%` }}
                                            />
                                        </div>
                                        {field.probability === 100 ? (
                                            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                                <CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> Required
                                            </span>
                                        ) : (
                                            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                                <Info className="w-2.5 h-2.5 text-amber-500" /> Optional
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top max-w-sm overflow-hidden">
                                    <div className="flex flex-wrap gap-1">
                                        {field.sampleValues.map((val, i) => (
                                            <span key={i} className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded italic truncate max-w-[150px]">
                                                {typeof val === 'object' ? JSON.stringify(val).slice(0, 30) : String(val)}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
