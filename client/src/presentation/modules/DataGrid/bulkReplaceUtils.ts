import type { RowData, TableColumn } from '@/core/domain/entities';

export const ALL_TEXT_COLUMNS = '__all_text_columns__';

export type BulkReplaceScope = 'selected' | 'page' | 'filtered';
export type BulkReplaceMatchMode = 'contains' | 'exact' | 'whole-word';

export interface BulkReplaceOptions {
  scope: BulkReplaceScope;
  columnId: string;
  findText: string;
  replaceText: string;
  matchMode: BulkReplaceMatchMode;
  caseSensitive: boolean;
}

export interface BulkReplaceTargetRow {
  rowId: string;
  rowIndex: number;
  values: RowData;
}

export interface BulkReplacePlan {
  updatesByRow: Record<string, RowData>;
  matchedRows: number;
  matchedCells: number;
}

export interface BulkSearchMatch {
  rowId: string;
  rowIndex: number;
  columnId: string;
  cellKey: string;
  preview: string;
}

export interface BulkSearchPlan {
  matches: BulkSearchMatch[];
  matchedRows: number;
  matchedCells: number;
}

const TEXT_TYPE_HINTS = [
  'char',
  'text',
  'string',
  'clob',
  'citext',
  'enum',
  'set',
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordBoundaryCodePoint(char: string | undefined): boolean {
  if (!char) return true;
  return !/[\p{L}\p{N}_]/u.test(char);
}

function matchWholeWord(
  source: string,
  findText: string,
  caseSensitive: boolean,
): { matched: boolean } {
  const flags = `gu${caseSensitive ? '' : 'i'}`;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegex(findText)})(?=$|[^\\p{L}\\p{N}_])`, flags);
  let matched = false;
  source.replace(pattern, (fullMatch, _prefix: string, _token: string, offset: number, whole: string) => {
    const previousChar = offset > 0 ? whole[offset - 1] : undefined;
    const nextChar = whole[offset + fullMatch.length] ?? undefined;

    if (!isWordBoundaryCodePoint(previousChar) || !isWordBoundaryCodePoint(nextChar)) {
      return fullMatch;
    }

    matched = true;
    return fullMatch;
  });

  return { matched };
}

function matchContains(
  source: string,
  findText: string,
  caseSensitive: boolean,
): { matched: boolean } {
  const flags = `g${caseSensitive ? '' : 'i'}`;
  const pattern = new RegExp(escapeRegex(findText), flags);
  const matched = pattern.test(source);
  return { matched };
}

function matchExact(
  source: string,
  findText: string,
  caseSensitive: boolean,
): { matched: boolean } {
  const matched = caseSensitive
    ? source === findText
    : source.localeCompare(findText, undefined, { sensitivity: 'base' }) === 0;

  return { matched };
}

function matchValue(
  source: string,
  options: Pick<BulkReplaceOptions, 'findText' | 'matchMode' | 'caseSensitive'>,
): { matched: boolean } {
  if (!options.findText) {
    return { matched: false };
  }

  switch (options.matchMode) {
    case 'exact':
      return matchExact(
        source,
        options.findText,
        options.caseSensitive,
      );
    case 'whole-word':
      return matchWholeWord(
        source,
        options.findText,
        options.caseSensitive,
      );
    case 'contains':
    default:
      return matchContains(
        source,
        options.findText,
        options.caseSensitive,
      );
  }
}

function applyReplace(
  source: string,
  options: BulkReplaceOptions,
): { matched: boolean; value: string } {
  const match = matchValue(source, options);
  if (!match.matched) {
    return { matched: false, value: source };
  }

  switch (options.matchMode) {
    case 'exact':
      return { matched: true, value: options.replaceText };
    case 'whole-word': {
      const flags = `gu${options.caseSensitive ? '' : 'i'}`;
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegex(options.findText)})(?=$|[^\\p{L}\\p{N}_])`, flags);
      return {
        matched: true,
        value: source.replace(pattern, (fullMatch, prefix: string, _token: string, offset: number, whole: string) => {
          const previousChar = offset > 0 ? whole[offset - 1] : undefined;
          const nextChar = whole[offset + fullMatch.length] ?? undefined;

          if (!isWordBoundaryCodePoint(previousChar) || !isWordBoundaryCodePoint(nextChar)) {
            return fullMatch;
          }

          return `${prefix}${options.replaceText}`;
        }),
      };
    }
    case 'contains':
    default: {
      const flags = `g${options.caseSensitive ? '' : 'i'}`;
      const pattern = new RegExp(escapeRegex(options.findText), flags);
      return {
        matched: true,
        value: source.replace(pattern, options.replaceText),
      };
    }
  }
}

export function isTextLikeColumn(column: Pick<TableColumn, 'type'>): boolean {
  const normalized = column.type.toLowerCase();
  return TEXT_TYPE_HINTS.some((hint) => normalized.includes(hint));
}

export function getTextColumnIds(columns: TableColumn[]): string[] {
  return columns.filter(isTextLikeColumn).map((column) => column.name);
}

export function buildBulkSearchPlan(params: {
  targetRows: BulkReplaceTargetRow[];
  pendingChanges: Record<string, RowData>;
  options: Pick<BulkReplaceOptions, 'columnId' | 'findText' | 'matchMode' | 'caseSensitive'>;
  textColumnIds: string[];
}): BulkSearchPlan {
  const { targetRows, pendingChanges, options, textColumnIds } = params;
  const targetColumnIds = options.columnId === ALL_TEXT_COLUMNS
    ? textColumnIds
    : [options.columnId];
  const matches: BulkSearchMatch[] = [];
  const matchedRowIds = new Set<string>();

  for (const row of targetRows) {
    const currentPending = pendingChanges[row.rowId] ?? {};

    for (const columnId of targetColumnIds) {
      const sourceValue = currentPending[columnId] ?? row.values[columnId];
      if (typeof sourceValue !== 'string') continue;

      const match = matchValue(sourceValue, options);
      if (!match.matched) continue;

      matchedRowIds.add(row.rowId);
      matches.push({
        rowId: row.rowId,
        rowIndex: row.rowIndex,
        columnId,
        cellKey: `${row.rowId}::${columnId}`,
        preview: sourceValue,
      });
    }
  }

  return {
    matches,
    matchedRows: matchedRowIds.size,
    matchedCells: matches.length,
  };
}

export function buildBulkReplacePlan(params: {
  targetRows: BulkReplaceTargetRow[];
  pendingChanges: Record<string, RowData>;
  options: BulkReplaceOptions;
  textColumnIds: string[];
}): BulkReplacePlan {
  const { targetRows, pendingChanges, options, textColumnIds } = params;
  const updatesByRow: Record<string, RowData> = {};
  const targetColumnIds = options.columnId === ALL_TEXT_COLUMNS
    ? textColumnIds
    : [options.columnId];

  let matchedRows = 0;
  let matchedCells = 0;

  for (const row of targetRows) {
    const currentPending = pendingChanges[row.rowId] ?? {};
    const rowUpdates: RowData = {};
    let rowMatched = false;

    for (const columnId of targetColumnIds) {
      const sourceValue = currentPending[columnId] ?? row.values[columnId];
      if (typeof sourceValue !== 'string') continue;

      const replacement = applyReplace(sourceValue, options);
      if (!replacement.matched || replacement.value === sourceValue) continue;

      rowUpdates[columnId] = replacement.value;
      matchedCells += 1;
      rowMatched = true;
    }

    if (rowMatched) {
      updatesByRow[row.rowId] = rowUpdates;
      matchedRows += 1;
    }
  }

  return {
    updatesByRow,
    matchedRows,
    matchedCells,
  };
}
