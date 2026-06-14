import { createRequire } from 'module';
import { performance } from 'perf_hooks';
import { PassThrough } from 'stream';
import { once } from 'events';

const require = createRequire(import.meta.url);
require('reflect-metadata');
require('ts-node/register/transpile-only');

const {
  MigrationService,
} = require('../../src/migration/migration.service.ts');
const {
  MigrationComparisonService,
} = require('../../src/migration/migration-comparison.service.ts');

function round(value) {
  return Number(value.toFixed(3));
}

function createQueueMock() {
  let counter = 0;
  const jobs = new Map();

  const queue = {
    async add(name, data) {
      counter += 1;
      const jobId = `bench-job-${counter}`;
      const job = {
        id: jobId,
        name,
        data,
        failedReason: undefined,
        progress: {
          stage: 'queued',
          processedRows: 0,
          batchesProcessed: 0,
        },
        state: 'waiting',
        async updateProgress(nextProgress) {
          this.progress = { ...this.progress, ...nextProgress };
          this.state = 'active';
        },
        async getState() {
          return this.state;
        },
        async moveToFailed(error) {
          this.failedReason = error.message;
          this.state = 'failed';
        },
      };

      jobs.set(jobId, job);
      return job;
    },
    async getJob(jobId) {
      return jobs.get(jobId);
    },
  };

  return {
    queue,
    jobs,
  };
}

function buildMetadata(sampleRow) {
  const row = sampleRow ?? { id: 1 };
  return {
    columns: Object.keys(row).map((name, index) => ({
      name,
      type: typeof row[name] === 'number' ? 'number' : 'text',
      isNullable: true,
      defaultValue: null,
      isPrimaryKey: index === 0,
      pkConstraintName: index === 0 ? 'pk_bench' : null,
    })),
    indices: [],
    rowCount: undefined,
  };
}

function makeRows(count, variant) {
  if (variant === 'wide') {
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      external_id: `user-${index + 1}`,
      first_name: `First-${index + 1}`,
      last_name: `Last-${index + 1}`,
      email: `user_${index + 1}@example.com`,
      status: index % 3 === 0 ? 'active' : 'inactive',
      tier: ['free', 'pro', 'enterprise'][index % 3],
      region: ['apac', 'emea', 'amer'][index % 3],
      score: index % 100,
      balance: Number((index * 1.37).toFixed(2)),
      bio: `Synthetic benchmark row ${index + 1} with intentionally wider text payload.`,
      notes: `This migration benchmark row ${index + 1} is used to approximate a wider insert payload.`,
      tag_1: `tag-${index % 10}`,
      tag_2: `tag-${index % 11}`,
      tag_3: `tag-${index % 12}`,
      flag_a: index % 2 === 0,
      flag_b: index % 5 === 0,
      flag_c: index % 7 === 0,
      created_at: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      updated_at: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    }));
  }

  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    email: `user_${index + 1}@example.com`,
    score: index % 100,
  }));
}

function createSourceStrategy(rows) {
  return {
    async createPool() {
      return 'source-pool';
    },
    async closePool() {},
    async getFullMetadata() {
      return buildMetadata(rows[0]);
    },
    async exportStream() {
      const stream = new PassThrough({ objectMode: true });
      queueMicrotask(async () => {
        try {
          for (const row of rows) {
            if (!stream.write(row)) {
              await once(stream, 'drain');
            }
          }
          stream.end();
        } catch (error) {
          stream.destroy(error);
        }
      });
      return stream;
    },
  };
}

function createTargetStrategy(rows, sink) {
  return {
    async createPool() {
      return 'target-pool';
    },
    async closePool() {},
    async getFullMetadata() {
      return buildMetadata(rows[0]);
    },
    async importData(_pool, params) {
      sink.processedRows += params.data.length;
      sink.batchesProcessed += 1;
      sink.maxBatchSize = Math.max(sink.maxBatchSize, params.data.length);
      return {
        success: true,
        rowCount: params.data.length,
      };
    },
  };
}

async function runScenario({ label, rowCount, variant }) {
  const rows = makeRows(rowCount, variant);
  const queueState = createQueueMock();
  const sink = {
    processedRows: 0,
    batchesProcessed: 0,
    maxBatchSize: 0,
  };

  const connectionsService = {
    async getDecryptedConnection(connectionId) {
      if (connectionId === 'src-1') {
        return {
          id: 'src-1',
          name: 'Source Bench',
          type: 'postgres',
          host: 'bench.local',
          database: 'main',
        };
      }

      if (connectionId === 'tgt-1') {
        return {
          id: 'tgt-1',
          name: 'Target Bench',
          type: 'mongodb',
          host: 'bench.local',
          database: 'main',
        };
      }

      return null;
    },
  };

  const strategyFactory = {
    getStrategy(type) {
      if (type === 'postgres') {
        return createSourceStrategy(rows);
      }

      return createTargetStrategy(rows, sink);
    },
  };

  const service = new MigrationService(
    connectionsService,
    strategyFactory,
    new MigrationComparisonService(),
    queueState.queue,
  );
  service.logger = {
    log() {},
    verbose() {},
    error() {},
  };

  const dto = {
    sourceConnectionId: 'src-1',
    sourceSchema: 'public',
    sourceTable: 'users',
    targetConnectionId: 'tgt-1',
    targetSchema: '',
    targetTable: 'users',
  };

  const { jobId } = await service.startMigration('user-1', dto);
  const startedAt = performance.now();
  await service.runMigrationPipeline('user-1', jobId, dto);
  const durationMs = performance.now() - startedAt;

  const job = queueState.jobs.get(jobId);
  if (job && job.state !== 'failed') {
    job.state = 'completed';
  }

  const finalJob = await service.getPublicJob(jobId, 'user-1');

  return {
    label,
    variant,
    rowCount,
    processedRows: finalJob.processedRows,
    batchesProcessed: finalJob.batchesProcessed,
    maxBatchSize: sink.maxBatchSize,
    durationMs: round(durationMs),
    rowsPerSecond: round(rowCount / Math.max(durationMs / 1000, 0.001)),
  };
}

async function main() {
  const payload = {
    benchmark: 'migration',
    startedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    notes: [
      'Exercises the current MigrationService streaming and batching path with mocked source and target strategies.',
      'Source rows are synthetic and streamed through a PassThrough object stream.',
      'Target importData is mocked so the result reflects coordinator overhead, batching, and event flow rather than live database write latency.',
    ],
    scenarios: [
      await runScenario({
        label: 'migration_narrow_20000',
        rowCount: 20_000,
        variant: 'narrow',
      }),
      await runScenario({
        label: 'migration_wide_20000',
        rowCount: 20_000,
        variant: 'wide',
      }),
    ],
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
