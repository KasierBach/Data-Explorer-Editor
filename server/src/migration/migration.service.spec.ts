import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { PermissionsService } from '../permissions/services/permissions.service';
import { OrganizationRole } from '../organizations/entities/organization-role.enum';
import { MigrationService, MigrationJob } from './migration.service';
import { ConnectionsService } from '../connections/connections.service';
import { Permission } from '../permissions/enums/permission.enum';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { getQueueToken } from '@nestjs/bullmq';
import { PassThrough } from 'stream';
import { MigrationComparisonService } from './migration-comparison.service';
import { FreshnessService } from '../common/freshness/freshness.service';

// Mock uuid to avoid ESM import issues in Jest
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `mock-uuid-${++uuidCounter}`,
}));

describe('MigrationService', () => {
  let service: MigrationService;
  let mockConnectionsService: any;
  let mockStrategyFactory: any;

  // ─── Reusable Mocks ───

  const createMockStrategy = () => ({
    createPool: jest.fn().mockResolvedValue('mock-pool'),
    closePool: jest.fn().mockResolvedValue(undefined),
    exportStream: jest.fn(),
    importData: jest.fn().mockImplementation(async (_pool, params) => ({
      success: true,
      rowCount: params.data.length,
    })),
    getFullMetadata: jest.fn().mockResolvedValue({
      columns: [
        {
          name: 'id',
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: true,
        },
        {
          name: 'name',
          isNullable: true,
          defaultValue: null,
          isPrimaryKey: false,
        },
        {
          name: 'email',
          isNullable: true,
          defaultValue: null,
          isPrimaryKey: false,
        },
      ],
    }),
  });

  const mockSourceConn = {
    id: 'src-1',
    name: 'Source DB',
    type: 'postgres',
    database: 'migration_unit',
  };
  const mockTargetConn = {
    id: 'tgt-1',
    name: 'Target DB',
    type: 'mongodb',
    database: 'migration_unit',
  };

  const baseDto = {
    sourceConnectionId: 'src-1',
    sourceSchema: 'public',
    sourceTable: 'users',
    targetConnectionId: 'tgt-1',
    targetSchema: '',
    targetTable: 'users',
  };

  const startPipeline = async (jobId: string, dto = baseDto) => {
    const job = mockJobs.get(jobId);
    try {
      await service.runMigrationPipeline('user-1', jobId, dto);
      job.getState = jest.fn().mockResolvedValue('completed');
    } catch (error) {
      job.failedReason = error instanceof Error ? error.message : String(error);
      job.getState = jest.fn().mockResolvedValue('failed');
    }
  };

  let mockMigrationQueue: any;
  let mockJobs: Map<string, any>;

  beforeEach(async () => {
    mockJobs = new Map();
    mockMigrationQueue = {
      add: jest.fn().mockImplementation((name, data) => {
        const id = `mock-job-${++uuidCounter}`;
        const job = {
          id,
          data,
          progress: {},
          updateProgress: jest.fn().mockImplementation((p) => {
            job.progress = { ...job.progress, ...p };
            return Promise.resolve();
          }),
          getState: jest.fn().mockResolvedValue('active'),
          moveToFailed: jest.fn().mockImplementation((err) => {
            (job as any).failedReason = err.message;
            job.getState = jest.fn().mockResolvedValue('failed');
            return Promise.resolve();
          }),
          failedReason: undefined,
          progress_val: 0,
        };
        mockJobs.set(id, job);
        return Promise.resolve(job);
      }),
      getJob: jest
        .fn()
        .mockImplementation((id) => Promise.resolve(mockJobs.get(id))),
    };

    mockSourceConn.type = 'postgres';
    mockTargetConn.type = 'mongodb';
    mockConnectionsService = {
      getMigrationConnection: jest.fn().mockImplementation((id: string) => {
        if (id === 'src-1') return Promise.resolve(mockSourceConn);
        if (id === 'tgt-1') return Promise.resolve(mockTargetConn);
        return Promise.resolve(null);
      }),
      getDecryptedConnection: jest.fn().mockImplementation((id: string) => {
        if (id === 'src-1') return Promise.resolve(mockSourceConn);
        if (id === 'tgt-1') return Promise.resolve(mockTargetConn);
        return Promise.resolve(null);
      }),
      findOne: jest.fn().mockImplementation((id: string) => {
        if (id === 'src-1') return Promise.resolve(mockSourceConn);
        if (id === 'tgt-1') return Promise.resolve(mockTargetConn);
        return Promise.resolve(null);
      }),
      getPool: jest.fn().mockResolvedValue('mock-pool'),
    };

    mockStrategyFactory = {
      getStrategy: jest.fn().mockReturnValue(createMockStrategy()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        { provide: ConnectionsService, useValue: mockConnectionsService },
        { provide: DatabaseStrategyFactory, useValue: mockStrategyFactory },
        MigrationComparisonService,
        {
          provide: FreshnessService,
          useValue: {
            invalidateConnection: jest.fn(),
            invalidatePartialWrite: jest.fn(),
          },
        },
        { provide: getQueueToken('migration'), useValue: mockMigrationQueue },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
  });

  // ─── Test 1: Job Creation ───

  it('should create a job and return a jobId', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    // Source stream that immediately ends (empty table)
    const stream = new PassThrough({ objectMode: true });
    sourceStrategy.exportStream.mockResolvedValue(stream);
    setTimeout(() => stream.end(), 10);

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const result = await service.startMigration('user-1', baseDto);

    expect(result.jobId).toBeDefined();
    expect(typeof result.jobId).toBe('string');
    expect(mockJobs.has(result.jobId)).toBe(true);
  });

  it('authorizes both endpoints before enqueuing a migration', async () => {
    await service.startMigration('user-1', baseDto);

    expect(
      mockConnectionsService.getMigrationConnection,
    ).toHaveBeenNthCalledWith(
      1,
      'src-1',
      'user-1',
      expect.objectContaining({
        permission: Permission.READ,
        database: undefined,
        write: false,
      }),
    );
    expect(
      mockConnectionsService.getMigrationConnection,
    ).toHaveBeenNthCalledWith(
      2,
      'tgt-1',
      'user-1',
      expect.objectContaining({
        permission: Permission.WRITE,
        database: undefined,
        write: true,
      }),
    );
    expect(mockMigrationQueue.add).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue when migration authorization fails', async () => {
    mockConnectionsService.getMigrationConnection.mockRejectedValueOnce(
      new Error('migration denied'),
    );

    await expect(service.startMigration('user-1', baseDto)).rejects.toThrow(
      'migration denied',
    );
    expect(mockMigrationQueue.add).not.toHaveBeenCalled();
  });

  it('queues a canonical DTO copy with engine defaults and rejects later caller mutation', async () => {
    const dto = {
      ...baseDto,
      sourceConnectionId: ' src-1 ',
      sourceSchema: ' ',
      sourceTable: ' users ',
      targetConnectionId: ' tgt-1 ',
      targetSchema: ' ignored-mongo-schema ',
      targetTable: ' users_copy ',
    };
    const { jobId } = await service.startMigration('user-1', dto);

    expect(mockJobs.get(jobId).data.dto).toEqual({
      sourceConnectionId: 'src-1',
      sourceSchema: 'public',
      sourceTable: 'users',
      targetConnectionId: 'tgt-1',
      targetSchema: '',
      targetTable: 'users_copy',
    });
    expect(dto.sourceSchema).toBe(' ');
    dto.targetTable = 'changed_after_enqueue';
    expect(mockJobs.get(jobId).data.dto.targetTable).toBe('users_copy');
  });

  it.each(['sourceTable', 'targetTable'] as const)(
    'rejects whitespace-only %s before authorization or queue admission',
    async (field) => {
      await expect(
        service.startMigration('user-1', { ...baseDto, [field]: ' \t ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        mockConnectionsService.getMigrationConnection,
      ).not.toHaveBeenCalled();
      expect(mockMigrationQueue.add).not.toHaveBeenCalled();
      expect(mockStrategyFactory.getStrategy).not.toHaveBeenCalled();
    },
  );

  // ─── Test 2: Batch Chunking (Core Streaming Logic) ───

  it('should batch rows in chunks of 2000 and call importData correct number of times', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    // Create a stream that emits 5000 rows
    const stream = new PassThrough({ objectMode: true });
    sourceStrategy.exportStream.mockResolvedValue(stream);

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const { jobId } = await service.startMigration('user-1', baseDto);
    const pipeline = startPipeline(jobId, baseDto);

    await new Promise<void>((resolve) => setImmediate(resolve));

    for (let i = 0; i < 5000; i++) {
      stream.write({ id: i, name: `user_${i}`, email: `user${i}@test.com` });
    }
    stream.end();

    await pipeline;

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('completed');
    expect(job.processedRows).toBe(5000);

    // 5000 rows / 2000 batch = 2 full batches + 1 partial = 3 calls
    expect(targetStrategy.importData).toHaveBeenCalledTimes(3);
    expect(mockConnectionsService.getMigrationConnection).toHaveBeenCalledWith(
      'src-1',
      'user-1',
      expect.objectContaining({ permission: Permission.READ, write: false }),
    );
    expect(mockConnectionsService.getMigrationConnection).toHaveBeenCalledWith(
      'tgt-1',
      'user-1',
      expect.objectContaining({ permission: Permission.WRITE, write: true }),
    );

    // First call should have 2000 rows
    expect(targetStrategy.importData.mock.calls[0][1].data.length).toBe(2000);
    // Second call should have 2000 rows
    expect(targetStrategy.importData.mock.calls[1][1].data.length).toBe(2000);
    // Third call should have 1000 remaining rows
    expect(targetStrategy.importData.mock.calls[2][1].data.length).toBe(1000);
  });

  // ─── Test 3: Progress Events ───

  it('should emit progress events via EventEmitter after each batch', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    const stream = new PassThrough({ objectMode: true });
    sourceStrategy.exportStream.mockResolvedValue(stream);

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const { jobId } = await service.startMigration('user-1', baseDto);
    const pipeline = startPipeline(jobId, baseDto);

    const progressUpdates: MigrationJob[] = [];
    service.eventEmitter.on(`migration-${jobId}`, (job: MigrationJob) => {
      progressUpdates.push({ ...job });
    });

    await new Promise<void>((resolve) => setImmediate(resolve));

    for (let i = 0; i < 2500; i++) {
      stream.write({ id: i });
    }
    stream.end();

    await pipeline;

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('completed');
    expect(job.processedRows).toBe(2500);
  });

  // ─── Test 4: Error Handling (Target DB Failure Mid-Stream) ───

  it('should set job to failed if target importData throws mid-stream', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    // importData fails on second call
    targetStrategy.importData
      .mockResolvedValueOnce({ success: true, rowCount: 2000 })
      .mockRejectedValueOnce(new Error('Target DB connection lost'));

    const stream = new PassThrough({ objectMode: true });
    sourceStrategy.exportStream.mockResolvedValue(stream);

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const { jobId } = await service.startMigration('user-1', baseDto);
    const pipeline = startPipeline(jobId, baseDto);

    await new Promise<void>((resolve) => setImmediate(resolve));

    for (let i = 0; i < 4000; i++) {
      stream.write({ id: i });
    }
    stream.end();

    await pipeline;

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('failed');
    expect(job.error).toContain('Target DB connection lost');
  });

  // ─── Test 5: Connection Not Found ───

  it('reauthorizes queued migration endpoints before creating pools', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();
    const stream = new PassThrough({ objectMode: true });
    sourceStrategy.exportStream.mockResolvedValue(stream);
    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const { jobId } = await service.startMigration('user-1', baseDto);
    mockConnectionsService.getMigrationConnection.mockClear();
    mockConnectionsService.getMigrationConnection.mockRejectedValueOnce(
      new Error('access revoked'),
    );

    await startPipeline(jobId, baseDto);

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('failed');
    expect(job.error).toContain('access revoked');
    expect(sourceStrategy.createPool).not.toHaveBeenCalled();
    expect(targetStrategy.createPool).not.toHaveBeenCalled();
  });

  it('should reject before enqueue if source connection is not found', async () => {
    mockConnectionsService.getMigrationConnection.mockResolvedValue(null);

    await expect(service.startMigration('user-1', baseDto)).rejects.toThrow(
      'not found',
    );
    expect(mockMigrationQueue.add).not.toHaveBeenCalled();
  });

  // ─── Test 6: Empty Table (0 rows) ───

  it('should complete successfully with 0 rows for an empty source table', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    const stream = new PassThrough({ objectMode: true });
    sourceStrategy.exportStream.mockResolvedValue(stream);

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const { jobId } = await service.startMigration('user-1', baseDto);
    const pipeline = startPipeline(jobId, baseDto);

    await new Promise<void>((resolve) => setImmediate(resolve));

    stream.end();

    await pipeline;

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('completed');
    expect(job.processedRows).toBe(0);
    expect(targetStrategy.importData).not.toHaveBeenCalled();
  });

  it('should reject before enqueue when source and target point to the same table', async () => {
    await expect(
      service.startMigration('user-1', {
        ...baseDto,
        targetConnectionId: 'src-1',
        targetSchema: 'public',
        targetTable: 'users',
      }),
    ).rejects.toThrow('same table');
    expect(mockMigrationQueue.add).not.toHaveBeenCalled();
  });

  it('treats normalized schema and table aliases as the same endpoint', async () => {
    await expect(
      service.startMigration('user-1', {
        ...baseDto,
        targetConnectionId: 'src-1',
        sourceSchema: '',
        targetSchema: ' public ',
        sourceTable: ' users ',
        targetTable: 'users',
      }),
    ).rejects.toThrow('same table');
    expect(mockMigrationQueue.add).not.toHaveBeenCalled();
  });

  it('should fail during preflight when SQL target is missing source columns', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    targetStrategy.getFullMetadata.mockResolvedValue({
      columns: [
        {
          name: 'id',
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: true,
        },
        {
          name: 'name',
          isNullable: true,
          defaultValue: null,
          isPrimaryKey: false,
        },
      ],
    });

    mockTargetConn.type = 'postgres';

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const { jobId } = await service.startMigration('user-1', {
      ...baseDto,
      targetConnectionId: 'src-1',
      targetSchema: 'public',
      targetTable: 'users_copy',
    });
    await startPipeline(jobId, {
      ...baseDto,
      targetConnectionId: 'src-1',
      targetSchema: 'public',
      targetTable: 'users_copy',
    });

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('failed');
    expect(job.error).toContain('missing source columns');
  });

  it('should preview schema differences before running a migration', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    mockTargetConn.type = 'postgres';
    sourceStrategy.getFullMetadata.mockResolvedValue({
      columns: [
        {
          name: 'id',
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: true,
          pkConstraintName: 'users_pkey',
        },
        {
          name: 'name',
          isNullable: true,
          defaultValue: null,
          isPrimaryKey: false,
          pkConstraintName: null,
        },
        {
          name: 'email',
          isNullable: true,
          defaultValue: null,
          isPrimaryKey: false,
          pkConstraintName: null,
        },
      ],
      indices: [
        {
          name: 'users_email_idx',
          columns: ['email'],
          isUnique: false,
          isPrimary: false,
        },
      ],
      rowCount: 125_000,
    });
    targetStrategy.getFullMetadata.mockResolvedValue({
      columns: [
        {
          name: 'id',
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: true,
          pkConstraintName: 'users_pkey',
        },
        {
          name: 'name',
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: false,
          pkConstraintName: null,
        },
        {
          name: 'email',
          isNullable: true,
          defaultValue: null,
          isPrimaryKey: false,
          pkConstraintName: null,
        },
        {
          name: 'created_at',
          isNullable: false,
          defaultValue: 'now()',
          isPrimaryKey: false,
          pkConstraintName: null,
        },
      ],
      indices: [
        {
          name: 'users_email_idx',
          columns: ['email'],
          isUnique: true,
          isPrimary: false,
        },
        {
          name: 'users_created_at_idx',
          columns: ['created_at'],
          isUnique: false,
          isPrimary: false,
        },
      ],
      rowCount: 80_000,
    });

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const review = await service.previewMigration('user-1', {
      ...baseDto,
      targetConnectionId: 'tgt-1',
      targetSchema: 'public',
      targetTable: 'users_shadow',
    });

    expect(review.canProceed).toBe(true);
    expect(review.blockers).toHaveLength(0);
    expect(review.estimatedImpact.changedColumns).toBeGreaterThan(0);
    expect(review.estimatedImpact.addedColumns).toBeGreaterThan(0);
    expect(review.estimatedImpact.changedIndices).toBeGreaterThan(0);
    expect(
      review.warnings.some((warning) => warning.includes('Large source table')),
    ).toBe(true);
  });

  it('should report blockers in a migration preview when the target is not compatible', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    mockTargetConn.type = 'postgres';
    targetStrategy.getFullMetadata.mockResolvedValue({
      columns: [
        {
          name: 'id',
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: true,
          pkConstraintName: 'users_pkey',
        },
        {
          name: 'name',
          isNullable: false,
          defaultValue: null,
          isPrimaryKey: false,
          pkConstraintName: null,
        },
      ],
      indices: [],
      rowCount: 10,
    });

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const review = await service.previewMigration('user-1', {
      ...baseDto,
      targetConnectionId: 'tgt-1',
      targetSchema: 'public',
      targetTable: 'users_shadow',
    });

    expect(review.canProceed).toBe(false);
    expect(review.blockers.join(' ')).toContain('missing source columns');
  });

  it('should shrink the import batch size after a retryable target write failure', async () => {
    const sourceStrategy = createMockStrategy();
    const targetStrategy = createMockStrategy();

    mockTargetConn.type = 'mssql';
    targetStrategy.importData
      .mockRejectedValueOnce(
        Object.assign(new Error('Too many parameters. Maximum is 2100.'), {
          code: 'EREQUEST',
          number: 8003,
        }),
      )
      .mockImplementation(async (_pool, params) => ({
        success: true,
        rowCount: params.data.length,
      }));

    const stream = new PassThrough({ objectMode: true });
    sourceStrategy.exportStream.mockResolvedValue(stream);

    mockStrategyFactory.getStrategy
      .mockReturnValueOnce(sourceStrategy)
      .mockReturnValueOnce(targetStrategy);

    const { jobId } = await service.startMigration('user-1', baseDto);
    const pipeline = startPipeline(jobId, baseDto);

    await new Promise<void>((resolve) => setImmediate(resolve));

    for (let i = 0; i < 125; i++) {
      stream.write({ id: i, name: `user_${i}`, email: `user${i}@test.com` });
    }
    stream.end();

    await pipeline;

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('completed');
    expect(targetStrategy.importData).toHaveBeenCalledTimes(4);
    expect(targetStrategy.importData.mock.calls[0][1].data.length).toBe(125);
    expect(targetStrategy.importData.mock.calls[1][1].data.length).toBe(62);
    expect(targetStrategy.importData.mock.calls[2][1].data.length).toBe(62);
    expect(targetStrategy.importData.mock.calls[3][1].data.length).toBe(1);
  });
});

describe('Migration policy and effective endpoint lifecycle', () => {
  const database = 'allowed';
  const columns = [
    {
      name: 'id',
      type: 'integer',
      isNullable: false,
      isPrimaryKey: true,
      defaultValue: null,
      pkConstraintName: null,
    },
  ];

  function setup() {
    const dto = {
      sourceConnectionId: 'source',
      targetConnectionId: 'target',
      sourceSchema: 'public',
      targetSchema: 'public',
      sourceTable: 'items',
      targetTable: 'items_copy',
    };
    const records: Record<string, any> = Object.fromEntries(
      ['source', 'target'].map((id) => [
        id,
        {
          id,
          name: id,
          userId: 'owner',
          organizationId: 'org',
          type: 'postgres',
          host: '127.0.0.1',
          database,
          password: null,
          allowImportExport: true,
          readOnly: false,
          allowedDatabases: [database],
          roleQueryModes: { MEMBER: 'full' },
        },
      ]),
    );
    const state = { member: true, role: OrganizationRole.MEMBER };
    const policy = new PermissionsService(
      {} as never,
    ).buildDefaultResourcePolicy();
    const policies = Object.fromEntries(
      ['source', 'target'].map((id) => [id, { ...policy }]),
    );
    const prisma = {
      connection: {
        findFirst: jest.fn(async ({ where }: { where: { id: string } }) =>
          state.member ? (records[where.id] ?? null) : null,
        ),
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) =>
            records[where.id] ?? null,
        ),
      },
      organizationMember: {
        findUnique: jest.fn(async () =>
          state.member ? { role: state.role } : null,
        ),
      },
      organizationResource: {
        findUnique: jest.fn(
          async ({
            where,
          }: {
            where: {
              resourceType_resourceId_organizationId: { resourceId: string };
            };
          }) => ({
            permissions:
              policies[where.resourceType_resourceId_organizationId.resourceId],
          }),
        ),
      },
    };
    const permissions = new PermissionsService(prisma as never);
    const sourcePool = {},
      targetPool = {};
    const source = {
      createPool: jest.fn(async () => sourcePool),
      closePool: jest.fn(async () => {}),
      getFullMetadata: jest.fn(async () => ({ columns, indices: [] })),
      exportStream: jest.fn(async () =>
        Readable.from([{ id: 1 }, { id: 2 }], { objectMode: true }),
      ),
    };
    const target = {
      createPool: jest.fn(async () => targetPool),
      closePool: jest.fn(async () => {}),
      getFullMetadata: jest.fn(async () => ({ columns, indices: [] })),
      importData: jest.fn(
        async (_pool: unknown, params: { data: unknown[] }) => ({
          success: true,
          rowCount: params.data.length,
        }),
      ),
    };
    let factoryCalls = 0;
    const factory = {
      getStrategy: jest.fn(() => (factoryCalls++ === 0 ? source : target)),
    };
    // Use the real authorization and PermissionsService implementations without a pool-cleanup timer.
    const connections = Object.assign(
      Object.create(ConnectionsService.prototype),
      {
        prisma,
        permissionsService: permissions,
      },
    ) as ConnectionsService;
    const authorize = jest.spyOn(connections, 'getMigrationConnection');
    const job = {
      id: 'policy-job',
      data: { userId: 'member', dto },
      progress: {} as Record<string, unknown>,
      getState: jest.fn(async () => 'active'),
      updateProgress: jest.fn(async (progress: Record<string, unknown>) => {
        job.progress = { ...progress };
      }),
    };
    const queue = {
      getJob: jest.fn(async () => job),
      add: jest.fn(async (_name: string, data: typeof job.data) => {
        job.data = data;
        return job;
      }),
    };
    const freshness = {
      invalidateConnection: jest.fn(async () => {}),
      invalidatePartialWrite: jest.fn(async () => {}),
    };
    const service = new MigrationService(
      connections,
      factory as never,
      new MigrationComparisonService(),
      queue as never,
      freshness as never,
    );
    return {
      service,
      records,
      state,
      policies,
      dto,
      job,
      queue,
      factory,
      source,
      target,
      sourcePool,
      targetPool,
      authorize,
      freshness,
    };
  }

  const denials = [
    {
      name: 'membership removed',
      change: (f: ReturnType<typeof setup>) => {
        f.state.member = false;
      },
    },
    {
      name: 'source READ resource permission removed',
      change: (f: ReturnType<typeof setup>) => {
        f.policies.source.MEMBER = [];
      },
    },
    {
      name: 'target WRITE resource permission removed',
      change: (f: ReturnType<typeof setup>) => {
        f.policies.target.MEMBER = [Permission.READ];
      },
    },
    {
      name: 'source import/export disabled',
      change: (f: ReturnType<typeof setup>) => {
        f.records.source.allowImportExport = false;
      },
    },
    {
      name: 'target import/export disabled',
      change: (f: ReturnType<typeof setup>) => {
        f.records.target.allowImportExport = false;
      },
    },
    {
      name: 'target readOnly enabled',
      change: (f: ReturnType<typeof setup>) => {
        f.records.target.readOnly = true;
      },
    },
    {
      name: 'source role blocked',
      change: (f: ReturnType<typeof setup>) => {
        f.records.source.roleQueryModes = { MEMBER: 'blocked' };
      },
    },
    {
      name: 'target role changed to readonly',
      change: (f: ReturnType<typeof setup>) => {
        f.records.target.roleQueryModes = { MEMBER: 'readonly' };
      },
    },
    {
      name: 'target database removed from whitelist',
      change: (f: ReturnType<typeof setup>) => {
        f.records.target.allowedDatabases = ['private'];
      },
    },
  ];

  it.each(denials)(
    'denies $name at enqueue, preview and worker entry',
    async ({ change }) => {
      for (const entry of ['enqueue', 'preview', 'worker'] as const) {
        const f = setup();
        if (entry === 'worker') await f.service.startMigration('member', f.dto);
        change(f);
        const work =
          entry === 'enqueue'
            ? f.service.startMigration('member', f.dto)
            : entry === 'preview'
              ? f.service.previewMigration('member', f.dto)
              : f.service.runMigrationPipeline(
                  'member',
                  f.job.id,
                  f.job.data.dto,
                );

        await expect(work).rejects.toThrow();
        expect(f.factory.getStrategy).not.toHaveBeenCalled();
        expect(f.source.createPool).not.toHaveBeenCalled();
        expect(f.target.createPool).not.toHaveBeenCalled();
        expect(f.target.importData).not.toHaveBeenCalled();
        expect(f.queue.add).toHaveBeenCalledTimes(entry === 'worker' ? 1 : 0);
        if (entry === 'worker') expect(f.job.progress.stage).toBe('failed');
      }
    },
  );

  it.each(denials)(
    'rechecks $name after metadata for both preview and worker',
    async ({ change }) => {
      for (const entry of ['preview', 'worker'] as const) {
        const f = setup();
        f.target.getFullMetadata.mockImplementationOnce(async () => {
          change(f);
          return { columns, indices: [] };
        });
        const work =
          entry === 'preview'
            ? f.service.previewMigration('member', f.dto)
            : f.service.runMigrationPipeline('member', f.job.id, f.dto);

        await expect(work).rejects.toThrow();
        expect(f.source.exportStream).not.toHaveBeenCalled();
        expect(f.target.importData).not.toHaveBeenCalled();
        expect(f.source.closePool).toHaveBeenCalledWith(f.sourcePool);
        expect(f.target.closePool).toHaveBeenCalledWith(f.targetPool);
      }
    },
  );

  it('rechecks before target metadata when policy changes during source metadata', async () => {
    const f = setup();
    f.source.getFullMetadata.mockImplementationOnce(async () => {
      f.records.target.allowImportExport = false;
      return { columns, indices: [] };
    });

    await expect(f.service.previewMigration('member', f.dto)).rejects.toThrow(
      /disabled/i,
    );
    expect(f.target.getFullMetadata).not.toHaveBeenCalled();
    expect(f.source.closePool).toHaveBeenCalledTimes(1);
    expect(f.target.closePool).toHaveBeenCalledTimes(1);
  });

  it('rechecks before metadata if policy changes while connecting', async () => {
    const f = setup();
    f.target.createPool.mockImplementationOnce(async () => {
      f.state.member = false;
      return f.targetPool;
    });

    await expect(f.service.previewMigration('member', f.dto)).rejects.toThrow();
    expect(f.source.getFullMetadata).not.toHaveBeenCalled();
    expect(f.target.getFullMetadata).not.toHaveBeenCalled();
    expect(f.source.closePool).toHaveBeenCalledTimes(1);
    expect(f.target.closePool).toHaveBeenCalledTimes(1);
  });

  it('denies policy changes during stream acquisition before the first target write', async () => {
    const f = setup();
    f.source.exportStream.mockImplementationOnce(async () => {
      f.records.target.roleQueryModes = { MEMBER: 'readonly' };
      return Readable.from([{ id: 1 }], { objectMode: true });
    });

    await expect(
      f.service.runMigrationPipeline('member', f.job.id, f.dto),
    ).rejects.toThrow(/read.only/i);
    expect(f.target.importData).not.toHaveBeenCalled();
    expect(f.job.progress.stage).toBe('failed');
  });

  it('stops subsequent batches after revocation but keeps committed rows and freshness', async () => {
    const f = setup();
    f.source.exportStream.mockResolvedValueOnce(
      Readable.from(
        Array.from({ length: 2001 }, (_, id) => ({ id })),
        { objectMode: true },
      ),
    );
    f.target.importData.mockImplementationOnce(async (_pool, params) => {
      f.records.target.allowImportExport = false;
      return { success: true, rowCount: params.data.length };
    });

    await expect(
      f.service.runMigrationPipeline('member', f.job.id, f.dto),
    ).rejects.toThrow(/disabled/i);
    expect(f.target.importData).toHaveBeenCalledTimes(1);
    expect(f.job.progress).toMatchObject({
      stage: 'failed',
      processedRows: 2000,
      batchesProcessed: 1,
    });
    expect(f.freshness.invalidateConnection).toHaveBeenCalledWith(
      'target',
      database,
    );
    expect(f.source.closePool).toHaveBeenCalledTimes(1);
    expect(f.target.closePool).toHaveBeenCalledTimes(1);
  });

  it.each(['mysql', 'mariadb', 'clickhouse'])(
    'uses one effective %s database for canonical DTO, pools, metadata, writes and freshness',
    async (type) => {
      const f = setup();
      f.records.source.type = type;
      f.records.source.database = 'allowed';
      f.records.target.type = type;
      f.records.target.database = 'legacy';
      const dto = {
        ...f.dto,
        sourceSchema: ' ',
        sourceTable: ' items ',
        targetSchema: ' allowed ',
        targetTable: ' items_copy ',
      };
      await f.service.startMigration('member', dto);
      expect(f.job.data.dto).toEqual({
        ...f.dto,
        sourceSchema: 'allowed',
        targetSchema: 'allowed',
      });
      await f.service.runMigrationPipeline('member', f.job.id, f.job.data.dto);

      expect(f.source.createPool).toHaveBeenCalledWith(
        expect.objectContaining({ database }),
      );
      expect(f.target.createPool).toHaveBeenCalledWith(
        expect.objectContaining({ database }),
      );
      expect(f.source.getFullMetadata).toHaveBeenCalledWith(
        f.sourcePool,
        database,
        'items',
        database,
      );
      expect(f.target.getFullMetadata).toHaveBeenCalledWith(
        f.targetPool,
        database,
        'items_copy',
        database,
      );
      expect(f.source.exportStream).toHaveBeenCalledWith(
        f.sourcePool,
        database,
        'items',
      );
      expect(f.target.importData).toHaveBeenCalledWith(f.targetPool, {
        schema: database,
        table: 'items_copy',
        data: [{ id: 1 }, { id: 2 }],
      });
      expect(f.freshness.invalidateConnection).toHaveBeenCalledWith(
        'target',
        database,
      );
      expect(f.freshness.invalidateConnection).not.toHaveBeenCalledWith(
        'target',
        'legacy',
      );
      expect(f.records.target.database).toBe('legacy');
    },
  );

  it('denies forbidden ClickHouse schema databases at enqueue, preview and worker before pools', async () => {
    for (const entry of ['enqueue', 'preview', 'worker'] as const) {
      const f = setup();
      f.records.source.type = 'clickhouse';
      f.records.target.type = 'clickhouse';
      const dto = {
        ...f.dto,
        sourceSchema: 'allowed',
        targetSchema: 'private',
      };
      const work =
        entry === 'enqueue'
          ? f.service.startMigration('member', dto)
          : entry === 'preview'
            ? f.service.previewMigration('member', dto)
            : f.service.runMigrationPipeline('member', f.job.id, dto);
      if (entry === 'worker') f.job.data.dto = dto;
      await expect(work).rejects.toThrow(/database.*private/i);
      expect(f.source.createPool).not.toHaveBeenCalled();
      expect(f.target.createPool).not.toHaveBeenCalled();
      expect(f.target.importData).not.toHaveBeenCalled();
      expect(f.queue.add).not.toHaveBeenCalled();
    }
  });

  it.each(['postgres', 'cockroach'])(
    'fails closed for omitted %s databases at enqueue, preview and worker',
    async (type) => {
      for (const side of ['source', 'target'] as const) {
        for (const entry of ['enqueue', 'preview', 'worker'] as const) {
          const f = setup();
          f.records[side].type = type;
          delete f.records[side].database;
          f.records[side].username = 'allowed';
          const work =
            entry === 'enqueue'
              ? f.service.startMigration('member', f.dto)
              : entry === 'preview'
                ? f.service.previewMigration('member', f.dto)
                : f.service.runMigrationPipeline('member', f.job.id, f.dto);
          await expect(work).rejects.toThrow(
            /explicit.*database|database.*required/i,
          );
          expect(f.source.createPool).not.toHaveBeenCalled();
          expect(f.target.createPool).not.toHaveBeenCalled();
          expect(f.target.importData).not.toHaveBeenCalled();
          expect(f.queue.add).not.toHaveBeenCalled();
        }
      }
    },
  );

  it('pins queued database and DTO independently of later saved-default and caller changes', async () => {
    const f = setup();
    await f.service.startMigration('member', f.dto);
    f.records.target.database = 'private';
    await f.service.runMigrationPipeline('member', f.job.id, {
      ...f.dto,
      targetTable: 'caller_retargeted_table',
    });

    expect(f.target.createPool).toHaveBeenCalledWith(
      expect.objectContaining({ database }),
    );
    expect(f.target.importData).toHaveBeenCalledWith(
      f.targetPool,
      expect.objectContaining({ table: 'items_copy' }),
    );
    expect(f.freshness.invalidateConnection).toHaveBeenCalledWith(
      'target',
      database,
    );
  });

  it.each(['host', 'type'] as const)(
    'rejects queued %s changes before creating pools',
    async (field) => {
      const f = setup();
      await f.service.startMigration('member', f.dto);
      f.records.target[field] = field === 'host' ? '127.0.0.2' : 'mysql';
      // Keep policy permissive so endpoint identity, not a whitelist denial,
      // is what proves a changed connection cannot run the queued plan.
      f.records.target.allowedDatabases = ['allowed', 'public'];

      await expect(
        f.service.runMigrationPipeline('member', f.job.id, f.job.data.dto),
      ).rejects.toThrow(/changed|endpoint/i);
      expect(f.source.createPool).not.toHaveBeenCalled();
      expect(f.target.createPool).not.toHaveBeenCalled();
      expect(f.target.importData).not.toHaveBeenCalled();
    },
  );

  it('rejects endpoint identity changes during metadata without writing through an old pool', async () => {
    const f = setup();
    f.target.getFullMetadata.mockImplementationOnce(async () => {
      f.records.target.host = '127.0.0.2';
      return { columns, indices: [] };
    });
    await expect(
      f.service.runMigrationPipeline('member', f.job.id, f.dto),
    ).rejects.toThrow(/changed|endpoint/i);
    expect(f.source.exportStream).not.toHaveBeenCalled();
    expect(f.target.importData).not.toHaveBeenCalled();
    expect(f.source.closePool).toHaveBeenCalledTimes(1);
    expect(f.target.closePool).toHaveBeenCalledTimes(1);
  });

  it('rejects the same canonical database/schema/table through duplicated connection aliases', async () => {
    const f = setup();
    await expect(
      f.service.startMigration('member', {
        ...f.dto,
        sourceSchema: ' public ',
        targetSchema: '',
        targetTable: ' items ',
      }),
    ).rejects.toThrow(/same table/i);
    expect(f.queue.add).not.toHaveBeenCalled();
  });

  it('does not retarget an existing pool when the saved database changes during metadata', async () => {
    const f = setup();
    f.target.getFullMetadata.mockImplementationOnce(async () => {
      f.records.target.database = 'private';
      return { columns, indices: [] };
    });
    await f.service.runMigrationPipeline('member', f.job.id, f.dto);

    expect(f.freshness.invalidateConnection).toHaveBeenCalledWith(
      'target',
      database,
    );
    expect(f.authorize).toHaveBeenLastCalledWith(
      'target',
      'member',
      expect.objectContaining({ database }),
    );
  });

  it('freezes canonical table names before asynchronous metadata work', async () => {
    const f = setup();
    const dto = {
      ...f.dto,
      sourceTable: ' items ',
      targetTable: ' items_copy ',
    };
    f.target.getFullMetadata.mockImplementationOnce(async () => {
      dto.sourceTable = 'unexpected_source';
      dto.targetTable = 'unexpected_target';
      return { columns, indices: [] };
    });
    await f.service.runMigrationPipeline('member', f.job.id, dto);

    expect(f.source.exportStream).toHaveBeenCalledWith(
      f.sourcePool,
      'public',
      'items',
    );
    expect(f.target.importData).toHaveBeenCalledWith(
      f.targetPool,
      expect.objectContaining({
        schema: 'public',
        table: 'items_copy',
      }),
    );
  });
});
