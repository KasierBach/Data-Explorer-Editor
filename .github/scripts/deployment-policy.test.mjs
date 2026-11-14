import assert from "node:assert/strict";
import test from "node:test";
import * as deploymentPolicy from "./deployment-policy.mjs";
import {
  POLICY_VERSION, TARGETS, assertDeploymentEvent, classifyDeploymentPaths,
  createDeploymentReceipt, decideDeployment, parseDeploymentJson, parseForce,
  parseGitChanges, resolveDeploymentHistory, validateDeploymentRecord,
} from "./deployment-policy.mjs";

const REPOSITORY = "KasierBach/Data-Explorer-Editor";
const RELEASE_SHA = "a".repeat(40);
const BASELINE_SHA = "b".repeat(40);
const TREE_SHA = "c".repeat(40);
const CONFIG_SHA256 = "d".repeat(64);
const eventFixture = () => ({
  workflow_run: {
    id: 314159, run_attempt: 2, head_sha: RELEASE_SHA, head_branch: "main",
    event: "push", conclusion: "success", name: "CI",
    head_repository: { full_name: REPOSITORY },
  },
});

const NON_RUNTIME_PATHS = [
  "docs/operations/ci-cd.md", "plans/release/checklist.md",
  "README.md", "AGENTS.md", "CLAUDE.md", "CODEX-HANDOFF.md", "LICENSE",
  "client/e2e/workspace.spec.ts", "client/e2e/fixtures/preview.json",
  "client/full-stack/workspace.spec.ts", "server/test/compose.e2e.yml",
  "server/test/fixtures/schema.sql", "client/playwright.config.ts",
  "client/playwright.ci.config.ts", "client/playwright.merge.config.ts",
  "client/playwright.full-stack.config.ts", "client/scripts/typecheck-browser-tests.mjs",
  "client/scripts/prerender-public.test.mjs", ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml", ".github/workflows/dependency-review.yml",
  ".github/workflows/benchmark.yml", ".github/workflows/load-test.yml",
  ".github/workflows/ai-hardening.yml",
  ".github/scripts/browser-ci-artifacts.test.mjs", ".github/scripts/browser-ci-artifacts.d.mts",
  ".github/scripts/server-ci-artifacts.mjs", ".github/scripts/server-ci-artifacts.test.mjs",
  ".github/scripts/npm-audit.mjs", ".github/scripts/npm-audit.test.mjs",
  ".github/scripts/ai-release-readiness.mjs", ".github/scripts/ai-release-readiness.test.mjs",
  ".github/dependabot.yml",
];
const DEPLOY_PATHS = [
  "client/src/App.tsx", "client/src/App.test.tsx", "client/src/__tests__/preview.test.tsx",
  "client/public/index.html", "server/src/main.ts", "server/src/main.spec.ts",
  "server/src/__tests__/service.spec.ts", "client/package.json", "client/package-lock.json",
  "server/package.json", "server/package-lock.json", "package.json", "package-lock.json",
  "server/prisma/schema.prisma", "server/prisma/migrations/20261114/migration.sql",
  "Dockerfile", "client/Dockerfile", "docker-compose.yml", "vercel.json", "render.yaml",
  "client/scripts/prerender-public.mjs", "scripts/release.mjs", ".github/scripts/other.test.mjs",
  ".github/workflows/other-ci.yml", "client/tests/helper.ts", "server/tests/helper.ts",
  "src/docs/runtime.ts", "README.txt", "new-runtime-config.json",
];
const DEPLOY_CONTROL_PATHS = [
  ".github/workflows/deploy-production.yml", ".github/workflows/deploy-frontend.yml",
  ".github/scripts/deploy-render.mjs", ".github/scripts/deploy-render.test.mjs",
  ".github/scripts/deployment-policy.mjs", ".github/scripts/deployment-policy.test.mjs",
  ".github/scripts/browser-ci-workflow.test.mjs", ".github/scripts/deployment-config.test.mjs",
  ".github/scripts/browser-ci-artifacts.mjs",
];

test("policy version and target workflow names are fixed", () => {
  assert.equal(POLICY_VERSION, 1);
  assert.deepEqual(TARGETS, {
    backend: { workflow: ".github/workflows/deploy-production.yml" },
    frontend: { workflow: ".github/workflows/deploy-frontend.yml" },
  });
});

test("force accepts only the explicit lowercase strings", () => {
  for (const value of [undefined, "", "false"]) assert.equal(parseForce(value), false);
  assert.equal(parseForce("true"), true);
});

test("force rejects coercion, case variants, whitespace and other values", () => {
  for (const value of [null, true, false, 0, 1, "0", "1", "True", "FALSE", " true", "true ", "yes", [], {}, new String("true")]) {
    assert.throws(() => parseForce(value), /INVALID_FORCE_DEPLOY/);
  }
});

test("strict JSON accepts ordinary nested records without changing values", () => {
  const value = { formatVersion: 1, verifiedSha: RELEASE_SHA, nested: [{ note: "quote \" and \\", count: 0 }], baselineSha: null };
  assert.deepEqual(parseDeploymentJson(JSON.stringify(value)), value);
});

test("strict JSON rejects duplicate and escaped-equivalent keys at every depth", () => {
  for (const value of [
    '{"decision":"deploy","decision":"skip"}',
    '{"target":"backend","targ\\u0065t":"frontend"}',
    '{"nested":[{"runAttempt":"1","runAttempt":"2"}]}',
  ]) assert.throws(() => parseDeploymentJson(value));
});

test("strict JSON rejects prototype keys including escaped and nested forms", () => {
  for (const key of ["__proto__", "prototype", "constructor", "\\u005f_proto__"]) {
    assert.throws(() => parseDeploymentJson(`{"${key}":{}}`));
    assert.throws(() => parseDeploymentJson(`{"nested":[{"${key}":{}}]}`));
  }
});

test("strict JSON rejects malformed, trailing, nonfinite and nonstring input", () => {
  for (const value of ["", "{", '{"a":1,}', "[1,]", "{}{}", '{} true', '{"x":01}', '{"x":1e999}', null, undefined, {}, Buffer.from("{}")]) {
    assert.throws(() => parseDeploymentJson(value));
  }
});

test("strict JSON enforces the 256 KiB UTF-8 byte bound and depth limit", () => {
  const boundary = `"${"x".repeat(256 * 1024 - 2)}"`;
  assert.equal(Buffer.byteLength(boundary), 256 * 1024);
  assert.equal(parseDeploymentJson(boundary).length, 256 * 1024 - 2);
  assert.throws(() => parseDeploymentJson(`"${"x".repeat(256 * 1024 - 1)}"`));
  const unicode = JSON.stringify("é".repeat(140_000));
  assert.ok(unicode.length < 256 * 1024 && Buffer.byteLength(unicode) > 256 * 1024);
  assert.throws(() => parseDeploymentJson(unicode));
  assert.throws(() => parseDeploymentJson(`${"[".repeat(66)}0${"]".repeat(66)}`));
});

test("only the complete explicitly reviewed non-runtime allowlist may skip", () => {
  for (const path of NON_RUNTIME_PATHS) assert.equal(classifyDeploymentPaths([path]), "skip", path);
  assert.equal(classifyDeploymentPaths(NON_RUNTIME_PATHS), "skip");
  assert.equal(classifyDeploymentPaths([]), "skip");
});

test("application source, in-source tests, public assets and unknown paths deploy", () => {
  for (const path of DEPLOY_PATHS) assert.equal(classifyDeploymentPaths([path]), "deploy", path);
  for (const path of [".github/workflows/ci.yaml", ".github/scripts/npm-audit.d.mts", "client/playwright.extra.config.ts", "docs-runtime/main.ts"]) {
    assert.equal(classifyDeploymentPaths([path]), "deploy", path);
  }
});

test("deployment controls and guard tests always deploy both fixed targets", () => {
  for (const path of DEPLOY_CONTROL_PATHS) assert.equal(classifyDeploymentPaths([path]), "deploy", path);
  for (const target of Object.keys(TARGETS)) {
    assert.deepEqual(assertDeploymentEvent(eventFixture(), REPOSITORY, target), {
      releaseSha: RELEASE_SHA, ciRunId: "314159", ciRunAttempt: "2",
    });
  }
});

test("mixed changes and both sides of renames cannot hide runtime changes", () => {
  for (const changes of [
    ["README.md", "server/src/main.ts"], ["client/public/deleted.js", "docs/removed.md"],
    ["client/e2e/helper.ts", "client/src/helper.ts"], ["server/src/old.ts", "server/test/new.ts"],
    ["docs/old.md", "plans/new.md", ".github/workflows/deploy-frontend.yml"],
  ]) assert.equal(classifyDeploymentPaths(changes), "deploy");
  assert.equal(classifyDeploymentPaths(["docs/deleted.md", "plans/new.md"]), "skip");
});

test("unsafe, absolute, traversal, empty and malformed change paths fail closed", () => {
  for (const path of ["", "/docs/a.md", "C:/docs/a.md", "../docs/a.md", "docs/../a.md", "docs/./a.md", "docs//a.md", "docs\\a.md", "docs/a\u0000.md", "docs/a\n.md", null, undefined, 1, {}, ["README.md"]]) {
    assert.throws(() => classifyDeploymentPaths([path]), /UNSAFE_DEPLOY_PATH/);
  }
  for (const changes of [null, undefined, {}, "README.md"]) assert.throws(() => classifyDeploymentPaths(changes));
});

test("authorized event binds only a successful same-repository CI main push", () => {
  assert.deepEqual(assertDeploymentEvent(eventFixture(), REPOSITORY, "backend"), {
    releaseSha: RELEASE_SHA, ciRunId: "314159", ciRunAttempt: "2",
  });
});

test("event rejects fork, PR, wrong workflow, stale outcome and malformed run identity", () => {
  const patches = [
    { head_branch: "feature" }, { event: "pull_request" }, { event: "workflow_dispatch" },
    { conclusion: "failure" }, { conclusion: "cancelled" }, { conclusion: null }, { name: "Other CI" },
    { id: "314159" }, { id: 0 }, { id: 1.5 }, { id: Number.MAX_SAFE_INTEGER + 1 },
    { run_attempt: "2" }, { run_attempt: 0 }, { run_attempt: 1.5 },
    { head_sha: "A".repeat(40) }, { head_sha: "a".repeat(39) }, { head_sha: "g".repeat(40) },
    { head_repository: { full_name: "fork/Data-Explorer-Editor" } }, { head_repository: null },
  ];
  for (const patch of patches) {
    const event = eventFixture(); Object.assign(event.workflow_run, patch);
    assert.throws(() => assertDeploymentEvent(event, REPOSITORY, "backend"), /UNAUTHORIZED_DEPLOY_EVENT/);
  }
  for (const key of Object.keys(eventFixture().workflow_run)) {
    const event = eventFixture(); delete event.workflow_run[key];
    assert.throws(() => assertDeploymentEvent(event, REPOSITORY, "backend"), /UNAUTHORIZED_DEPLOY_EVENT/);
  }
});

test("event rejects missing envelope, invalid expected repository and unknown target", () => {
  for (const event of [null, undefined, {}, { workflow_run: null }, { workflow_run: [] }]) {
    assert.throws(() => assertDeploymentEvent(event, REPOSITORY, "backend"), /UNAUTHORIZED_DEPLOY_EVENT/);
  }
  for (const repository of ["", "owner", "owner/repo/extra", "../repo", "owner/repo?token=x", null, {}]) {
    assert.throws(() => assertDeploymentEvent(eventFixture(), repository, "backend"));
  }
  for (const target of ["", "server", "Backend", "__proto__", null, undefined]) {
    assert.throws(() => assertDeploymentEvent(eventFixture(), REPOSITORY, target));
  }
});

const contextFixture = (patch = {}) => ({
  repository: REPOSITORY, target: "backend", releaseSha: RELEASE_SHA, treeSha: TREE_SHA,
  ciRunId: "314159", ciRunAttempt: "2", deployRunId: "902", deployRunAttempt: "1",
  configSha256: CONFIG_SHA256, ...patch,
});
const baseRecord = (context, kind) => ({
  formatVersion: 1, policyVersion: 1, kind, repository: context.repository,
  target: context.target, verifiedSha: context.releaseSha, treeSha: context.treeSha,
  ciRunId: context.ciRunId, ciRunAttempt: context.ciRunAttempt,
  deployRunId: context.deployRunId, deployRunAttempt: context.deployRunAttempt,
  configSha256: context.configSha256,
});
const decisionFixture = (context = contextFixture(), patch = {}) => ({
  ...baseRecord(context, "deployment-decision"), decision: "deploy",
  reason: "FIRST_DEPLOYMENT_RECEIPT", baselineSha: null, changeCount: 0, ...patch,
});
const receiptFixture = (context = contextFixture()) => ({
  ...baseRecord(context, "actual-deployment-receipt"), decision: "deploy",
  evidence: context.target === "backend" ? "backend-ready" : "vercel-production",
  url: context.target === "backend" ? "https://backend.example.com/health/ready" : "https://fixture.vercel.app",
});
const expectedRecord = (value, kind = "decision") => ({
  kind, target: value.target, repository: value.repository,
  deployRunId: value.deployRunId, deployRunAttempt: value.deployRunAttempt,
});
const actualContext = () => contextFixture({ releaseSha: BASELINE_SHA, ciRunId: "111", ciRunAttempt: "1", deployRunId: "900" });

test("decision and actual receipt records require their exact versioned shapes", () => {
  for (const target of ["backend", "frontend"]) {
    const decision = decisionFixture(contextFixture({ target }));
    const receipt = receiptFixture(contextFixture({ target }));
    assert.deepEqual(validateDeploymentRecord(decision, expectedRecord(decision)), decision);
    assert.deepEqual(validateDeploymentRecord(receipt, expectedRecord(receipt, "receipt")), receipt);
    for (const [value, kind] of [[decision, "decision"], [receipt, "receipt"]]) {
      for (const key of Object.keys(value)) {
        const missing = { ...value }; delete missing[key];
        assert.throws(() => validateDeploymentRecord(missing, expectedRecord(value, kind)), /INVALID_DEPLOY_RECORD/, key);
      }
      for (const extra of [{ createdAt: "not-a-date" }, { unreviewed: true }]) {
        assert.throws(() => validateDeploymentRecord({ ...value, ...extra }, expectedRecord(value, kind)), /INVALID_DEPLOY_RECORD/);
      }
    }
  }
});

test("record validation rejects coercion, invalid hashes, unsafe prototypes and unknown enums", () => {
  const value = decisionFixture();
  for (const patch of [
    { formatVersion: "1" }, { policyVersion: 2 }, { kind: "actual-deployment-receipt" },
    { verifiedSha: "A".repeat(40) }, { treeSha: "c".repeat(39) }, { configSha256: "d".repeat(63) },
    { ciRunId: 111 }, { ciRunId: "01" }, { ciRunAttempt: "0" }, { deployRunId: "0" },
    { changeCount: -1 }, { changeCount: 10_001 }, { changeCount: 1.5 }, { changeCount: "1" },
    { baselineSha: "invalid" }, { decision: "unknown" }, { reason: "FREE_FORM_REASON" },
    { decision: "skip" }, { decision: "skip", reason: "NON_RUNTIME_ONLY", baselineSha: null },
  ]) assert.throws(() => validateDeploymentRecord({ ...value, ...patch }, expectedRecord(value)), /INVALID_DEPLOY_RECORD/);
  for (const invalid of [null, [], Object.assign(Object.create({ inherited: true }), value), Object.assign(Object.create(null), value), JSON.parse(`{${JSON.stringify(value).slice(1, -1)},"__proto__":{}}`)]) {
    assert.throws(() => validateDeploymentRecord(invalid, expectedRecord(value)), /INVALID_DEPLOY_RECORD/);
  }
  assert.throws(() => validateDeploymentRecord({ ...receiptFixture(), decision: "skip" }, expectedRecord(value, "receipt")), /INVALID_DEPLOY_RECORD/);
  assert.throws(() => validateDeploymentRecord({ ...receiptFixture(), evidence: "vercel-production" }, expectedRecord(value, "receipt")), /INVALID_DEPLOY_RECORD/);
});

test("records cannot cross repository, target, deployment run or attempt boundaries", () => {
  for (const kind of ["decision", "receipt"]) {
    const value = kind === "decision" ? decisionFixture() : receiptFixture();
    for (const patch of [{ repository: "fork/repository" }, { target: "frontend" }, { deployRunId: "901" }, { deployRunAttempt: "2" }]) {
      assert.throws(() => validateDeploymentRecord(value, { ...expectedRecord(value, kind), ...patch }), /INVALID_DEPLOY_RECORD/);
    }
  }
});

test("receipts require a deploy decision with every current context binding", () => {
  const context = contextFixture(); const decision = decisionFixture(context);
  assert.deepEqual(createDeploymentReceipt(context, decision, receiptFixture(context).url), receiptFixture(context));
  for (const key of ["verifiedSha", "treeSha", "ciRunId", "ciRunAttempt", "deployRunId", "deployRunAttempt", "repository", "target", "configSha256"]) {
    const changed = { ...decision, [key]: key.endsWith("Sha") ? "e".repeat(40) : key === "configSha256" ? "e".repeat(64) : "999" };
    assert.throws(() => createDeploymentReceipt(context, changed, receiptFixture().url), undefined, key);
  }
  assert.throws(() => createDeploymentReceipt(context, decisionFixture(context, { decision: "skip", reason: "NON_RUNTIME_ONLY", baselineSha: BASELINE_SHA }), receiptFixture().url));
  const frontend = contextFixture({ target: "frontend" });
  assert.deepEqual(createDeploymentReceipt(frontend, decisionFixture(frontend), "https://fixture.vercel.app"), receiptFixture(frontend));
  for (const url of ["http://fixture.vercel.app", "https://user:password@fixture.vercel.app", "https://fixture.vercel.app/?token=x", "https://fixture.vercel.app/#fragment", "https://fixture.vercel.app.attacker.example", "https://example.com"]) {
    assert.throws(() => createDeploymentReceipt(frontend, decisionFixture(frontend), url));
  }
});

test("missing receipt, uncertainty, force, runtime and config changes conservatively deploy", () => {
  const context = contextFixture(); const baseline = receiptFixture(actualContext());
  const cases = [
    [{}, "FIRST_DEPLOYMENT_RECEIPT", null, 0],
    [{ baseline, uncertain: true, changes: ["README.md"] }, "HISTORY_UNCERTAIN", BASELINE_SHA, 1],
    [{ baseline, force: "true", changes: ["README.md"] }, "FORCED", BASELINE_SHA, 1],
    [{ baseline, changes: ["README.md", "server/src/main.ts"] }, "RUNTIME_CHANGED", BASELINE_SHA, 2],
    [{ baseline: { ...baseline, configSha256: "e".repeat(64) }, changes: ["README.md"] }, "CONFIG_CHANGED", BASELINE_SHA, 1],
  ];
  for (const [options, reason, baselineSha, changeCount] of cases) {
    assert.deepEqual(decideDeployment(context, options), decisionFixture(context, { reason, baselineSha, changeCount }));
  }
});

test("only known non-runtime changes or no changes skip against an actual receipt", () => {
  const context = contextFixture(); const baseline = receiptFixture(actualContext());
  for (const [changes, reason] of [[NON_RUNTIME_PATHS, "NON_RUNTIME_ONLY"], [[], "NO_CHANGES"]]) {
    const expected = decisionFixture(context, { decision: "skip", reason, baselineSha: BASELINE_SHA, changeCount: changes.length });
    assert.deepEqual(decideDeployment(context, { baseline, changes }), expected);
    assert.deepEqual(validateDeploymentRecord(expected, expectedRecord(expected)), expected);
  }
  assert.equal(decideDeployment(context, { baseline, force: "false", changes: ["docs/deleted.md"] }).decision, "skip");
});

test("force cannot override a diverged baseline or malformed identity", () => {
  for (const force of ["", "true"]) {
    assert.throws(() => decideDeployment(contextFixture(), { baseline: receiptFixture(actualContext()), ancestor: false, force }), /STALE_DEPLOY_BASELINE/);
  }
  for (const patch of [{ releaseSha: "bad" }, { target: "__proto__" }, { repository: "owner/repo/extra" }, { ciRunId: "0" }, { deployRunAttempt: 1 }, { configSha256: "bad" }]) {
    assert.throws(() => decideDeployment(contextFixture(patch), { force: "true" }));
  }
  assert.throws(() => decideDeployment(contextFixture(), { force: true }), /INVALID_FORCE_DEPLOY/);
  assert.throws(() => decideDeployment(contextFixture(), { baseline: decisionFixture(), changes: ["README.md"] }));
});

test("NUL-delimited Git changes retain deleted paths and both rename or copy sides", () => {
  const paths = ["README.md", "server/src/main.ts", "client/public/deleted.js", "server/prisma/schema.prisma", "client/e2e/old.ts", "client/src/new.ts", "docs/old file.md", "docs/new file.md"];
  const diff = `A\0${paths[0]}\0M\0${paths[1]}\0D\0${paths[2]}\0T\0${paths[3]}\0R100\0${paths[4]}\0${paths[5]}\0C75\0${paths[6]}\0${paths[7]}\0`;
  assert.deepEqual(parseGitChanges(diff), paths);
  assert.equal(classifyDeploymentPaths(parseGitChanges(diff)), "deploy");
  assert.deepEqual(parseGitChanges(""), []);
  assert.equal(classifyDeploymentPaths(parseGitChanges("D\0docs/deleted.md\0")), "skip");
  for (const diff of ["Z\0README.md\0", "R100\0docs/old.md\0", "A\0../unsafe.md\0", "M\0\0", null, {}]) assert.throws(() => parseGitChanges(diff));
});

const historyRun = (value, patch = {}) => ({
  id: Number(value.deployRunId), run_attempt: Number(value.deployRunAttempt),
  status: "completed", conclusion: "success", event: "workflow_run",
  path: TARGETS[value.target].workflow, head_sha: value.verifiedSha, head_branch: "main", ...patch,
});
const ciRun = (record) => ({
  id: Number(record.ciRunId), run_attempt: Number(record.ciRunAttempt), status: "completed",
  name: "CI", event: "push", conclusion: "success", head_branch: "main",
  head_sha: record.verifiedSha, head_repository: { full_name: record.repository },
});
function historyIo(runs, records, patch = {}) {
  const calls = [];
  const io = {
    listRuns: async () => structuredClone(runs),
    readRecord: async (run, kind) => {
      calls.push([run.id, kind, run.run_attempt]);
      const key = `${run.id}:${run.run_attempt}:${kind}`;
      return structuredClone(records.get(records.has(key) ? key : `${run.id}:${kind}`));
    },
    readCiRun: async (id, attempt) => ciRun([...records.values()].find((record) => record && record.ciRunId === id && record.ciRunAttempt === attempt)),
    ...patch,
  };
  return { io, calls };
}
const historicalRecords = (receipt, decision) => new Map([
  [`${receipt.deployRunId}:receipt`, receipt], ...(decision ? [[`${decision.deployRunId}:decision`, decision]] : []),
]);

test("newer authenticated skip-only runs never advance the actual deployment baseline", async () => {
  const receipt = receiptFixture(actualContext());
  const skipped = decisionFixture(contextFixture({ releaseSha: "e".repeat(40), ciRunId: "112", deployRunId: "901" }), { decision: "skip", reason: "NON_RUNTIME_ONLY", baselineSha: BASELINE_SHA, changeCount: 1 });
  const { io, calls } = historyIo([historyRun(skipped), historyRun(receipt)], historicalRecords(receipt, skipped));
  const history = await resolveDeploymentHistory(contextFixture(), io);
  assert.deepEqual(history.baseline, receipt); assert.equal(history.uncertain, false);
  assert.ok(calls.some(([id, kind]) => id === 901 && kind === "decision"));
  assert.equal(decideDeployment(contextFixture(), { ...history, changes: ["README.md"] }).decision, "skip");
});

test("failed, cancelled or successful unrecorded delivery makes history uncertain", async () => {
  const receipt = receiptFixture(actualContext());
  const newer = decisionFixture(contextFixture({ ciRunId: "112", deployRunId: "901" }));
  for (const conclusion of ["failure", "cancelled", "success"]) {
    for (const record of [undefined, newer]) {
      const records = historicalRecords(receipt, record);
      const { io } = historyIo([historyRun(newer, { conclusion }), historyRun(receipt)], records);
      const history = await resolveDeploymentHistory(contextFixture(), io);
      assert.deepEqual(history.baseline, receipt); assert.equal(history.uncertain, true);
      assert.equal(decideDeployment(contextFixture(), { ...history, changes: ["README.md"] }).decision, "deploy");
      assert.throws(() => decideDeployment(contextFixture(), { ...history, ancestor: false, force: "true" }), /STALE_DEPLOY_BASELINE/);
    }
  }
});

test("no receipt, history cap and ignored outer skipped/current runs never fabricate a baseline", async () => {
  const { io } = historyIo([], new Map());
  const empty = await resolveDeploymentHistory(contextFixture(), io);
  assert.equal(empty.baseline, null); assert.equal(decideDeployment(contextFixture(), empty).decision, "deploy");
  const receipt = receiptFixture(actualContext());
  const current = decisionFixture(); const newer = decisionFixture(contextFixture({ deployRunId: "901" }));
  const fixture = historyIo([historyRun(current), historyRun(newer, { conclusion: "skipped" }), historyRun(receipt)], historicalRecords(receipt));
  const history = await resolveDeploymentHistory(contextFixture(), fixture.io);
  assert.deepEqual(history.baseline, receipt); assert.equal(history.uncertain, false);
  assert.ok(fixture.calls.every(([id]) => id === 900));
  const cappedRuns = Array.from({ length: 32 }, (_, index) => historyRun(decisionFixture(contextFixture({ deployRunId: String(899 - index) }))));
  const capped = await resolveDeploymentHistory(contextFixture(), historyIo(cappedRuns, new Map()).io);
  assert.equal(capped.baseline, null); assert.equal(decideDeployment(contextFixture(), capped).decision, "deploy");
});

test("malformed JSON, read permissions and CI provenance failures abort history instead of skipping", async () => {
  const receipt = receiptFixture(actualContext()); const runs = [historyRun(receipt)];
  const { io } = historyIo(runs, historicalRecords(receipt));
  const denied = Object.assign(new Error("FIXTURE_FORBIDDEN"), { status: 403 });
  for (const patch of [
    { listRuns: async () => { throw denied; } }, { readRecord: async () => { throw denied; } },
    { readRecord: async () => parseDeploymentJson('{"target":"backend","target":"frontend"}') },
    { readRecord: async () => ({ ...receipt, deployRunAttempt: "2" }) },
    { readCiRun: async () => { throw denied; } },
  ]) await assert.rejects(resolveDeploymentHistory(contextFixture(), { ...io, ...patch }));
  for (const patch of [{ id: 999 }, { status: "in_progress" }, { conclusion: "failure" }, { name: "Other CI" }, { event: "pull_request" }, { head_branch: "feature" }, { head_sha: RELEASE_SHA }, { run_attempt: 2 }, { head_repository: { full_name: "fork/repo" } }]) {
    await assert.rejects(resolveDeploymentHistory(contextFixture(), { ...io, readCiRun: async () => ({ ...ciRun(receipt), ...patch }) }));
  }
});

test("skip history must match the selected actual receipt SHA and configuration", async () => {
  const receipt = receiptFixture(actualContext());
  const skipped = decisionFixture(contextFixture({ ciRunId: "112", deployRunId: "901" }), { decision: "skip", reason: "NON_RUNTIME_ONLY", baselineSha: BASELINE_SHA, changeCount: 1 });
  for (const patch of [{ baselineSha: "e".repeat(40) }, { configSha256: "e".repeat(64) }, { target: "frontend" }, { repository: "fork/repo" }]) {
    const changed = { ...skipped, ...patch };
    const fixture = historyIo([historyRun(skipped), historyRun(receipt)], historicalRecords(receipt, changed));
    await assert.rejects(resolveDeploymentHistory(contextFixture(), fixture.io));
  }
});

test("current rerun excludes only its own attempt and retains prior actual receipts", async () => {
  const context = contextFixture({ deployRunAttempt: "2" });
  const receipt = receiptFixture(contextFixture({ deployRunAttempt: "1", configSha256: "e".repeat(64) }));
  const fixture = historyIo([historyRun(decisionFixture(context)), historyRun(receipt)], new Map([
    [`${receipt.deployRunId}:1:receipt`, receipt],
  ]));
  const history = await resolveDeploymentHistory(context, fixture.io);
  assert.deepEqual(history.baseline, receipt); assert.equal(history.uncertain, true);
  assert.ok(fixture.calls.every(([id, , attempt]) => id === 902 && attempt === 1));
  assert.equal(decideDeployment(context, { ...history, changes: ["README.md"] }).decision, "deploy");
  assert.throws(() => decideDeployment(context, { ...history, ancestor: false, force: "true" }), /STALE_DEPLOY_BASELINE/);
});

test("present malformed receipts are not mistaken for missing deployment evidence", async () => {
  const receipt = receiptFixture(actualContext());
  const skipped = decisionFixture(contextFixture({ ciRunId: "112", deployRunId: "901" }), { decision: "skip", reason: "NON_RUNTIME_ONLY", baselineSha: BASELINE_SHA, changeCount: 1 });
  for (const invalid of [null, false, "", [], {}]) {
    const records = historicalRecords(receipt, skipped); records.set("901:receipt", invalid);
    const fixture = historyIo([historyRun(skipped), historyRun(receipt)], records);
    await assert.rejects(resolveDeploymentHistory(contextFixture(), fixture.io));
  }
});

const historyArtifact = (record, createdAt, patch = {}) => ({
  id: Number(record.deployRunId) * 100 + Number(record.deployRunAttempt),
  name: `actual-deployment-${record.target}-${record.deployRunId}-${record.deployRunAttempt}`,
  created_at: createdAt, expired: false, size_in_bytes: 1024,
  workflow_run: { id: Number(record.deployRunId) }, ...patch,
});
const activityRun = (record, createdAt, updatedAt) => historyRun(record, {
  created_at: createdAt, run_started_at: updatedAt, updated_at: updatedAt,
});
const orderedHistory = (context, runs, artifacts) => {
  assert.equal(typeof deploymentPolicy.orderDeploymentHistory, "function", "orderDeploymentHistory must order actual deployments, not workflow creation IDs");
  return deploymentPolicy.orderDeploymentHistory(context, { runs, artifacts });
};

test("later successful rerun of an older-created workflow is the actual config baseline", async () => {
  const context = contextFixture();
  const earlier = receiptFixture(contextFixture({ deployRunId: "901" }));
  const later = receiptFixture(contextFixture({ deployRunId: "900", deployRunAttempt: "2", configSha256: "e".repeat(64) }));
  const oldCreated = "2026-11-14T10:00:00Z", newCreated = "2026-11-14T11:00:00Z";
  const earlyDeploy = "2026-11-14T11:05:00Z", laterDeploy = "2026-11-14T12:05:00Z";
  const runs = [activityRun(earlier, newCreated, earlyDeploy), activityRun(later, oldCreated, laterDeploy)];
  const artifacts = [historyArtifact(earlier, earlyDeploy), historyArtifact(later, laterDeploy)];
  const ordered = orderedHistory(context, runs, artifacts);
  assert.deepEqual(ordered.map((run) => [run.id, run.run_attempt]), [[900, 2], [901, 1]]);
  assert.deepEqual(runs.map((run) => run.id), [901, 900], "raw created-order fixture must remain unchanged");
  const records = new Map([["901:1:receipt", earlier], ["900:2:receipt", later]]);
  const byAttempt = new Map(runs.map((run) => [`${run.id}:${run.run_attempt}`, run]));
  const fixture = historyIo(ordered.map((ref) => ({ ...byAttempt.get(`${ref.id}:${ref.run_attempt}`), ...ref })), records);
  const history = await resolveDeploymentHistory(context, fixture.io);
  assert.deepEqual(history.baseline, later); assert.equal(history.uncertain, false);
  const decision = decideDeployment(context, { ...history, changes: [] });
  assert.equal(decision.decision, "deploy"); assert.equal(decision.reason, "CONFIG_CHANGED");
});

test("artifact chronology finds old reruns outside workflow list and coalesces decision plus receipt", () => {
  const context = contextFixture();
  const earlier = receiptFixture(contextFixture({ deployRunId: "901" }));
  const later = receiptFixture(contextFixture({ deployRunId: "800", deployRunAttempt: "2" }));
  const artifacts = [historyArtifact(earlier, "2026-11-14T11:00:00Z"),
    historyArtifact(later, "2026-11-14T12:00:00Z", { id: 80020, name: "deployment-decision-backend-800-2" }),
    historyArtifact(later, "2026-11-14T12:05:00Z")];
  const refs = orderedHistory(context, [activityRun(earlier, "2026-11-14T10:00:00Z", "2026-11-14T11:00:00Z")], artifacts);
  assert.deepEqual(refs.map((run) => [run.id, run.run_attempt]), [[800, 2], [901, 1]]);
  assert.equal(refs[0].recordedAt, "2026-11-14T12:05:00Z");
});

test("actual activity ordering rejects corrupt provenance and retains unrecorded failure barriers", () => {
  const context = contextFixture(); const receipt = receiptFixture(actualContext());
  const artifact = historyArtifact(receipt, "2026-11-14T11:00:00Z");
  for (const patch of [{ id: 0 }, { created_at: "invalid" }, { created_at: "2026-02-30T00:00:00Z" }, { size_in_bytes: 262145 }, { workflow_run: { id: 901 } }, { name: "actual-deployment-backend-0900-1" }]) {
    assert.throws(() => orderedHistory(context, [], [{ ...artifact, ...patch }]));
  }
  const failed = activityRun(decisionFixture(contextFixture({ deployRunId: "901" })), "2026-11-14T10:30:00Z", "2026-11-14T12:00:00Z");
  failed.conclusion = "cancelled";
  const refs = orderedHistory(context, [failed], [artifact]);
  assert.deepEqual(refs.map((run) => [run.id, run.run_attempt]), [[901, 1], [900, 1]]);
  assert.ok(refs.length <= 32);
  assert.throws(() => orderedHistory(context, [], Array.from({ length: 101 }, () => artifact)), /INVALID_DEPLOY_HISTORY/);
  assert.throws(() => orderedHistory(context, [], [artifact, { ...artifact, id: 90099 }]), /INVALID_DEPLOY_HISTORY/);
});

test("ambiguous deployment timestamps fail closed and evidenced higher run IDs are not ignored", async () => {
  const context = contextFixture();
  const first = receiptFixture(contextFixture({ deployRunId: "901" }));
  const second = receiptFixture(contextFixture({ deployRunId: "903", configSha256: "e".repeat(64) }));
  const at = "2026-11-14T12:00:00Z";
  const artifacts = [historyArtifact(first, at), historyArtifact(second, at)];
  const refs = orderedHistory(context, [], artifacts);
  assert.equal(refs.length, 2); assert.ok(refs.every((ref) => ref.ambiguous === true));
  const records = new Map([["901:1:receipt", first], ["903:1:receipt", second]]);
  const raw = new Map([first, second].map((record) => [Number(record.deployRunId), historyRun(record)]));
  const hydrate = (values) => values.map((ref) => ({ ...raw.get(ref.id), ...ref }));
  await assert.rejects(resolveDeploymentHistory(context, historyIo(hydrate(refs), records).io), /AMBIGUOUS_DEPLOY_HISTORY/);
  const distinct = orderedHistory(context, [], [artifacts[0], { ...artifacts[1], created_at: "2026-11-14T12:01:00Z" }]);
  const history = await resolveDeploymentHistory(context, historyIo(hydrate(distinct), records).io);
  assert.deepEqual(history.baseline, second);
  assert.equal(decideDeployment(context, { ...history, changes: [] }).reason, "CONFIG_CHANGED");
});

test("bounded artifact discovery cannot authorize skip from an older available receipt", async () => {
  const context = contextFixture(), receipt = receiptFixture(actualContext());
  const fixture = historyIo([historyRun(receipt)], historicalRecords(receipt), { discoveryUncertain: async () => true });
  const history = await resolveDeploymentHistory(context, fixture.io);
  assert.deepEqual(history.baseline, receipt); assert.equal(history.uncertain, true);
  assert.equal(decideDeployment(context, { ...history, changes: [] }).reason, "HISTORY_UNCERTAIN");
  assert.throws(() => decideDeployment(context, { ...history, ancestor: false, force: "true" }), /STALE_DEPLOY_BASELINE/);
});
