import { QueryService } from './query.service';
import type { QueryExecutionHandle } from '../database-strategies/database-strategy.interface';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const MAX_BYTES = 32 * 1024 * 1024;

function setup(type = 'postgres') {
  const pool = {};
  const acquisition = deferred<unknown>();
  const handle = { cancel: jest.fn(async () => true) };
  const result = {
    rows: [] as Record<string, unknown>[],
    columns: [] as string[],
  };
  const strategy = {
    executeQuery: jest.fn(
      async (
        _pool: unknown,
        _sql: string,
        options?: { onExecution?: (handle: QueryExecutionHandle) => void },
      ) => {
        options?.onExecution?.(handle);
        return result;
      },
    ),
    runStatementsInTransaction: jest.fn(async () => result),
    cancelActiveQuery: jest.fn(async (execution: QueryExecutionHandle) =>
      execution.cancel(),
    ),
    quoteTable: (_schema: string | undefined, table: string) => `"${table}"`,
    quoteIdentifier: (name: string) => `"${name}"`,
    getColumns: jest.fn(async () => []),
  };
  const connections = {
    findOne: jest.fn(async () => ({
      id: 'connection',
      userId: 'owner',
      type,
      database: 'fixture',
      allowQueryExecution: true,
      readOnly: false,
    })),
    getPool: jest.fn(() => acquisition.promise),
  };
  const freshness = {
    buildKey: jest.fn(async () => 'budget-fixture'),
    invalidateConnection: jest.fn(async () => {}),
    invalidatePartialWrite: jest.fn(async () => {}),
  };
  const audit = { log: jest.fn(async () => {}) };
  const cache = {
    get: jest.fn(async (): Promise<unknown> => undefined),
    set: jest.fn(async () => {}),
  };
  const service = new QueryService(
    connections as never,
    { getStrategy: () => strategy } as never,
    audit as never,
    freshness as never,
    cache as never,
    { ensurePermission: jest.fn(async () => {}) } as never,
  );
  jest
    .spyOn(
      service as unknown as { getQueryTimeoutMs: () => number },
      'getQueryTimeoutMs',
    )
    .mockReturnValue(100);
  return {
    service,
    connections,
    strategy,
    freshness,
    audit,
    cache,
    acquisition,
    pool,
    handle,
    result,
  };
}

function observe<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: unknown } = { settled: false };
  const outcome = promise.then(
    (value) => {
      state.settled = true;
      state.value = value;
      return value;
    },
    (error: unknown) => {
      state.settled = true;
      state.value = error;
      return error;
    },
  );
  return { state, outcome };
}

describe('interactive acquisition deadline and payload budget', () => {
  beforeEach(() =>
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }),
  );
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('registers before shared pool acquisition and times out just this waiter', async () => {
    const f = setup();
    const task = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
      ),
    );
    try {
      await tick();
      expect(f.connections.getPool).toHaveBeenCalledWith(
        'connection',
        'fixture',
        'owner',
      );
      expect(f.service.getActiveQueries('owner')).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(101);
      expect(task.state.settled).toBe(true);
      expect(task.state.value).toMatchObject({
        message: expect.stringMatching(/maximum execution time|deadline/i),
      });
      expect(f.service.getActiveQueries('owner')).toEqual([]);
      expect(f.strategy.executeQuery).not.toHaveBeenCalled();
      expect(f.strategy.cancelActiveQuery).not.toHaveBeenCalled();
    } finally {
      f.acquisition.resolve(f.pool);
      await task.outcome;
    }
    expect(f.strategy.executeQuery).not.toHaveBeenCalled();
  });

  it('does not acquire or dispatch a pre-aborted request', async () => {
    const f = setup(),
      abort = new AbortController();
    abort.abort();
    await expect(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
        abort.signal,
      ),
    ).rejects.toThrow(/abort/i);
    expect(f.connections.findOne).not.toHaveBeenCalled();
    expect(f.connections.getPool).not.toHaveBeenCalled();
    expect(f.strategy.executeQuery).not.toHaveBeenCalled();
  });

  it('rechecks an abort that arrives during authorization before starting acquisition', async () => {
    const f = setup(),
      abort = new AbortController();
    const authorize =
      deferred<Awaited<ReturnType<typeof f.connections.findOne>>>();
    const connection = await f.connections.findOne();
    f.connections.findOne.mockImplementationOnce(() => authorize.promise);
    const task = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
        abort.signal,
      ),
    );
    abort.abort();
    authorize.resolve(connection);
    try {
      await tick();
      expect(task.state.settled).toBe(true);
      expect(task.state.value).toMatchObject({
        message: expect.stringMatching(/abort/i),
      });
      expect(f.connections.getPool).not.toHaveBeenCalled();
    } finally {
      f.acquisition.resolve(f.pool);
      await task.outcome;
    }
  });

  it('rejects an aborted acquisition promptly without cancelling shared creation', async () => {
    const f = setup(),
      abort = new AbortController();
    const task = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
        abort.signal,
      ),
    );
    try {
      await tick();
      abort.abort();
      await tick();
      expect(task.state.settled).toBe(true);
      expect(task.state.value).toMatchObject({
        message: expect.stringMatching(/abort/i),
      });
      expect(f.service.getActiveQueries('owner')).toEqual([]);
      expect(f.strategy.cancelActiveQuery).not.toHaveBeenCalled();
    } finally {
      f.acquisition.resolve(f.pool);
      await task.outcome;
    }
    expect(f.strategy.executeQuery).not.toHaveBeenCalled();
  });

  it('lets an owner manually cancel the pending acquisition', async () => {
    const f = setup();
    const task = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
      ),
    );
    try {
      await tick();
      const entry = f.service.getActiveQueries('owner')[0];
      expect(entry).toBeDefined();
      await expect(
        f.service.cancelQuery(entry.queryId, 'other'),
      ).rejects.toThrow('own queries');
      expect(await f.service.cancelQuery(entry.queryId, 'owner')).toBe(true);
      await tick();
      expect(task.state.settled).toBe(true);
      expect(task.state.value).toMatchObject({
        message: expect.stringMatching(/cancel/i),
      });
      expect(f.strategy.cancelActiveQuery).not.toHaveBeenCalled();
    } finally {
      f.acquisition.resolve(f.pool);
      await task.outcome;
    }
    expect(f.strategy.executeQuery).not.toHaveBeenCalled();
  });

  it('does not poison a second waiter on the same pool promise', async () => {
    const f = setup(),
      abort = new AbortController();
    const first = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
        abort.signal,
      ),
    );
    const second = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 2' },
        'owner',
      ),
    );
    try {
      await tick();
      abort.abort();
      await tick();
      expect(first.state.settled).toBe(true);
      expect(second.state.settled).toBe(false);
      f.acquisition.resolve(f.pool);
      await second.outcome;
      expect(second.state.value).toMatchObject({ rows: [], columns: [] });
      expect(f.strategy.executeQuery).toHaveBeenCalledTimes(1);
      expect(f.strategy.executeQuery.mock.calls[0][1]).toBe('SELECT 2');
      expect(f.strategy.cancelActiveQuery).not.toHaveBeenCalled();
    } finally {
      f.acquisition.resolve(f.pool);
      await Promise.all([first.outcome, second.outcome]);
    }
  });

  it('checks elapsed time even when the acquisition promise wins before the timer callback', async () => {
    const f = setup();
    const task = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
      ),
    );
    await tick();
    jest.setSystemTime(Date.now() + 101);
    f.acquisition.resolve(f.pool);
    await task.outcome;
    expect(task.state.value).toMatchObject({
      message: expect.stringMatching(/maximum execution time|deadline/i),
    });
    expect(f.strategy.executeQuery).not.toHaveBeenCalled();
  });

  it('deducts acquisition time and keeps an active source registered until drainage (R07)', async () => {
    const f = setup(),
      driver = deferred<typeof f.result>();
    f.strategy.executeQuery.mockImplementationOnce(
      async (_pool, _sql, options) => {
        options?.onExecution?.(f.handle);
        return driver.promise;
      },
    );
    const task = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
      ),
    );
    try {
      await tick();
      await jest.advanceTimersByTimeAsync(80);
      f.acquisition.resolve(f.pool);
      await tick();
      await jest.advanceTimersByTimeAsync(21);
      expect(f.strategy.cancelActiveQuery).toHaveBeenCalledWith(f.handle);
      expect(task.state.settled).toBe(false);
      expect(f.service.getActiveQueries('owner')).toHaveLength(1);
      driver.reject(new Error('wire drained'));
      await task.outcome;
      expect(task.state.value).toMatchObject({
        message: expect.stringMatching(/maximum execution time|deadline/i),
      });
      expect(f.service.getActiveQueries('owner')).toEqual([]);
    } finally {
      f.acquisition.resolve(f.pool);
      driver.resolve(f.result);
      await task.outcome;
    }
  });

  it('holds an aborted active query until the driver drains rather than racing its lease', async () => {
    const f = setup(),
      abort = new AbortController(),
      driver = deferred<typeof f.result>();
    f.acquisition.resolve(f.pool);
    f.strategy.executeQuery.mockImplementationOnce(
      async (_pool, _sql, options) => {
        options?.onExecution?.(f.handle);
        return driver.promise;
      },
    );
    const task = observe(
      f.service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT 1' },
        'owner',
        abort.signal,
      ),
    );
    try {
      await tick();
      abort.abort();
      await tick();
      expect(f.strategy.cancelActiveQuery).toHaveBeenCalledWith(f.handle);
      expect(task.state.settled).toBe(false);
      expect(f.service.getActiveQueries('owner')).toHaveLength(1);
      driver.resolve(f.result);
      await task.outcome;
      expect(f.service.getActiveQueries('owner')).toEqual([]);
    } finally {
      driver.resolve(f.result);
      await task.outcome;
    }
  });

  it('does not dispatch a count after an expired completed query', async () => {
    const f = setup();
    f.acquisition.resolve(f.pool);
    f.strategy.executeQuery.mockImplementationOnce(
      async (_pool, _sql, options) => {
        options?.onExecution?.(f.handle);
        jest.setSystemTime(Date.now() + 101);
        return f.result;
      },
    );
    await expect(
      f.service.executeQuery(
        {
          connectionId: 'connection',
          sql: 'SELECT 1',
          includeTotalCount: true,
        },
        'owner',
      ),
    ).rejects.toThrow(/maximum execution time|deadline/i);
    expect(f.strategy.executeQuery).toHaveBeenCalledTimes(1);
  });

  it('rechecks deadline after an awaited count-cache miss even when the driver ignores onExecution', async () => {
    const f = setup('clickhouse'),
      countCache = deferred<unknown>();
    f.acquisition.resolve(f.pool);
    f.strategy.executeQuery.mockImplementation(async () => f.result);
    f.cache.get.mockImplementationOnce(() => countCache.promise);
    const task = observe(
      f.service.executeQuery(
        {
          connectionId: 'connection',
          sql: 'SELECT 1',
          includeTotalCount: true,
        },
        'owner',
      ),
    );
    await tick();
    expect(f.strategy.executeQuery).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 101);
    countCache.resolve(undefined);
    await task.outcome;
    expect(f.strategy.executeQuery).toHaveBeenCalledTimes(1);
    expect(task.state.value).toMatchObject({
      message: expect.stringMatching(/deadline|maximum execution time/i),
    });
  });

  it.each([
    'postgres',
    'mysql',
    'mariadb',
    'mssql',
    'clickhouse',
    'mongodb',
    'redis',
  ])(
    'passes the same internal 32 MiB runtime budget for %s without a product quota',
    async (type) => {
      const f = setup(type);
      f.acquisition.resolve(f.pool);
      const sql =
        type === 'mongodb'
          ? '{"action":"find","collection":"items"}'
          : type === 'redis'
            ? 'GET key'
            : 'SELECT 1';
      await f.service.executeQuery(
        { connectionId: 'connection', sql },
        'owner',
      );
      expect(f.strategy.executeQuery).toHaveBeenCalledWith(
        f.pool,
        sql,
        expect.objectContaining({ maxResultBytes: MAX_BYTES }),
      );
    },
  );

  it('guards a buffered result before returning it and does not replay an executed mutation', async () => {
    const f = setup();
    f.acquisition.resolve(f.pool);
    f.result.rows = [{ returned: 'x'.repeat(MAX_BYTES) }];
    await expect(
      f.service.executeQuery(
        {
          connectionId: 'connection',
          sql: 'INSERT INTO items VALUES (1) RETURNING id',
        },
        'owner',
      ),
    ).rejects.toThrow(/byte budget|payload budget/i);
    expect(f.strategy.executeQuery).toHaveBeenCalledTimes(1);
    expect(f.freshness.invalidateConnection).toHaveBeenCalledWith(
      'connection',
      'fixture',
    );
    expect(f.audit.log).not.toHaveBeenCalled();
  });

  it('guards table-window payloads and supplies the budget to its native path', async () => {
    const f = setup('mariadb');
    f.acquisition.resolve(f.pool);
    f.result.rows = [{ returned: 'x'.repeat(MAX_BYTES) }];
    await expect(
      f.service.fetchTableWindow(
        {
          connectionId: 'connection',
          table: 'items',
          sortBy: 'id',
          includeTotalCount: false,
        },
        'owner',
      ),
    ).rejects.toThrow(/byte budget|payload budget/i);
    expect(f.strategy.executeQuery).toHaveBeenCalledWith(
      f.pool,
      expect.any(String),
      expect.objectContaining({
        maxResultBytes: MAX_BYTES,
        readOnly: true,
        limit: 100,
        offset: 0,
      }),
    );
    expect(f.strategy.executeQuery).toHaveBeenCalledTimes(1);
  });
});
