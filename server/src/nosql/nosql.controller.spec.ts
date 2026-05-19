import { NoSqlController } from './nosql.controller';

describe('NoSqlController security', () => {
  it('passes the authenticated user id when clearing schema cache', async () => {
    const nosqlServiceMock = {
      analyzeSchema: jest.fn(),
      clearSchemaCache: jest.fn(),
    };
    const controller = new NoSqlController(nosqlServiceMock as any);

    await controller.clearCache(
      {
        connectionId: 'conn-1',
        database: 'analytics',
        collection: 'events',
      },
      { user: { id: 'user-1' } } as any,
    );

    expect(nosqlServiceMock.clearSchemaCache).toHaveBeenCalledWith(
      'conn-1',
      'analytics',
      'events',
      'user-1',
    );
  });
});
