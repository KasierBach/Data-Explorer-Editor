import type { DatabaseValue, RowData, TableColumn } from '@/core/domain/entities';

export interface SelectedCellState {
  columnName: string;
  columnType: string;
  rowKey: string;
  value: DatabaseValue;
}

const MIN_COLUMN_WIDTH = 96;
const MAX_COLUMN_WIDTH = 2000;
const DEFAULT_COLUMN_WIDTH = 180;
const AVERAGE_CHARACTER_WIDTH = 7.4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function serializeDatabaseValue(
  value: DatabaseValue,
  pretty = false,
): string {
  if (value === null) return 'NULL';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) {
    return `[binary ${value.byteLength} bytes]`;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, pretty ? 2 : 0);
}

export function previewDatabaseValue(
  value: DatabaseValue,
  maxLength = 2048,
): string {
  const compact = serializeDatabaseValue(value).replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

export function buildColumnSizingStorageKey(
  connectionId: string | null | undefined,
  schema: string,
  tableName: string,
) {
  if (!connectionId) return null;
  return `data-grid:column-sizing:${connectionId}:${schema}.${tableName}`;
}

export function buildColumnOrderStorageKey(
  connectionId: string | null | undefined,
  schema: string,
  tableName: string,
) {
  if (!connectionId) return null;
  return `data-grid:column-order:${connectionId}:${schema}.${tableName}`;
}

export function normalizeColumnOrder(
  storedOrder: string[] | null | undefined,
  availableColumnIds: string[],
) {
  const allowedIds = new Set(availableColumnIds);
  const sanitized = (storedOrder ?? []).filter(
    (columnId, index, allIds) =>
      allowedIds.has(columnId) && allIds.indexOf(columnId) === index,
  );
  const missingIds = availableColumnIds.filter(
    (columnId) => !sanitized.includes(columnId),
  );
  return [...sanitized, ...missingIds];
}

export function reorderColumnIds(
  currentOrder: string[],
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) return currentOrder;

  const nextOrder = [...currentOrder];
  const sourceIndex = nextOrder.indexOf(sourceId);
  const targetIndex = nextOrder.indexOf(targetId);

  if (sourceIndex === -1 || targetIndex === -1) return currentOrder;

  nextOrder.splice(sourceIndex, 1);
  nextOrder.splice(targetIndex, 0, sourceId);
  return nextOrder;
}

export function getInitialColumnWidth(column: TableColumn) {
  const name = column.name.toLowerCase();
  const type = column.type.toLowerCase();

  if (column.isPrimaryKey) return 110;
  if (name.includes('email')) return 240;
  if (name.includes('phone')) return 160;
  if (name.includes('password') || name.includes('token')) return 340;
  if (type.includes('json')) return 280;
  if (type.includes('timestamp') || type.includes('date')) return 210;
  if (type.includes('boolean')) return 120;
  if (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal')
  ) {
    return 140;
  }

  return DEFAULT_COLUMN_WIDTH;
}

export function getAutoFitColumnWidth(column: TableColumn, rows: RowData[]) {
  const samples = rows
    .slice(0, 40)
    .map((row) => previewDatabaseValue(row[column.name], 300));
  const lengths = [
    column.name.length,
    column.type.length,
    ...samples.map((sample) => sample.length),
  ];
  const maxLength = Math.max(...lengths, 8);
  const paddedWidth = maxLength * AVERAGE_CHARACTER_WIDTH + 36;

  return clamp(paddedWidth, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH);
}
