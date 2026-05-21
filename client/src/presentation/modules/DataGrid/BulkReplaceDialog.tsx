import { useMemo, useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import type { RowData, TableColumn } from '@/core/domain/entities';
import type { AppLang } from '@/core/utils/i18n';
import {
  ALL_TEXT_COLUMNS,
  buildBulkSearchPlan,
  buildBulkReplacePlan,
  getTextColumnIds,
  type BulkReplaceMatchMode,
  type BulkReplaceOptions,
  type BulkReplaceScope,
  type BulkReplaceTargetRow,
  type BulkSearchMatch,
} from './bulkReplaceUtils';
import { getDataGridText } from './dataGridI18n';

interface BulkReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowReplace: boolean;
  lang: AppLang;
  columns: TableColumn[];
  pageTargets: BulkReplaceTargetRow[];
  filteredTargets: BulkReplaceTargetRow[];
  selectedTargets: BulkReplaceTargetRow[];
  pendingChanges: Record<string, RowData>;
  onApply: (
    updatesByRow: Record<string, RowData>,
    summary: { matchedRows: number; matchedCells: number },
  ) => void;
  onSearch: (
    matches: BulkSearchMatch[],
    summary: { matchedRows: number; matchedCells: number },
  ) => void;
  onClearSearch: () => void;
  hasSearchResults: boolean;
}

function getDefaultScope(params: {
  selectedCount: number;
  filteredCount: number;
  pageCount: number;
}): BulkReplaceScope {
  const { selectedCount, filteredCount, pageCount } = params;
  if (selectedCount > 0) return 'selected';
  if (filteredCount > 0 && filteredCount < pageCount) return 'filtered';
  return 'page';
}

export function BulkReplaceDialog({
  open,
  onOpenChange,
  allowReplace,
  lang,
  columns,
  pageTargets,
  filteredTargets,
  selectedTargets,
  pendingChanges,
  onApply,
  onSearch,
  onClearSearch,
  hasSearchResults,
}: BulkReplaceDialogProps) {
  const text = getDataGridText(lang);
  const textColumns = useMemo(
    () => columns.filter((column) => getTextColumnIds([column]).length > 0),
    [columns],
  );
  const textColumnIds = useMemo(
    () => textColumns.map((column) => column.name),
    [textColumns],
  );
  const [mode, setMode] = useState<'find' | 'replace'>('find');
  const [scope, setScope] = useState<BulkReplaceScope>('page');
  const [columnId, setColumnId] = useState<string>(ALL_TEXT_COLUMNS);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchMode, setMatchMode] = useState<BulkReplaceMatchMode>('contains');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setMode('find');
    setScope(
      getDefaultScope({
        selectedCount: selectedTargets.length,
        filteredCount: filteredTargets.length,
        pageCount: pageTargets.length,
      }),
    );
    setColumnId(ALL_TEXT_COLUMNS);
    setFindText('');
    setReplaceText('');
    setMatchMode('contains');
    setCaseSensitive(false);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const [prevAllowReplace, setPrevAllowReplace] = useState(allowReplace);
  if (!allowReplace && prevAllowReplace) {
    setPrevAllowReplace(false);
    setMode('find');
  } else if (allowReplace && !prevAllowReplace) {
    setPrevAllowReplace(true);
  }

  const targetRows = useMemo(() => {
    switch (scope) {
      case 'selected':
        return selectedTargets;
      case 'filtered':
        return filteredTargets;
      case 'page':
      default:
        return pageTargets;
    }
  }, [filteredTargets, pageTargets, scope, selectedTargets]);

  const replaceOptions = useMemo<BulkReplaceOptions>(() => ({
    scope,
    columnId,
    findText,
    replaceText,
    matchMode,
    caseSensitive,
  }), [caseSensitive, columnId, findText, matchMode, replaceText, scope]);

  const searchPreview = useMemo(() => {
    if (!findText.trim() || textColumnIds.length === 0) {
      return { matches: [], matchedRows: 0, matchedCells: 0 };
    }

    return buildBulkSearchPlan({
      targetRows,
      pendingChanges,
      options: {
        columnId,
        findText: findText.trim(),
        matchMode,
        caseSensitive,
      },
      textColumnIds,
    });
  }, [caseSensitive, columnId, findText, matchMode, pendingChanges, targetRows, textColumnIds]);

  const replacePreview = useMemo(() => {
    if (!findText.trim() || textColumnIds.length === 0) {
      return { updatesByRow: {}, matchedRows: 0, matchedCells: 0 };
    }

    return buildBulkReplacePlan({
      targetRows,
      pendingChanges,
      options: {
        ...replaceOptions,
        findText: findText.trim(),
      },
      textColumnIds,
    });
  }, [findText, pendingChanges, replaceOptions, targetRows, textColumnIds]);

  const preview = mode === 'find' ? searchPreview : replacePreview;
  const canApply =
    preview.matchedCells > 0 &&
    Boolean(findText.trim()) &&
    textColumnIds.length > 0;

  const handleApply = () => {
    if (!canApply) return;

    if (mode === 'find' || !allowReplace) {
      onSearch(searchPreview.matches, {
        matchedRows: searchPreview.matchedRows,
        matchedCells: searchPreview.matchedCells,
      });
    } else {
      onApply(replacePreview.updatesByRow, {
        matchedRows: replacePreview.matchedRows,
        matchedCells: replacePreview.matchedCells,
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-base font-semibold text-foreground">
            {allowReplace ? text.findReplace : text.find}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {!allowReplace
              ? text.searchDescriptionWithReplace
              : mode === 'find'
              ? text.searchDescription
              : text.stageReplaceDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {textColumnIds.length === 0 ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              {text.noTextColumns}
            </div>
          ) : (
            <>
              {allowReplace ? (
                <div className="inline-flex rounded-lg border border-border/60 bg-muted/20 p-1">
                  <button
                    type="button"
                    onClick={() => setMode('find')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'find' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {text.find}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('replace')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'replace' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {text.replace}
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  {text.replaceModeRequiresEdit}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Scope</span>
                  <select
                    value={scope}
                    onChange={(event) => setScope(event.target.value as BulkReplaceScope)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="selected" disabled={selectedTargets.length === 0}>
                      {text.selectedRows(selectedTargets.length)}
                    </option>
                    <option value="page">
                      {text.currentPage(pageTargets.length)}
                    </option>
                    <option value="filtered">
                      {text.currentFilteredRows(filteredTargets.length)}
                    </option>
                  </select>
                </label>

                <label className="space-y-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{text.targetColumn}</span>
                  <select
                    value={columnId}
                    onChange={(event) => setColumnId(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value={ALL_TEXT_COLUMNS}>{text.allTextColumns}</option>
                    {textColumns.map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name} ({column.type})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={`grid gap-4 ${mode === 'replace' ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{text.searchText}</span>
                  <Input
                    value={findText}
                    onChange={(event) => setFindText(event.target.value)}
                    placeholder={mode === 'find' ? text.textToSearch : text.textToReplace}
                    className="h-10"
                  />
                </label>

                {mode === 'replace' && (
                  <label className="space-y-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{text.replaceWith}</span>
                    <Input
                      value={replaceText}
                      onChange={(event) => setReplaceText(event.target.value)}
                      placeholder={text.replaceWith}
                      className="h-10"
                    />
                  </label>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{text.matchMode}</span>
                  <select
                    value={matchMode}
                    onChange={(event) => setMatchMode(event.target.value as BulkReplaceMatchMode)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="contains">Contains</option>
                    <option value="exact">{text.exactMatch}</option>
                    <option value="whole-word">{text.wholeWord}</option>
                  </select>
                </label>

                <label className="mt-6 inline-flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(event) => setCaseSensitive(event.target.checked)}
                    className="h-4 w-4 rounded border-border bg-background"
                  />
                  {text.caseSensitive}
                </label>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{text.rowsMatched(preview.matchedRows)}</span>
                  <span>{text.updatedCells(preview.matchedCells, mode)}</span>
                </div>
                <div className="mt-1 opacity-80">
                  {mode === 'find' || !allowReplace
                    ? text.searchSummary
                    : text.stagedReplaceSource}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 px-5 py-4">
          {mode === 'find' && hasSearchResults && (
            <Button variant="ghost" onClick={onClearSearch}>
              {text.clearSearch}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {text.cancel}
          </Button>
          <Button onClick={handleApply} disabled={!canApply}>
            {mode === 'find' || !allowReplace ? text.findMatches : text.applyReplace}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
