import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ColumnInfo, RowIdentity } from './database-strategy.interface';

export function validateRowIdentities(identities: RowIdentity[]): void {
  if (
    !Array.isArray(identities) ||
    !identities.length ||
    identities.length > 1000
  ) {
    throw new BadRequestException('Select between 1 and 1000 rows.');
  }
  const seen = new Set<string>();
  for (const identity of identities) {
    if (!Array.isArray(identity) || !identity.length || identity.length > 16) {
      throw new BadRequestException(
        'A row identity requires 1 to 16 primary-key columns.',
      );
    }
    const columns = new Set<string>();
    for (const key of identity) {
      if (
        !key ||
        typeof key.column !== 'string' ||
        !key.column ||
        columns.has(key.column)
      ) {
        throw new BadRequestException(
          'Invalid or duplicate primary-key column.',
        );
      }
      columns.add(key.column);
      const value = key.value;
      if (
        !(
          typeof value === 'string' ||
          typeof value === 'boolean' ||
          (typeof value === 'number' &&
            Number.isFinite(value) &&
            (!Number.isInteger(value) || Number.isSafeInteger(value)))
        )
      ) {
        throw new BadRequestException(
          'Primary-key values must be lossless, non-null JSON scalars.',
        );
      }
    }
    const canonical = JSON.stringify(
      [...identity]
        .sort((a, b) => a.column.localeCompare(b.column))
        .map((key) => [key.column, typeof key.value, key.value]),
    );
    if (seen.has(canonical))
      throw new BadRequestException('Duplicate row identity.');
    seen.add(canonical);
  }
}

export function assertPrimaryKeyIdentities(
  identities: RowIdentity[],
  columns: ColumnInfo[],
): void {
  validateRowIdentities(identities);
  const primary = columns.filter((column) => column.isPrimaryKey);
  if (
    !primary.length ||
    new Set(primary.map((column) => column.name)).size !== primary.length
  ) {
    throw new BadRequestException(
      'Editing requires verified primary-key metadata.',
    );
  }
  for (const identity of identities) {
    if (
      identity.length !== primary.length ||
      identity.some(
        (key) => !primary.some((column) => column.name === key.column),
      )
    ) {
      throw new BadRequestException(
        'Provide every primary-key column and no other columns.',
      );
    }
    for (const key of identity) {
      const type = primary
        .find((column) => column.name === key.column)!
        .type.toLowerCase();
      // shortcut: temporal drivers truncate precision; enable editing after lossless retrieval exists.
      if (/date|time/.test(type)) {
        throw new BadRequestException(
          'Temporal primary keys require lossless retrieval before row editing.',
        );
      }
      if (/uuid|uniqueidentifier/.test(type)) {
        if (
          typeof key.value !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            key.value,
          )
        )
          throw new BadRequestException('Invalid UUID primary key.');
      } else if (/char|text|enum|inet|cidr/.test(type)) {
        if (typeof key.value !== 'string')
          throw new BadRequestException(
            'Text primary keys must remain strings.',
          );
      } else if (
        /int|numeric|decimal|real|float|double|number|serial|money/.test(type)
      ) {
        // Exact numeric drivers may round before JSON; only their original decimal strings are safe.
        if (
          /numeric|decimal|money/.test(type) &&
          typeof key.value !== 'string'
        ) {
          throw new BadRequestException(
            'Exact numeric primary keys must be lossless decimal strings.',
          );
        }
        const numeric =
          typeof key.value === 'number' ||
          (typeof key.value === 'string' &&
            /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(key.value));
        if (
          !numeric ||
          (/int|serial/.test(type) &&
            (typeof key.value === 'number'
              ? !Number.isInteger(key.value)
              : !/^[+-]?\d+$/.test(key.value as string)))
        ) {
          throw new BadRequestException('Invalid numeric primary key.');
        }
      } else if (/bool|^bit$/.test(type)) {
        if (
          typeof key.value !== 'boolean' &&
          key.value !== 0 &&
          key.value !== 1
        )
          throw new BadRequestException('Invalid boolean primary key.');
      } else {
        throw new BadRequestException(
          `Primary-key type ${type} is not supported for row editing.`,
        );
      }
    }
  }
}

export function buildRowPredicate(
  identities: RowIdentity[],
  quote: (column: string) => string,
  placeholder: (position: number) => string,
  offset = 0,
): { sql: string; values: unknown[] } {
  validateRowIdentities(identities);
  const values: unknown[] = [];
  const sql = identities
    .map(
      (identity) =>
        `(${identity
          .map((key) => {
            values.push(key.value);
            return `${quote(key.column)} = ${placeholder(offset + values.length)}`;
          })
          .join(' AND ')})`,
    )
    .join(' OR ');
  if (offset + values.length > 2000)
    throw new BadRequestException(
      'Row mutation exceeds the supported parameter budget.',
    );
  return { sql, values };
}

export function assertAffectedRows(
  actual: number | null | undefined,
  expected: number,
): void {
  if (actual !== expected)
    throw new ConflictException(
      'Selected rows changed or their identity is ambiguous. Refresh the table before trying again.',
    );
}
