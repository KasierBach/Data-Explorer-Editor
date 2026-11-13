'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const runner = join(__dirname, 'fixtures/ai-model-role-runner.cjs');
const {
  appendAttemptJournal,
  cleanupRunResources,
  createDockerNativeExecutor,
  createModelEvaluationEnvironment,
  prepareReportOutput,
  publishReport,
  selectFailureStage,
} = require('./fixtures/ai-model-role-runner.cjs');

test('live runner creates output before attempts and retains journal when report publication fails', () => {
  const directory = mkdtempSync(join(tmpdir(), 'data-explorer-model-output-'));
  const reportPath = join(directory, 'nested', 'report.json');
  try {
    const { journalPath } = prepareReportOutput(reportPath);
    assert.equal(readFileSync(journalPath, 'utf8'), '');
    assert.throws(() => prepareReportOutput(reportPath), /EEXIST/);
    appendAttemptJournal(journalPath, 1, () =>
      Date.parse('2026-11-12T00:00:00.000Z'),
    );
    publishReport(reportPath, '{"existing":true}\n');
    assert.throws(
      () => publishReport(reportPath, '{"replacement":true}\n'),
      /EEXIST/,
    );
    assert.deepEqual(
      readFileSync(journalPath, 'utf8').trim().split('\n').map(JSON.parse),
      [{ ordinal: 1, admittedAt: '2026-11-12T00:00:00.000Z' }],
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('cleanup continues after native failure and promotes only a cleanup failure stage', async () => {
  const calls = [];
  const prisma = {
    aiGeneration: {
      findMany: async () => {
        calls.push('find');
        return [{ id: 'generation' }];
      },
      deleteMany: async () => calls.push('generation'),
    },
    aiGenerationFeedback: {
      deleteMany: async () => calls.push('feedback'),
    },
    aiProviderAttempt: {
      deleteMany: async () => calls.push('attempt'),
    },
    user: {
      deleteMany: async () => calls.push('user'),
    },
    $disconnect: async () => calls.push('prisma'),
  };
  const redis = {
    onModuleDestroy: async () => calls.push('redis'),
  };
  await assert.rejects(
    cleanupRunResources({
      nativeFixture: {
        close: async () => {
          calls.push('native');
          throw new Error('private failure');
        },
      },
      actorCreated: true,
      actorId: 'actor',
      actorEmail: 'actor@example.test',
      prisma,
      redis,
    }),
    /MODEL_EVAL_CLEANUP_FAILED/,
  );
  assert.deepEqual(calls, [
    'native',
    'find',
    'feedback',
    'attempt',
    'generation',
    'user',
    'prisma',
    'redis',
  ]);
  assert.equal(selectFailureStage('assessment', false), 'assessment');
  assert.equal(selectFailureStage('assessment', true), 'cleanup');
});
test('live runner accepts only the dedicated loopback ledger fixtures', () => {
  const valid = createModelEvaluationEnvironment(
    {
      E2E_DATABASE_URL:
        'postgresql://e2e:e2e-local-only@127.0.0.1:15432/data_explorer_e2e',
      E2E_REDIS_URL: 'redis://127.0.0.1:16379/15',
      AI_EVAL_RUNNER_CONTAINER: 'ai-eval-fixture0001-eval-runner-1',
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
    },
    {
      BEEKNOEE_API_KEY: 'fixture-key',
      BEEKNOEE_BASE_URL: 'https://platform.beeknoee.com/api/v1',
      BEEKNOEE_CHAT_MODEL: 'fixture-model',
    },
  );
  assert.equal(valid.DATABASE_URL, valid.E2E_DATABASE_URL);
  assert.equal(valid.REDIS_URL, valid.E2E_REDIS_URL);
  assert.equal(valid.ALLOW_INTERNAL_IPS, undefined);

  for (const patch of [
    {
      E2E_DATABASE_URL:
        'postgresql://e2e:e2e-local-only@remote.example.invalid:15432/data_explorer_e2e',
    },
    {
      E2E_DATABASE_URL:
        'postgresql://other:e2e-local-only@127.0.0.1:15432/data_explorer_e2e',
    },
    { E2E_REDIS_URL: 'redis://127.0.0.1:16379/0' },
    { E2E_REDIS_URL: 'redis://remote.example.invalid:16379/15' },
    { AI_EVAL_RUNNER_CONTAINER: 'other-container' },
  ])
    assert.throws(
      () =>
        createModelEvaluationEnvironment(
          {
            E2E_DATABASE_URL:
              'postgresql://e2e:e2e-local-only@127.0.0.1:15432/data_explorer_e2e',
            E2E_REDIS_URL: 'redis://127.0.0.1:16379/15',
            AI_EVAL_RUNNER_CONTAINER: 'ai-eval-fixture0001-eval-runner-1',
            ...patch,
          },
          {
            BEEKNOEE_API_KEY: 'fixture-key',
            BEEKNOEE_BASE_URL: 'https://platform.beeknoee.com/api/v1',
          },
        ),
      /MODEL_EVAL_FIXTURE_INVALID/,
    );
});

test('live runner validates native container ownership before spawning worker', () => {
  const name = 'ai-eval-fixture0001-eval-runner-1';
  const project = 'ai-eval-fixture0001';
  const valid = {
    Id: 'a'.repeat(64),
    State: { Running: true },
    Config: {
      User: 'node',
      Labels: {
        'ai.eval.profile': 'a12-native-fixture-v1',
        'com.docker.compose.service': 'eval-runner',
        'com.docker.compose.project': project,
      },
    },
    HostConfig: {
      NetworkMode: 'none',
      ReadonlyRootfs: true,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges:true'],
    },
    Mounts: [
      { Destination: '/workspace/server/node_modules', RW: false },
      { Destination: '/workspace/server/scripts/ai-eval', RW: false },
      {
        Destination:
          '/workspace/server/test/fixtures/ai-eval-native-runner.mjs',
        RW: false,
      },
    ],
  };
  for (const patch of [
    { State: { Running: false } },
    { Config: { ...valid.Config, User: 'root' } },
    {
      Config: {
        ...valid.Config,
        Labels: {
          ...valid.Config.Labels,
          'com.docker.compose.project': 'other-project',
        },
      },
    },
    { HostConfig: { ...valid.HostConfig, NetworkMode: 'host' } },
    { Mounts: [{ Destination: '/workspace/server/scripts', RW: true }] },
  ])
    assert.throws(
      () =>
        createDockerNativeExecutor(name, () => ({
          status: 0,
          error: undefined,
          stdout: JSON.stringify([{ ...valid, ...patch }]),
        })),
      /MODEL_NATIVE_CONTAINER_INVALID/,
    );
});

test('live runner refuses missing arguments before config, stores, or providers', () => {
  const result = spawnSync(process.execPath, [runner], {
    cwd: join(__dirname, '..'),
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
    },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    code: 'MODEL_EVAL_RUN_ARGUMENTS_INVALID',
    stage: 'arguments',
  });
});

test('live runner refuses absent config files without echoing paths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'data-explorer-model-runner-'));
  try {
    const result = spawnSync(
      process.execPath,
      [
        runner,
        join(directory, 'missing.env'),
        join(directory, 'missing.json'),
        join(directory, 'report.json'),
      ],
      {
        cwd: join(__dirname, '..'),
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          WINDIR: process.env.WINDIR,
        },
        encoding: 'utf8',
        timeout: 5000,
      },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(existsSync(join(directory, 'attempt-journal.ndjson')), false);
    assert.deepEqual(JSON.parse(result.stderr), {
      code: 'MODEL_EVAL_FIXTURE_INVALID',
      stage: 'config',
    });
    assert.ok(!result.stderr.includes(directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
