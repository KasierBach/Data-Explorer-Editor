import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import * as mysql from 'mysql2/promise';
import { MysqlStrategy } from './mysql.strategy';
import type { QueryExecutionOptions } from './database-strategy.interface';
import { QueryService } from '../query/query.service';

type InternalOptions = QueryExecutionOptions & { maxResultBytes?: number };
type Program = {
  rows: Record<string, unknown>[] | Record<string, unknown>;
  fields?: { name: string }[];
  error?: Error;
  afterEnd?: () => void;
};
const mockControl = {
  query: jest.fn(async () => [[], []]),
  end: jest.fn(async () => {}),
};
jest.mock('mysql2/promise', () => ({
  ...jest.requireActual('mysql2/promise'),
  createConnection: jest.fn(async () => mockControl),
}));
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const bytes = (value: unknown) =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function fixture(programs: Program[]) {
  const streams: Readable[] = [],
    commands: EventEmitter[] = [];
  let produced = 0,
    nativeIndex = 0,
    bufferedIndex = 0;
  const rawQuery = jest.fn((_options: unknown) => {
    const program = programs[nativeIndex++];
    if (!program) throw new Error('Unexpected native dispatch');
    const command = new EventEmitter();
    let initialized = false,
      index = 0;
    const data = Array.isArray(program.rows) ? program.rows : [program.rows];
    const stream = new Readable({
      objectMode: true,
      highWaterMark: 1,
      read() {
        if (!initialized) {
          initialized = true;
          command.emit('fields', program.fields);
          stream.emit('fields', program.fields);
          if (stream.destroyed) return;
          if (program.error) {
            command.emit('error', program.error);
            stream.destroy(program.error);
            command.emit('end');
            return;
          }
        }
        if (index < data.length) {
          produced++;
          this.push(data[index++]);
        } else {
          command.emit('end');
          program.afterEnd?.();
          this.push(null);
        }
      },
    });
    // mysql2 synthesizes stream end on early close: it is not evidence of wire drainage.
    stream.once('close', () => {
      if (!stream.readableEnded) stream.emit('end');
    });
    const query = Object.assign(command, { stream: jest.fn(() => stream) });
    streams.push(stream);
    commands.push(command);
    return query;
  });
  const connection = Object.assign(new EventEmitter(), {
    threadId: 456,
    config: { host: '127.0.0.1' },
    connection: { query: rawQuery },
    query: jest.fn(async (sql: unknown) => {
      if (typeof sql === 'string') return [[], []];
      const program = programs[bufferedIndex++];
      if (!program) throw new Error('Unexpected buffered dispatch');
      if (program.error) throw program.error;
      return [program.rows, program.fields];
    }),
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    ping: jest.fn(async () => {}),
    release: jest.fn(),
    destroy: jest.fn(),
    resume: jest.fn(),
  });
  const pool = {
    getConnection: jest.fn(async () => connection),
    end: jest.fn(),
  };
  const strategy = new MysqlStrategy();
  const execute = (sql: string, options: InternalOptions = {}) =>
    strategy.executeQuery(pool as never, sql, options);
  const batch = (sql: string[], options: InternalOptions = {}) =>
    strategy.runStatementsInTransaction(pool as never, sql, options);
  return {
    connection,
    pool,
    strategy,
    execute,
    batch,
    rawQuery,
    streams,
    commands,
    produced: () => produced,
  };
}

function observe<T>(promise: Promise<T>) {
  let settled = false;
  const outcome = promise.then(
    (value) => {
      settled = true;
      return value;
    },
    (error: unknown) => {
      settled = true;
      return error;
    },
  );
  return { outcome, settled: () => settled };
}

function interactiveService(f: ReturnType<typeof fixture>, type = 'mysql') {
  const freshness = {
    invalidateConnection: jest.fn(async () => {}),
    invalidatePartialWrite: jest.fn(async () => {}),
    buildKey: jest.fn(async () => 'fixture'),
  };
  const service = new QueryService(
    {
      findOne: async () => ({
        id: 'connection',
        userId: 'owner',
        database: 'fixture',
        type,
        allowQueryExecution: true,
      }),
      getPool: async () => f.pool,
    } as never,
    { getStrategy: () => f.strategy } as never,
    { log: jest.fn(async () => {}) } as never,
    freshness as never,
    { get: async () => undefined, set: async () => {} } as never,
    { ensurePermission: async () => {} } as never,
  );
  return { service, freshness };
}

describe('MySQL/MariaDB interactive native result collector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mysql.createConnection as jest.Mock).mockImplementation(
      async () => mockControl,
    );
    mockControl.query.mockImplementation(async () => [[], []]);
    mockControl.end.mockImplementation(async () => {});
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'rejects local Readable interruption-code spoofing (readOnly=%s, otherCommandError=%s)',
    async (readOnly, otherCommandError) => {
      const f = fixture([]),
        command = new EventEmitter();
      const stream = new Readable({ objectMode: true, read() {} });
      f.rawQuery.mockImplementationOnce(() =>
        Object.assign(command, { stream: jest.fn(() => stream) }),
      );
      const local = Object.assign(new TypeError('local readable failure'), {
        code: 'ER_QUERY_INTERRUPTED',
      });
      const native = Object.assign(new Error('different native interruption'), {
        code: 'ER_QUERY_INTERRUPTED',
      });
      const task = observe(
        f.execute('SELECT SLEEP(5)', { maxResultBytes: 1024, readOnly }),
      );
      await tick();
      // The fake command intentionally does not forward its event to this Readable.
      // Even a previously captured different native error must not bless local.
      if (otherCommandError) command.emit('error', native);
      stream.destroy(local);
      expect(await task.outcome).toBe(local);
      expect(f.connection.ping).toHaveBeenCalledTimes(1);
      if (readOnly) expect(f.connection.rollback).toHaveBeenCalledTimes(1);
      expect(f.connection.destroy).toHaveBeenCalledTimes(1);
      expect(f.connection.release).not.toHaveBeenCalled();
      expect(f.pool.end).not.toHaveBeenCalled();
      expect(f.rawQuery).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['single', 'read-only', 'prior-write batch'])(
    'preserves the same healthy session after a budgeted server interruption (%s)',
    async (path) => {
      // Native SERVER ERR interruption commonly omits fatal; omission is not fatal=true.
      const interrupted = Object.assign(
        new Error('Query execution was interrupted'),
        {
          code: 'ER_QUERY_INTERRUPTED',
          errno: 1317,
          sqlState: '70100',
        },
      );
      const f = fixture([
        ...(path === 'prior-write batch'
          ? [{ rows: { affectedRows: 1, serverStatus: 1 } }]
          : []),
        { rows: [], fields: [], error: interrupted },
      ]);
      f.connection.threadId = 102;
      const session = { variable: 'keep-session', temporaryRows: [{ id: 7 }] };
      f.connection.destroy.mockImplementation(() => {
        f.connection.threadId = 104;
        session.variable = 'lost-session';
        session.temporaryRows = [];
      });
      let execution: unknown;
      const onMutation = jest.fn(async () => {});
      const options: InternalOptions = {
        maxResultBytes: 1024,
        readOnly: path === 'read-only',
        onMutation,
        onExecution: (handle) => {
          execution = handle;
        },
      };
      await expect(
        path === 'prior-write batch'
          ? f.batch(
              ['INSERT INTO items VALUES (1)', 'SELECT SLEEP(5)'],
              options,
            )
          : f.execute('SELECT SLEEP(5)', options),
      ).rejects.toBe(interrupted);
      expect(mockControl.query).toHaveBeenCalledWith('KILL QUERY 102');
      expect(mockControl.end).toHaveBeenCalledTimes(1);
      expect(f.connection.ping).toHaveBeenCalledTimes(1);
      if (path !== 'single')
        expect(f.connection.rollback).toHaveBeenCalledTimes(1);
      expect(f.connection.release).toHaveBeenCalledTimes(1);
      expect(f.connection.destroy).not.toHaveBeenCalled();
      const next = await f.pool.getConnection();
      expect(next).toBe(f.connection);
      expect(next.threadId).toBe(102);
      expect(session).toEqual({
        variable: 'keep-session',
        temporaryRows: [{ id: 7 }],
      });
      expect(f.rawQuery).toHaveBeenCalledTimes(
        path === 'prior-write batch' ? 2 : 1,
      );
      expect(f.connection.commit).not.toHaveBeenCalled();
      expect(onMutation).toHaveBeenCalledTimes(
        path === 'prior-write batch' ? 1 : 0,
      );
      expect(await f.strategy.cancelActiveQuery(execution)).toBe(false);
      expect(mockControl.query).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    'fatal interruption',
    'source error',
    'failed ping',
    'failed rollback',
    'overflow',
    'inactivity timeout',
    'local collector error',
    'local collector interruption code',
  ])(
    'still discards a budgeted source when reuse is unsafe (%s)',
    async (kind) => {
      const interrupted = Object.assign(
        new Error('Query execution was interrupted'),
        { code: 'ER_QUERY_INTERRUPTED' },
      );
      const sourceError =
        kind === 'fatal interruption'
          ? Object.assign(interrupted, { fatal: true })
          : kind === 'inactivity timeout'
            ? Object.assign(new Error('Query inactivity timeout'), {
                code: 'PROTOCOL_SEQUENCE_TIMEOUT',
              })
            : interrupted;
      const local = Object.assign(
        new TypeError('Cannot serialize native result'),
        kind === 'local collector interruption code'
          ? { code: 'ER_QUERY_INTERRUPTED' }
          : {},
      );
      const program: Program =
        kind === 'overflow'
          ? { rows: [{ value: 'x'.repeat(2048) }], fields: [{ name: 'value' }] }
          : kind.startsWith('local collector')
            ? {
                rows: [
                  {
                    value: {
                      toJSON: () => {
                        throw local;
                      },
                    },
                  },
                ],
                fields: [{ name: 'value' }],
              }
            : { rows: [], fields: [], error: sourceError };
      const f = fixture([program]);
      if (kind === 'source error')
        f.connection.ping.mockImplementationOnce(async () => {
          f.connection.emit('error', new Error('source transport failed'));
        });
      if (kind === 'failed ping')
        f.connection.ping.mockRejectedValueOnce(
          new Error('wire drainage failed'),
        );
      if (kind === 'failed rollback')
        f.connection.rollback.mockRejectedValueOnce(
          new Error('rollback failed'),
        );
      const task = f.execute('SELECT SLEEP(5)', {
        maxResultBytes: 1024,
        readOnly: kind === 'failed rollback',
      });
      if (kind === 'overflow')
        await expect(task).rejects.toMatchObject({
          code: 'RESULT_BYTE_BUDGET_EXCEEDED',
        });
      else
        await expect(task).rejects.toBe(
          kind.startsWith('local collector') ? local : sourceError,
        );
      expect(f.connection.destroy).toHaveBeenCalledTimes(1);
      expect(f.connection.release).not.toHaveBeenCalled();
      expect(f.pool.end).not.toHaveBeenCalled();
      expect(f.rawQuery).toHaveBeenCalledTimes(1);
    },
  );

  it('holds a safely interrupted budgeted session through pending control and successful drainage', async () => {
    const control = deferred<typeof mockControl>(),
      drained = deferred<void>();
    (mysql.createConnection as jest.Mock).mockImplementationOnce(
      () => control.promise,
    );
    const interrupted = Object.assign(new Error('Query interrupted'), {
      code: 'ER_QUERY_INTERRUPTED',
      fatal: false,
    });
    const f = fixture([{ rows: [], fields: [], error: interrupted }]);
    f.connection.ping.mockImplementationOnce(() => drained.promise);
    let execution: unknown;
    const task = observe(
      f.execute('SELECT SLEEP(5)', {
        maxResultBytes: 1024,
        onExecution: (handle) => {
          execution = handle;
        },
      }),
    );
    try {
      await tick();
      expect(task.settled()).toBe(false);
      expect(f.connection.release).not.toHaveBeenCalled();
      expect(f.connection.destroy).not.toHaveBeenCalled();
      control.resolve(mockControl);
      await tick();
      expect(mockControl.query).toHaveBeenCalledWith('KILL QUERY 456');
      expect(f.connection.ping).toHaveBeenCalledTimes(1);
      expect(task.settled()).toBe(false);
      expect(f.connection.release).not.toHaveBeenCalled();
      drained.resolve();
      expect(await task.outcome).toBe(interrupted);
      expect(f.connection.release).toHaveBeenCalledTimes(1);
      expect(f.connection.destroy).not.toHaveBeenCalled();
      expect(await f.strategy.cancelActiveQuery(execution)).toBe(false);
      expect(mockControl.query).toHaveBeenCalledTimes(1);
    } finally {
      control.resolve(mockControl);
      drained.resolve();
      await task.outcome;
    }
  });

  it('preserves the session when QueryService manual cancellation interrupts its budgeted read-only source', async () => {
    const f = fixture([]),
      command = new EventEmitter();
    const stream = new Readable({ objectMode: true, read() {} });
    f.rawQuery.mockImplementationOnce(() =>
      Object.assign(command, { stream: jest.fn(() => stream) }),
    );
    f.connection.threadId = 102;
    f.connection.destroy.mockImplementation(() => {
      f.connection.threadId = 104;
    });
    const interrupted = Object.assign(
      new Error('Query execution was interrupted'),
      { code: 'ER_QUERY_INTERRUPTED' },
    );
    mockControl.query.mockImplementationOnce(async () => {
      command.emit('error', interrupted);
      stream.destroy(interrupted);
      command.emit('end');
      return [[], []];
    });
    const { service } = interactiveService(f);
    const task = observe(
      service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT SLEEP(5)' },
        'owner',
      ),
    );
    await tick();
    const entry = service.getActiveQueries('owner')[0];
    expect(entry).toBeDefined();
    expect(await service.cancelQuery(entry.queryId, 'owner')).toBe(true);
    expect(await task.outcome).toMatchObject({
      message: expect.stringContaining('Query execution was interrupted'),
    });
    expect(f.connection.query).toHaveBeenCalledWith(
      'START TRANSACTION READ ONLY',
    );
    expect(f.connection.rollback).toHaveBeenCalledTimes(1);
    expect(f.connection.release).toHaveBeenCalledTimes(1);
    expect(f.connection.destroy).not.toHaveBeenCalled();
    expect((await f.pool.getConnection()).threadId).toBe(102);
    expect(mockControl.query).toHaveBeenCalledWith('KILL QUERY 102');
    expect(mockControl.query).toHaveBeenCalledTimes(1);
    expect(f.rawQuery).toHaveBeenCalledTimes(1);
    expect(service.getActiveQueries('owner')).toEqual([]);
  });

  it.each([
    { row: { text: 'é😀漢字' }, name: 'text' },
    { row: { binary: Buffer.from([0, 9, 100, 255]) }, name: 'binary' },
  ])(
    'collects the exact JSON boundary, preserves fields and releases once (%p)',
    async ({ row, name }) => {
      const expected = { rows: [row], columns: [name] };
      const f = fixture([{ rows: [row], fields: [{ name }] }]);
      const result = await f.execute('SELECT * FROM items', {
        maxResultBytes: bytes(expected),
        limit: 3,
        offset: 2,
      });
      expect(result).toMatchObject(expected);
      expect(f.rawQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringMatching(/LIMIT 3.*OFFSET 2/),
          timeout: 30000,
        }),
      );
      expect(f.connection.query).not.toHaveBeenCalled();
      expect(f.connection.release).toHaveBeenCalledTimes(1);
      expect(f.connection.destroy).not.toHaveBeenCalled();
    },
  );

  it('retains field names for an empty native result', async () => {
    const f = fixture([{ rows: [], fields: [{ name: 'empty_alias' }] }]);
    expect(
      await f.execute('SELECT 1 WHERE FALSE', { maxResultBytes: 1024 }),
    ).toMatchObject({ rows: [], columns: ['empty_alias'] });
    expect(f.connection.release).toHaveBeenCalledTimes(1);
  });

  it('preserves affectedRows for a successful native mutation', async () => {
    const f = fixture([{ rows: { affectedRows: 7, serverStatus: 2 } }]);
    expect(
      await f.execute('UPDATE items SET seen=1', { maxResultBytes: 1024 }),
    ).toMatchObject({ rows: [], columns: [], rowCount: 7 });
    expect(f.rawQuery).toHaveBeenCalledTimes(1);
    expect(f.connection.release).toHaveBeenCalledTimes(1);
  });

  it('stops early on overflow, never silently truncates, and destroys only the leased source', async () => {
    const rows = Array.from({ length: 200 }, (_, id) => ({
      id,
      value: 'é😀'.repeat(20),
    }));
    const f = fixture([{ rows, fields: [{ name: 'id' }, { name: 'value' }] }]);
    await expect(
      f.execute('SELECT * FROM items', { maxResultBytes: 256 }),
    ).rejects.toThrow(/byte budget|payload budget/i);
    expect(f.produced()).toBeLessThan(10);
    expect(f.streams[0].destroyed).toBe(true);
    expect(mockControl.query).toHaveBeenCalledWith('KILL QUERY 456');
    expect(f.connection.ping).toHaveBeenCalledTimes(1);
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.connection.release).not.toHaveBeenCalled();
    expect(f.pool.end).not.toHaveBeenCalled();
    expect(f.connection.query).not.toHaveBeenCalled();
    expect(f.rawQuery).toHaveBeenCalledTimes(1);
  });

  it('retains the source until both delayed cancellation and wire drainage finish despite stream close/end', async () => {
    const control = deferred<typeof mockControl>(),
      drained = deferred<void>();
    (mysql.createConnection as jest.Mock).mockImplementationOnce(
      () => control.promise,
    );
    const f = fixture([
      { rows: [{ value: 'x'.repeat(1024) }], fields: [{ name: 'value' }] },
    ]);
    f.connection.ping.mockImplementationOnce(() => drained.promise);
    const task = observe(
      f.execute('SELECT * FROM items', { maxResultBytes: 64 }),
    );
    try {
      await tick();
      expect(f.streams[0]?.destroyed).toBe(true);
      expect(task.settled()).toBe(false);
      expect(f.connection.release).not.toHaveBeenCalled();
      expect(f.connection.destroy).not.toHaveBeenCalled();
      control.resolve(mockControl);
      await tick();
      expect(f.connection.ping).toHaveBeenCalledTimes(1);
      expect(task.settled()).toBe(false);
      expect(f.connection.destroy).not.toHaveBeenCalled();
      // A late native error after stream destruction must still have a safe listener.
      expect(() =>
        f.commands[0].emit('error', new Error('late wire cancellation')),
      ).not.toThrow();
      drained.resolve();
      const error = await task.outcome;
      expect(error).toMatchObject({ code: 'RESULT_BYTE_BUDGET_EXCEEDED' });
      expect(f.connection.destroy).toHaveBeenCalledTimes(1);
      expect(f.connection.release).not.toHaveBeenCalled();
    } finally {
      control.resolve(mockControl);
      drained.resolve();
      await task.outcome;
    }
  });

  it.each(['single', 'read-only'])(
    'defensively drains the mocked SDK push-false-after-destroy branch (%s)',
    async (path) => {
      // Exercise mysql2's installed Readable implementation, with no socket or DB.
      // Its onResult may pause after push() synchronously destroys/resumes the stream.
      const nativeMysql = jest.requireActual<{
        createQuery: (
          sql: string,
          values: undefined,
          callback: undefined,
          config: object,
        ) => EventEmitter & { stream: (options?: object) => Readable };
      }>('mysql2');
      const f = fixture([]);
      let paused = false,
        finishPing: (() => void) | undefined;
      f.connection.resume.mockImplementation(() => {
        paused = false;
        finishPing?.();
      });
      f.connection.ping.mockImplementationOnce(() =>
        paused
          ? new Promise<void>((resolve) => {
              finishPing = resolve;
            })
          : Promise.resolve(),
      );
      const command = Object.assign(
        nativeMysql.createQuery('SELECT 1', undefined, undefined, {}),
        {
          _connection: {
            pause: () => {
              paused = true;
            },
            resume: () => f.connection.resume(),
          },
        },
      );
      const nativeStream = command.stream.bind(command);
      command.stream = (options) => {
        const stream = nativeStream(options);
        const push = stream.push.bind(stream);
        // Drive mysql2's documented backpressure-false branch after consumer
        // destruction; Node versions need not return the same value by default.
        jest.spyOn(stream, 'push').mockImplementation((chunk, encoding) => {
          const accepted = push(chunk, encoding);
          return stream.destroyed ? false : accepted;
        });
        return stream;
      };
      f.rawQuery.mockImplementationOnce(
        () => command as unknown as ReturnType<typeof f.rawQuery>,
      );
      const task = observe(
        f.execute('SELECT 1', {
          maxResultBytes: 64,
          readOnly: path === 'read-only',
        }),
      );
      try {
        await tick();
        command.emit('fields', [{ name: 'value' }]);
        command.emit('result', { value: 'x'.repeat(1024) }, 0);
        expect(paused).toBe(true);
        await tick();
        expect(task.settled()).toBe(true);
        expect(await task.outcome).toMatchObject({
          code: 'RESULT_BYTE_BUDGET_EXCEEDED',
        });
        expect(paused).toBe(false);
        expect(f.connection.destroy).toHaveBeenCalledTimes(1);
        expect(f.connection.release).not.toHaveBeenCalled();
        expect(f.pool.end).not.toHaveBeenCalled();
      } finally {
        f.connection.resume();
        finishPing?.();
        await task.outcome;
      }
    },
  );

  it.each(['single', 'read-only'])(
    'cleans up overflow using the default installed mysql2 stream (%s)',
    async (path) => {
      const nativeMysql = jest.requireActual<{
        createQuery: (
          sql: string,
          values: undefined,
          callback: undefined,
          config: object,
        ) => EventEmitter & { stream: (options?: object) => Readable };
      }>('mysql2');
      const f = fixture([]);
      const command = Object.assign(
        nativeMysql.createQuery('SELECT 1', undefined, undefined, {}),
        {
          _connection: {
            pause: jest.fn(),
            resume: () => f.connection.resume(),
          },
        },
      );
      f.rawQuery.mockImplementationOnce(
        () => command as unknown as ReturnType<typeof f.rawQuery>,
      );
      const task = observe(
        f.execute('SELECT 1', {
          maxResultBytes: 64,
          readOnly: path === 'read-only',
        }),
      );
      await tick();
      command.emit('fields', [{ name: 'value' }]);
      command.emit('result', { value: 'x'.repeat(1024) }, 0);
      expect(await task.outcome).toMatchObject({
        code: 'RESULT_BYTE_BUDGET_EXCEEDED',
      });
      expect(mockControl.query).toHaveBeenCalledWith('KILL QUERY 456');
      expect(f.connection.ping).toHaveBeenCalledTimes(1);
      expect(f.connection.destroy).toHaveBeenCalledTimes(1);
      expect(f.connection.release).not.toHaveBeenCalled();
      if (path === 'read-only')
        expect(f.connection.rollback).toHaveBeenCalledTimes(1);
    },
  );

  it('retains the existing 50,000-row secondary cap on small native rows', async () => {
    const f = fixture([
      { rows: new Array(50001).fill({ id: 1 }), fields: [{ name: 'id' }] },
    ]);
    const result = await f.execute('SELECT * FROM items', {
      maxResultBytes: 1024 * 1024,
    });
    expect(result.rows).toHaveLength(50000);
    expect(f.connection.release).toHaveBeenCalledTimes(1);
  });

  it('streams every transaction statement while applying requested pagination only to the final read', async () => {
    const f = fixture([
      { rows: [{ first: 1 }], fields: [{ name: 'first' }] },
      { rows: [{ final: 2 }], fields: [{ name: 'final' }] },
    ]);
    expect(
      await f.batch(['SELECT first FROM items', 'SELECT final FROM items'], {
        maxResultBytes: 1024,
        limit: 5,
        offset: 7,
      }),
    ).toMatchObject({ rows: [{ final: 2 }], columns: ['final'] });
    expect(
      f.rawQuery.mock.calls.map(
        ([options]) => (options as { sql: string }).sql,
      ),
    ).toEqual([
      'SELECT first FROM items LIMIT 50000;',
      'SELECT final FROM items LIMIT 5 OFFSET 7;',
    ]);
    expect(f.connection.commit).toHaveBeenCalledTimes(1);
    expect(f.connection.release).toHaveBeenCalledTimes(1);
    expect(f.connection.query).not.toHaveBeenCalled();
  });

  it('applies early collection to the read-only transaction path and rolls back before discarding', async () => {
    const onMutation = jest.fn(async () => {});
    const f = fixture([
      { rows: [{ value: 'x'.repeat(1024) }], fields: [{ name: 'value' }] },
    ]);
    await expect(
      f.execute('SELECT * FROM items', {
        maxResultBytes: 64,
        readOnly: true,
        onMutation,
      }),
    ).rejects.toThrow(/byte budget|payload budget/i);
    expect(f.connection.query).toHaveBeenCalledWith(
      'START TRANSACTION READ ONLY',
    );
    expect(f.rawQuery).toHaveBeenCalledTimes(1);
    expect(f.connection.rollback).toHaveBeenCalledTimes(1);
    expect(f.connection.commit).not.toHaveBeenCalled();
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.connection.release).not.toHaveBeenCalled();
    expect(onMutation).not.toHaveBeenCalled();
    expect(f.connection.rollback.mock.invocationCallOrder[0]).toBeLessThan(
      f.connection.destroy.mock.invocationCallOrder[0],
    );
  });

  it('invalidates a partial implicit-commit batch even when the final read overflows', async () => {
    const onMutation = jest.fn(async () => {});
    const f = fixture([
      { rows: { affectedRows: 1, serverStatus: 1 } },
      { rows: { affectedRows: 0, serverStatus: 0 } },
      { rows: [{ value: 'x'.repeat(1024) }], fields: [{ name: 'value' }] },
    ]);
    await expect(
      f.batch(
        [
          'INSERT INTO items VALUES (1)',
          'CREATE TABLE created(id int)',
          'SELECT * FROM items',
        ],
        { maxResultBytes: 64, onMutation },
      ),
    ).rejects.toThrow(/byte budget|payload budget/i);
    expect(onMutation.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(f.connection.rollback).toHaveBeenCalledTimes(1);
    expect(f.connection.commit).not.toHaveBeenCalled();
    expect(f.rawQuery).toHaveBeenCalledTimes(3);
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(['single', 'transaction'])(
    'invalidates an uncertain write when collection fails before completedWrite is set (%s)',
    async (path) => {
      const onMutation = jest.fn(async () => {});
      const f = fixture([
        {
          rows: [{ returned: 'x'.repeat(1024) }],
          fields: [{ name: 'returned' }],
        },
      ]);
      const options: InternalOptions = { maxResultBytes: 64, onMutation };
      const task =
        path === 'single'
          ? f.execute('CALL writes_and_returns_rows()', options)
          : f.batch(['CALL writes_and_returns_rows()'], options);
      await expect(task).rejects.toThrow(/inspect.*writes|writes.*inspect/i);
      expect(onMutation).toHaveBeenCalledTimes(1);
      expect(f.rawQuery).toHaveBeenCalledTimes(1);
      expect(f.connection.commit).not.toHaveBeenCalled();
      if (path === 'transaction')
        expect(f.connection.rollback).toHaveBeenCalledTimes(1);
      expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['single', 'transaction'])(
    'does not imply a write failed when affectedRows metadata itself exceeds the budget (%s)',
    async (path) => {
      const onMutation = jest.fn(async () => {});
      const f = fixture([{ rows: { affectedRows: 1, serverStatus: 0 } }]);
      const options: InternalOptions = { maxResultBytes: 24, onMutation };
      await expect(
        path === 'single'
          ? f.execute('INSERT INTO items VALUES (1)', options)
          : f.batch(['INSERT INTO items VALUES (1)'], options),
      ).rejects.toThrow(/byte budget|payload budget/i);
      expect(onMutation).toHaveBeenCalledTimes(1);
      expect(f.rawQuery).toHaveBeenCalledTimes(1);
      expect(f.connection.release).not.toHaveBeenCalled();
      expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves the budget error if cache invalidation or rollback also fails', async () => {
    const f = fixture([
      { rows: [{ value: 'x'.repeat(1024) }], fields: [{ name: 'value' }] },
    ]);
    f.connection.rollback.mockRejectedValueOnce(new Error('rollback failed'));
    await expect(
      f.batch(['CALL writes_and_returns_rows()'], {
        maxResultBytes: 64,
        onMutation: async () => {
          throw new Error('cache unavailable');
        },
      }),
    ).rejects.toMatchObject({ code: 'RESULT_BYTE_BUDGET_EXCEEDED' });
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.connection.release).not.toHaveBeenCalled();
  });

  it('drains a native stream inactivity timeout before discarding the source (R07)', async () => {
    const timeout = Object.assign(new Error('Query inactivity timeout'), {
      code: 'PROTOCOL_SEQUENCE_TIMEOUT',
    });
    const f = fixture([{ rows: [], fields: [], error: timeout }]);
    await expect(f.execute('SELECT 1', { maxResultBytes: 1024 })).rejects.toBe(
      timeout,
    );
    expect(mockControl.query).toHaveBeenCalledWith('KILL QUERY 456');
    expect(f.connection.ping).toHaveBeenCalledTimes(1);
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.connection.release).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'validates internal budget %p before leasing or dispatching',
    async (maxResultBytes) => {
      const f = fixture([{ rows: [], fields: [] }]);
      await expect(f.execute('SELECT 1', { maxResultBytes })).rejects.toThrow(
        RangeError,
      );
      expect(f.pool.getConnection).not.toHaveBeenCalled();
      expect(f.rawQuery).not.toHaveBeenCalled();
      expect(f.connection.query).not.toHaveBeenCalled();
    },
  );

  it('does not silently use the buffered path if a budgeted source lacks native streaming', async () => {
    const f = fixture([{ rows: [], fields: [] }]);
    (f.connection as unknown as { connection?: unknown }).connection =
      undefined;
    await expect(
      f.execute('SELECT 1', { maxResultBytes: 1024 }),
    ).rejects.toThrow(/native|stream/i);
    expect(f.connection.query).not.toHaveBeenCalled();
    expect(f.connection.release).toHaveBeenCalledTimes(1);
  });

  it('holds a completed budgeted source while a late cancellation control is still pending (R07)', async () => {
    const control = deferred<typeof mockControl>();
    (mysql.createConnection as jest.Mock).mockImplementationOnce(
      () => control.promise,
    );
    const f = fixture([]),
      command = new EventEmitter();
    const stream = new Readable({ objectMode: true, read() {} });
    f.rawQuery.mockImplementationOnce(() =>
      Object.assign(command, { stream: jest.fn(() => stream) }),
    );
    let execution: unknown;
    const task = f.execute('SELECT 1', {
      maxResultBytes: 1024,
      onExecution: (handle) => {
        execution = handle;
      },
    });
    let cancellation: Promise<boolean> | undefined;
    try {
      await tick();
      expect(execution).toBeDefined();
      cancellation = f.strategy.cancelActiveQuery(execution);
      await tick();
      command.emit('fields', [{ name: 'value' }]);
      stream.push({ value: 1 });
      command.emit('end');
      stream.push(null);
      await tick();
      expect(f.connection.release).not.toHaveBeenCalled();
      expect(f.connection.destroy).not.toHaveBeenCalled();
      control.resolve(mockControl);
      expect(await cancellation).toBe(false);
      await expect(task).resolves.toMatchObject({
        rows: [{ value: 1 }],
        columns: ['value'],
      });
      expect(mockControl.query).not.toHaveBeenCalled();
      expect(f.connection.release).toHaveBeenCalledTimes(1);
      expect(await f.strategy.cancelActiveQuery(execution)).toBe(false);
    } finally {
      stream.push(null);
      control.resolve(mockControl);
      await cancellation;
      await task;
    }
  });

  it('stops at oversized field metadata before retaining a row', async () => {
    const f = fixture([
      { rows: [{ value: 1 }], fields: [{ name: 'x'.repeat(1024) }] },
    ]);
    await expect(
      f.execute('SELECT 1', { maxResultBytes: 64 }),
    ).rejects.toMatchObject({ code: 'RESULT_BYTE_BUDGET_EXCEEDED' });
    expect(f.produced()).toBe(0);
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.connection.release).not.toHaveBeenCalled();
  });

  it('never reaches a later mutation when an earlier read exceeds the budget', async () => {
    const onMutation = jest.fn(async () => {});
    const f = fixture([
      { rows: [{ value: 'x'.repeat(1024) }], fields: [{ name: 'value' }] },
      { rows: { affectedRows: 1, serverStatus: 0 } },
    ]);
    await expect(
      f.batch(['SELECT * FROM items', 'INSERT INTO items VALUES (1)'], {
        maxResultBytes: 64,
        onMutation,
      }),
    ).rejects.toMatchObject({ code: 'RESULT_BYTE_BUDGET_EXCEEDED' });
    expect(f.rawQuery).toHaveBeenCalledTimes(1);
    expect(onMutation).not.toHaveBeenCalled();
    expect(f.connection.rollback).toHaveBeenCalledTimes(1);
    expect(f.connection.commit).not.toHaveBeenCalled();
  });

  it.each(['mysql', 'mariadb'])(
    'wires native single/batch overflow to QueryService invalidation exactly once, without replay (%s)',
    async (type) => {
      for (const sql of [
        'CALL writes_and_returns_rows()',
        'CALL writes_and_returns_rows(); SELECT 1',
      ]) {
        const f = fixture([
          {
            rows: [{ value: 'x'.repeat(32 * 1024 * 1024) }],
            fields: [{ name: 'value' }],
          },
        ]);
        const { service, freshness } = interactiveService(f, type);
        await expect(
          service.executeQuery(
            { connectionId: 'connection', sql, confirmed: true },
            'owner',
          ),
        ).rejects.toMatchObject({
          code: 'RESULT_BYTE_BUDGET_EXCEEDED',
          maxResultBytes: 32 * 1024 * 1024,
        });
        expect(f.rawQuery).toHaveBeenCalledTimes(1);
        expect(freshness.invalidateConnection).toHaveBeenCalledTimes(1);
        expect(freshness.invalidateConnection).toHaveBeenCalledWith(
          'connection',
          'fixture',
        );
        expect(f.connection.destroy).toHaveBeenCalledTimes(1);
        expect(f.connection.release).not.toHaveBeenCalled();
        expect(f.connection.commit).not.toHaveBeenCalled();
      }
    },
  );

  it('enforces table-window overflow inside the native read-only transaction', async () => {
    const f = fixture([
      {
        rows: [{ value: 'x'.repeat(32 * 1024 * 1024) }],
        fields: [{ name: 'value' }],
      },
    ]);
    const { service, freshness } = interactiveService(f, 'mariadb');
    await expect(
      service.fetchTableWindow(
        {
          connectionId: 'connection',
          table: 'items',
          sortBy: 'id',
          includeTotalCount: false,
        },
        'owner',
      ),
    ).rejects.toMatchObject({ code: 'RESULT_BYTE_BUDGET_EXCEEDED' });
    expect(f.rawQuery).toHaveBeenCalledTimes(1);
    expect(f.connection.query).toHaveBeenCalledWith(
      'START TRANSACTION READ ONLY',
    );
    expect(f.connection.rollback).toHaveBeenCalledTimes(1);
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.connection.release).not.toHaveBeenCalled();
    expect(freshness.invalidateConnection).not.toHaveBeenCalled();
  });

  it('does not dispatch or signal a write when even an empty payload cannot fit', async () => {
    const f = fixture([{ rows: { affectedRows: 1, serverStatus: 0 } }]);
    const onMutation = jest.fn(async () => {});
    await expect(
      f.execute('INSERT INTO items VALUES (1)', {
        maxResultBytes: 1,
        onMutation,
      }),
    ).rejects.toMatchObject({ code: 'RESULT_BYTE_BUDGET_EXCEEDED' });
    expect(f.rawQuery).not.toHaveBeenCalled();
    expect(f.connection.query).not.toHaveBeenCalled();
    expect(onMutation).not.toHaveBeenCalled();
    expect(f.connection.destroy).toHaveBeenCalledTimes(1);
    expect(f.connection.release).not.toHaveBeenCalled();
    expect(mockControl.query).not.toHaveBeenCalled();
  });

  it.each(['after BEGIN', 'after first result', 'before COMMIT'])(
    'checks the request wall clock immediately before more native work (%s)',
    async (phase) => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      const expire = () => jest.setSystemTime(Date.now() + 101);
      const f = fixture([
        {
          rows: [{ value: 1 }],
          fields: [{ name: 'value' }],
          ...(phase !== 'after BEGIN' ? { afterEnd: expire } : {}),
        },
        { rows: [{ value: 2 }], fields: [{ name: 'value' }] },
      ]);
      const { service } = interactiveService(f);
      const timeout = jest
        .spyOn(
          service as unknown as { getQueryTimeoutMs: () => number },
          'getQueryTimeoutMs',
        )
        .mockReturnValue(100);
      if (phase === 'after BEGIN')
        f.connection.query.mockImplementationOnce(async () => {
          expire();
          return [[], []];
        });
      const sql =
        phase === 'after first result' ? 'SELECT 1; SELECT 2' : 'SELECT 1';
      const task = observe(
        service.executeQuery({ connectionId: 'connection', sql }, 'owner'),
      );
      try {
        await task.outcome;
        expect(f.rawQuery).toHaveBeenCalledTimes(
          phase === 'after BEGIN' ? 0 : 1,
        );
        expect(f.connection.commit).not.toHaveBeenCalled();
        expect(f.connection.rollback).toHaveBeenCalledTimes(1);
        expect(await task.outcome).toMatchObject({
          message: expect.stringMatching(/deadline|maximum execution time/i),
        });
        expect(service.getActiveQueries('owner')).toEqual([]);
      } finally {
        timeout.mockRestore();
        jest.useRealTimers();
      }
    },
  );

  it.each(['timeout', 'abort', 'manual'])(
    'settles a warm native acquisition before a handle exists and safely releases its late lease (%s)',
    async (reason) => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      const f = fixture([{ rows: [], fields: [] }]),
        acquisition = deferred<typeof f.connection>();
      f.pool.getConnection.mockImplementationOnce(() => acquisition.promise);
      const { service } = interactiveService(f),
        abort = new AbortController();
      const timeout = jest
        .spyOn(
          service as unknown as { getQueryTimeoutMs: () => number },
          'getQueryTimeoutMs',
        )
        .mockReturnValue(100);
      const task = observe(
        service.executeQuery(
          { connectionId: 'connection', sql: 'SELECT 1' },
          'owner',
          abort.signal,
        ),
      );
      try {
        await tick();
        expect(f.pool.getConnection).toHaveBeenCalledTimes(1);
        expect(service.getActiveQueries('owner')).toHaveLength(1);
        if (reason === 'timeout') await jest.advanceTimersByTimeAsync(101);
        else if (reason === 'abort') abort.abort();
        else
          expect(
            await service.cancelQuery(
              service.getActiveQueries('owner')[0].queryId,
              'owner',
            ),
          ).toBe(true);
        await tick();
        expect(task.settled()).toBe(true);
        expect(service.getActiveQueries('owner')).toEqual([]);
        expect(f.connection.release).not.toHaveBeenCalled();
        expect(mockControl.query).not.toHaveBeenCalled();
      } finally {
        acquisition.resolve(f.connection);
        await task.outcome;
        await tick();
        timeout.mockRestore();
        jest.useRealTimers();
      }
      expect(f.rawQuery).not.toHaveBeenCalled();
      expect(f.connection.query).not.toHaveBeenCalled();
      expect(f.connection.commit).not.toHaveBeenCalled();
      expect(f.connection.release).toHaveBeenCalledTimes(1);
      expect(f.connection.destroy).not.toHaveBeenCalled();
    },
  );

  it.each(['field names', 'headers', 'row groups'])(
    'rejects aggregate retained multi-results during collection, not after buffering (%s)',
    async (kind) => {
      const f = fixture([]),
        command = new EventEmitter();
      const stream = new Readable({ objectMode: true, read() {} });
      f.rawQuery.mockImplementationOnce(() =>
        Object.assign(command, { stream: jest.fn(() => stream) }),
      );
      const limit = kind === 'field names' ? 64 : 128;
      const task = observe(
        f.execute('CALL returns_result_sets()', { maxResultBytes: limit }),
      );
      try {
        await tick();
        for (let i = 0; i < 2; i++) {
          command.emit(
            'fields',
            kind === 'headers' ? undefined : [{ name: 'x'.repeat(30) }],
          );
          if (kind === 'headers')
            stream.push({
              affectedRows: 1,
              serverStatus: 0,
              info: 'x'.repeat(20),
            });
          if (kind === 'row groups') stream.push({ value: 'x'.repeat(10) });
        }
        await tick();
        expect(task.settled()).toBe(true);
        expect(await task.outcome).toMatchObject({
          code: 'RESULT_BYTE_BUDGET_EXCEEDED',
        });
        expect(f.connection.destroy).toHaveBeenCalledTimes(1);
        expect(f.connection.release).not.toHaveBeenCalled();
        // A routine's undefined-fields / ResultSetHeader tail must not undo overflow.
        command.emit('fields', undefined);
        stream.push({ affectedRows: 0, serverStatus: 0 });
      } finally {
        if (!stream.destroyed) stream.push(null);
        await task.outcome;
      }
    },
  );

  it('preserves every retained row group in the existing multi-result tuple when within budget', async () => {
    const f = fixture([]),
      command = new EventEmitter();
    const stream = new Readable({ objectMode: true, read() {} });
    f.rawQuery.mockImplementationOnce(() =>
      Object.assign(command, { stream: jest.fn(() => stream) }),
    );
    const task = f.execute('CALL returns_result_sets()', {
      maxResultBytes: 512,
    });
    await tick();
    command.emit('fields', [{ name: 'first' }]);
    stream.push({ first: 1 });
    command.emit('fields', [{ name: 'second' }]);
    stream.push({ second: 2 });
    stream.push(null);
    await expect(task).resolves.toMatchObject({
      rows: [[{ first: 1 }], [{ second: 2 }]],
      columns: [undefined, undefined],
    });
    expect(f.connection.release).toHaveBeenCalledTimes(1);
  });

  it('keeps absent-budget internal and export contracts unchanged', async () => {
    const large = { value: 'x'.repeat(32 * 1024 * 1024) };
    const f = fixture([{ rows: [large], fields: [{ name: 'value' }] }]);
    expect(await f.execute('SELECT * FROM items')).toMatchObject({
      rows: [large],
      columns: ['value'],
    });
    expect(f.rawQuery).not.toHaveBeenCalled();
    expect(f.connection.query).toHaveBeenCalledTimes(1);
    const exported = (await f.strategy.exportStream(
      f.pool as never,
      'app',
      'items',
    )) as Readable;
    const rows: unknown[] = [];
    for await (const row of exported) rows.push(row);
    expect(rows).toEqual([large]);
    expect(f.rawQuery).toHaveBeenCalledWith('SELECT * FROM `app`.`items`');
    expect(f.connection.release).toHaveBeenCalledTimes(2);
  });
});
