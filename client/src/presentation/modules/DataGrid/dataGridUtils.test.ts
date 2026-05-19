import { describe, expect, it } from 'vitest';
import {
  buildColumnOrderStorageKey,
  getAutoFitColumnWidth,
  normalizeColumnOrder,
  previewDatabaseValue,
  reorderColumnIds,
} from './dataGridUtils';

describe('dataGridUtils', () => {
  it('normalizes stored column order and appends missing columns', () => {
    expect(
      normalizeColumnOrder(['email', 'email', 'missing', 'name'], [
        '__row_number',
        'name',
        'email',
        'phone',
      ]),
    ).toEqual(['email', 'name', '__row_number', 'phone']);
  });

  it('reorders column ids without losing other columns', () => {
    expect(
      reorderColumnIds(
        ['__row_number', 'name', 'email', 'phone'],
        'phone',
        'name',
      ),
    ).toEqual(['__row_number', 'phone', 'name', 'email']);
  });

  it('builds a stable column-order storage key per connection and table', () => {
    expect(
      buildColumnOrderStorageKey('conn-1', 'public', 'customers'),
    ).toBe('data-grid:column-order:conn-1:public.customers');
    expect(
      buildColumnOrderStorageKey(null, 'public', 'customers'),
    ).toBeNull();
  });

  it('truncates preview values for long content', () => {
    expect(previewDatabaseValue('a'.repeat(80), 12)).toBe('aaaaaaaaaaa…');
  });

  it('auto-fits based on the widest sampled value within bounds', () => {
    expect(
      getAutoFitColumnWidth(
        {
          name: 'email',
          type: 'character varying',
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
        },
        [
          { email: 'short@example.com' },
          { email: 'very.long.email.address@example.com' },
        ],
      ),
    ).toBeGreaterThanOrEqual(96);
  });
});
