import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseBrowserJson } from './browser-ci-artifacts.mjs';

export const POLICY_VERSION = 1;
export const TARGETS = Object.freeze({
  backend: Object.freeze({ workflow: '.github/workflows/deploy-production.yml' }),
  frontend: Object.freeze({ workflow: '.github/workflows/deploy-frontend.yml' }),
});
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[1-9][0-9]{0,19}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BASE_FIELDS = ['formatVersion', 'policyVersion', 'kind', 'repository', 'target', 'verifiedSha', 'treeSha', 'ciRunId', 'ciRunAttempt', 'deployRunId', 'deployRunAttempt', 'configSha256'];
const CONTEXT_FIELDS = ['repository', 'target', 'releaseSha', 'treeSha', 'ciRunId', 'ciRunAttempt', 'deployRunId', 'deployRunAttempt', 'configSha256'];
const REASONS = new Set(['FIRST_DEPLOYMENT_RECEIPT', 'HISTORY_UNCERTAIN', 'FORCED', 'RUNTIME_CHANGED', 'CONFIG_CHANGED', 'NON_RUNTIME_ONLY', 'NO_CHANGES']);
const NON_RUNTIME_FILES = new Set([
  'README.md', 'AGENTS.md', 'CLAUDE.md', 'CODEX-HANDOFF.md', 'LICENSE',
  'client/playwright.config.ts', 'client/playwright.ci.config.ts', 'client/playwright.merge.config.ts', 'client/playwright.full-stack.config.ts',
  'client/scripts/typecheck-browser-tests.mjs', 'client/scripts/prerender-public.test.mjs',
  '.github/dependabot.yml', '.github/workflows/ci.yml', '.github/workflows/codeql.yml', '.github/workflows/dependency-review.yml',
  '.github/workflows/benchmark.yml', '.github/workflows/load-test.yml', '.github/workflows/ai-hardening.yml',
  '.github/scripts/browser-ci-artifacts.test.mjs', '.github/scripts/browser-ci-artifacts.d.mts',
  '.github/scripts/server-ci-artifacts.mjs', '.github/scripts/server-ci-artifacts.test.mjs',
  '.github/scripts/npm-audit.mjs', '.github/scripts/npm-audit.test.mjs',
  '.github/scripts/ai-release-readiness.mjs', '.github/scripts/ai-release-readiness.test.mjs',
]);
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exact = (value, keys) => object(value) && keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => keys.includes(key));
const targetExists = target => typeof target === 'string' && Object.hasOwn(TARGETS, target);
const validId = value => typeof value === 'string' && ID.test(value);

export function parseForce(value) {
  if (value === undefined || value === '' || value === 'false') return false;
  requireValue(value === 'true', 'INVALID_FORCE_DEPLOY');
  return true;
}

export function parseDeploymentJson(text) {
  requireValue(typeof text === 'string' && Buffer.byteLength(text) <= 256 * 1024, 'DEPLOY_JSON_LIMIT');
  return parseBrowserJson(text);
}

function safePath(path) {
  requireValue(typeof path === 'string' && path.length > 0 && path.length <= 512 && !/[\\\u0000-\u001f<>:"|?*]/.test(path) && !path.startsWith('/') && path.split('/').every(part => part && part !== '.' && part !== '..'), 'UNSAFE_DEPLOY_PATH');
  return path;
}

export function classifyDeploymentPaths(paths) {
  requireValue(Array.isArray(paths) && paths.length <= 10000, 'INVALID_DEPLOY_DIFF');
  const reviewed = paths.map(safePath);
  return reviewed.every(path => NON_RUNTIME_FILES.has(path) || ['docs/', 'plans/', 'client/e2e/', 'client/full-stack/', 'server/test/'].some(prefix => path.startsWith(prefix))) ? 'skip' : 'deploy';
}

export function parseGitChanges(text) {
  requireValue(typeof text === 'string' && Buffer.byteLength(text) <= 1024 * 1024 && (text === '' || text.endsWith('\0')), 'INVALID_DEPLOY_DIFF');
  const words = text === '' ? [] : text.slice(0, -1).split('\0');
  const paths = [];
  for (let at = 0; at < words.length;) {
    const status = words[at++];
    requireValue(/^(?:[AMDT]|[RC][0-9]{1,3})$/.test(status), 'INVALID_DEPLOY_DIFF');
    const count = /^[RC]/.test(status) ? 2 : 1;
    requireValue(at + count <= words.length, 'INVALID_DEPLOY_DIFF');
    for (let index = 0; index < count; index++) paths.push(safePath(words[at++]));
  }
  requireValue(paths.length <= 10000, 'INVALID_DEPLOY_DIFF');
  return [...new Set(paths)];
}

export function assertDeploymentEvent(event, repository, target) {
  requireValue(typeof repository === 'string' && REPOSITORY.test(repository) && targetExists(target), 'UNAUTHORIZED_DEPLOY_EVENT');
  const run = event?.workflow_run;
  requireValue(object(run) && Number.isSafeInteger(run.id) && run.id > 0 && Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0 && typeof run.head_sha === 'string' && SHA.test(run.head_sha) && run.name === 'CI' && run.head_branch === 'main' && run.event === 'push' && run.conclusion === 'success' && run.head_repository?.full_name === repository, 'UNAUTHORIZED_DEPLOY_EVENT');
  return { releaseSha: run.head_sha, ciRunId: String(run.id), ciRunAttempt: String(run.run_attempt) };
}

function validateContext(context) {
  requireValue(exact(context, CONTEXT_FIELDS) && REPOSITORY.test(context.repository) && targetExists(context.target) && SHA.test(context.releaseSha) && SHA.test(context.treeSha) && HASH.test(context.configSha256) && ['ciRunId', 'ciRunAttempt', 'deployRunId', 'deployRunAttempt'].every(key => validId(context[key])), 'INVALID_DEPLOY_CONTEXT');
}

function deployUrl(value, target) {
  requireValue(typeof value === 'string' && value.length <= 2048, 'INVALID_DEPLOY_URL');
  let url;
  try { url = new URL(value); } catch { throw new Error('INVALID_DEPLOY_URL'); }
  requireValue(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && !url.port && url.hostname.includes('.') && url.href.trim() === url.href, 'INVALID_DEPLOY_URL');
  if (target === 'frontend') requireValue(url.hostname.endsWith('.vercel.app') && (url.pathname === '/' || url.pathname === ''), 'INVALID_DEPLOY_URL');
  return value;
}

export function validateDeploymentRecord(value, expected = {}) {
  const receipt = value?.kind === 'actual-deployment-receipt';
  const fields = receipt ? [...BASE_FIELDS, 'decision', 'evidence', 'url'] : [...BASE_FIELDS, 'decision', 'reason', 'baselineSha', 'changeCount'];
  requireValue(exact(value, fields) && value.formatVersion === 1 && value.policyVersion === POLICY_VERSION && value.kind === (receipt ? 'actual-deployment-receipt' : 'deployment-decision') && typeof value.repository === 'string' && REPOSITORY.test(value.repository) && targetExists(value.target) && typeof value.verifiedSha === 'string' && SHA.test(value.verifiedSha) && typeof value.treeSha === 'string' && SHA.test(value.treeSha) && typeof value.configSha256 === 'string' && HASH.test(value.configSha256) && ['ciRunId', 'ciRunAttempt', 'deployRunId', 'deployRunAttempt'].every(key => validId(value[key])), 'INVALID_DEPLOY_RECORD');
  if (receipt) {
    requireValue(value.decision === 'deploy' && value.evidence === (value.target === 'backend' ? 'backend-ready' : 'vercel-production'), 'INVALID_DEPLOY_RECORD');
    try { deployUrl(value.url, value.target); } catch { throw new Error('INVALID_DEPLOY_RECORD'); }
  } else {
    requireValue(['deploy', 'skip'].includes(value.decision) && REASONS.has(value.reason) && (value.baselineSha === null || typeof value.baselineSha === 'string' && SHA.test(value.baselineSha)) && Number.isSafeInteger(value.changeCount) && value.changeCount >= 0 && value.changeCount <= 10000, 'INVALID_DEPLOY_RECORD');
    requireValue(value.decision !== 'skip' || value.baselineSha !== null && ['NON_RUNTIME_ONLY', 'NO_CHANGES'].includes(value.reason), 'INVALID_DEPLOY_RECORD');
  }
  requireValue(!expected.kind || (expected.kind === 'receipt') === receipt, 'INVALID_DEPLOY_RECORD');
  for (const key of ['target', 'repository', 'deployRunId', 'deployRunAttempt']) requireValue(expected[key] === undefined || value[key] === expected[key], 'INVALID_DEPLOY_RECORD');
  return value;
}

function recordBase(context, kind) {
  validateContext(context);
  const { releaseSha, ...rest } = context;
  return { formatVersion: 1, policyVersion: POLICY_VERSION, kind, ...rest, verifiedSha: releaseSha };
}

export function decideDeployment(context, { baseline = null, changes = [], ancestor = true, uncertain = false, force = '' } = {}) {
  validateContext(context);
  const forced = parseForce(force);
  const changed = classifyDeploymentPaths(changes);
  if (baseline) {
    validateDeploymentRecord(baseline, { kind: 'receipt', repository: context.repository, target: context.target });
    requireValue(ancestor === true, 'STALE_DEPLOY_BASELINE');
  }
  const reason = forced ? 'FORCED' : uncertain ? 'HISTORY_UNCERTAIN' : !baseline ? 'FIRST_DEPLOYMENT_RECEIPT' : baseline.configSha256 !== context.configSha256 ? 'CONFIG_CHANGED' : changed === 'deploy' ? 'RUNTIME_CHANGED' : changes.length ? 'NON_RUNTIME_ONLY' : 'NO_CHANGES';
  const value = { ...recordBase(context, 'deployment-decision'), decision: ['NON_RUNTIME_ONLY', 'NO_CHANGES'].includes(reason) ? 'skip' : 'deploy', reason, baselineSha: baseline?.verifiedSha ?? null, changeCount: changes.length };
  return validateDeploymentRecord(value, { kind: 'decision' });
}

export function createDeploymentReceipt(context, decision, url) {
  validateContext(context);
  validateDeploymentRecord(decision, { kind: 'decision', repository: context.repository, target: context.target, deployRunId: context.deployRunId, deployRunAttempt: context.deployRunAttempt });
  requireValue(decision.decision === 'deploy' && Object.entries(recordBase(context, 'deployment-decision')).every(([key, value]) => decision[key] === value), 'INVALID_DEPLOY_RECORD');
  const receipt = { ...recordBase(context, 'actual-deployment-receipt'), decision: 'deploy', evidence: context.target === 'backend' ? 'backend-ready' : 'vercel-production', url: deployUrl(url, context.target) };
  return validateDeploymentRecord(receipt, { kind: 'receipt' });
}

async function verifySource(record, io) {
  const run = await io.readCiRun(record.ciRunId, record.ciRunAttempt);
  const declared = assertDeploymentEvent({ workflow_run: run }, record.repository, record.target);
  requireValue(declared.releaseSha === record.verifiedSha && declared.ciRunId === record.ciRunId && declared.ciRunAttempt === record.ciRunAttempt && run.status === 'completed', 'INVALID_DEPLOY_PROVENANCE');
}

function activityTime(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z'), 'INVALID_DEPLOY_HISTORY');
  return Date.parse(value);
}

export function orderDeploymentHistory(context, { runs, artifacts }) {
  validateContext(context);
  requireValue(Array.isArray(runs) && runs.length <= 32 && Array.isArray(artifacts) && artifacts.length <= 100, 'INVALID_DEPLOY_HISTORY');
  const refs = new Map();
  const add = (id, attempt, recordedAt) => {
    requireValue(Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(attempt) && attempt > 0, 'INVALID_DEPLOY_HISTORY');
    if (String(id) === context.deployRunId && String(attempt) === context.deployRunAttempt) return;
    const time = activityTime(recordedAt);
    const key = `${id}-${attempt}`;
    const prior = refs.get(key);
    if (!prior || time > activityTime(prior.recordedAt)) refs.set(key, { id, run_attempt: attempt, recordedAt });
  };
  const artifactNames = new Set();
  for (const artifact of artifacts) {
    requireValue(object(artifact) && typeof artifact.name === 'string', 'INVALID_DEPLOY_HISTORY');
    const prefixes = [`actual-deployment-${context.target}-`, `deployment-decision-${context.target}-`];
    const prefix = prefixes.find(value => artifact.name.startsWith(value));
    if (!prefix) continue;
    const suffix = artifact.name.slice(prefix.length);
    const match = /^([1-9][0-9]{0,19})-([1-9][0-9]{0,5})$/.exec(suffix);
    requireValue(match && !artifactNames.has(artifact.name) && Number.isSafeInteger(artifact.id) && artifact.id > 0 && Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= 256 * 1024 && typeof artifact.expired === 'boolean' && artifact.workflow_run?.id === Number(match[1]), 'INVALID_DEPLOY_HISTORY');
    artifactNames.add(artifact.name);
    add(Number(match[1]), Number(match[2]), artifact.created_at);
  }
  for (const run of runs) {
    requireValue(object(run) && typeof run.path === 'string' && run.path.split('@')[0] === TARGETS[context.target].workflow && run.event === 'workflow_run', 'INVALID_DEPLOY_HISTORY');
    add(run.id, run.run_attempt, run.updated_at);
  }
  const ordered = [...refs.values()].sort((left, right) => activityTime(right.recordedAt) - activityTime(left.recordedAt));
  return ordered.slice(0, 32).map(ref => ({ ...ref, ambiguous: ordered.filter(other => other.recordedAt === ref.recordedAt).length > 1 }));
}

export async function resolveDeploymentHistory(context, io) {
  validateContext(context);
  const runs = await io.listRuns();
  requireValue(Array.isArray(runs) && runs.length <= 32, 'INVALID_DEPLOY_HISTORY');
  const skips = [];
  const seen = new Set();
  const discoveryUncertain = io.discoveryUncertain ? await io.discoveryUncertain() : false;
  requireValue(typeof discoveryUncertain === 'boolean', 'INVALID_DEPLOY_HISTORY');
  let uncertain = Number(context.deployRunAttempt) > 1 || discoveryUncertain;
  for (const run of runs) {
    const key = `${run?.id}-${run?.run_attempt}`;
    requireValue(object(run) && Number.isSafeInteger(run.id) && run.id > 0 && !seen.has(key) && Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0 && typeof run.path === 'string' && run.path.split('@')[0] === TARGETS[context.target].workflow && run.event === 'workflow_run', 'INVALID_DEPLOY_HISTORY');
    seen.add(key);
    if (String(run.id) === context.deployRunId && String(run.run_attempt) === context.deployRunAttempt) continue;
    requireValue(run.ambiguous !== true, 'AMBIGUOUS_DEPLOY_HISTORY');
    if (run.conclusion === 'skipped') continue;
    const expected = { repository: context.repository, target: context.target, deployRunId: String(run.id), deployRunAttempt: String(run.run_attempt) };
    const receipt = await io.readRecord(run, 'receipt');
    if (receipt !== undefined) {
      validateDeploymentRecord(receipt, { ...expected, kind: 'receipt' });
      await verifySource(receipt, io);
      requireValue(uncertain || skips.every(skip => skip.baselineSha === receipt.verifiedSha && skip.configSha256 === receipt.configSha256), 'INVALID_DEPLOY_HISTORY');
      return { baseline: receipt, uncertain: uncertain || run.status !== 'completed' || run.conclusion !== 'success' };
    }
    if (run.status !== 'completed' || run.conclusion !== 'success') { uncertain = true; continue; }
    const decision = await io.readRecord(run, 'decision');
    if (decision === undefined) { uncertain = true; continue; }
    validateDeploymentRecord(decision, { ...expected, kind: 'decision' });
    await verifySource(decision, io);
    if (decision.decision !== 'skip') { uncertain = true; continue; }
    skips.push(decision);
  }
  return { baseline: null, uncertain: uncertain || runs.length >= 32 || skips.length > 0 };
}

async function boundedJson(path) {
  const stat = await lstat(path);
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 256 * 1024, 'INVALID_DEPLOY_FILE');
  return parseDeploymentJson(await readFile(path, 'utf8'));
}

function git(...args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 }); }
  catch { throw new Error('DEPLOY_GIT_FAILED'); }
}

function github(endpoint) {
  try {
    const text = execFileSync('gh', ['api', '--hostname', 'github.com', endpoint], { cwd: ROOT, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' } });
    requireValue(Buffer.byteLength(text) <= 2 * 1024 * 1024, 'DEPLOY_API_LIMIT');
    return parseBrowserJson(text);
  } catch { throw new Error('DEPLOY_API_FAILED'); }
}

async function deploymentContext(target, env, clean = true) {
  const event = await boundedJson(env.GITHUB_EVENT_PATH);
  const source = assertDeploymentEvent(event, env.GITHUB_REPOSITORY, target);
  const releaseSha = git('rev-parse', 'HEAD').trim();
  requireValue(releaseSha === source.releaseSha && (!clean || git('status', '--porcelain').trim() === ''), 'DEPLOY_CHECKOUT_MISMATCH');
  const apiUrl = deployUrl(env.PRODUCTION_API_URL || 'https://data-explorer-editor-9v55.onrender.com', 'backend');
  const context = { repository: env.GITHUB_REPOSITORY, target, ...source, treeSha: git('rev-parse', 'HEAD^{tree}').trim(), deployRunId: env.GITHUB_RUN_ID, deployRunAttempt: env.GITHUB_RUN_ATTEMPT, configSha256: digest(JSON.stringify({ target, apiUrl })) };
  validateContext(context);
  return context;
}

function historyIo(context, directory) {
  const artifactCache = new Map();
  const ciCache = new Map();
  let repositoryArtifacts = [];
  return {
    listRuns: async () => {
      const payload = github(`repos/${context.repository}/actions/workflows/${TARGETS[context.target].workflow.split('/').at(-1)}/runs?per_page=32`);
      const artifacts = github(`repos/${context.repository}/actions/artifacts?per_page=100`);
      requireValue(Array.isArray(payload.workflow_runs) && Array.isArray(artifacts.artifacts), 'INVALID_DEPLOY_HISTORY');
      repositoryArtifacts = artifacts.artifacts;
      const refs = orderDeploymentHistory(context, { runs: payload.workflow_runs, artifacts: repositoryArtifacts });
      return refs.map(ref => {
        const run = github(`repos/${context.repository}/actions/runs/${ref.id}/attempts/${ref.run_attempt}`);
        requireValue(object(run) && run.id === ref.id && run.run_attempt === ref.run_attempt && run.path?.split('@')[0] === TARGETS[context.target].workflow && run.event === 'workflow_run', 'INVALID_DEPLOY_PROVENANCE');
        return { ...run, recordedAt: ref.recordedAt, ambiguous: ref.ambiguous };
      });
    },
    discoveryUncertain: async () => {
      const receipts = repositoryArtifacts.filter(artifact => artifact.name.startsWith(`actual-deployment-${context.target}-`));
      if (!receipts.length) return true;
      const latest = receipts.reduce((left, right) => activityTime(left.created_at) >= activityTime(right.created_at) ? left : right);
      return latest.expired === true;
    },
    readCiRun: async (id, attempt) => {
      const key = `${id}-${attempt}`;
      if (!ciCache.has(key)) ciCache.set(key, github(`repos/${context.repository}/actions/runs/${id}/attempts/${attempt}`));
      return ciCache.get(key);
    },
    readRecord: async (run, kind) => {
      if (!artifactCache.has(run.id)) artifactCache.set(run.id, github(`repos/${context.repository}/actions/runs/${run.id}/artifacts?per_page=100`));
      const payload = artifactCache.get(run.id);
      requireValue(Array.isArray(payload.artifacts) && payload.artifacts.length <= 100, 'INVALID_DEPLOY_HISTORY');
      const prefix = kind === 'receipt' ? 'actual-deployment' : 'deployment-decision';
      const name = `${prefix}-${context.target}-${run.id}-${run.run_attempt}`;
      const known = repositoryArtifacts.find(artifact => artifact.name === name);
      const matches = payload.artifacts.filter(artifact => artifact.name === name);
      requireValue(matches.length <= 1 && (!known || matches.length === 1 && matches[0].id === known.id), 'INVALID_DEPLOY_HISTORY');
      if (!matches.length || matches[0].expired === true) return undefined;
      requireValue(matches[0].size_in_bytes > 0 && matches[0].size_in_bytes <= 256 * 1024 && matches[0].workflow_run?.id === run.id, 'INVALID_DEPLOY_HISTORY');
      const destination = await mkdtemp(join(directory, 'history-'));
      try {
        execFileSync('gh', ['run', 'download', String(run.id), '--repo', `github.com/${context.repository}`, '--name', name, '--dir', destination], { cwd: ROOT, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024, env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' } });
      } catch { throw new Error('DEPLOY_ARTIFACT_DOWNLOAD_FAILED'); }
      const file = kind === 'receipt' ? 'receipt.json' : 'decision.json';
      const entries = await readdir(destination);
      requireValue(entries.length === 1 && entries[0] === file, 'INVALID_DEPLOY_FILE');
      const value = await boundedJson(join(destination, file));
      await unlink(join(destination, file)); await rmdir(destination);
      return value;
    },
  };
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const [action, target, destination] = args;
  requireValue(args.length === 3 && ['decide', 'record'].includes(action) && targetExists(target) && destination, 'INVALID_DEPLOY_ARGUMENTS');
  const directory = resolve(destination);
  const context = await deploymentContext(target, env, action === 'decide');
  if (action === 'decide') {
    requireValue(env.GH_TOKEN, 'DEPLOY_API_AUTH_REQUIRED');
    await verifySource({ ...recordBase(context, 'deployment-decision') }, { readCiRun: async (id, attempt) => github(`repos/${context.repository}/actions/runs/${id}/attempts/${attempt}`) });
    requireValue(github(`repos/${context.repository}/commits/main`).sha === context.releaseSha, 'STALE_DEPLOY_CANDIDATE');
    await mkdir(directory, { recursive: false });
    const history = await resolveDeploymentHistory(context, historyIo(context, directory));
    let changes = [], ancestor = true;
    if (history.baseline) {
      try { execFileSync('git', ['merge-base', '--is-ancestor', history.baseline.verifiedSha, context.releaseSha], { cwd: ROOT, timeout: 15000, stdio: 'pipe' }); }
      catch { ancestor = false; }
      if (ancestor) {
        requireValue(git('rev-parse', `${history.baseline.verifiedSha}^{tree}`).trim() === history.baseline.treeSha, 'INVALID_DEPLOY_PROVENANCE');
        changes = parseGitChanges(git('diff', '--name-status', '-z', '--find-renames', history.baseline.verifiedSha, context.releaseSha));
      }
    }
    const decision = decideDeployment(context, { ...history, changes, ancestor, force: env.FORCE_DEPLOY });
    await writeFile(join(directory, 'decision.json'), `${JSON.stringify(decision, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    requireValue(env.GITHUB_OUTPUT, 'DEPLOY_OUTPUT_REQUIRED');
    await writeFile(env.GITHUB_OUTPUT, `decision=${decision.decision}\n`, { flag: 'a' });
    if (env.GITHUB_STEP_SUMMARY) await writeFile(env.GITHUB_STEP_SUMMARY, `## ${target} deployment decision\n\n${decision.decision}: ${decision.reason}; verified source \`${context.releaseSha}\`; baseline \`${decision.baselineSha || 'unavailable'}\`.\n`, { flag: 'a' });
    process.stdout.write(JSON.stringify({ target, decision: decision.decision, reason: decision.reason, releaseSha: context.releaseSha }) + '\n');
  } else {
    const decision = await boundedJson(join(directory, 'decision.json'));
    let url = env.DEPLOYMENT_URL;
    if (env.DEPLOYMENT_URL_FILE) {
      const stat = await lstat(env.DEPLOYMENT_URL_FILE);
      requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 2048, 'INVALID_DEPLOY_URL');
      url = (await readFile(env.DEPLOYMENT_URL_FILE, 'utf8')).trim();
    }
    const receipt = createDeploymentReceipt(context, decision, url);
    await writeFile(join(directory, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write(JSON.stringify({ target, receipt: 'actual-deployment', releaseSha: context.releaseSha }) + '\n');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${/^[A-Z0-9_]+$/.test(error?.message || '') ? error.message : 'DEPLOY_POLICY_FAILED'}\n`); process.exitCode = 1; });
