import { AiSchemaContextService } from './ai.schema-context.service';

describe('AiSchemaContextService', () => {
  it('stops metadata gathering after cancellation instead of starting the next task', async () => {
    const controller = new AbortController();
    const cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
    };
    const freshnessService = {
      buildKey: jest.fn().mockResolvedValue('fixture'),
      bump: jest.fn(),
    };
    const strategy = {
      getSchemas: jest.fn(async () => {
        controller.abort();
        return ['public'];
      }),
      getTables: jest.fn(),
      getRelationships: jest.fn(),
      getColumns: jest.fn(),
    };
    const service = new AiSchemaContextService(
      cacheManager as never,
      freshnessService as never,
    );

    await expect(
      service.gatherSchemaContext({}, strategy as never, 'app', 'conn-a', '', {
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(strategy.getTables).not.toHaveBeenCalled();
    expect(strategy.getColumns).not.toHaveBeenCalled();
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('does not use cached schema after a fresh policy denial', async () => {
    const cacheManager = {
      get: jest.fn().mockResolvedValue('Cached schema'),
      set: jest.fn(),
    };
    const freshnessService = {
      buildKey: jest.fn().mockResolvedValue('fixture'),
      bump: jest.fn(),
    };
    const policy = jest.fn().mockRejectedValue(new Error('Policy denied'));
    const service = new AiSchemaContextService(
      cacheManager as never,
      freshnessService as never,
    );

    await expect(
      service.gatherSchemaContext({}, {} as never, 'app', 'conn-a', '', {
        beforeProviderRequest: policy,
      }),
    ).rejects.toThrow('Policy denied');
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

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

  it('bounds and discloses truncated schema inventories before cache and column work', async () => {
    const cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const freshnessService = {
      buildKey: jest
        .fn()
        .mockResolvedValueOnce('ai-schema:inventory')
        .mockResolvedValueOnce('ai-schema:context'),
    };
    const publicTables = Array.from({ length: 4_999 }, (_, index) => ({
      name: `table_${index}`,
    }));
    const relationships = Array.from({ length: 10_250 }, (_, index) => ({
      constraint_name: `fk_${index}`,
      source_table: `table_${index % 100}`,
      source_column: 'id',
      target_table: `table_${(index + 1) % 100}`,
      target_column: 'id',
    }));
    const strategy = {
      getSchemas: jest.fn().mockResolvedValue(['public', 'archive', 'ignored']),
      getTables: jest
        .fn()
        .mockResolvedValueOnce(publicTables)
        .mockResolvedValueOnce([
          { name: 'final_allowed' },
          { name: 'not_retained' },
        ]),
      getColumns: jest.fn().mockResolvedValue([
        {
          name: 'id',
          type: 'uuid',
          isNullable: false,
          isPrimaryKey: true,
        },
      ]),
      getRelationships: jest.fn().mockResolvedValue(relationships),
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
      'final allowed',
    );

    expect(strategy.getTables).toHaveBeenCalledTimes(2);
    expect(strategy.getTables).not.toHaveBeenCalledWith({}, 'ignored', 'app');
    expect(strategy.getColumns).toHaveBeenCalledWith(
      {},
      'archive',
      'final_allowed',
      'app',
    );
    expect(strategy.getColumns).toHaveBeenCalledTimes(1);
    expect(context).toContain('final_allowed');
    expect(context).toContain(
      'Schema inventory truncated to operational limits',
    );
    const inventoryCall = cacheManager.set.mock.calls.find(
      ([key]) => key === 'ai-schema:inventory',
    );
    expect(inventoryCall?.[1]).toMatchObject({ truncated: true });
    expect(inventoryCall?.[1].tables).toHaveLength(5_000);
    expect(inventoryCall?.[1].relationships).toHaveLength(10_000);
  });

  it('returns a cached empty context without rebuilding schema metadata', async () => {
    const cacheManager = {
      get: jest.fn().mockResolvedValue(''),
      set: jest.fn(),
    };
    const freshnessService = {
      buildKey: jest.fn().mockResolvedValue('ai-schema:context'),
    };
    const strategy = {
      getSchemas: jest.fn(),
    };
    const service = new AiSchemaContextService(
      cacheManager as never,
      freshnessService as never,
    );

    await expect(
      service.gatherSchemaContext({}, strategy as never, 'app', 'connection-1'),
    ).resolves.toBe('');
    expect(strategy.getSchemas).not.toHaveBeenCalled();
  });
});
