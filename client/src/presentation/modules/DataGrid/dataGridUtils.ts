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
const GRID_WHEEL_LINE_HEIGHT = 32;
const GRID_WHEEL_PAGE_RATIO = 0.72;
const GRID_WHEEL_MIN_DELTA = 40;
const GRID_WHEEL_MAX_DELTA = 220;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function shouldUseMomentumWheel(
  deltaX: number,
  deltaY: number,
  deltaMode: number,
) {
  if (deltaY === 0) return false;
  if (Math.abs(deltaX) > Math.abs(deltaY)) return false;

  // Let precision trackpads keep the browser's native inertial behavior.
  if (deltaMode === 0 && Math.abs(deltaY) < GRID_WHEEL_MIN_DELTA) {
    return false;
  }

  return true;
}

export function normalizeMomentumWheelDelta(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
) {
  if (deltaY === 0) return 0;

  let pixelDelta = deltaY;

  if (deltaMode === 1) {
    pixelDelta *= GRID_WHEEL_LINE_HEIGHT;
  } else if (deltaMode === 2) {
    pixelDelta *= Math.max(
      160,
      viewportHeight * GRID_WHEEL_PAGE_RATIO,
    );
  }

  const magnitude = clamp(
    Math.abs(pixelDelta),
    GRID_WHEEL_MIN_DELTA,
    GRID_WHEEL_MAX_DELTA,
  );

  return Math.sign(pixelDelta) * magnitude;
}

export interface MomentumScrollStep {
  nextScrollTop: number;
  nextVelocity: number;
  done: boolean;
}

export function advanceMomentumScroll(
  currentScrollTop: number,
  velocity: number,
  maxScrollTop: number,
  frameRatio = 1,
): MomentumScrollStep {
  if (velocity === 0) {
    return {
      nextScrollTop: currentScrollTop,
      nextVelocity: 0,
      done: true,
    };
  }

  const nextScrollTopRaw = currentScrollTop + velocity * frameRatio;
  const nextScrollTop = clamp(nextScrollTopRaw, 0, maxScrollTop);
  const hitBoundary = nextScrollTop !== nextScrollTopRaw;

  if (hitBoundary) {
    return {
      nextScrollTop,
      nextVelocity: 0,
      done: true,
    };
  }

  const nextVelocity = velocity * Math.pow(0.88, frameRatio);
  const done = Math.abs(nextVelocity) < 0.35;

  return {
    nextScrollTop,
    nextVelocity: done ? 0 : nextVelocity,
    done,
  };
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
