'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const runner = join(__dirname, 'fixtures/ai-model-role-runner.cjs');
const {
  appendAttemptJournal,
  cleanupRunResources,
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
    assert.deepEqual(JSON.parse(result.stderr), {
      code: 'MODEL_EVAL_RUN_FAILED',
      stage: 'config',
    });
    assert.ok(!result.stderr.includes(directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
