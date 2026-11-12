import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const runner = '/workspace/server/test/fixtures/ai-eval-native-runner.mjs';
const scenarios = [
  'replay-dev',
  'replay-calibration',
  'replay-holdout',
  'forged-query',
  'forged-result',
  'sql-privileges',
  'mongo-privileges',
  'query-guards',
  'row-overflow',
  'immutable-handle',
  'cleanup-readback',
  'lock-deadline',
  'cleanup-refusal',
  'mongo-marker-ack-loss',
  'close-seed-phase',
  'model-native-worker',
];

/** Native drivers run in a fresh Node process, not Jest's ESM/module facade. */
describe('A12 native PostgreSQL and authenticated Mongo fixture replay', () => {
  let containerId: string;
  let project: string;
  const reports: Record<string, unknown>[] = [];
  beforeAll(async () => {
    const name = process.env.AI_EVAL_RUNNER_CONTAINER;
    if (!name || !/^ai-eval-[a-z0-9-]{8,80}-eval-runner-1$/.test(name))
      throw new Error('Native evaluation runner must be explicitly owned');
    const result = await execute('docker', ['inspect', name], {
      timeout: 10000,
      maxBuffer: 128 * 1024,
    });
    const inspected = JSON.parse(result.stdout) as Array<{
      Id: string;
      State: { Running: boolean };
      Config: { User: string; Labels: Record<string, string> };
      HostConfig: {
        NetworkMode: string;
        ReadonlyRootfs: boolean;
        CapDrop: string[];
        SecurityOpt: string[];
      };
      Mounts: Array<{ Destination: string; RW: boolean }>;
    }>;
    if (inspected.length !== 1)
      throw new Error('Native evaluation runner is ambiguous');
    const container = inspected[0];
    expect(container.State.Running).toBe(true);
    expect(container.Config.Labels['ai.eval.profile']).toBe(
      'a12-native-fixture-v1',
    );
    expect(container.Config.Labels['com.docker.compose.service']).toBe(
      'eval-runner',
    );
    expect(container.Config.Labels['com.docker.compose.project']).toBe(
      name.slice(0, -'-eval-runner-1'.length),
    );
    expect(container.Config.User).toBe('node');
    expect(container.HostConfig.NetworkMode).toBe('none');
    expect(container.HostConfig.ReadonlyRootfs).toBe(true);
    expect(container.HostConfig.CapDrop).toContain('ALL');
    expect(container.HostConfig.SecurityOpt).toContain(
      'no-new-privileges:true',
    );
    expect(container.Mounts).toHaveLength(3);
    expect(
      container.Mounts.every(
        (mount) =>
          !mount.RW && mount.Destination.startsWith('/workspace/server/'),
      ),
    ).toBe(true);
    project = name.slice(0, -'-eval-runner-1'.length);
    containerId = container.Id;
  }, 15000);
  afterAll(async () => {
    if (!project) return;
    const summary = {
      formatVersion: 1,
      evidence: 'NATIVE_FIXTURE_REPLAY_NOT_MODEL_ACCURACY_CERTIFICATION',
      networkIsolation: 'NETWORK_NONE_SHARED_LOOPBACK',
      expectedScenarios: scenarios.length,
      completedScenarios: reports.length,
      allPassed: reports.length === scenarios.length,
      scenarios: reports,
      deploymentAuthorized: false,
      certification: 'NOT_CERTIFIED',
    };
    const text = JSON.stringify(summary, null, 2);
    if (Buffer.byteLength(text) > 128 * 1024)
      throw new Error('Native report exceeded its metadata bound');
    await writeFile(
      join(tmpdir(), `${project}-native-results.json`),
      `${text}\n`,
      { flag: 'wx', mode: 0o600 },
    );
  });
  it.each(scenarios)(
    'verifies %s with restricted synthetic fixtures and scoped cleanup',
    async (scenario) => {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: 'test',
        CI: 'true',
        NO_COLOR: '1',
      };
      for (const key of [
        'PATH',
        'Path',
        'SystemRoot',
        'SYSTEMROOT',
        'ComSpec',
        'TEMP',
        'TMP',
        'TMPDIR',
        'HOME',
      ]) {
        if (process.env[key] !== undefined) env[key] = process.env[key];
      }
      const result = await execute(
        'docker',
        ['exec', containerId, 'node', runner, '--scenario', scenario],
        {
          cwd: join(__dirname, '..'),
          env,
          timeout: 35000,
          maxBuffer: 128 * 1024,
          windowsHide: true,
        },
      );
      expect(result.stderr).toBe('');
      const summary: {
        scenario: string;
        passed: boolean;
        cleanupVerified: boolean;
        providerCalls: number;
        semanticModelAccuracy: string;
        deploymentAuthorized: boolean;
        report?: Record<string, unknown>;
      } = JSON.parse(result.stdout);
      expect(summary).toMatchObject({
        scenario,
        passed: true,
        cleanupVerified: true,
        providerCalls: 0,
        semanticModelAccuracy: 'NOT_ASSESSED',
        deploymentAuthorized: false,
      });
      reports.push({
        scenario,
        passed: summary.passed,
        cleanupVerified: summary.cleanupVerified,
        providerCalls: summary.providerCalls,
        semanticModelAccuracy: summary.semanticModelAccuracy,
        deploymentAuthorized: summary.deploymentAuthorized,
        ...(summary.report ? { report: summary.report } : {}),
      });
    },
    40000,
  );
});
