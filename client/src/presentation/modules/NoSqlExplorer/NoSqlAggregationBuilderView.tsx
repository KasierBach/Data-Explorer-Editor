import { Layers, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Save, Sparkles } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/presentation/components/ui/select";
import { MqlEditor } from './MqlEditor';
import { cn } from '@/lib/utils';

export const NoSqlAggregationBuilderView: React.FC = () => {
    const { 
        nosqlPipelineStages, 
        setNosqlPipelineStages, 
        setNosqlMqlQuery, 
        nosqlActiveCollection
    } = useAppStore();

    const addStage = () => {
        const newStage = {
            id: Math.random().toString(36).substr(2, 9),
            type: '$match',
            value: '{\n  \n}',
            enabled: true
        };
        setNosqlPipelineStages([...nosqlPipelineStages, newStage]);
    };

    const removeStage = (id: string) => {
        setNosqlPipelineStages(nosqlPipelineStages.filter(s => s.id !== id));
    };

    const updateStage = (id: string, updates: any) => {
        setNosqlPipelineStages(nosqlPipelineStages.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const moveStage = (index: number, direction: 'up' | 'down') => {
        const newStages = [...nosqlPipelineStages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newStages.length) return;
        
        [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
        setNosqlPipelineStages(newStages);
    };

    const assemblePipeline = () => {
        const activeStages = nosqlPipelineStages
            .filter(s => s.enabled)
            .map(s => {
                try {
                    return { [s.type]: JSON.parse(s.value) };
                } catch {
                    return null;
                }
            })
            .filter(Boolean);

        const mql = JSON.stringify({
            action: 'aggregate',
            collection: nosqlActiveCollection,
            pipeline: activeStages
        }, null, 2);

        setNosqlMqlQuery(mql);
    };

    const STAGE_TYPES = [
        '$match', '$group', '$project', '$sort', '$limit', '$skip', '$lookup', '$unwind', '$facet', '$addFields'
    ];

    return (
        <div className="h-full flex flex-col gap-4 animate-in slide-in-from-right duration-500 p-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-500/10 rounded-lg">
                        <Layers className="w-5 h-5 text-pink-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Visual Aggregation Builder</h3>
                        <p className="text-xs text-muted-foreground">Build complex data pipelines stage by stage</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-2 text-xs border-dashed" onClick={addStage}>
                        <Plus className="w-3.5 h-3.5" />
                        Add Stage
                    </Button>
                    <Button variant="secondary" size="sm" className="h-8 gap-2 text-xs bg-pink-600 hover:bg-pink-700 text-white border-none shadow-lg shadow-pink-500/20" onClick={assemblePipeline}>
                        <Save className="w-3.5 h-3.5" />
                        Apply to Editor
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto space-y-4 pr-2 custom-scrollbar">
                {nosqlPipelineStages.map((stage, index) => (
                    <div key={stage.id} className={cn(
                        "group border rounded-xl overflow-hidden bg-card/40 transition-all",
                        !stage.enabled && "opacity-50 grayscale bg-muted/20"
                    )}>
                        {/* Stage Header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-muted-foreground/50 w-4">#{index + 1}</span>
                                <Select value={stage.type} onValueChange={(val) => updateStage(stage.id, { type: val })}>
                                    <SelectTrigger className="h-7 w-32 text-[11px] font-bold uppercase tracking-tight bg-background border-none shadow-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STAGE_TYPES.map(t => <SelectItem key={t} value={t} className="text-[11px] uppercase">{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateStage(stage.id, { enabled: !stage.enabled })}>
                                    {stage.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStage(index, 'up')} disabled={index === 0}>
                                    <ChevronUp className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStage(index, 'down')} disabled={index === nosqlPipelineStages.length - 1}>
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => removeStage(stage.id)}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>

                        {/* Stage Editor */}
                        <div className="h-32 relative">
                            <MqlEditor 
                                value={stage.value} 
                                onChange={(val) => updateStage(stage.id, { value: val || '' })}
                                height="100%"
                            />
                        </div>
                    </div>
                ))}

                {nosqlPipelineStages.length === 0 && (
                    <div className="h-40 border border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-3">
                        <Layers className="w-8 h-8 opacity-20" />
                        <p className="text-xs">No stages added. Start by adding your first aggregation stage.</p>
                        <Button variant="outline" size="sm" className="h-8" onClick={addStage}>
                            <Plus className="w-3.5 h-3.5 mr-2" /> Add Match Stage
                        </Button>
                    </div>
                )}
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 flex items-center justify-between gap-4">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-full">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-xs">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">AI Pipeline Optimization</p>
                        <p className="text-muted-foreground/70">Ask AI to optimize these stages or explain the logic for you.</p>
                    </div>
                 </div>
                 <Button variant="outline" size="sm" className="h-8 border-indigo-500/20 text-indigo-500">
                    Auto-Optimize
                 </Button>
            </div>
        </div>
    );
};
