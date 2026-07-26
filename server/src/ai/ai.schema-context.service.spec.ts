import { AiSchemaContextService } from './ai.schema-context.service';

describe('AiSchemaContextService', () => {
  it('builds AI context from schema metadata without reading row values', async () => {
    const cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const freshnessService = {
      buildKey: jest.fn().mockResolvedValue('ai-schema:test'),
      bump: jest.fn(),
    };
    const getSampleRows = jest
      .fn()
      .mockResolvedValue([{ email: 'secret@example.com' }]);
    const strategy = {
      getSchemas: jest.fn().mockResolvedValue(['public']),
      getTables: jest.fn().mockResolvedValue([{ name: 'users' }]),
      getColumns: jest.fn().mockResolvedValue([
        {
          name: 'id',
          type: 'integer',
          isNullable: false,
          isPrimaryKey: true,
        },
        {
          name: 'email',
          type: 'text',
          isNullable: false,
          isPrimaryKey: false,
        },
      ]),
      getRelationships: jest.fn().mockResolvedValue([]),
      getSampleRows,
    };
    const service = new AiSchemaContextService(
      cacheManager as never,
      freshnessService as never,
    );

    const context = await service.gatherSchemaContext(
      {},
      strategy as never,
      'app',
      'connection-1',
    );

    expect(getSampleRows).not.toHaveBeenCalled();
    expect(context).toContain('TABLE:');
    expect(context).toContain('public');
    expect(context).toContain('users');
    expect(context).toContain('email text NOT NULL');
    expect(context).not.toContain('SAMPLE DATA');
    expect(context).not.toContain('secret@example.com');
  });
});
