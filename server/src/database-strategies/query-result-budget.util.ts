import { BadRequestException } from '@nestjs/common';

/** Interactive payload safety limit, independent of product tiers and existing row caps. */
export const DEFAULT_QUERY_RESULT_MAX_BYTES = 32 * 1024 * 1024;

export class ResultByteBudgetError extends BadRequestException {
  readonly code = 'RESULT_BYTE_BUDGET_EXCEEDED';

  constructor(readonly maxResultBytes: number) {
    super({
      message:
        `Query result exceeded the ${maxResultBytes} byte runtime payload budget; complete result unavailable. ` +
        'Inspect the database and any writes before retrying; the query was not replayed.',
      reason: 'QUERY_RESULT_BYTE_BUDGET_EXCEEDED',
      details: { maxResultBytes },
    });
  }
}

/** Absent means unchanged internal/export behavior; invalid values must not disable safety. */
export function validateResultByteBudget(value?: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError('Result byte budget must be a positive safe integer.');
  }
  return value;
}

/** Counts JSON UTF-8 without allocating a serialized result or Buffer.toJSON's byte array. */
class JsonByteCounter {
  bytes = 0;
  private readonly ancestors = new Set<object>();

  constructor(private readonly maximum: number) {}

  reserve(bytes: number): void {
    this.bytes += bytes;
    if (this.bytes > this.maximum)
      throw new ResultByteBudgetError(this.maximum);
  }

  private string(value: string): void {
    // Every UTF-16 code unit needs at least one JSON byte. Refuse huge values
    // immediately, then account for UTF-8/escaping expansion without copying them.
    this.reserve(value.length + 2);
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code === 34 || code === 92) this.reserve(1);
      else if (code < 32) {
        this.reserve([8, 9, 10, 12, 13].includes(code) ? 1 : 5);
      } else if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          this.reserve(2);
          i++;
        } else this.reserve(5);
      } else if (code >= 0xdc00 && code <= 0xdfff) this.reserve(5);
      else if (code >= 0x800) this.reserve(2);
      else if (code >= 0x80) this.reserve(1);
    }
  }

  add(
    value: unknown,
    key = '',
    arrayElement = false,
    applyToJson = true,
  ): void {
    if (
      applyToJson &&
      Buffer.isBuffer(value) &&
      value.toJSON === Buffer.prototype.toJSON
    ) {
      this.reserve('{"type":"Buffer","data":['.length);
      for (let i = 0; i < value.length; i++) {
        this.reserve(
          (i ? 1 : 0) + (value[i] < 10 ? 1 : value[i] < 100 ? 2 : 3),
        );
      }
      this.reserve(2);
      return;
    }
    if (
      value !== null &&
      (typeof value === 'object' || typeof value === 'bigint')
    ) {
      const toJSON = (value as { toJSON?: (key: string) => unknown }).toJSON;
      if (applyToJson && typeof toJSON === 'function') {
        this.add(toJSON.call(value, key), key, arrayElement, false);
        return;
      }
      if (
        value instanceof Number ||
        value instanceof String ||
        value instanceof Boolean
      ) {
        value = value.valueOf();
      }
    }
    if (value === null) {
      this.reserve(4);
      return;
    }
    if (typeof value === 'string') {
      this.string(value);
      return;
    }
    if (typeof value === 'number') {
      this.reserve(Number.isFinite(value) ? String(value).length : 4);
      return;
    }
    if (typeof value === 'boolean') {
      this.reserve(value ? 4 : 5);
      return;
    }
    if (typeof value === 'bigint')
      throw new TypeError('Cannot serialize a BigInt query result.');
    if (typeof value !== 'object') {
      if (arrayElement) this.reserve(4);
      return;
    }
    if (this.ancestors.has(value))
      throw new TypeError('Cannot serialize a circular query result.');
    this.ancestors.add(value);
    try {
      this.reserve(2);
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (i) this.reserve(1);
          this.add(value[i], String(i), true);
        }
      } else {
        let first = true;
        for (const name of Object.keys(value)) {
          let child: unknown = (value as Record<string, unknown>)[name];
          let nativeBufferJson = false;
          // JSON calls a property's toJSON before deciding whether to omit it.
          if (
            child !== null &&
            (typeof child === 'object' || typeof child === 'bigint')
          ) {
            const toJSON = (child as { toJSON?: (key: string) => unknown })
              .toJSON;
            nativeBufferJson =
              Buffer.isBuffer(child) && toJSON === Buffer.prototype.toJSON;
            if (typeof toJSON === 'function' && !nativeBufferJson) {
              child = toJSON.call(child, name);
            }
          }
          if (
            child === undefined ||
            typeof child === 'function' ||
            typeof child === 'symbol'
          )
            continue;
          if (!first) this.reserve(1);
          first = false;
          this.string(name);
          this.reserve(1);
          this.add(child, name, false, nativeBufferJson);
        }
      }
    } finally {
      this.ancestors.delete(value);
    }
  }
}

/** Post-buffer guard for other drivers; this is not a hard driver/heap allocation bound. */
export function assertResultByteBudget(
  result: unknown,
  maxResultBytes = DEFAULT_QUERY_RESULT_MAX_BYTES,
): void {
  validateResultByteBudget(maxResultBytes);
  new JsonByteCounter(maxResultBytes).add(result);
}

/** Incremental native collector accounting for the returned rows/columns/affectedRows. */
export class QueryResultByteBudget {
  private readonly counter: JsonByteCounter;
  private rows = 0;
  private columnBytes = 2;
  private rowCountBytes = 0;
  private groups = 1;
  private headerRetained = false;

  constructor(maxResultBytes: number) {
    validateResultByteBudget(maxResultBytes);
    this.counter = new JsonByteCounter(maxResultBytes);
    this.counter.add({ rows: [], columns: [] });
  }

  /** Freeze the previous group's costs; retain every group, not only the last metadata. */
  nextResultSet(): void {
    // Each retained group contributes its rows/columns envelope and delimiter;
    // a multi-group result also needs an outer array envelope once.
    this.counter.reserve(24 + 1 + (this.groups++ === 1 ? 2 : 0));
    this.rows = 0;
    this.columnBytes = 2;
    this.rowCountBytes = 0;
    this.headerRetained = false;
  }

  /** Native CALL tails retain the full header, not just outbound affectedRows. */
  retainHeader(header: unknown): void {
    this.counter.add(header);
    this.headerRetained = true;
  }

  setColumns(columns: string[]): void {
    this.counter.reserve(-this.columnBytes);
    const before = this.counter.bytes;
    this.counter.add(columns);
    this.columnBytes = this.counter.bytes - before;
  }

  addRow(row: unknown): void {
    if (this.rows++) this.counter.reserve(1);
    this.counter.add(row, String(this.rows - 1), true);
  }

  setRowCount(rowCount?: number): void {
    // A full retained native header already accounts for affectedRows; do not
    // charge the same scalar again while retaining all earlier group costs.
    if (this.headerRetained) return;
    this.counter.reserve(-this.rowCountBytes);
    const before = this.counter.bytes;
    if (rowCount !== undefined) {
      this.counter.reserve(',"rowCount":'.length);
      this.counter.add(rowCount);
    }
    this.rowCountBytes = this.counter.bytes - before;
  }
}
