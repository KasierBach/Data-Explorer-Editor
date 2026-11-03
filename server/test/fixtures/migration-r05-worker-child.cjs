const assert = require('node:assert/strict');
const { createE2eEnvironment } = require('../e2e-environment.cjs');
process.env = createE2eEnvironment(process.env);
const { Logger } = require('@nestjs/common');
Logger.overrideLogger([]);
const { Queue, Worker } = require('bullmq');
const { MigrationService } = require('../../src/migration/migration.service');
const {
  MigrationProcessor,
} = require('../../src/migration/migration.processor');
const {
  MigrationComparisonService,
} = require('../../src/migration/migration-comparison.service');
const {
  PostgresStrategy,
} = require('../../src/database-strategies/postgres.strategy');
const [queueName, sourceTable, targetTable, mode] = process.argv.slice(2);
assert(/^r05-replay-[0-9a-f]+$/.test(queueName));
assert([sourceTable, targetTable].every((x) => /^r05_[a-z0-9_]+$/.test(x)));
const db = new URL(process.env.E2E_DATABASE_URL),
  redis = new URL(process.env.E2E_REDIS_URL);
const config = {
  host: db.hostname,
  port: Number(db.port),
  username: decodeURIComponent(db.username),
  password: decodeURIComponent(db.password),
  database: db.pathname.slice(1),
  type: 'postgres',
};
const connection = {
  host: redis.hostname,
  port: Number(redis.port),
  db: Number(redis.pathname.slice(1)),
  maxRetriesPerRequest: null,
};
const queue = new Queue(queueName, { connection }),
  source = new PostgresStrategy(),
  target = new PostgresStrategy();
for (const strategy of [source, target]) {
  const create = strategy.createPool.bind(strategy);
  strategy.createPool = (options) => {
    const pool = create(options);
    pool.options.application_name = queueName;
    return pool;
  };
}
if (mode === 'interrupt') {
  const write = target.importData.bind(target);
  target.importData = async (...args) => {
    await write(...args);
    process.send({ type: 'committed' });
    await new Promise(() => {});
  };
}
const service = new MigrationService(
  {
    getMigrationConnection: async (id, _userId, options) => ({
      ...config,
      id,
      name: id,
      database: options.database || config.database,
    }),
  },
  { getStrategy: () => (factoryCalls++ % 2 === 0 ? source : target) },
  new MigrationComparisonService(),
  queue,
  {
    invalidateConnection: async () => {},
    invalidatePartialWrite: async () => {},
  },
);
let factoryCalls = 0;
const processor = new MigrationProcessor(service);
const worker = new Worker(queueName, (job) => processor.process(job), {
  connection,
  lockDuration: 1000,
  stalledInterval: 500,
});
worker.on('error', (error) =>
  process.send?.({ type: 'worker-error', message: error.message }),
);
process.on('message', async (message) => {
  if (message !== 'close') return;
  try {
    await worker.close();
    await queue.close();
    process.disconnect();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
});
worker
  .waitUntilReady()
  .then(() => process.send({ type: 'ready' }))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
