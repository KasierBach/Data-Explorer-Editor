import { EventEmitter } from 'node:events';
import type { Pool } from 'pg';
import { PostgresStrategy } from './postgres.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';
import type { Pool as MysqlPool } from 'mysql2/promise';
import type { ConnectionPool } from 'mssql';

const mockControl = { connect: jest.fn(), query: jest.fn(), end: jest.fn() };
const mockMysqlControl = {
  query: jest.fn(async () => [[], []]),
  end: jest.fn(async () => {}),
};
jest.mock('pg', () => ({
  ...jest.requireActual('pg'),
  Client: jest.fn(() => mockControl),
}));
jest.mock('mysql2/promise', () => ({
  ...jest.requireActual('mysql2/promise'),
  createConnection: jest.fn(async () => mockMysqlControl),
}));

function fixture() {
  const client = Object.assign(new EventEmitter(), {
    processID: 123,
    query: jest.fn(),
    release: jest.fn(),
  });
  const pool = {
    options: { host: '127.0.0.1' },
    connect: jest.fn(async () => client),
  };
  let finish!: () => void;
  client.query.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ rows: [], fields: [], rowCount: 0 });
      }),
  );
  return { client, pool, finishQuery: () => finish() };
}

describe('R07 driver execution lease', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockControl.connect.mockResolvedValue(undefined);
    mockControl.query.mockResolvedValue({ rows: [{ cancelled: true }] });
    mockControl.end.mockResolvedValue(undefined);
  });
  it('holds the source lease until a pending cancellation finishes and never cancels a reused client', async () => {
    const f = fixture();
    let execution: { cancel: () => Promise<boolean> } | undefined,
      connect!: () => void;
    mockControl.connect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          connect = resolve;
        }),
    );
    const options = {
      limit: 1,
      onExecution: (handle: { cancel: () => Promise<boolean> }) => {
        execution = handle;
      },
    };
    const strategy = new PostgresStrategy();
    const task = strategy.executeQuery(
      f.pool as unknown as Pool,
      'SELECT 1',
      options,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      expect(execution).toBeDefined();
      const cancellation = strategy.cancelActiveQuery(execution);
      await new Promise<void>((resolve) => setImmediate(resolve));
      f.finishQuery();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(f.client.release).not.toHaveBeenCalled();
      connect();
      expect(await cancellation).toBe(false);
      await task;
      expect(mockControl.query).not.toHaveBeenCalled();
      expect(f.client.release).toHaveBeenCalledTimes(1);
      expect(await strategy.cancelActiveQuery(execution)).toBe(false);
    } finally {
      connect?.();
      f.finishQuery();
      await task;
    }
  });
  it('discards a client on native read timeout instead of returning a still-running backend to the pool', async () => {
    const f = fixture(),
      error = new Error('Query read timeout');
    f.client.query.mockReset().mockRejectedValueOnce(error);
    mockControl.query.mockImplementationOnce(async () => {
      f.client.emit('drain');
      return { rows: [{ cancelled: true }] };
    });
    await expect(
      new PostgresStrategy().executeQuery(
        f.pool as unknown as Pool,
        'SELECT 1',
      ),
    ).rejects.toThrow(error);
    expect(f.client.release).toHaveBeenCalledWith(error);
  });
  it('publishes the leased MySQL connection and cancels through a separate control connection', async () => {
    let finish!: () => void, execution: unknown;
    const query = jest.fn(
      () =>
        new Promise((resolve) => {
          finish = () => resolve([[], []]);
        }),
    );
    const connection = Object.assign(new EventEmitter(), {
      threadId: 456,
      config: { host: '127.0.0.1' },
      query,
      release: jest.fn(),
      destroy: jest.fn(),
    });
    const pool = { getConnection: async () => connection, query };
    const strategy = new MysqlStrategy();
    const task = strategy.executeQuery(
      pool as unknown as MysqlPool,
      'SELECT 1',
      {
        limit: 1,
        onExecution: (handle: unknown) => {
          execution = handle;
        },
      },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      expect(execution).toBeDefined();
      expect(await strategy.cancelActiveQuery(execution)).toBe(true);
      expect(mockMysqlControl.query).toHaveBeenCalledWith('KILL QUERY 456');
      expect(query).toHaveBeenCalledTimes(1);
    } finally {
      finish();
      await task;
    }
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(await strategy.cancelActiveQuery(execution)).toBe(false);
  });
  it('publishes the actual SQL Server request rather than the connection pool', async () => {
    let finish!: () => void, execution: unknown;
    const query = jest.fn(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ recordset: [], rowsAffected: [0] });
        }),
    );
    const driverRequest = { query, cancel: jest.fn() };
    const pool = { request: () => driverRequest };
    const strategy = new MssqlStrategy();
    const task = strategy.executeQuery(
      pool as unknown as ConnectionPool,
      'SELECT 1',
      {
        limit: 1,
        onExecution: (handle: unknown) => {
          execution = handle;
        },
      },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      expect(execution).toBeDefined();
      expect(await strategy.cancelActiveQuery(execution)).toBe(true);
      expect(driverRequest.cancel).toHaveBeenCalledTimes(1);
    } finally {
      finish();
      await task;
    }
    expect(await strategy.cancelActiveQuery(execution)).toBe(false);
  });
  it('discards a PostgreSQL client if transaction rollback fails', async () => {
    const f = fixture(),
      error = new Error('statement failed'),
      rollbackError = new Error('rollback failed');
    f.client.query
      .mockReset()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(rollbackError);
    await expect(
      new PostgresStrategy().runStatementsInTransaction(
        f.pool as unknown as Pool,
        ['SELECT 1'],
      ),
    ).rejects.toThrow(error);
    expect(f.client.release).toHaveBeenCalledWith(rollbackError);
  });
  it('destroys a MySQL connection if transaction rollback fails', async () => {
    const error = new Error('statement failed');
    const connection = Object.assign(new EventEmitter(), {
      query: jest.fn().mockRejectedValue(error),
      beginTransaction: jest.fn(),
      rollback: jest.fn().mockRejectedValue(new Error('rollback failed')),
      release: jest.fn(),
      destroy: jest.fn(),
    });
    await expect(
      new MysqlStrategy().runStatementsInTransaction(
        { getConnection: async () => connection } as unknown as MysqlPool,
        ['SELECT 1'],
      ),
    ).rejects.toThrow(error);
    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(connection.release).not.toHaveBeenCalled();
  });
});
