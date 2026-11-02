import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Pool } from 'pg';

describe('R05 native PostgreSQL streaming in an isolated process', () => {
  const table = `r05_stream_${randomUUID().replace(/-/g, '')}`;
  let postgres: Pool;
  beforeAll(async () => {
    postgres = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    await postgres.query(
      `CREATE TABLE ${table}(id INTEGER PRIMARY KEY,note TEXT); INSERT INTO ${table} SELECT n,'row-'||n FROM generate_series(1,5) n; CREATE VIEW ${table}_slow AS SELECT pg_sleep(2)::text AS wait`,
    );
  });
  afterAll(async () => {
    try {
      await postgres.query(
        `DROP VIEW IF EXISTS ${table}_slow; DROP TABLE IF EXISTS ${table}`,
      );
    } finally {
      await postgres.end();
    }
  });
  it.each(['five', 'source-error', 'deadline', 'disconnect'])(
    'handles %s without killing its process and releases the native client',
    async (mode) => {
      const result = await new Promise<{
        code: number | null;
        stdout: string;
        stderr: string;
      }>((resolve, reject) => {
        const child = fork(
          join(__dirname, 'fixtures', 'migration-r05-stream-child.cjs'),
          [
            mode,
            ['deadline', 'disconnect'].includes(mode) ? `${table}_slow` : table,
          ],
          {
            cwd: join(__dirname, '..'),
            execArgv: ['--require', 'ts-node/register/transpile-only'],
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          },
        );
        let stdout = '',
          stderr = '';
        child.stdout!.on('data', (data) => {
          stdout += data.toString();
        });
        child.stderr!.on('data', (data) => {
          stderr += data.toString();
        });
        const deadline = setTimeout(() => {
          child.kill();
          reject(new Error(`R05 child exceeded 15s: ${stderr}`));
        }, 15000);
        child.once('error', (error) => {
          clearTimeout(deadline);
          reject(error);
        });
        child.once('exit', (code) => {
          clearTimeout(deadline);
          resolve({ code, stdout, stderr });
        });
      });
      expect(result.stderr).not.toContain('TypeError');
      expect(result.code).toBe(0);
      const report = JSON.parse(result.stdout.trim().split('\n').at(-1)!);
      expect(report.poolTotal).toBe(0);
      expect(report.poolWaiting).toBe(0);
      expect(report.closed).toBe(true);
      if (mode === 'five') expect(report.rows).toHaveLength(5);
      else {
        expect(report.error).toMatch(
          mode === 'deadline'
            ? /timeout/i
            : mode === 'disconnect'
              ? /terminat|connection|socket/i
              : /does not exist/i,
        );
        if (mode === 'deadline') expect(report.elapsedMs).toBeLessThan(750);
      }
    },
    20000,
  );
});
