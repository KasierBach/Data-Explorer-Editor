import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessModelEvaluationPreflight,
  createModelAttemptBudget,
  classifyModelOperation,
  readBeeknoeeAssessmentRoster,
  runModelRoleAssessment,
  MODEL_ROLE_PROBES,
} from './model-role-assessment.mjs';

const roster = await readBeeknoeeAssessmentRoster();
const now = Date.parse('2026-11-11T12:00:00.000Z');
const authorization = {
  credentialPresent: true,
  zeroCostAuthorityVerified: true,
  policyVerified: true,
  ledgerVerified: true,
  recipient: 'https://platform.beeknoee.com',
  provider: 'beeknoee',
  modelIds: roster.map((item) => item.apiModel),
  authorizationId: 'user-approved-zero-usd-beeknoee',
  zeroCostEvidenceSha256: 'a'.repeat(64),
  expiresAt: now + 60000,
  deadlineAt: now + 60000,
};

test('the assessment roster comes from the single client Beeknoee catalog', () => {
  assert.equal(roster.length, 8);
  assert.equal(new Set(roster.map((item) => item.selectionId)).size, 8);
  assert.ok(
    roster.every((item) => item.selectionId === `beeknoee:${item.apiModel}`),
  );
  assert.ok(
    roster.some((item) => item.apiModel === 'bee-tok/claude-sonnet-5-5'),
  );
  assert.ok(roster.some((item) => item.apiModel === 'bee/gemini-4-argon'));
  assert.equal(MODEL_ROLE_PROBES.length, 8);
  assert.ok(
    MODEL_ROLE_PROBES.every((probe) => !Object.hasOwn(probe, 'expectedRows')),
  );
});

test('zero-cost preflight requires independent authority and every essential boundary', () => {
  assert.equal(
    assessModelEvaluationPreflight(authorization, roster, now).allowed,
    true,
  );
  for (const field of [
    'credentialPresent',
    'zeroCostAuthorityVerified',
    'policyVerified',
    'ledgerVerified',
  ]) {
    const result = assessModelEvaluationPreflight(
      { ...authorization, [field]: false },
      roster,
      now,
    );
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.length > 0);
  }
  for (const patch of [
    { provider: 'gemini' },
    { recipient: 'https://generativelanguage.googleapis.com' },
    { expiresAt: now },
    { deadlineAt: now },
    { modelIds: ['claude-sonnet-4-6'] },
    { authorizationId: '' },
    { zeroCostEvidenceSha256: 'not-a-hash' },
    { spendUsd: 1 },
    { force: true },
  ])
    assert.equal(
      assessModelEvaluationPreflight(
        { ...authorization, ...patch },
        roster,
        now,
      ).allowed,
      false,
    );
});

test('attempt admission is shared, sequential, finite and never renewed', () => {
  const budget = createModelAttemptBudget({
    maxAttempts: 2,
    deadlineAt: now + 50,
    now: () => now,
  });
  const first = budget.acquire();
  assert.throws(() => budget.acquire(), /MODEL_EVALUATION_BUSY/);
  first.release();
  first.release();
  const second = budget.acquire();
  assert.equal(budget.attempts, 2);
  second.release();
  assert.throws(() => budget.acquire(), /MODEL_EVALUATION_ATTEMPT_LIMIT/);
  assert.throws(
    () => createModelAttemptBudget({ maxAttempts: 81, deadlineAt: now + 50 }),
    /MODEL_EVALUATION_LIMIT_INVALID/,
  );
  assert.throws(
    () =>
      createModelAttemptBudget({
        maxAttempts: 1,
        deadlineAt: now - 1,
        now: () => now,
      }),
    /MODEL_EVALUATION_DEADLINE/,
  );
});

test('model operation failure reasons do not imply task incapability', () => {
  assert.equal(classifyModelOperation({ status: 401 }), 'auth-denied');
  assert.equal(classifyModelOperation({ status: 403 }), 'auth-denied');
  assert.equal(classifyModelOperation({ status: 429 }), 'rate-limited');
  assert.equal(classifyModelOperation({ status: 402 }), 'credits-required');
  assert.equal(classifyModelOperation({ status: 404 }), 'unavailable');
  assert.equal(
    classifyModelOperation({ code: 'AI_REQUEST_TIMEOUT' }),
    'timeout',
  );
  assert.equal(
    classifyModelOperation(new Error('API key SECRET customer query')),
    'operation-failed',
  );
});

test('blocked assessment reports each model unassessed without invoking an adapter', async () => {
  let dispatches = 0;
  const report = await runModelRoleAssessment({
    roster,
    authorization: {},
    now: () => now,
    adapter: {
      runProbe: async () => {
        dispatches++;
        throw new Error('must not run');
      },
    },
  });
  assert.equal(dispatches, 0);
  assert.equal(report.providerAttempts, 0);
  assert.equal(report.models.length, 8);
  assert.ok(
    report.models.every(
      (item) =>
        item.operationalStatus === 'not-assessed' &&
        item.recommendedRoles.length === 0,
    ),
  );
  assert.ok(
    report.models.every((item) =>
      item.roles.every((role) => role.verdict === 'not-assessed'),
    ),
  );
  assert.equal(report.semanticModelAccuracy, 'NOT_ASSESSED');
  assert.equal(report.deploymentAuthorized, false);
  assert.equal(report.cost, null);
  assert.ok(!JSON.stringify(report).includes('SECRET'));
});

test('a model auth/quota failure stops its probes and retains unknown capability and roles', async () => {
  const tried = [];
  const report = await runModelRoleAssessment({
    roster,
    authorization,
    now: () => now,
    adapter: {
      runProbe: async ({ model }, budget) => {
        const lease = budget.acquire();
        tried.push(model.apiModel);
        lease.release();
        throw { status: 429, message: 'SECRET' };
      },
    },
  });
  assert.equal(tried.length, 8);
  assert.equal(report.providerAttempts, 8);
  assert.ok(
    report.models.every((model) => model.operationalStatus === 'rate-limited'),
  );
  assert.ok(
    report.models.every(
      (model) =>
        model.recommendedRoles.length === 0 &&
        model.capabilities.vision.live === 'not-tested',
    ),
  );
  assert.ok(!JSON.stringify(report).includes('SECRET'));
});

test('quality and identity require evidence, not a producer score or requested-model echo', async () => {
  const report = await runModelRoleAssessment({
    roster: roster.slice(0, 1),
    authorization: { ...authorization, modelIds: [roster[0].apiModel] },
    now: () => now,
    adapter: {
      runProbe: async ({ probe }, budget) => {
        const lease = budget.acquire();
        lease.release();
        return {
          message: 'SMOKE_ACK',
          sql: undefined,
          elapsedMs: 1,
          ttftMs: null,
          reportedModel: null,
          usage: null,
          terminalVerified: true,
          probeId: probe.id,
          score: 100,
        };
      },
    },
  });
  assert.equal(report.models[0].reportedModel, null);
  assert.equal(report.models[0].identityEvidence, 'not-reported');
  assert.equal(report.models[0].recommendedRoles.length, 0);
  assert.ok(
    report.models[0].roles.find((item) => item.role === 'sql').verdict !==
      'observed-match',
  );
  assert.equal(report.semanticModelAccuracy, 'NOT_ASSESSED');
});

test('role recommendations require observed native matches and remain provisional', async () => {
  const first = roster[0];
  const expectedSql =
    'SELECT COUNT(*) AS total_rows, COUNT(amount) AS known_amounts FROM orders';
  const expectedMongo = {
    collection: 'invoices',
    pipeline: [
      { $match: { label: null } },
      { $sort: { id: 1 } },
      { $project: { _id: 0, id: 1 } },
    ],
  };
  const report = await runModelRoleAssessment({
    roster: [first],
    authorization: { ...authorization, modelIds: [first.apiModel] },
    now: () => now,
    nativeExecutor: async (engine, query) => {
      if (engine === 'sql' && query === expectedSql)
        return {
          columns: [
            { name: 'total_rows', type: 'integer', nullable: false },
            { name: 'known_amounts', type: 'integer', nullable: false },
          ],
          rows: [[6, 5]],
        };
      if (
        engine === 'mongo' &&
        JSON.stringify(query) === JSON.stringify(expectedMongo)
      )
        return {
          columns: [{ name: 'id', type: 'integer', nullable: false }],
          rows: [[1], [2]],
        };
      if (engine === 'sql' && /note IS NULL/.test(query))
        return {
          columns: [{ name: 'id', type: 'integer', nullable: false }],
          rows: [[10], [13], [14]],
        };
      throw new Error('unexpected pinned query');
    },
    adapter: {
      runProbe: async ({ probe }, budget) => {
        const lease = budget.acquire();
        lease.release();
        if (probe.id === 'availability' || probe.id === 'terminal-stream')
          return {
            message: 'SMOKE_ACK',
            terminalVerified: true,
            reportedModel: first.apiModel,
            usage: null,
          };
        if (probe.id === 'sql-count')
          return {
            message: 'SQL',
            sql: expectedSql,
            terminalVerified: true,
            reportedModel: first.apiModel,
            usage: null,
          };
        if (probe.id === 'mongo-null')
          return {
            message: 'MQL',
            sql: JSON.stringify({ action: 'aggregate', ...expectedMongo }),
            terminalVerified: true,
            reportedModel: first.apiModel,
            usage: null,
          };
        if (probe.id === 'repair-null')
          return {
            message: 'fixed',
            sql: 'SELECT id FROM orders WHERE note IS NULL ORDER BY id ASC',
            terminalVerified: true,
            reportedModel: first.apiModel,
            usage: null,
          };
        if (probe.id === 'autocomplete-null')
          return {
            message: 'ULL',
            terminalVerified: true,
            reportedModel: first.apiModel,
            usage: null,
          };
        return {
          message: 'Needs independent review',
          terminalVerified: true,
          reportedModel: first.apiModel,
          usage: null,
        };
      },
    },
  });
  assert.deepEqual(report.models[0].recommendedRoles, [
    'sql',
    'nosql',
    'autocomplete',
  ]);
  assert.equal(
    report.models[0].recommendationLevel,
    'provisional-small-sample',
  );
  assert.equal(
    report.models[0].roles.find((item) => item.role === 'explain').verdict,
    'requires-review',
  );
  assert.equal(report.semanticModelAccuracy, 'NOT_ASSESSED');
});

test('a mismatched reported model is not credited to the requested model', async () => {
  const report = await runModelRoleAssessment({
    roster: roster.slice(0, 1),
    authorization: { ...authorization, modelIds: [roster[0].apiModel] },
    now: () => now,
    adapter: {
      runProbe: async (_request, budget) => {
        const lease = budget.acquire();
        lease.release();
        return {
          message: 'SMOKE_ACK',
          terminalVerified: true,
          reportedModel: 'other-model',
          elapsedMs: 1,
          ttftMs: null,
          usage: null,
        };
      },
    },
  });
  assert.equal(report.models[0].operationalStatus, 'identity-mismatch');
  assert.equal(report.models[0].recommendedRoles.length, 0);
});
