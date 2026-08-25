import { SqliteStrategy } from '../../database-strategies/sqlite.strategy';

describe('SqliteStrategy', () => {
  it('exports through the database iterator instead of loading all rows', async () => {
    const iterate = jest.fn(function* () {
      yield { id: 1 };
    });
    const pool = {
      prepare: jest.fn().mockReturnValue({ iterate }),
    };

    const stream = (await new SqliteStrategy().exportStream(
      pool as never,
      '',
      'users',
    )) as AsyncIterable<Record<string, unknown>>;
    const rows: Record<string, unknown>[] = [];
    for await (const row of stream) rows.push(row);
    expect(rows).toEqual([{ id: 1 }]);
    expect(stream[Symbol.asyncIterator]).toBeDefined();
  });
});
