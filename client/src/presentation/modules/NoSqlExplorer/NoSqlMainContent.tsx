import React from 'react';
import {
  AlignLeft,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Leaf,
  Loader2,
  Play,
  SearchCode,
  Sparkles,
  TreeDeciduous,
  X,
} from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { openAiQueryFixDraft } from '@/core/services/aiQueryFix';
import { Button } from '@/presentation/components/ui/button';
import { useVerticalResizablePanel } from '@/presentation/hooks/useVerticalResizablePanel';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import { useNoSqlQuery } from '@/presentation/hooks/useNoSqlQuery';
import { JsonTreeView } from './JsonTreeView';
import { MqlEditor } from './MqlEditor';
import { NoSqlGridView } from './NoSqlGridView';
import { NoSqlDashboard } from './NoSqlDashboard';
import { NoSqlSchemaAnalysisView } from './NoSqlSchemaAnalysisView';
import { NoSqlAggregationBuilderView } from './NoSqlAggregationBuilderView';
import { NoSqlAiQueryBox } from './components/NoSqlAiQueryBox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/presentation/components/ui/dialog';

export const NoSqlMainContent: React.FC = () => {
  const {
    nosqlActiveCollection,
    nosqlActiveDatabase,
    setNosqlCollection,
    nosqlMqlQuery,
    setNosqlMqlQuery,
    nosqlResult,
    nosqlViewMode,
    setNosqlViewMode,
    nosqlPageIndex,
    nosqlPageSize,
    nosqlActiveConnectionId,
    connections,
    lang,
    isResultPanelOpen,
    toggleResultPanel,
    defaultResultHeight,
    setDefaultResultHeight,
  } = useAppStore();
  const text = getWorkspaceText(lang).noSqlMainContent;

  const activeConnection = connections.find((c) => c.id === nosqlActiveConnectionId);
  const nosqlEffectiveDatabase =
    activeConnection?.database || nosqlActiveDatabase || undefined;
  const isNoSql =
    activeConnection?.type === 'mongodb' ||
    activeConnection?.type === 'mongodb+srv';
  const hasPersistentGuardrail = Boolean(
    activeConnection?.readOnly || activeConnection?.allowQueryExecution === false,
  );
  const guardrailMessage =
    activeConnection?.allowQueryExecution === false
      ? text.executionDisabledGuardrail
      : activeConnection?.readOnly
        ? text.readOnlyGuardrail
        : text.performanceGuardrail;

  const { isCompactMobileLayout } = useResponsiveLayoutMode();
  const resizer = useVerticalResizablePanel({
    initialHeight: defaultResultHeight || 300,
    minHeight: 150,
    maxHeight: 0.8,
    onHeightChange: setDefaultResultHeight,
  });

  const { isLoading, error, executeMql, result } = useNoSqlQuery();
  const [pageJumpValue, setPageJumpValue] = React.useState(String(nosqlPageIndex + 1));
  const isAggregationView = nosqlViewMode === 'aggregation';
  const isSchemaDialogOpen = nosqlViewMode === 'schema';
  const [resultViewMode, setResultViewMode] = React.useState<'tree' | 'grid'>(
    nosqlViewMode === 'grid' ? 'grid' : 'tree',
  );
  const canRunQuery =
    !isLoading && activeConnection?.allowQueryExecution !== false;

  React.useEffect(() => {
    if (nosqlViewMode === 'tree' || nosqlViewMode === 'grid') {
      setResultViewMode(nosqlViewMode);
    }
  }, [nosqlViewMode]);

  React.useEffect(() => {
    setPageJumpValue(String(nosqlPageIndex + 1));
  }, [nosqlPageIndex]);
  const resultPanelCopy =
    resultViewMode === 'grid'
      ? {
          title: text.gridTitle,
          description: text.gridDescription,
        }
      : {
          title:
            isAggregationView && result
              ? text.pipelineOutputTitle
              : text.treeTitle,
          description: text.treeDescription,
        };
  const resultPillLabel =
    result?.summaryLabel || text.docsLabel;
  const resultPillValue = result?.summaryValue ?? result?.rowCount ?? result?.rows.length;
  const resultOffset = result?.appliedOffset ?? nosqlPageIndex * nosqlPageSize;
  const resultRangeStart = result?.rows.length ? resultOffset + 1 : resultOffset;
  const resultRangeEnd = resultOffset + (result?.rows.length || 0);

  const handleResultViewModeChange = (mode: 'tree' | 'grid') => {
    setResultViewMode(mode);
    if (!isAggregationView && !isSchemaDialogOpen) {
      setNosqlViewMode(mode);
    }
  };

  const returnToQueryWorkspace = () => {
    setNosqlViewMode(resultViewMode);
  };

  const handleSchemaDialogChange = (open: boolean) => {
    if (!open) {
      setNosqlViewMode(resultViewMode);
    }
  };

  const handleRunPreparedQuery = async (query?: string) => {
    if (query) {
      setNosqlMqlQuery(query);
    }

    if (!isResultPanelOpen) {
      toggleResultPanel();
    }

    await executeMql({ pageIndex: 0 });
  };

  const loadPage = async (pageIndex: number, pageSize = nosqlPageSize) => {
    await executeMql({ pageIndex, pageSize });
  };

  const commitPageJump = () => {
    const parsed = Number(pageJumpValue);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageJumpValue(String(nosqlPageIndex + 1));
      return;
    }
    void loadPage(Math.floor(parsed) - 1);
  };

  if (!isNoSql) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
        <Leaf className="w-16 h-16 mb-6 opacity-20" />
        <h2 className="text-2xl font-semibold mb-2 text-foreground/80">
          {text.waitingTitle}
        </h2>
        <p className="max-w-md opacity-70">
          {text.waitingDescription}
        </p>
      </div>
    );
  }

  if (!nosqlActiveCollection) {
    return <NoSqlDashboard />;
  }

  return (
    <div className="h-full w-full bg-background flex flex-col">
      {hasPersistentGuardrail && (
        <div
          className={cn(
            'mx-4 mt-4 rounded-lg border px-3 py-2 text-xs',
            activeConnection?.allowQueryExecution === false
              ? 'border-red-500/20 bg-red-500/10 text-red-400'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-400',
          )}
        >
          <div className="font-semibold uppercase tracking-wide text-[10px]">
            {text.guardrailsTitle}
          </div>
          <div className="mt-1 text-muted-foreground">{guardrailMessage}</div>
        </div>
      )}

      <div
        className={cn(
          `border-b bg-card px-3 py-1.5 shrink-0 flex items-center gap-2 overflow-hidden ${
            hasPersistentGuardrail ? 'mt-4' : ''
          }`,
        )}
      >
        <div
          className="flex items-center gap-1.5 min-w-0 shrink-0"
          title={`db.${nosqlActiveCollection}`}
        >
          <Database className="w-4 h-4 text-green-500 shrink-0" />
          <span
            className={cn(
              'max-w-[160px] truncate text-sm font-semibold',
              isCompactMobileLayout && 'sr-only',
            )}
          >
            db.{nosqlActiveCollection}
          </span>
        </div>

        <div className="w-px h-5 bg-border/40 shrink-0" />

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
          <Button
            variant={!isAggregationView ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-3 text-xs"
            onClick={returnToQueryWorkspace}
          >
            <Database className="h-3.5 w-3.5 text-green-500" />
            <span className="whitespace-nowrap">
              {isCompactMobileLayout ? 'Query' : lang === 'vi' ? 'Truy vấn' : 'Query'}
            </span>
          </Button>
          <Button
            variant={isAggregationView ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-3 text-xs"
            onClick={() => setNosqlViewMode('aggregation')}
          >
            <Layers className="h-3.5 w-3.5 text-emerald-500" />
            <span className="whitespace-nowrap">
              {isCompactMobileLayout ? 'Pipeline' : 'Aggregation Pipeline'}
            </span>
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2 text-xs text-green-500/80 hover:bg-green-500/10 hover:text-green-400"
              title={text.askAiMql}
            >
              <Sparkles className="h-3.5 w-3.5 fill-green-500/10" />
              <span className={cn('whitespace-nowrap', isCompactMobileLayout && 'sr-only')}>
                AI NoSQL
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(450px,calc(100vw-1rem))] overflow-hidden rounded-2xl border-white/10 bg-background/95 p-0 shadow-2xl backdrop-blur-xl"
            align="end"
            sideOffset={10}
          >
            <NoSqlAiQueryBox
              currentConnectionId={nosqlActiveConnectionId || ''}
              currentDatabase={nosqlEffectiveDatabase}
              collectionName={nosqlActiveCollection}
              onGenerate={(generatedMql) => setNosqlMqlQuery(generatedMql)}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={toggleResultPanel}
          title={isResultPanelOpen ? text.hideResultsPanelTitle : text.showResultsPanelTitle}
        >
          {isResultPanelOpen ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">
            {isResultPanelOpen ? text.hideResults : text.showResults}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400"
          onClick={() => setNosqlViewMode('schema')}
        >
          <SearchCode className="h-3.5 w-3.5" />
          <span className={cn('whitespace-nowrap', isCompactMobileLayout && 'sr-only')}>
            {lang === 'vi' ? 'Phân tích schema' : 'Schema Analysis'}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          onClick={() => setNosqlCollection(null)}
          title={text.closeCollection}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 min-h-0 relative bg-muted/10 flex flex-col">
          {!isAggregationView && (
          <div className="px-3 py-1.5 border-b text-xs font-semibold text-muted-foreground bg-muted/30 uppercase tracking-widest flex items-center justify-between gap-2 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0 shrink truncate">
              <span className="truncate whitespace-nowrap">
                {isAggregationView
                  ? text.aggregationBuilder
                  : text.visualBuilder}
              </span>
              {!isAggregationView && (
                <span className="text-[9px] font-normal lowercase bg-background border border-border/50 px-1.5 py-0.5 rounded text-muted-foreground tracking-normal whitespace-nowrap hidden md:inline">
                  {text.formatHint}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {result && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full shrink-0">
                  <span className="text-[10px] font-bold text-green-500/80">
                    {resultPillValue}
                  </span>
                  <span className="text-[9px] text-green-500/50 uppercase tracking-tighter">
                    {resultPillLabel}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-green-500/20 mx-0.5" />
                  <span className="text-[10px] font-medium text-green-500/70">
                    {result.durationMs}ms
                  </span>
                </div>
              )}

              {result?.truncated && result.limitSource !== 'requested' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full shrink-0">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-500/80">
                    {text.capped}
                  </span>
                  {result.appliedLimit && (
                    <span className="text-[10px] font-medium text-amber-500/70">
                      {result.appliedLimit.toLocaleString(
                        lang === 'vi' ? 'vi-VN' : 'en-US',
                      )}
                    </span>
                  )}
                </div>
              )}

              {!isAggregationView && (
                <>
                  <div className="w-px h-4 bg-border/40" />

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 gap-1.5 px-2"
                    onClick={() => {
                      try {
                        const formatted = JSON.stringify(
                          JSON.parse(nosqlMqlQuery),
                          null,
                          2,
                        );
                        setNosqlMqlQuery(formatted);
                      } catch (formatError) {
                        console.error('Failed to format MQL:', formatError);
                      }
                    }}
                    title="Alt+Shift+F"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>Format</span>
                  </Button>
                  <span
                    className={cn(
                      'text-[10px] font-normal lowercase bg-muted border px-1.5 py-0.5 rounded text-muted-foreground tracking-normal',
                      isCompactMobileLayout && 'hidden',
                    )}
                  >
                    Ctrl + Enter
                  </span>
                  <Button
                    size="sm"
                    className={cn(
                      'h-7 bg-green-600 hover:bg-green-700 text-white gap-1',
                      isCompactMobileLayout && 'ml-auto',
                    )}
                    onClick={() => handleRunPreparedQuery()}
                    disabled={!canRunQuery}
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    {text.run}
                  </Button>
                </>
              )}
            </div>
          </div>
          )}

          <div className="flex-1 min-h-0 w-full relative">
            {isAggregationView ? (
              <NoSqlAggregationBuilderView
                collectionName={nosqlActiveCollection}
                mqlQuery={nosqlMqlQuery}
                onApply={setNosqlMqlQuery}
                onRun={handleRunPreparedQuery}
                onBack={returnToQueryWorkspace}
                canRun={canRunQuery}
              />
            ) : (
              <MqlEditor
                value={nosqlMqlQuery}
                onChange={(value) => setNosqlMqlQuery(value || '')}
                onRun={() => handleRunPreparedQuery()}
              />
            )}
          </div>
        </div>

        <div
          onPointerDown={resizer.startResizing}
          className={cn(
            'h-1.5 bg-muted/20 border-y border-border/10 cursor-row-resize flex items-center justify-center group transition-colors select-none z-20 touch-none',
            resizer.isDragging ? 'bg-green-500/20' : 'hover:bg-green-500/10',
            !isResultPanelOpen && 'hidden',
          )}
        >
          <div
            className={cn(
              'w-12 h-0.5 rounded-full bg-muted-foreground/20 group-hover:bg-green-500/50 transition-colors',
              resizer.isDragging && 'bg-green-500',
            )}
          />
        </div>

        <div
          style={{ height: isResultPanelOpen ? `${resizer.height}px` : '0px' }}
          className={cn(
            'flex flex-col overflow-hidden bg-background shrink-0 relative z-10',
            resizer.isDragging ? '' : 'transition-[height] duration-300 ease-in-out',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {resultPanelCopy.title}
                </div>
                <div className="flex items-center rounded-md border border-border/60 bg-background/70 p-0.5">
                  <Button
                    variant={resultViewMode === 'tree' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 gap-1 px-2 text-[10px]"
                    onClick={() => handleResultViewModeChange('tree')}
                  >
                    <TreeDeciduous className="h-3 w-3" />
                    Tree
                  </Button>
                  <Button
                    variant={resultViewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 gap-1 px-2 text-[10px]"
                    onClick={() => handleResultViewModeChange('grid')}
                  >
                    <Filter className="h-3 w-3" />
                    Grid
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground/80">
                {result?.summaryHint || resultPanelCopy.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {result && (
                <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px]">
                  <span className="font-semibold text-foreground/85">
                    {resultPillValue}
                  </span>
                  <span className="uppercase tracking-[0.16em] text-muted-foreground">
                    {resultPillLabel}
                  </span>
                  <div className="mx-0.5 h-1 w-1 rounded-full bg-border" />
                  <span className="text-muted-foreground">{result.durationMs}ms</span>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                onClick={toggleResultPanel}
                title={text.closeResultsPanel}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-4 custom-scrollbar">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-green-500/20 border-t-green-500 animate-spin" />
                <span className="text-sm font-medium text-green-600 animate-pulse">
                  {text.queryingBson}
                </span>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-destructive">
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm font-medium">{error.message}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                  onClick={() => void openAiQueryFixDraft(
                    nosqlMqlQuery,
                    error.message,
                    'MQL',
                    lang,
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {lang === 'vi' ? 'Sửa bằng AI' : 'Fix with AI'}
                </Button>
              </div>
            ) : !nosqlResult ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                <Leaf className="w-8 h-8 text-green-500 animate-pulse" />
                <span className="text-sm font-medium tracking-wide">
                  {isAggregationView ? text.buildPipelineHint : text.clickRunHint}
                </span>
              </div>
            ) : (
              <>
                {resultViewMode === 'tree' && (
                  <div className="bg-muted/20 p-6 rounded-xl border border-border/50 shadow-inner">
                    <JsonTreeView data={nosqlResult} initialExpanded={true} />
                  </div>
                )}
                {resultViewMode === 'grid' && <NoSqlGridView data={nosqlResult} />}
              </>
            )}
          </div>

          {result?.appliedLimit && (
            <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/15 px-3 py-2 text-xs">
              <div className="text-muted-foreground max-sm:hidden">
                {lang === 'vi'
                  ? `${resultRangeStart}–${resultRangeEnd} trên trang này`
                  : `${resultRangeStart}–${resultRangeEnd} on this page`}
              </div>

              <div className="ml-auto flex max-w-full items-center gap-2 overflow-x-auto">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={nosqlPageIndex === 0 || isLoading}
                  onClick={() => void loadPage(nosqlPageIndex - 1)}
                  title={lang === 'vi' ? 'Trang trước' : 'Previous page'}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                <label className="flex items-center gap-1 text-muted-foreground">
                  <span>{lang === 'vi' ? 'Trang' : 'Page'}</span>
                  <input
                    aria-label={lang === 'vi' ? 'Đi đến trang' : 'Go to page'}
                    className="h-7 w-14 rounded-md border border-border bg-background px-2 text-center text-foreground outline-none focus:border-green-500"
                    inputMode="numeric"
                    value={pageJumpValue}
                    onChange={(event) => setPageJumpValue(event.target.value.replace(/\D/g, ''))}
                    onBlur={commitPageJump}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitPageJump();
                    }}
                  />
                </label>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!(result.hasNextPage ?? result.truncated) || isLoading}
                  onClick={() => void loadPage(nosqlPageIndex + 1)}
                  title={lang === 'vi' ? 'Trang sau' : 'Next page'}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>

                <select
                  aria-label={lang === 'vi' ? 'Số tài liệu mỗi trang' : 'Documents per page'}
                  className="h-7 rounded-md border border-border bg-background px-2 text-foreground outline-none focus:border-green-500"
                  value={nosqlPageSize}
                  onChange={(event) => void loadPage(0, Number(event.target.value))}
                  disabled={isLoading}
                >
                  {[50, 100, 500, 1000].map((size) => (
                    <option key={size} value={size}>{size} / {lang === 'vi' ? 'trang' : 'page'}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isSchemaDialogOpen} onOpenChange={handleSchemaDialogChange}>
        <DialogContent className="z-[80] block h-[calc(100dvh-1rem)] max-h-[860px] max-w-[calc(100vw-1rem)] overflow-hidden border-border/70 bg-background p-0 shadow-2xl sm:h-[82dvh] sm:max-w-[min(1200px,calc(100vw-2rem))]">
          <DialogTitle className="sr-only">Phân tích schema</DialogTitle>
          <DialogDescription className="sr-only">
            Kiểm tra field, kiểu dữ liệu và giá trị mẫu của collection đang chọn.
          </DialogDescription>
          <div className="h-full overflow-hidden px-4 pb-4 pt-12 sm:px-6 sm:pb-6 sm:pt-6">
            <NoSqlSchemaAnalysisView />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
