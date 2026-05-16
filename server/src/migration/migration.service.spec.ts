import { Test, TestingModule } from '@nestjs/testing';
import { MigrationService, MigrationJob } from './migration.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { getQueueToken } from '@nestjs/bullmq';
import { PassThrough } from 'stream';
import { MigrationComparisonService } from './migration-comparison.service';

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
    importData: jest.fn().mockResolvedValue({ success: true, rowCount: 0 }),
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

  const mockSourceConn = { id: 'src-1', name: 'Source DB', type: 'postgres' };
  const mockTargetConn = { id: 'tgt-1', name: 'Target DB', type: 'mongodb' };

  const baseDto = {
    sourceConnectionId: 'src-1',
    sourceSchema: 'public',
    sourceTable: 'users',
    targetConnectionId: 'tgt-1',
    targetSchema: '',
    targetTable: 'users',
  };

  const startPipeline = async (jobId: string, dto = baseDto) => {
    await service.runMigrationPipeline('user-1', jobId, dto);
    const job = mockJobs.get(jobId);
    if (job && !job.failedReason) {
      job.getState = jest.fn().mockResolvedValue('completed');
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

    mockConnectionsService = {
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

  it('should fail immediately if source connection is not found', async () => {
    mockConnectionsService.getDecryptedConnection.mockResolvedValue(null);

    const { jobId } = await service.startMigration('user-1', baseDto);
    await startPipeline(jobId, baseDto);

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('failed');
    expect(job.error).toContain('not found');
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

  it('should fail immediately when source and target point to the same table', async () => {
    const { jobId } = await service.startMigration('user-1', {
      ...baseDto,
      targetConnectionId: 'src-1',
      targetSchema: 'public',
      targetTable: 'users',
    });
    await startPipeline(jobId, {
      ...baseDto,
      targetConnectionId: 'src-1',
      targetSchema: 'public',
      targetTable: 'users',
    });

    const job = await service.getPublicJob(jobId, 'user-1');
    expect(job.status).toBe('failed');
    expect(job.error).toContain('same table');
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
});
