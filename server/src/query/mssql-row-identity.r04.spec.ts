import { MssqlStrategy } from '../database-strategies/mssql.strategy';
import * as mssql from 'mssql';
jest.mock('mssql', () => ({ Transaction: jest.fn(), Request: jest.fn() }));
describe('R04 MSSQL mutation contract', () => {
  const strategy = new MssqlStrategy();
  const tx = { begin: jest.fn(), commit: jest.fn(), rollback: jest.fn() };
  const req = { input: jest.fn(), query: jest.fn() };
  const pool = { request: () => req };
  beforeEach(() => {
    jest.resetAllMocks();
    req.input.mockReturnValue(req);
    req.query.mockResolvedValue({ rowsAffected: [1] });
    (mssql.Transaction as unknown as jest.Mock).mockImplementation(() => tx);
    (mssql.Request as unknown as jest.Mock).mockImplementation(() => req);
  });
  it('binds both key columns and commits only one matched row', async () => {
    const params = {
      schema: 'dbo',
      table: 'items',
      pkColumn: 'tenant',
      pkValue: 'A',
      identity: [
        { column: 'tenant', value: 'A' },
        { column: 'id', value: '9007199254740993' },
      ],
      updates: { note: 'changed' },
    };
    expect(await strategy.updateRow(pool as never, params)).toEqual({
      success: true,
      rowCount: 1,
    });
    expect(req.query).toHaveBeenCalledWith(
      'UPDATE [dbo].[items] SET [note] = @p0 WHERE ([tenant] = @p1 AND [id] = @p2)',
    );
    expect(req.input.mock.calls).toEqual([
      ['p0', 'changed'],
      ['p1', 'A'],
      ['p2', '9007199254740993'],
    ]);
    expect(tx.commit).toHaveBeenCalledTimes(1);
  });
  it('rolls back rather than returning success when an update matches two rows', async () => {
    req.query.mockResolvedValue({ rowsAffected: [2] });
    await expect(
      strategy.updateRow(pool as never, {
        schema: 'dbo',
        table: 'items',
        pkColumn: 'tenant',
        pkValue: 'A',
        updates: { note: 'changed' },
      }),
    ).rejects.toThrow();
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });
  it('rolls back a multi-tuple delete if one target is missing', async () => {
    const params = {
      schema: 'dbo',
      table: 'items',
      pkColumn: 'tenant',
      pkValues: ['A', 'B'],
      identities: [
        [
          { column: 'tenant', value: 'A' },
          { column: 'id', value: 2 },
        ],
        [
          { column: 'tenant', value: 'B' },
          { column: 'id', value: 1 },
        ],
      ],
    };
    await expect(strategy.deleteRows(pool as never, params)).rejects.toThrow();
    expect(req.input.mock.calls).toEqual([
      ['p0', 'A'],
      ['p1', 2],
      ['p2', 'B'],
      ['p3', 1],
    ]);
    expect(req.query).toHaveBeenCalledWith(
      'DELETE FROM [dbo].[items] WHERE ([tenant] = @p0 AND [id] = @p1) OR ([tenant] = @p2 AND [id] = @p3)',
    );
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });
});
