import React from 'react';
import {
  AlignLeft,
  AlertCircle,
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
    nosqlActiveConnectionId,
    connections,
    lang,
    isResultPanelOpen,
    toggleResultPanel,
    defaultResultHeight,
    setDefaultResultHeight,
  } = useAppStore();

  const activeConnection = connections.find((c) => c.id === nosqlActiveConnectionId);
  const nosqlEffectiveDatabase =
    activeConnection?.database || nosqlActiveDatabase || undefined;
  const isNoSql =
    activeConnection?.type === 'mongodb' ||
    activeConnection?.type === 'mongodb+srv' ||
    activeConnection?.type === 'redis';
  const hasPersistentGuardrail = Boolean(
    activeConnection?.readOnly || activeConnection?.allowQueryExecution === false,
  );
  const guardrailMessage =
    activeConnection?.allowQueryExecution === false
      ? lang === 'vi'
        ? 'Kết nối này đang tắt quyền chạy truy vấn.'
        : 'Query execution is disabled for this connection.'
      : activeConnection?.readOnly
        ? lang === 'vi'
          ? 'Chế độ chỉ đọc đang bật. Chỉ cho phép find/aggregate.'
          : 'Read-only mode is enabled. Only find/aggregate are allowed.'
        : lang === 'vi'
          ? 'Kết quả được giới hạn để bảo vệ hiệu năng và tránh quá tải.'
          : 'Results are guarded with execution limits to protect performance.';

  const { isCompactMobileLayout } = useResponsiveLayoutMode();
  const resizer = useVerticalResizablePanel({
    initialHeight: defaultResultHeight || 300,
    minHeight: 150,
    maxHeight: 0.8,
    onHeightChange: setDefaultResultHeight,
  });

  const { isLoading, error, executeMql, result } = useNoSqlQuery();
  const isAggregationView = nosqlViewMode === 'aggregation';
  const resultViewMode = React.useMemo<'tree' | 'grid' | 'charts' | 'schema'>(() => {
    if (isAggregationView) {
      return 'tree';
    }

    if (nosqlViewMode === 'charts') {
      return 'grid';
    }

    return nosqlViewMode;
  }, [isAggregationView, nosqlViewMode]);
  const canRunQuery =
    !isLoading && activeConnection?.allowQueryExecution !== false;

  React.useEffect(() => {
    if (nosqlViewMode === 'charts') {
      setNosqlViewMode('grid');
    }
  }, [nosqlViewMode, setNosqlViewMode]);
  const resultPanelCopy =
    resultViewMode === 'grid'
      ? {
          title: lang === 'vi' ? 'Kết quả dạng bảng' : 'Flattened Result Grid',
          description:
            lang === 'vi'
              ? 'Xem tài liệu dưới dạng cột để lọc, so sánh và scan nhanh.'
              : 'Scan documents as columns to compare fields and inspect rows faster.',
        }
      : resultViewMode === 'charts'
        ? {
            title: lang === 'vi' ? 'Insight từ tập kết quả' : 'Result Set Insights',
            description:
              lang === 'vi'
                ? 'Nhóm dữ liệu hiện tại thành metric có ý nghĩa thay vì vẽ từng document rời rạc.'
                : 'Turn the current result sample into grouped metrics instead of charting raw documents.',
          }
        : resultViewMode === 'schema'
          ? {
              title: lang === 'vi' ? 'Phân tích schema' : 'Schema Analysis',
              description:
                lang === 'vi'
                  ? 'Kiểm tra độ phủ field, kiểu dữ liệu và ví dụ giá trị trong collection.'
                  : 'Inspect field coverage, type distribution, and sample values for the collection.',
            }
          : {
              title:
                isAggregationView && result
                  ? lang === 'vi'
                    ? 'Kết quả pipeline'
                    : 'Pipeline Output'
                  : lang === 'vi'
                    ? 'Kết quả dạng cây'
                    : 'Tree Result View',
              description:
                lang === 'vi'
                  ? 'Giữ nguyên cấu trúc BSON/JSON để kiểm tra document thật.'
                  : 'Preserve BSON/JSON structure so you can inspect the real document shape.',
            };
  const resultPillLabel =
    result?.summaryLabel || (lang === 'vi' ? 'tài liệu' : 'docs');
  const resultPillValue = result?.summaryValue ?? result?.rowCount ?? result?.rows.length;

  const handleViewModeChange = (
    mode: 'tree' | 'grid' | 'schema' | 'aggregation',
  ) => {
    setNosqlViewMode(mode);
  };

  const handleRunPreparedQuery = async (query?: string) => {
    if (query) {
      setNosqlMqlQuery(query);
    }

    if (!isResultPanelOpen) {
      toggleResultPanel();
    }

    await executeMql();
  };

  if (!isNoSql) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
        <Leaf className="w-16 h-16 mb-6 opacity-20" />
        <h2 className="text-2xl font-semibold mb-2 text-foreground/80">
          {lang === 'vi'
            ? 'NoSQL workspace đang chờ kết nối phù hợp...'
            : 'Waiting for a NoSQL connection...'}
        </h2>
        <p className="max-w-md opacity-70">
          {lang === 'vi'
            ? 'Bạn đang chọn một kết nối SQL. Hãy chọn MongoDB hoặc Redis ở sidebar để mở NoSQL Studio.'
            : 'You are currently selecting a relational connection. Choose MongoDB or Redis from the sidebar to open the NoSQL Studio.'}
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
            {lang === 'vi' ? 'Guardrails NoSQL' : 'NoSQL guardrails'}
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
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <Database className="w-4 h-4 text-green-500 shrink-0" />
          <span className="font-semibold text-sm truncate max-w-[160px]">
            db.{nosqlActiveCollection}
          </span>
        </div>

        <div className="w-px h-5 bg-border/40 shrink-0" />

        <div className="flex items-center bg-muted/50 rounded-md p-1 border flex-1 min-w-0 overflow-x-auto scrollbar-none">
          <Button
            variant={nosqlViewMode === 'tree' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 shrink-0"
            onClick={() => handleViewModeChange('tree')}
          >
            <TreeDeciduous className="w-3.5 h-3.5 text-green-600" />
            <span className="whitespace-nowrap">
              {isCompactMobileLayout ? 'Tree' : 'Tree (JSON)'}
            </span>
          </Button>
          <Button
            variant={nosqlViewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 shrink-0"
            onClick={() => handleViewModeChange('grid')}
          >
            <Filter className="w-3.5 h-3.5 text-blue-500" />
            <span className="whitespace-nowrap">
              {isCompactMobileLayout ? 'Grid' : 'Auto-Flatten Grid'}
            </span>
          </Button>
          <Button
            variant={nosqlViewMode === 'schema' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 shrink-0"
            onClick={() => handleViewModeChange('schema')}
          >
            <SearchCode className="w-3.5 h-3.5 text-indigo-500" />
            <span className="whitespace-nowrap">
              {isCompactMobileLayout ? 'Schema' : 'Schema Analysis'}
            </span>
          </Button>
          <Button
            variant={nosqlViewMode === 'aggregation' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 shrink-0"
            onClick={() => handleViewModeChange('aggregation')}
          >
            <Layers className="w-3.5 h-3.5 text-pink-500" />
            <span className="whitespace-nowrap">
              {isCompactMobileLayout ? 'Steps' : 'Aggregation Builder'}
            </span>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          onClick={() => setNosqlCollection(null)}
          title={lang === 'vi' ? 'Đóng collection' : 'Close collection'}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 min-h-0 relative bg-muted/10 flex flex-col">
          <div className="px-3 py-1.5 border-b text-xs font-semibold text-muted-foreground bg-muted/30 uppercase tracking-widest flex items-center justify-between gap-2 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0 shrink truncate">
              <span className="truncate whitespace-nowrap">
                {isAggregationView
                  ? lang === 'vi'
                    ? 'Trình dựng Aggregation Pipeline'
                    : 'Aggregation Pipeline Builder'
                  : lang === 'vi'
                    ? 'Trình thiết kế truy vấn (MQL)'
                    : 'Visual MQL Builder'}
              </span>
              {!isAggregationView && (
                <span className="text-[9px] font-normal lowercase bg-background border border-border/50 px-1.5 py-0.5 rounded text-muted-foreground tracking-normal whitespace-nowrap hidden md:inline">
                  Shift + Alt + F to format
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 hover:bg-green-500/10 text-green-500/80 hover:text-green-400 transition-all border border-transparent hover:border-green-500/20"
                    title={
                      lang === 'vi'
                        ? 'Hỏi trợ lý AI sinh MQL'
                        : 'Ask AI to generate MQL'
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-green-500/10" />
                    <span className="font-semibold text-[10px] uppercase tracking-wider">
                      {isCompactMobileLayout ? 'AI' : 'AI NoSQL'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[min(450px,calc(100vw-1rem))] p-0 border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden"
                  align="start"
                  sideOffset={10}
                >
                  <NoSqlAiQueryBox
                    currentConnectionId={nosqlActiveConnectionId || ''}
                    currentDatabase={nosqlEffectiveDatabase}
                    collectionName={nosqlActiveCollection}
                    onGenerate={(generatedMql) => {
                      setNosqlMqlQuery(generatedMql);
                    }}
                  />
                </PopoverContent>
              </Popover>

              <div className="w-px h-4 bg-border/40" />

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

              {result?.truncated && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full shrink-0">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-500/80">
                    {lang === 'vi' ? 'Giới hạn' : 'Capped'}
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

              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                onClick={toggleResultPanel}
                title={
                  isResultPanelOpen
                    ? lang === 'vi'
                      ? 'Ẩn panel kết quả'
                      : 'Hide results panel'
                    : lang === 'vi'
                      ? 'Mở panel kết quả'
                      : 'Show results panel'
                }
              >
                {isResultPanelOpen ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span className={cn('whitespace-nowrap', isCompactMobileLayout && 'hidden')}>
                  {isResultPanelOpen
                    ? lang === 'vi'
                      ? 'Ẩn kết quả'
                      : 'Hide results'
                    : lang === 'vi'
                      ? 'Mở kết quả'
                      : 'Show results'}
                </span>
              </Button>

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
                    {lang === 'vi' ? 'Thực thi' : 'Run'}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 w-full relative">
            {isAggregationView ? (
              <NoSqlAggregationBuilderView
                collectionName={nosqlActiveCollection}
                mqlQuery={nosqlMqlQuery}
                onApply={setNosqlMqlQuery}
                onRun={handleRunPreparedQuery}
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
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {resultPanelCopy.title}
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
                title={
                  lang === 'vi'
                    ? 'Đóng panel kết quả (Ctrl+J)'
                    : 'Close results panel (Ctrl+J)'
                }
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 custom-scrollbar">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-green-500/20 border-t-green-500 animate-spin" />
                <span className="text-sm font-medium text-green-600 animate-pulse">
                  {lang === 'vi' ? 'Đang truy vấn BSON...' : 'Querying BSON...'}
                </span>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-destructive">
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm font-medium">{error.message}</span>
              </div>
            ) : !nosqlResult ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                <Leaf className="w-8 h-8 text-green-500 animate-pulse" />
                <span className="text-sm font-medium tracking-wide">
                  {isAggregationView
                    ? lang === 'vi'
                      ? 'Dựng pipeline rồi chạy để xem kết quả'
                      : 'Build a pipeline, then run it to inspect results'
                    : lang === 'vi'
                      ? 'Nhấn Thực thi để nạp dữ liệu'
                      : 'Click Run to fetch documents'}
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
                {resultViewMode === 'schema' && <NoSqlSchemaAnalysisView />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
