import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { MqlEditor } from './MqlEditor';
import { cn } from '@/lib/utils';
import type { NoSqlPipelineStage } from '@/core/services/store/slices/nosqlSlice';
import {
  buildAggregationQuery,
  createPipelineStage,
  getPipelineStageSignature,
  NOSQL_STAGE_TYPES,
  parseAggregationQuery,
} from './aggregationBuilderUtils';

interface NoSqlAggregationBuilderViewProps {
  collectionName: string;
  mqlQuery: string;
  onApply: (query: string) => void;
  onRun: (query: string) => void | Promise<void>;
  canRun?: boolean;
}

function summarizeStage(stage: NoSqlPipelineStage) {
  const compact = (stage.value || '')
    .replace(/\s+/g, ' ')
    .replace(/\{\s+\}/g, '{}')
    .trim();

  if (!compact || compact === '{}') {
    return 'Stage body is empty. Add fields to shape this step.';
  }

  return compact.length > 110 ? `${compact.slice(0, 107)}...` : compact;
}

export const NoSqlAggregationBuilderView: React.FC<
  NoSqlAggregationBuilderViewProps
> = ({
  collectionName,
  mqlQuery,
  onApply,
  onRun,
  canRun = true,
}) => {
  const { nosqlPipelineStages, setNosqlPipelineStages } = useAppStore();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const stageItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const parsed = parseAggregationQuery(mqlQuery);
    const nextStages =
      parsed?.collection === collectionName
        ? parsed.stages
        : [createPipelineStage()];

    const currentStages = useAppStore.getState().nosqlPipelineStages;
    if (
      getPipelineStageSignature(nextStages) !==
      getPipelineStageSignature(currentStages)
    ) {
      setNosqlPipelineStages(nextStages);
    }
  }, [collectionName, mqlQuery, setNosqlPipelineStages]);

  const effectiveSelectedStageId = useMemo(() => {
    if (!nosqlPipelineStages.length) {
      return null;
    }

    if (
      selectedStageId &&
      nosqlPipelineStages.some((stage) => stage.id === selectedStageId)
    ) {
      return selectedStageId;
    }

    return nosqlPipelineStages[0]?.id ?? null;
  }, [nosqlPipelineStages, selectedStageId]);

  useEffect(() => {
    if (!effectiveSelectedStageId) return;
    stageItemRefs.current[effectiveSelectedStageId]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [effectiveSelectedStageId]);

  const addStage = () => {
    const nextStage = createPipelineStage();
    setNosqlPipelineStages([...nosqlPipelineStages, nextStage]);
    setSelectedStageId(nextStage.id);
  };

  const removeStage = (id: string) => {
    const removedIndex = nosqlPipelineStages.findIndex((stage) => stage.id === id);
    const nextStages = nosqlPipelineStages.filter((stage) => stage.id !== id);
    setNosqlPipelineStages(nextStages);

    if (effectiveSelectedStageId === id) {
      const fallbackStage =
        nextStages[Math.min(removedIndex, nextStages.length - 1)] ?? null;
      setSelectedStageId(fallbackStage?.id ?? null);
    }
  };

  const updateStage = (id: string, updates: Partial<NoSqlPipelineStage>) => {
    setNosqlPipelineStages(
      nosqlPipelineStages.map((stage) =>
        stage.id === id ? { ...stage, ...updates } : stage,
      ),
    );
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const nextStages = [...nosqlPipelineStages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nextStages.length) return;

    [nextStages[index], nextStages[targetIndex]] = [
      nextStages[targetIndex],
      nextStages[index],
    ];
    setNosqlPipelineStages(nextStages);
    setSelectedStageId(nextStages[targetIndex]?.id ?? null);
  };

  const assembled = buildAggregationQuery(collectionName, nosqlPipelineStages);
  const issuesByStage = new Map(
    assembled.issues.map((issue) => [issue.stageId, issue]),
  );
  const hasIssues = assembled.issues.length > 0;

  const selectedStageIndex = nosqlPipelineStages.findIndex(
    (stage) => stage.id === effectiveSelectedStageId,
  );
  const selectedStage =
    selectedStageIndex >= 0 ? nosqlPipelineStages[selectedStageIndex] : null;

  const assemblePipeline = () => {
    if (hasIssues) return;
    onApply(assembled.serialized);
  };

  const runPipeline = async () => {
    if (hasIssues) return;
    await onRun(assembled.serialized);
  };

  return (
    <div className="h-full min-h-0 animate-in slide-in-from-right duration-500 p-2">
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/60 bg-card/20">
        <div className="flex flex-col gap-4 border-b border-border/60 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-pink-500/10 p-2.5">
              <Layers className="h-5 w-5 text-pink-500" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold">
                Visual Aggregation Builder
              </h3>
              <p className="text-xs text-muted-foreground">
                Keep the stage list compact, then edit one step at a time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 lg:max-w-[60%] lg:justify-end">
            <div className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {assembled.payload.pipeline.length} active stage
              {assembled.payload.pipeline.length === 1 ? '' : 's'}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-2 text-xs border-dashed whitespace-nowrap"
              onClick={addStage}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Stage
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-2 text-xs whitespace-nowrap"
              onClick={assemblePipeline}
              disabled={hasIssues}
            >
              <Save className="h-3.5 w-3.5" />
              Apply to Editor
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 shrink-0 gap-2 text-xs whitespace-nowrap bg-pink-600 text-white shadow-lg shadow-pink-500/20 hover:bg-pink-700"
              onClick={runPipeline}
              disabled={hasIssues || !canRun}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Run Pipeline
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 custom-scrollbar lg:overflow-hidden">
          <div className="grid gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
            <section className="rounded-2xl border border-border/60 bg-background/40 lg:flex lg:min-h-0 lg:flex-col">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 shrink-0">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Pipeline Stages
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    Add, reorder, or disable steps without losing context.
                  </p>
                </div>
                <div className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {nosqlPipelineStages.length} total
                </div>
              </div>

              <div className="space-y-2 p-3 custom-scrollbar lg:flex-1 lg:min-h-0 lg:overflow-auto">
                {nosqlPipelineStages.map((stage, index) => {
                  const isSelected = stage.id === effectiveSelectedStageId;
                  const issue = issuesByStage.get(stage.id);

                  return (
                    <button
                      key={stage.id}
                      ref={(node) => {
                        stageItemRefs.current[stage.id] = node;
                      }}
                      type="button"
                      onClick={() => setSelectedStageId(stage.id)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-all',
                        isSelected
                          ? 'border-pink-500/40 bg-pink-500/10 shadow-lg shadow-pink-500/10'
                          : 'border-border/60 bg-card/40 hover:border-pink-500/20 hover:bg-card',
                        !stage.enabled && 'opacity-70',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground/60">
                              #{index + 1}
                            </span>
                            <span className="text-sm font-semibold uppercase tracking-tight">
                              {stage.type}
                            </span>
                            {!stage.enabled && (
                              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Hidden
                              </span>
                            )}
                            {issue && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                                <AlertTriangle className="h-3 w-3" />
                                Invalid JSON
                              </span>
                            )}
                          </div>
                          <p className="mt-2 truncate text-xs text-muted-foreground/80">
                            {summarizeStage(stage)}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="rounded-full bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-pink-500">
                            Editing
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {nosqlPipelineStages.length === 0 && (
                  <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-muted-foreground">
                    <Layers className="h-8 w-8 opacity-20" />
                    <p className="text-xs">
                      No stages added. Start by adding your first aggregation
                      stage.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={addStage}
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Add Match Stage
                    </Button>
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-4 lg:min-h-0">
              {selectedStage ? (
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/40 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                  <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 shrink-0 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-1 -mb-1">
                      <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        Stage #{selectedStageIndex + 1}
                      </span>
                      <Select
                        value={selectedStage.type}
                        onValueChange={(value) =>
                          updateStage(selectedStage.id, { type: value })
                        }
                      >
                        <SelectTrigger className="h-9 w-36 shrink-0 border-border/60 bg-background text-[11px] font-bold uppercase tracking-tight">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NOSQL_STAGE_TYPES.map((type) => (
                            <SelectItem
                              key={type}
                              value={type}
                              className="text-[11px] uppercase"
                            >
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {issuesByStage.has(selectedStage.id) && (
                        <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500 whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3" />
                          Stage body must be valid JSON
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateStage(selectedStage.id, {
                            enabled: !selectedStage.enabled,
                          })
                        }
                        title={
                          selectedStage.enabled
                            ? 'Hide stage from the pipeline'
                            : 'Enable stage in the pipeline'
                        }
                      >
                        {selectedStage.enabled ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => moveStage(selectedStageIndex, 'up')}
                        disabled={selectedStageIndex === 0}
                        title="Move stage up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => moveStage(selectedStageIndex, 'down')}
                        disabled={
                          selectedStageIndex === nosqlPipelineStages.length - 1
                        }
                        title="Move stage down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => removeStage(selectedStage.id)}
                        title="Remove stage"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="border-b border-border/60 px-4 py-3 text-xs text-muted-foreground shrink-0">
                    Edit the selected stage here. The full pipeline preview stays
                    below so the result panel does not crowd the editor anymore.
                  </div>

                  <div className="relative h-[240px] bg-background lg:flex-1 lg:min-h-[240px]">
                    <MqlEditor
                      value={selectedStage.value}
                      onChange={(value) =>
                        updateStage(selectedStage.id, { value: value || '' })
                      }
                      height="100%"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                  Select or add a stage to start editing the pipeline.
                </div>
              )}

              <div
                className={cn(
                  'rounded-2xl border shrink-0',
                  hasIssues
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-indigo-500/10 bg-indigo-500/5',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'rounded-full p-2',
                        hasIssues ? 'bg-amber-500/20' : 'bg-indigo-500/20',
                      )}
                    >
                      <Layers
                        className={cn(
                          'h-4 w-4',
                          hasIssues ? 'text-amber-500' : 'text-indigo-500',
                        )}
                      />
                    </div>
                    <div className="text-xs">
                      <p
                        className={cn(
                          'font-bold',
                          hasIssues
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-indigo-600 dark:text-indigo-400',
                        )}
                      >
                        {hasIssues
                          ? 'Pipeline needs attention'
                          : 'Generated MQL preview'}
                      </p>
                      <p className="text-muted-foreground/70">
                        {hasIssues
                          ? `${assembled.issues.length} stage(s) need valid JSON before apply or run.`
                          : 'Preview the final aggregate payload only when you need it.'}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 px-3 text-xs"
                    onClick={() => setIsPreviewExpanded((current) => !current)}
                  >
                    {isPreviewExpanded ? 'Hide JSON' : 'Show JSON'}
                    {isPreviewExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {hasIssues && (
                  <div className="mx-4 mb-4 space-y-1 rounded-xl border border-amber-500/10 bg-background/60 p-3 text-xs text-muted-foreground">
                    {assembled.issues.map((issue) => (
                      <div key={issue.stageId}>
                        Stage #{issue.stageIndex + 1}{' '}
                        <span className="font-mono">{issue.stageType}</span>:{' '}
                        {issue.message}
                      </div>
                    ))}
                  </div>
                )}

                {isPreviewExpanded && (
                  <pre className="mx-4 mb-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-background/70 p-3 text-[11px] text-foreground/80">
                    {assembled.serialized}
                  </pre>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
