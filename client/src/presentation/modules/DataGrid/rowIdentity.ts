import type { RowData, TableMetadata } from '@/core/domain/entities';
import type { RowIdentity } from '@/core/domain/database-adapter.interface';

export function getRowIdentity(row: RowData, metadata: TableMetadata | undefined): RowIdentity | undefined {
  const columns = metadata?.columns.filter(column=>column.isPrimaryKey) ?? [];
  if (!columns.length || columns.length > 16 || new Set(columns.map(column=>column.name)).size !== columns.length) return undefined;
  const identity: RowIdentity = [];
  for (const column of columns) {
    // shortcut: temporal keys stay read-only until drivers preserve their full precision.
    if (/date|time/i.test(column.type)) return undefined;
    const value = row[column.name];
    if (/numeric|decimal|money/i.test(column.type) && typeof value !== 'string') return undefined;
    if (!(typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))))) return undefined;
    identity.push({column:column.name,value});
  }
  return identity;
}

export function rowIdentityKey(identity: RowIdentity): string {
  return JSON.stringify(identity.map(key=>[key.column,typeof key.value,key.value]));
}
