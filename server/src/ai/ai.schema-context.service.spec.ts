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

  it('selects a prompt-relevant table even when it appears after the first 100', async () => {
    const cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const freshnessService = {
      buildKey: jest
        .fn()
        .mockResolvedValueOnce('ai-schema:inventory')
        .mockResolvedValueOnce('ai-schema:context'),
      bump: jest.fn(),
    };
    const tables = Array.from({ length: 149 }, (_, index) => ({
      name: `table_${index}`,
    })).concat({ name: 'audit_events' });
    const strategy = {
      getSchemas: jest.fn().mockResolvedValue(['public']),
      getTables: jest.fn().mockResolvedValue(tables),
      getColumns: jest.fn().mockResolvedValue([
        {
          name: 'event_id',
          type: 'uuid',
          isNullable: false,
          isPrimaryKey: true,
        },
      ]),
      getRelationships: jest.fn().mockResolvedValue([]),
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
      'Show recent audit events',
    );

    expect(context).toContain('audit_events');
    expect(context).not.toContain('table_0');
    expect(strategy.getColumns).toHaveBeenCalledTimes(1);
    expect(strategy.getColumns).toHaveBeenCalledWith(
      {},
      'public',
      'audit_events',
      'app',
    );
  });
});
