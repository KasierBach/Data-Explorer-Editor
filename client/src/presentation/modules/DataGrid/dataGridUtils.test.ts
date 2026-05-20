import { describe, expect, it } from 'vitest';
import {
  advanceMomentumScroll,
  buildColumnOrderStorageKey,
  getAutoFitColumnWidth,
  normalizeMomentumWheelDelta,
  normalizeColumnOrder,
  previewDatabaseValue,
  reorderColumnIds,
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
});
