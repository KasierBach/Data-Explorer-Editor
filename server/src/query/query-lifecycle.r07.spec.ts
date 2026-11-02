import { QueryService } from './query.service';
import type { ConnectionsService } from '../connections/connections.service';
import type { DatabaseStrategyFactory } from '../database-strategies';
import type { AuditService } from '../audit/audit.service';
import type { FreshnessService } from '../common/freshness/freshness.service';
import type { PermissionsService } from '../permissions/services/permissions.service';
import type { Cache } from 'cache-manager';

function setup() {
  const pool = {},
    handle = {};
  let finish!: (value: { rows: unknown[]; columns: string[] }) => void,
    fail!: (error: Error) => void;
  const pending = new Promise<{ rows: unknown[]; columns: string[] }>(
    (resolve, reject) => {
      finish = resolve;
      fail = reject;
    },
  );
  const strategy = {
    executeQuery: jest.fn(
      (
        _pool: unknown,
        _sql: string,
        options?: { onExecution?: (execution: unknown) => void },
      ) => {
        options?.onExecution?.(handle);
        return pending;
      },
    ),
    cancelActiveQuery: jest.fn(
      async (execution: unknown) => execution === handle,
    ),
  };
  const connections = {
    findOne: jest.fn(async () => ({
      id: 'connection',
      userId: 'owner',
      type: 'postgres',
      database: 'fixture',
      allowQueryExecution: true,
      readOnly: false,
    })),
    getPool: jest.fn(async () => pool),
  };
  const service = new QueryService(
    connections as unknown as ConnectionsService,
    { getStrategy: () => strategy } as unknown as DatabaseStrategyFactory,
    { log: async () => {} } as unknown as AuditService,
    {
      buildKey: async () => 'r07',
      bump: async () => {},
      invalidateConnection: async () => {},
      invalidatePartialWrite: async () => {},
    } as unknown as FreshnessService,
    { get: async () => undefined, set: async () => {} } as unknown as Cache,
    {} as PermissionsService,
  );
  return { service, strategy, pool, handle, finish, fail };
}

describe('R07 query lifecycle', () => {
  it('binds cancellation to the actual execution handle and preserves ownership', async () => {
    const f = setup();
    const task = f.service.executeQuery(
      { connectionId: 'connection', sql: 'SELECT 1' },
      'owner',
    );
    const outcome = task.catch((error) => error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const entry = f.service.getActiveQueries('owner')[0];
    try {
      expect(entry).toBeDefined();
      expect(f.service.getActiveQueries('other')).toEqual([]);
      await expect(
        f.service.cancelQuery(entry.queryId, 'other'),
      ).rejects.toThrow('own queries');
      expect(await f.service.cancelQuery(entry.queryId, 'owner')).toBe(true);
      expect(f.strategy.cancelActiveQuery).toHaveBeenCalledWith(f.handle);
    } finally {
      f.finish({ rows: [], columns: [] });
      await outcome;
    }
    expect(f.service.getActiveQueries('owner')).toEqual([]);
    expect(await f.service.cancelQuery(entry.queryId, 'owner')).toBe(false);
  });

  it('keeps the registry until the timed-out driver has actually drained', async () => {
    const saved = process.env.QUERY_TIMEOUT_MS;
    process.env.QUERY_TIMEOUT_MS = '20';
    const f = setup();
    const task = f.service.executeQuery(
      { connectionId: 'connection', sql: 'SELECT 1' },
      'owner',
    );
    const outcome = task.catch((error) => error);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 60));
      expect(f.strategy.cancelActiveQuery).toHaveBeenCalledWith(f.handle);
      expect(f.service.getActiveQueries('owner')).toHaveLength(1);
      f.fail(new Error('driver cancellation completed'));
      expect(await outcome).toMatchObject({
        message: expect.stringMatching(/maximum execution time|deadline/i),
      });
      expect(f.service.getActiveQueries('owner')).toEqual([]);
    } finally {
      if (saved === undefined) delete process.env.QUERY_TIMEOUT_MS;
      else process.env.QUERY_TIMEOUT_MS = saved;
      f.finish({ rows: [], columns: [] });
      await outcome;
    }
  });
});
