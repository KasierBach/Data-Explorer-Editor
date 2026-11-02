import { Readable, PassThrough } from 'node:stream';
import { MigrationService } from './migration.service';
import { MigrationProcessor } from './migration.processor';
import { MigrationComparisonService } from './migration-comparison.service';
import type { ConnectionsService } from '../connections/connections.service';
import type { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import type { Job, Queue } from 'bullmq';
import { MigrationController } from './migration.controller';
import type { TokenService } from '../auth/token.service';
import type { IDatabaseStrategy } from '../database-strategies/database-strategy.interface';

function setup() {
  const dto = {
    sourceConnectionId: 'source',
    targetConnectionId: 'target',
    sourceSchema: 'public',
    targetSchema: 'main',
    sourceTable: 'items',
    targetTable: 'items_copy',
  };
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
    importData: jest.fn<
      ReturnType<IDatabaseStrategy['importData']>,
      Parameters<IDatabaseStrategy['importData']>
    >(async () => ({ success: true, rowCount: 2 })),
  };
  const connections = {
    getDecryptedConnection: jest.fn(async (id: string) => ({
      id,
      name: id,
      type: id === 'source' ? 'postgres' : 'sqlite',
    })),
  };
  const factory = {
    getStrategy: (type: string) => (type === 'postgres' ? source : target),
  };
  const job = {
    id: 'r05-job',
    data: { userId: 'owner', dto },
    progress: {} as Record<string, unknown>,
    failedReason: undefined as string | undefined,
    getState: jest.fn(async () => 'active'),
    updateProgress: jest.fn(async (progress: Record<string, unknown>) => {
      job.progress = { ...progress };
    }),
    moveToFailed: jest.fn(async () => {
      throw new Error('Wrong worker lock token');
    }),
  };
  const queue = {
    getJob: jest.fn(async () => job),
    add: jest.fn(async () => job),
  };
  const service = new MigrationService(
    connections as unknown as ConnectionsService,
    factory as unknown as DatabaseStrategyFactory,
    new MigrationComparisonService(),
    queue as unknown as Queue,
    {
      invalidateConnection: jest.fn(),
      invalidatePartialWrite: jest.fn(),
    } as never,
  );
  const processor = new MigrationProcessor(service);
  return {
    service,
    processor,
    job,
    dto,
    source,
    target,
    sourcePool,
    targetPool,
  };
}

describe('R05 migration lifecycle invariants', () => {
  it('records committed rows before a cache failure terminates the transfer', async () => {
    const f = setup();
    jest
      .spyOn(f.service['freshnessService'], 'invalidateConnection')
      .mockRejectedValueOnce(new Error('cache unavailable'));
    await expect(
      f.service.runMigrationPipeline('owner', f.job.id, f.dto),
    ).rejects.toThrow('cache unavailable');
    expect(f.job.progress.processedRows).toBe(2);
    expect(f.target.importData).toHaveBeenCalledTimes(1);
  });

  it('never retries a committed import because a later cache error resembles a driver rejection', async () => {
    const f = setup();
    f.source.exportStream.mockResolvedValueOnce(
      Readable.from(
        Array.from({ length: 501 }, (_, id) => ({ id })),
        { objectMode: true },
      ),
    );
    f.target.importData.mockImplementation(
      async (_pool: unknown, params: { data: unknown[] }) => ({
        success: true,
        rowCount: params.data.length,
      }),
    );
    jest
      .spyOn(f.service['freshnessService'], 'invalidateConnection')
      .mockRejectedValueOnce(
        Object.assign(new Error('too many SQL variables'), {
          code: 'SQLITE_ERROR',
        }),
      );
    await expect(
      f.service.runMigrationPipeline('owner', f.job.id, f.dto),
    ).rejects.toThrow('too many SQL variables');
    expect(f.job.progress.processedRows).toBe(500);
    expect(f.target.importData).toHaveBeenCalledTimes(1);
  });

  it('releases both pools when preview preflight rejects', async () => {
    const f = setup();
    f.source.getFullMetadata.mockRejectedValueOnce(
      new Error('metadata unavailable'),
    );
    await expect(f.service.previewMigration('owner', f.dto)).rejects.toThrow(
      'metadata unavailable',
    );
    expect(f.source.closePool).toHaveBeenCalledWith(f.sourcePool);
    expect(f.target.closePool).toHaveBeenCalledWith(f.targetPool);
  });
  it('propagates the original stream failure to the owning worker instead of manually failing with a fake lock', async () => {
    const f = setup();
    f.source.exportStream.mockRejectedValueOnce(
      new Error('source read failed'),
    );
    await expect(f.processor.process(f.job as unknown as Job)).rejects.toThrow(
      'source read failed',
    );
    expect(f.job.moveToFailed).not.toHaveBeenCalled();
    expect(f.job.progress).toMatchObject({ stage: 'failed' });
    expect(f.source.closePool).toHaveBeenCalledTimes(1);
    expect(f.target.closePool).toHaveBeenCalledTimes(1);
  });
  it('refuses a replay after streaming began even before a progress counter was persisted', async () => {
    const f = setup();
    f.job.progress = {
      stage: 'streaming',
      processedRows: 0,
      batchesProcessed: 0,
    };
    await expect(f.processor.process(f.job as unknown as Job)).rejects.toThrow(
      /interrupted|restart|retry/i,
    );
    expect(f.source.exportStream).not.toHaveBeenCalled();
    expect(f.target.importData).not.toHaveBeenCalled();
  });
  it('publishes completed progress only after the last batch, and closes pools', async () => {
    const f = setup(),
      updates: unknown[] = [];
    f.service.eventEmitter.on(`migration-${f.job.id}`, (progress) =>
      updates.push(progress),
    );
    await expect(f.processor.process(f.job as unknown as Job)).resolves.toEqual(
      { success: true },
    );
    expect(f.job.progress).toMatchObject({
      stage: 'completed',
      processedRows: 2,
      batchesProcessed: 1,
    });
    expect(updates.at(-1)).toMatchObject({
      status: 'completed',
      stage: 'completed',
      processedRows: 2,
    });
    expect(f.source.closePool).toHaveBeenCalledTimes(1);
    expect(f.target.closePool).toHaveBeenCalledTimes(1);
  });
  it('rejects source close-before-end instead of waiting forever and detaches listeners', async () => {
    const f = setup(),
      stream = new PassThrough({ objectMode: true });
    f.source.exportStream.mockResolvedValueOnce(stream);
    const task = f.processor.process(f.job as unknown as Job);
    const rejection = expect(task).rejects.toThrow(/closed|premature/i);
    await new Promise<void>((resolve) => setImmediate(resolve));
    stream.destroy();
    await rejection;
    expect(f.target.importData).not.toHaveBeenCalled();
    expect(
      stream.listenerCount('data') +
        stream.listenerCount('row') +
        stream.listenerCount('end'),
    ).toBe(0);
  });
  it('completes a progress subscription opened after the job already finished', async () => {
    const f = setup();
    f.job.progress = {
      stage: 'completed',
      status: 'completed',
      processedRows: 2,
      batchesProcessed: 1,
    };
    f.job.getState.mockResolvedValue('completed');
    const controller = new MigrationController(f.service, {
      verifyMigrationProgressTicket: () => ({ sub: 'owner', jobId: f.job.id }),
    } as unknown as TokenService);
    const completed = jest.fn();
    const subscription = controller
      .progress(f.job.id, 'fixture-ticket')
      .subscribe({ complete: completed });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const listeners = f.service.eventEmitter.listenerCount(
      `migration-${f.job.id}`,
    );
    subscription.unsubscribe();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(listeners).toBe(0);
  });
  it('does not retry a timed-out batch whose write may already have committed', async () => {
    const f = setup();
    f.source.exportStream.mockResolvedValueOnce(
      Readable.from(
        Array.from({ length: 1000 }, (_, id) => ({ id })),
        { objectMode: true },
      ),
    );
    f.target.importData.mockRejectedValueOnce(
      new Error('Request timeout while writing batch'),
    );
    await expect(f.processor.process(f.job as unknown as Job)).rejects.toThrow(
      /timeout/i,
    );
    expect(f.target.importData).toHaveBeenCalledTimes(1);
  });
  it.each([
    { success: false, rowCount: 0 },
    { success: true, rowCount: 1 },
  ])(
    'does not report completion for an incomplete target acknowledgment %j',
    async (response) => {
      const f = setup();
      f.target.importData.mockResolvedValueOnce(response);
      await expect(
        f.processor.process(f.job as unknown as Job),
      ).rejects.toThrow(/target.*rows|imported/i);
      expect(f.job.progress).toMatchObject({
        stage: 'failed',
        processedRows: response.rowCount,
      });
      expect(f.target.importData).toHaveBeenCalledTimes(1);
    },
  );
  it('waits for an in-flight target write before closing pools after a source error', async () => {
    const f = setup(),
      stream = new PassThrough({ objectMode: true });
    f.source.exportStream.mockResolvedValueOnce(stream);
    let finish!: (result: { success: boolean; rowCount: number }) => void,
      started!: () => void;
    const writing = new Promise<void>((resolve) => {
      started = resolve;
    });
    f.target.importData.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
          started();
        }),
    );
    const task = f.processor.process(f.job as unknown as Job),
      rejection = expect(task).rejects.toThrow('source disconnected');
    await new Promise<void>((resolve) => setImmediate(resolve));
    for (let id = 0; id < 500; id++) stream.write({ id });
    await writing;
    stream.destroy(new Error('source disconnected'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const closedEarly = f.target.closePool.mock.calls.length;
    finish({ success: true, rowCount: 500 });
    await rejection;
    expect(closedEarly).toBe(0);
    expect(f.target.closePool).toHaveBeenCalledTimes(1);
    expect(f.target.importData).toHaveBeenCalledTimes(1);
    expect(f.job.progress).toMatchObject({
      stage: 'failed',
      processedRows: 500,
    });
  });
  it('stops remaining adaptive sub-batches after a source error during an in-flight write', async () => {
    const f = setup(),
      stream = new PassThrough({ objectMode: true });
    f.source.exportStream.mockResolvedValueOnce(stream);
    let finish!: (result: { success: boolean; rowCount: number }) => void,
      started!: () => void;
    const writing = new Promise<void>((resolve) => {
      started = resolve;
    });
    f.target.importData
      .mockRejectedValueOnce(
        Object.assign(new Error('too many SQL variables'), {
          code: 'SQLITE_ERROR',
        }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
            started();
          }),
      )
      .mockResolvedValue({ success: true, rowCount: 250 });
    const task = f.processor.process(f.job as unknown as Job),
      rejection = expect(task).rejects.toThrow('source disconnected');
    await new Promise<void>((resolve) => setImmediate(resolve));
    for (let id = 0; id < 500; id++) stream.write({ id });
    await writing;
    stream.destroy(new Error('source disconnected'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    finish({ success: true, rowCount: 250 });
    await rejection;
    expect(f.target.importData.mock.calls).toHaveLength(2);
    expect(f.job.progress).toMatchObject({
      stage: 'failed',
      processedRows: 250,
      batchesProcessed: 1,
    });
    expect(f.target.closePool).toHaveBeenCalledTimes(1);
  });
  it('normalizes a non-Error target failure before returning it to the worker', async () => {
    const f = setup();
    f.target.importData.mockRejectedValueOnce(null);
    await expect(f.processor.process(f.job as unknown as Job)).rejects.toThrow(
      'Migration pipeline failed.',
    );
    expect(f.job.progress).toMatchObject({ stage: 'failed', processedRows: 0 });
  });
});
