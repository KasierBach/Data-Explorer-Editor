import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  assertLocalJsonPath,
  readJsonArtifact,
  validateCatalog,
  compareResultBundles,
} from './evaluator.mjs';
import { snapshotPlainJson, digest } from './native-fixture-profile.mjs';
import { assertReadReplayQuery } from './native-replay.mjs';

export const MODEL_ASSESSMENT_VERSION = 'beeknoee-role-smoke-v1';
const catalogUrl = new URL('./synthetic-catalog.v1.json', import.meta.url);
const rosterUrl = new URL(
  '../../../client/src/presentation/modules/Query/beeknoeeModelCatalog.ts',
  import.meta.url,
);
const roles = ['assistant', 'sql', 'nosql', 'explain', 'autocomplete'];
const recommendationProbes = Object.freeze({
  sql: Object.freeze(['sql-count', 'repair-null']),
  nosql: Object.freeze(['mongo-null']),
  autocomplete: Object.freeze(['autocomplete-null']),
});
const safeError = (code) => Object.assign(new Error(code), { code });
const requireValue = (value, code) => {
  if (!value) throw safeError(code);
};
const sourceHash = (value) => createHash('sha256').update(value).digest('hex');

export const MODEL_ROLE_PROBES = snapshotPlainJson([
  {
    id: 'availability',
    role: 'assistant',
    operation: 'chat',
    prompt:
      'Reply with exactly SMOKE_ACK. Do not use tools or include database commands.',
    language: 'en',
    databaseType: 'postgres',
    rubric: 'format-only-not-task-quality',
  },
  {
    id: 'sql-count',
    role: 'sql',
    operation: 'chat',
    referenceCase: 'sql-count-null',
    language: 'vi',
    databaseType: 'postgres',
    rubric: 'pinned-native-result-only',
  },
  {
    id: 'mongo-null',
    role: 'nosql',
    operation: 'chat',
    referenceCase: 'mongo-null-or-missing',
    language: 'en',
    databaseType: 'mongodb',
    rubric: 'pinned-native-result-only',
  },
  {
    id: 'explain-null',
    role: 'explain',
    operation: 'chat',
    prompt:
      'Explain why SELECT id FROM orders WHERE note = NULL returns no matching rows in PostgreSQL. Do not execute or rewrite the query. State the NULL assumption clearly.',
    language: 'en',
    databaseType: 'postgres',
    rubric: 'independent-review-required',
  },
  {
    id: 'repair-null',
    role: 'sql',
    operation: 'chat',
    prompt:
      'Fix this read-only PostgreSQL query to return order ids with a NULL note in ascending id order: SELECT id FROM orders WHERE note = NULL ORDER BY id ASC. Use only the supplied schema.',
    referenceCase: 'sql-null-note',
    language: 'en',
    databaseType: 'postgres',
    rubric: 'pinned-native-result-only',
  },
  {
    id: 'autocomplete-null',
    role: 'autocomplete',
    operation: 'autocomplete',
    beforeCursor: 'SELECT id FROM orders WHERE note IS N',
    afterCursor: ' ORDER BY id ASC',
    referenceCase: 'sql-null-note',
    language: 'en',
    databaseType: 'postgres',
    rubric: 'pinned-native-result-only',
  },
  {
    id: 'missing-phone',
    role: 'assistant',
    operation: 'chat',
    referenceCase: 'sql-missing-phone',
    language: 'en',
    databaseType: 'postgres',
    rubric: 'abstention-review-required',
  },
  {
    id: 'terminal-stream',
    role: 'assistant',
    operation: 'stream',
    prompt:
      'Reply with exactly SMOKE_ACK. Do not use tools or include database commands.',
    language: 'en',
    databaseType: 'postgres',
    rubric: 'format-only-not-task-quality',
  },
]);

export async function readBeeknoeeAssessmentRoster() {
  const source = await readFile(rosterUrl, 'utf8');
  requireValue(Buffer.byteLength(source) <= 32 * 1024, 'MODEL_ROSTER_INVALID');
  const array =
    /export const BEEKNOEE_MODELS\s*=\s*\[([\s\S]*?)\]\s*as const;/.exec(
      source,
    )?.[1];
  requireValue(typeof array === 'string', 'MODEL_ROSTER_INVALID');
  const entries = [...array.matchAll(/\{([^{}]+)\}/g)].map((match) => {
    const id = /\bid:\s*("[^"\r\n]+")/.exec(match[1])?.[1];
    const label = /\blabel:\s*("[^"\r\n]+")/.exec(match[1])?.[1];
    const target = /\bassessmentTarget:\s*(true|false)/.exec(match[1])?.[1];
    requireValue(id && label && target, 'MODEL_ROSTER_INVALID');
    return {
      selectionId: JSON.parse(id),
      label: JSON.parse(label),
      target: target === 'true',
    };
  });
  const selected = entries
    .filter((entry) => entry.target)
    .map(({ selectionId, label }) => {
      requireValue(
        /^beeknoee:[a-z0-9][a-z0-9./-]{0,160}$/.test(selectionId),
        'MODEL_ROSTER_INVALID',
      );
      return {
        selectionId,
        apiModel: selectionId.slice('beeknoee:'.length),
        label,
      };
    });
  requireValue(
    selected.length === 8 &&
      new Set(selected.map((entry) => entry.selectionId)).size === 8,
    'MODEL_ROSTER_INVALID',
  );
  return snapshotPlainJson(selected);
}

export function assessModelEvaluationPreflight(
  input,
  roster,
  now = Date.now(),
) {
  const reasons = [];
  let value;
  try {
    value = snapshotPlainJson(input);
  } catch {
    value = null;
  }
  const keys = [
    'credentialPresent',
    'zeroCostAuthorityVerified',
    'policyVerified',
    'ledgerVerified',
    'provider',
    'recipient',
    'modelIds',
    'authorizationId',
    'zeroCostEvidenceSha256',
    'authorizationSha256',
    'expiresAt',
    'deadlineAt',
  ];
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    reasons.push('MODEL_EVAL_AUTHORITY_INVALID');
  if (value?.credentialPresent !== true)
    reasons.push('MODEL_EVAL_CREDENTIAL_MISSING');
  if (value?.zeroCostAuthorityVerified !== true)
    reasons.push('MODEL_EVAL_ZERO_COST_AUTHORITY_MISSING');
  if (value?.policyVerified !== true)
    reasons.push('MODEL_EVAL_POLICY_NOT_VERIFIED');
  if (value?.ledgerVerified !== true)
    reasons.push('MODEL_EVAL_LEDGER_NOT_VERIFIED');
  if (
    value?.provider !== 'beeknoee' ||
    value?.recipient !== 'https://platform.beeknoee.com'
  )
    reasons.push('MODEL_EVAL_RECIPIENT_MISMATCH');
  if (
    !Array.isArray(value?.modelIds) ||
    value.modelIds.length !== roster.length ||
    new Set(value.modelIds).size !== roster.length ||
    roster.some((entry) => !value.modelIds.includes(entry.apiModel))
  )
    reasons.push('MODEL_EVAL_MODEL_SCOPE_MISMATCH');
  if (
    typeof value?.authorizationId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value.authorizationId) ||
    typeof value?.zeroCostEvidenceSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.zeroCostEvidenceSha256) ||
    (value.authorizationSha256 !== undefined &&
      (typeof value.authorizationSha256 !== 'string' ||
        !/^[0-9a-f]{64}$/.test(value.authorizationSha256)))
  )
    reasons.push('MODEL_EVAL_AUTHORITY_EVIDENCE_INVALID');
  if (
    ![now, value?.expiresAt, value?.deadlineAt].every(Number.isSafeInteger) ||
    value.expiresAt <= now ||
    value.deadlineAt <= now ||
    value.deadlineAt > value.expiresAt ||
    value.expiresAt - now > 60 * 60 * 1000
  )
    reasons.push('MODEL_EVAL_AUTHORITY_EXPIRED');
  return { allowed: reasons.length === 0, reasons };
}

export function createModelAttemptBudget({
  maxAttempts = 80,
  deadlineAt,
  now = Date.now,
  onAcquire,
  authorizedMaxAttempts = 80,
  initialAttempts = 0,
}) {
  requireValue(
    Number.isSafeInteger(authorizedMaxAttempts) &&
      [80, 320].includes(authorizedMaxAttempts) &&
      Number.isSafeInteger(maxAttempts) &&
      maxAttempts >= 1 &&
      maxAttempts <= authorizedMaxAttempts &&
      Number.isSafeInteger(initialAttempts) &&
      initialAttempts >= 0 &&
      initialAttempts <= maxAttempts,
    'MODEL_EVALUATION_LIMIT_INVALID',
  );
  requireValue(
    Number.isSafeInteger(deadlineAt) && deadlineAt > now(),
    'MODEL_EVALUATION_DEADLINE',
  );
  let attempts = initialAttempts;
  let active = false;
  return Object.freeze({
    get attempts() {
      return attempts;
    },
    get active() {
      return active;
    },
    acquire() {
      requireValue(now() < deadlineAt, 'MODEL_EVALUATION_DEADLINE');
      requireValue(!active, 'MODEL_EVALUATION_BUSY');
      requireValue(attempts < maxAttempts, 'MODEL_EVALUATION_ATTEMPT_LIMIT');
      const ordinal = attempts + 1;
      active = true;
      try {
        if (onAcquire) {
          const recorded = onAcquire(ordinal);
          requireValue(
            !recorded || typeof recorded.then !== 'function',
            'MODEL_EVALUATION_ATTEMPT_JOURNAL_ASYNC',
          );
        }
        attempts = ordinal;
      } catch (error) {
        active = false;
        throw error;
      }
      let released = false;
      return Object.freeze({
        ordinal: attempts,
        release() {
          if (!released) {
            released = true;
            active = false;
          }
        },
      });
    },
  });
}

export function classifyModelOperation(error) {
  const status = error?.status ?? error?.statusCode;
  const code = error?.code;
  if (code === 'MODEL_EVAL_POLICY_DENIED') return 'policy-denied';
  if ([401, 403].includes(status)) return 'auth-denied';
  if (status === 429) return 'rate-limited';
  if (status === 402) return 'credits-required';
  if (status === 404) return 'unavailable';
  if (['AI_REQUEST_TIMEOUT', 'NATIVE_DEADLINE', 'TIMEOUT'].includes(code))
    return 'timeout';
  if (
    code === 'MODEL_EVAL_STREAM_ERROR' ||
    code === 'MODEL_EVAL_STREAM_TERMINAL_MISSING' ||
    code === 'MODEL_EVAL_RESULT_IDENTITY_MISMATCH'
  )
    return 'invalid-output';
  if (code === 'MODEL_EVALUATION_ATTEMPT_LIMIT') return 'attempt-limit';
  if (code === 'MODEL_EVALUATION_DEADLINE') return 'timeout';
  if (code === 'MODEL_EVALUATION_BUSY') return 'operation-failed';
  return 'operation-failed';
}

function unknownModel(model) {
  return {
    selectionId: model.selectionId,
    apiModel: model.apiModel,
    label: model.label,
    operationalStatus: 'not-assessed',
    reportedModel: null,
    identityEvidence: 'not-reported',
    recommendationLevel: 'not-assessed',
    recommendedRoles: [],
    roles: roles.map((role) => ({
      role,
      verdict: 'not-assessed',
      samples: 0,
    })),
    capabilities: Object.fromEntries(
      ['text', 'stream', 'structured', 'vision', 'pdf', 'web'].map((name) => [
        name,
        { advertised: 'not-verified', live: 'not-tested' },
      ]),
    ),
    probes: [],
  };
}

export function requestForProbe(probe, catalog) {
  const reference = probe.referenceCase
    ? catalog.cases.find((entry) => entry.id === probe.referenceCase)
    : null;
  requireValue(
    !probe.referenceCase || reference?.split === 'dev',
    'MODEL_PROBE_REFERENCE_INVALID',
  );
  const engine = probe.databaseType === 'mongodb' ? 'mongo' : 'sql';
  return snapshotPlainJson({
    id: probe.id,
    role: probe.role,
    operation: probe.operation,
    prompt: probe.prompt ?? reference?.prompt ?? '',
    beforeCursor: probe.beforeCursor ?? '',
    afterCursor: probe.afterCursor ?? '',
    databaseType: probe.databaseType,
    language: probe.language,
    schema: catalog.schema[engine],
    rubric: probe.rubric,
  });
}

export async function assessModelProbe(probe, result, catalog, nativeExecutor) {
  let reply;
  try {
    reply = snapshotPlainJson(result);
  } catch {
    return {
      verdict: 'observed-failure',
      reasons: ['INVALID_PROBE_OUTPUT'],
      execution: 'NOT_EXECUTED',
    };
  }
  if (
    !reply ||
    typeof reply !== 'object' ||
    Array.isArray(reply) ||
    reply.terminalVerified !== true ||
    typeof reply.message !== 'string' ||
    reply.message.length > 16000
  )
    return {
      verdict: 'observed-failure',
      reasons: ['INVALID_PROBE_OUTPUT'],
      execution: 'NOT_EXECUTED',
    };
  if (probe.rubric === 'format-only-not-task-quality')
    return {
      verdict:
        reply.message.trim() === 'SMOKE_ACK' && !reply.sql
          ? 'format-match'
          : 'observed-failure',
      reasons: ['FORMAT_ONLY_NOT_ROLE_ACCURACY'],
      execution: 'NOT_EXECUTED',
    };
  const reference = catalog.cases.find(
    (entry) => entry.id === probe.referenceCase,
  );
  if (
    probe.rubric === 'independent-review-required' ||
    reference?.expected.response.kind === 'abstain'
  )
    return {
      verdict: reply.sql ? 'observed-failure' : 'requires-review',
      reasons: [
        reply.sql ? 'UNEXPECTED_QUERY' : 'INDEPENDENT_RUBRIC_REVIEW_REQUIRED',
      ],
      execution: 'NOT_EXECUTED',
    };
  let query =
    probe.operation === 'autocomplete'
      ? `${probe.beforeCursor}${reply.message}${probe.afterCursor}`
      : reply.sql;
  if (typeof query !== 'string' || !query.trim())
    return {
      verdict: 'observed-failure',
      reasons: ['MISSING_GENERATED_QUERY'],
      execution: 'NOT_EXECUTED',
    };
  const engine = reference.engine;
  if (engine === 'mongo') {
    try {
      const parsed = JSON.parse(query);
      requireValue(
        parsed && typeof parsed === 'object' && !Array.isArray(parsed),
        'INVALID_PROBE_OUTPUT',
      );
      const keys = Object.keys(parsed);
      requireValue(
        keys.every((key) =>
          ['action', 'collection', 'pipeline'].includes(key),
        ) &&
          (parsed.action === undefined || parsed.action === 'aggregate'),
        'INVALID_PROBE_OUTPUT',
      );
      query = snapshotPlainJson({
        collection: parsed.collection,
        pipeline: parsed.pipeline,
      });
    } catch {
      return {
        verdict: 'observed-failure',
        reasons: ['INVALID_MONGO_PROPOSAL'],
        execution: 'NOT_EXECUTED',
      };
    }
  }
  try {
    assertReadReplayQuery(engine, query);
  } catch {
    return {
      verdict: 'requires-review',
      reasons: ['QUERY_OUTSIDE_PINNED_REPLAY'],
      execution: 'NOT_EXECUTED',
      querySha256: digest(query),
    };
  }
  if (!nativeExecutor)
    return {
      verdict: 'requires-review',
      reasons: ['NATIVE_EXECUTOR_NOT_AVAILABLE'],
      execution: 'NOT_EXECUTED',
      querySha256: digest(query),
    };
  try {
    const native = await nativeExecutor(engine, query);
    const comparison = compareResultBundles(
      reference.expected.result,
      native,
      reference.comparison ?? {
        ordering: 'ordered',
        numericTolerance: catalog.numericPolicy,
      },
    );
    return {
      verdict: comparison.equal ? 'observed-match' : 'observed-failure',
      reasons: comparison.issues.map((issue) => issue.code),
      execution: 'PINNED_NATIVE_QUERY_EXECUTED',
      querySha256: digest(query),
      nativeResultSha256: digest(native),
    };
  } catch (error) {
    if (
      typeof error?.code === 'string' &&
      (error.code.startsWith('MODEL_NATIVE_') ||
        error.code.startsWith('NATIVE_'))
    )
      throw error;
    return {
      verdict: 'observed-failure',
      reasons: ['NATIVE_EXECUTION_FAILED'],
      execution: 'NATIVE_ATTEMPT_FAILED',
      querySha256: digest(query),
    };
  }
}

export async function runModelRoleAssessment({
  roster,
  authorization = {},
  adapter,
  nativeExecutor,
  now = Date.now,
  maxAttempts = 80,
  onAttempt,
}) {
  const models = snapshotPlainJson(roster).map(unknownModel);
  const preflight = assessModelEvaluationPreflight(
    authorization,
    roster,
    now(),
  );
  const catalogArtifact = await readJsonArtifact(fileURLToPath(catalogUrl));
  const catalog = validateCatalog(catalogArtifact.data);
  const budget = preflight.allowed
    ? createModelAttemptBudget({
        maxAttempts,
        deadlineAt: authorization.deadlineAt,
        now,
        onAcquire: onAttempt,
      })
    : null;
  if (preflight.allowed)
    requireValue(
      adapter && typeof adapter.runProbe === 'function',
      'MODEL_EVAL_ADAPTER_MISSING',
    );
  if (budget)
    for (const [index, model] of models.entries()) {
      for (const probe of MODEL_ROLE_PROBES) {
        if (budget.attempts >= maxAttempts || now() >= authorization.deadlineAt)
          break;
        try {
          const request = requestForProbe(probe, catalog);
          const reply = await adapter.runProbe(
            { model: roster[index], probe: request },
            budget,
          );
          requireValue(!budget.active, 'MODEL_EVAL_ADAPTER_LEFT_ACTIVE');
          const safe = snapshotPlainJson(reply);
          if (
            safe.reportedModel != null &&
            safe.reportedModel !== model.apiModel
          ) {
            model.operationalStatus = 'identity-mismatch';
            model.identityEvidence = 'mismatch';
            model.probes.push({
              id: probe.id,
              role: probe.role,
              verdict: 'requires-review',
              reasons: ['REPORTED_MODEL_MISMATCH'],
            });
            break;
          }
          model.reportedModel = safe.reportedModel ?? null;
          model.identityEvidence = safe.reportedModel
            ? 'provider-reported-alias-not-upstream-proof'
            : 'not-reported';
          const assessed = await assessModelProbe(
            probe,
            safe,
            catalog,
            nativeExecutor,
          );
          model.probes.push({
            id: probe.id,
            role: probe.role,
            ...assessed,
            elapsedMs:
              Number.isFinite(safe.elapsedMs) && safe.elapsedMs >= 0
                ? safe.elapsedMs
                : null,
            ttftMs:
              Number.isFinite(safe.ttftMs) && safe.ttftMs >= 0
                ? safe.ttftMs
                : null,
            usage: safe.usage ?? null,
            requestSha256:
              typeof safe.requestSha256 === 'string' &&
              /^[0-9a-f]{64}$/.test(safe.requestSha256)
                ? safe.requestSha256
                : null,
          });
          if (probe.id === 'availability') {
            model.operationalStatus =
              assessed.verdict === 'format-match'
                ? 'reachable'
                : 'invalid-output';
            if (model.operationalStatus !== 'reachable') break;
            model.capabilities.text.live = 'format-tested-not-role-quality';
          }
          if (
            probe.operation === 'stream' &&
            assessed.verdict === 'format-match'
          )
            model.capabilities.stream.live = 'terminal-tested';
        } catch (error) {
          if (
            adapter.isFatalError?.(error) ||
            (typeof error?.code === 'string' &&
              (error.code.startsWith('MODEL_NATIVE_') ||
                error.code.startsWith('NATIVE_')))
          )
            throw error;
          model.operationalStatus = classifyModelOperation(error);
          model.probes.push({
            id: probe.id,
            role: probe.role,
            verdict: 'not-assessed',
            reasons: [model.operationalStatus],
            elapsedMs: null,
            execution: 'NOT_EXECUTED',
          });
          break;
        }
      }
      const identityMismatch = model.operationalStatus === 'identity-mismatch';
      model.roles = roles.map((role) => {
        const observed = model.probes.filter(
          (probe) =>
            probe.role === role &&
            ['observed-match', 'observed-failure', 'requires-review'].includes(
              probe.verdict,
            ),
        );
        const required = recommendationProbes[role] ?? [];
        const complete =
          required.length > 0 &&
          required.every((id) =>
            model.probes.some(
              (probe) => probe.id === id && probe.verdict === 'observed-match',
            ),
          );
        return {
          role,
          samples: observed.length,
          verdict: observed.some(
            (probe) => probe.verdict === 'observed-failure',
          )
            ? 'observed-failure'
            : identityMismatch && observed.length
              ? 'requires-review'
              : observed.some((probe) => probe.verdict === 'requires-review') ||
                  (observed.some(
                    (probe) => probe.verdict === 'observed-match',
                  ) &&
                    !complete)
                ? 'requires-review'
                : complete
                  ? 'observed-match'
                  : 'not-assessed',
        };
      });
      model.recommendedRoles = identityMismatch
        ? []
        : model.roles
            .filter((role) => role.verdict === 'observed-match')
            .map((role) => role.role);
      model.recommendationLevel = model.recommendedRoles.length
        ? 'provisional-small-sample'
        : 'not-assessed';
    }
  return {
    formatVersion: 1,
    assessmentVersion: MODEL_ASSESSMENT_VERSION,
    evaluatedAt: new Date(now()).toISOString(),
    evidenceOrigin: 'ADAPTER_OBSERVATIONS_REQUIRE_INDEPENDENT_PROVENANCE',
    preflight,
    providerAttempts: budget?.attempts ?? 0,
    maxAttempts,
    concurrency: 1,
    catalogSha256: catalogArtifact.metadata.sha256,
    probeRosterSha256: digest(MODEL_ROLE_PROBES),
    models,
    semanticModelAccuracy: 'NOT_ASSESSED',
    cost: null,
    usageCoverage: 'UNKNOWN_OR_PROVIDER_REPORTED_ONLY',
    deploymentAuthorized: false,
    certification: 'NOT_CERTIFIED',
    limitations: [
      'Author-draft smoke tasks are not an expert-reviewed benchmark.',
      'Format success, capability support and role quality are separate.',
      'No role is automatically assigned from this smoke roster.',
      'Requested or provider-reported aliases do not prove the upstream model.',
      'Missing provider telemetry is not zero tokens or a billing guarantee.',
      'Input authorization is trusted operator context, not a producer report or authenticity signature.',
    ],
  };
}

export async function cli(argv) {
  requireValue(
    argv.length === 0 || (argv.length === 2 && argv[0] === '--report'),
    'MODEL_EVAL_CLI_INVALID',
  );
  const roster = await readBeeknoeeAssessmentRoster();
  const report = await runModelRoleAssessment({ roster, authorization: {} });
  if (argv.length)
    await writeFile(
      assertLocalJsonPath(argv[1]),
      JSON.stringify(report, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
  else process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return report.preflight.allowed ? 0 : 1;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = await cli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        code:
          typeof error?.code === 'string' && /^MODEL_[A-Z_]+$/.test(error.code)
            ? error.code
            : 'MODEL_EVAL_FAILED',
      }) + '\n',
    );
    process.exitCode = 2;
  }
}
