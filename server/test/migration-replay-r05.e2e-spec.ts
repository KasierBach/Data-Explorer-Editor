import { fork, ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Queue, QueueEvents } from 'bullmq';
import { Pool } from 'pg';

describe('R05 abrupt worker interruption and stalled-job replay', () => {
  const suffix = randomUUID().replace(/-/g, ''),
    queueName = `r05-replay-${suffix}`,
    source = `r05_replay_source_${suffix}`,
    target = `r05_replay_target_${suffix}`;
  const children: ChildProcess[] = [];
  let postgres: Pool, queue: Queue, events: QueueEvents;
  const message = (child: ChildProcess, type: string) =>
    new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(deadline);
        child.off('message', received);
        child.off('exit', exited);
      };
      const received = (value: { type?: string; message?: string }) => {
        if (value.type === 'worker-error') {
          cleanup();
          reject(new Error(value.message));
        } else if (value.type === type) {
          cleanup();
          resolve();
        }
      };
      const exited = (code: number | null) => {
        cleanup();
        reject(new Error(`R05 worker exited ${code} before ${type}`));
      };
      const deadline = setTimeout(() => {
        cleanup();
        reject(new Error(`R05 worker did not send ${type} within 15s`));
      }, 15000);
      child.on('message', received);
      child.once('exit', exited);
    });
  const launch = (mode: string) => {
    const child = fork(
      join(__dirname, 'fixtures', 'migration-r05-worker-child.cjs'),
      [queueName, source, target, mode],
      {
        cwd: join(__dirname, '..'),
        execArgv: ['--require', 'ts-node/register/transpile-only'],
        env: process.env,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      },
    );
    children.push(child);
    let errors = '';
    child.stderr!.on('data', (data) => {
      errors += String(data);
    });
    child.once('exit', (code) => {
      if (code && errors) console.error(errors);
    });
    return child;
  };
  beforeAll(async () => {
    const redis = new URL(process.env.E2E_REDIS_URL!);
    const connection = {
      host: redis.hostname,
      port: Number(redis.port),
      db: Number(redis.pathname.slice(1)),
    };
    queue = new Queue(queueName, { connection });
    events = new QueueEvents(queueName, { connection });
    await events.waitUntilReady();
    postgres = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    await postgres.query(
      `CREATE TABLE ${source}(id INTEGER,note TEXT); INSERT INTO ${source} SELECT n,'row-'||n FROM generate_series(1,5)n; CREATE TABLE ${target}(id INTEGER,note TEXT)`,
    );
  });
  afterAll(async () => {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
    try {
      await queue?.obliterate({ force: true });
      await postgres?.query(
        `DROP TABLE IF EXISTS ${source};DROP TABLE IF EXISTS ${target}`,
      );
    } finally {
      await Promise.all([queue?.close(), events?.close(), postgres?.end()]);
    }
  });
  it('fails a recovered job after a committed batch instead of appending duplicates, including manual retry', async () => {
    const first = launch('interrupt');
    await message(first, 'ready');
    const committed = message(first, 'committed');
    const job = await queue.add(
      'migration-job',
      {
        userId: 'fixture-owner',
        dto: {
          sourceConnectionId: 'source',
          targetConnectionId: 'target',
          sourceSchema: 'public',
          targetSchema: 'public',
          sourceTable: source,
          targetTable: target,
        },
      },
      { attempts: 1, removeOnComplete: false, removeOnFail: false },
    );
    await committed;
    expect(
      (await postgres.query(`SELECT count(*)::int AS n FROM ${target}`)).rows,
    ).toEqual([{ n: 5 }]);
    const snapshot = await queue.getJob(job.id!);
    expect(snapshot!.progress).toMatchObject({
      stage: 'streaming',
      processedRows: 0,
    });
    const firstExit = once(first, 'exit');
    first.kill();
    await firstExit;
    const recovered = launch('recover');
    await message(recovered, 'ready');
    await expect(job.waitUntilFinished(events, 15000)).rejects.toThrow(
      /restarted safely/i,
    );
    await job.retry();
    await expect(job.waitUntilFinished(events, 15000)).rejects.toThrow(
      /restarted safely/i,
    );
    expect(
      (await postgres.query(`SELECT id,note FROM ${target} ORDER BY id`)).rows,
    ).toEqual(
      Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        note: `row-${i + 1}`,
      })),
    );
    const recoveredExit = once(recovered, 'exit');
    recovered.send('close');
    await recoveredExit;
    expect(
      (
        await postgres.query(
          'SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1',
          [queueName],
        )
      ).rows,
    ).toEqual([{ n: 0 }]);
  }, 45000);
});
