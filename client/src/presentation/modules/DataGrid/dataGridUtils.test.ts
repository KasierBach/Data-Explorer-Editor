import { describe, expect, it } from 'vitest';
import {
  advanceMomentumScroll,
  buildColumnOrderStorageKey,
  getAutoFitColumnWidth,
  normalizeMomentumWheelDelta,
  normalizeColumnOrder,
  previewDatabaseValue,
  reorderColumnIds,
  serializeDatabaseValue,
  shouldUseMomentumWheel,
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

  it('keeps precision trackpad deltas on native scrolling', () => {
    expect(shouldUseMomentumWheel(0, 18, 0)).toBe(false);
    expect(shouldUseMomentumWheel(0, 120, 1)).toBe(true);
  });

  it('normalizes and clamps wheel delta for momentum scrolling', () => {
    expect(normalizeMomentumWheelDelta(3, 1, 800)).toBe(96);
    expect(normalizeMomentumWheelDelta(1, 2, 600)).toBe(220);
    expect(normalizeMomentumWheelDelta(-500, 0, 800)).toBe(-220);
  });

  it('advances momentum scrolling without reversing direction', () => {
    let scrollTop = 100;
    let velocity = 18;

    for (let index = 0; index < 12; index += 1) {
      const step = advanceMomentumScroll(scrollTop, velocity, 5000, 1);
      expect(step.nextScrollTop).toBeGreaterThanOrEqual(scrollTop);
      expect(step.nextVelocity).toBeGreaterThanOrEqual(0);

      scrollTop = step.nextScrollTop;
      velocity = step.nextVelocity;

      if (step.done) break;
    }
  });

  it('serializes nested driver values without changing or mutating ordinary JSON values', () => {
    const date = new Date('2026-11-23T10:20:30.000Z');
    const binary = new Uint8Array([1, 2, 3]);
    const value = { nested: [9007199254740993n, date, binary, null, ''] };
    expect(serializeDatabaseValue(value)).toBe('{"nested":["9007199254740993","2026-11-23T10:20:30.000Z","[binary 3 bytes]",null,""]}');
    expect(serializeDatabaseValue(value, true)).toContain('\n  "nested": [');
    expect(value.nested[0]).toBe(9007199254740993n);
    expect(value.nested[1]).toBe(date);
    expect(Array.from(binary)).toEqual([1, 2, 3]);

    const ordinary = { number: 42, boolean: false, string: 'a,b\n"c"', null: null, empty: '', array: [1, 'two'] };
    expect(serializeDatabaseValue(ordinary)).toBe(JSON.stringify(ordinary));
    expect(serializeDatabaseValue(ordinary, true)).toBe(JSON.stringify(ordinary, null, 2));
  });

  it('keeps null, empty strings, scalar values, dates and binary values distinct', () => {
    expect(serializeDatabaseValue(null)).toBe('NULL');
    expect(serializeDatabaseValue('')).toBe('');
    expect(serializeDatabaseValue('  raw\ntext  ')).toBe('  raw\ntext  ');
    expect(serializeDatabaseValue(9007199254740993n)).toBe('9007199254740993');
    expect(serializeDatabaseValue(false)).toBe('false');
    expect(serializeDatabaseValue(0)).toBe('0');
    expect(serializeDatabaseValue(new Date('2026-11-23T00:00:00.000Z'))).toBe('2026-11-23T00:00:00.000Z');
    expect(serializeDatabaseValue(new Uint8Array([1, 2]))).toBe('[binary 2 bytes]');
    expect(serializeDatabaseValue(new ArrayBuffer(4))).toBe('[binary 4 bytes]');
    expect(serializeDatabaseValue({ binary: new DataView(new ArrayBuffer(4)) })).toBe('{"binary":"[binary 4 bytes]"}');
    expect(serializeDatabaseValue(undefined)).toBe('undefined');
  });
});
