import {
  assertResultByteBudget,
  DEFAULT_QUERY_RESULT_MAX_BYTES,
  QueryResultByteBudget,
  ResultByteBudgetError,
  validateResultByteBudget,
} from './query-result-budget.util';

const jsonBytes = (value: unknown) =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');

describe('interactive result JSON byte accounting', () => {
  it('has one 32 MiB safety default, not a product-tier quota', () => {
    expect(DEFAULT_QUERY_RESULT_MAX_BYTES).toBe(32 * 1024 * 1024);
    expect(validateResultByteBudget(undefined)).toBeUndefined();
    expect(validateResultByteBudget(1024)).toBe(1024);
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    '1024',
    null,
  ])(
    'rejects invalid internal budget %p rather than disabling the guard',
    (budget) => {
      expect(() => validateResultByteBudget(budget as number)).toThrow(
        RangeError,
      );
    },
  );

  it.each([
    { rows: [{ value: 'é😀漢字' }], columns: ['é😀漢字'] },
    {
      rows: [{ value: '"\\\n\t\u0000\ud800\udc00\ud800x\udc00' }],
      columns: ['escaped'],
    },
    {
      rows: [{ value: Buffer.from([0, 9, 10, 99, 100, 255]) }],
      columns: ['binary'],
    },
    { rows: [{ value: new Uint8Array([0, 128, 255]) }], columns: ['typed'] },
    {
      rows: [
        {
          value: new Date('2026-11-23T00:00:00.000Z'),
          nil: null,
          missing: undefined,
        },
      ],
      columns: ['date'],
    },
    {
      rows: [
        { value: [undefined, null, true, false, NaN, Infinity, -0, 1e21] },
      ],
      columns: ['array'],
      rowCount: 1,
      countStatus: 'skipped',
    },
    {
      rows: [{ value: { nested: ['💡', 1, { key: '終' }] } }],
      columns: ['nested'],
      appliedLimit: 50,
      cached: false,
    },
    { rows: [{ value: { toJSON: () => 'é😀' } }], columns: ['custom'] },
    {
      rows: [{ value: { toJSON: () => Buffer.from([0, 100, 255]) } }],
      columns: ['custom-buffer'],
    },
    {
      rows: [{ value: { toJSON: () => new Date('2026-11-23T00:00:00.000Z') } }],
      columns: ['single-toJSON'],
    },
  ])(
    'accepts the exact UTF-8 JSON boundary and rejects one byte less (%p)',
    (result) => {
      const bytes = jsonBytes(result);
      expect(() => assertResultByteBudget(result, bytes)).not.toThrow();
      expect(() => assertResultByteBudget(result, bytes - 1)).toThrow(
        ResultByteBudgetError,
      );
    },
  );

  it('counts binary JSON expansion, not only the raw buffer length', () => {
    const result = {
      rows: [{ value: Buffer.alloc(128, 255) }],
      columns: ['value'],
    };
    expect(jsonBytes(result)).toBeGreaterThan(512);
    expect(() => assertResultByteBudget(result, 256)).toThrow(
      ResultByteBudgetError,
    );
  });

  it('accounts incrementally for rows, field names, delimiters and affectedRows', () => {
    const result = {
      rows: [{ name: 'é' }, { name: '😀' }],
      columns: ['name'],
      rowCount: 2,
    };
    const budget = new QueryResultByteBudget(jsonBytes(result));
    budget.setColumns(result.columns);
    result.rows.forEach((row) => budget.addRow(row));
    budget.setRowCount(2);
    expect(() => budget.addRow({ name: 'overflow' })).toThrow(
      ResultByteBudgetError,
    );
  });

  it('stops walking an oversized result instead of serializing the entire payload', () => {
    const laterValue = jest.fn(() => 'must not be read');
    const row = {
      first: 'x'.repeat(1024),
      get later() {
        return laterValue();
      },
    };
    expect(() =>
      assertResultByteBudget({ rows: [row], columns: [] }, 64),
    ).toThrow(ResultByteBudgetError);
    expect(laterValue).not.toHaveBeenCalled();
  });

  it('reports uncertainty around writes, never a false rollback/no-write guarantee', () => {
    try {
      assertResultByteBudget(
        { rows: [{ value: 'overflow' }], columns: ['value'] },
        24,
      );
      throw new Error('expected overflow');
    } catch (error) {
      expect(error).toBeInstanceOf(ResultByteBudgetError);
      expect(error).toMatchObject({
        code: 'RESULT_BYTE_BUDGET_EXCEEDED',
        maxResultBytes: 24,
      });
      expect((error as Error).message).toMatch(
        /inspect.*writes|writes.*inspect/i,
      );
      expect((error as Error).message).not.toMatch(
        /no writes|nothing.*written|automatically.*retry/i,
      );
    }
  });
});
