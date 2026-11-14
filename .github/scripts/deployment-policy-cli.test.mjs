import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { main } from "./deployment-policy.mjs";

// These fixtures exercise CLI orchestration, not authentic GitHub or provider evidence.
const REPO = "KasierBach/Data-Explorer-Editor", PREFIX = `repos/${REPO}`;
const SHA = "a".repeat(40), TREE = "b".repeat(40), BASE_SHA = "c".repeat(40);
const API_URL = "https://api.fixture.example";
const CONFIG = createHash("sha256").update(JSON.stringify({ target: "backend", apiUrl: API_URL })).digest("hex");
const WORKFLOW = ".github/workflows/deploy-production.yml";
const CI_ENDPOINT = `${PREFIX}/actions/runs/111/attempts/1`;
const WORKFLOWS_ENDPOINT = `${PREFIX}/actions/workflows/deploy-production.yml/runs?per_page=32`;
const ARTIFACTS_ENDPOINT = `${PREFIX}/actions/artifacts?per_page=100`;
const eventFixture = () => ({ workflow_run: {
  id: 111, run_attempt: 1, status: "completed", name: "CI", event: "push",
  head_branch: "main", head_sha: SHA, conclusion: "success", head_repository: { full_name: REPO },
} });
const receipt = (patch = {}) => ({
  formatVersion: 1, policyVersion: 1, kind: "actual-deployment-receipt", repository: REPO,
  target: "backend", verifiedSha: BASE_SHA, treeSha: TREE, ciRunId: "110", ciRunAttempt: "1",
  deployRunId: "900", deployRunAttempt: "1", configSha256: CONFIG, decision: "deploy",
  evidence: "backend-ready", url: "https://api.fixture.example/health/ready", ...patch,
});
const runFor = (record, at = "2026-11-14T11:00:00Z") => ({
  id: Number(record.deployRunId), run_attempt: Number(record.deployRunAttempt), event: "workflow_run",
  path: WORKFLOW, status: "completed", conclusion: "success", created_at: "2026-11-14T10:00:00Z", updated_at: at,
});
const artifactFor = (record, at = "2026-11-14T11:00:00Z") => ({
  id: Number(record.deployRunId) * 100 + Number(record.deployRunAttempt),
  name: `actual-deployment-backend-${record.deployRunId}-${record.deployRunAttempt}`,
  created_at: at, size_in_bytes: 1024, expired: false, workflow_run: { id: Number(record.deployRunId) },
});

async function fixture(t, { records = [receipt()], runs, artifacts, diff = "M\0docs/release.md\0", event = eventFixture() } = {}) {
  const root = await mkdtemp(join(tmpdir(), "deployment-policy-cli-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "evidence"), output = join(root, "github-output.txt");
  const eventPath = join(root, "event.json"), urlFile = join(root, "deployment-url.txt");
  writeFileSync(eventPath, JSON.stringify(event), { flag: "wx" });
  writeFileSync(output, "", { flag: "wx" });
  writeFileSync(urlFile, "https://api.fixture.example/health/ready\n", { flag: "wx" });
  const env = { GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: REPO, GITHUB_RUN_ID: "902",
    GITHUB_RUN_ATTEMPT: "1", GH_TOKEN: "fixture-not-real", PRODUCTION_API_URL: API_URL, GITHUB_OUTPUT: output };
  const metadata = artifacts ?? records.map((record) => artifactFor(record));
  const api = new Map([
    [CI_ENDPOINT, eventFixture().workflow_run], [`${PREFIX}/commits/main`, { sha: SHA }],
    [WORKFLOWS_ENDPOINT, { workflow_runs: runs ?? records.map((record) => runFor(record)) }],
    [ARTIFACTS_ENDPOINT, { artifacts: metadata }],
  ]);
  const git = new Map([
    [JSON.stringify(["rev-parse", "HEAD"]), `${SHA}\n`],
    [JSON.stringify(["rev-parse", "HEAD^{tree}"]), `${TREE}\n`],
    [JSON.stringify(["status", "--porcelain"]), ""],
  ]);
  const downloads = new Map();
  for (const record of records) {
    api.set(`${PREFIX}/actions/runs/${record.deployRunId}/attempts/${record.deployRunAttempt}`, runFor(record));
    api.set(`${PREFIX}/actions/runs/${record.ciRunId}/attempts/${record.ciRunAttempt}`, {
      ...eventFixture().workflow_run, id: Number(record.ciRunId), run_attempt: Number(record.ciRunAttempt), head_sha: record.verifiedSha,
    });
    api.set(`${PREFIX}/actions/runs/${record.deployRunId}/artifacts?per_page=100`, {
      artifacts: metadata.filter((artifact) => artifact.workflow_run.id === Number(record.deployRunId)),
    });
    downloads.set(`actual-deployment-backend-${record.deployRunId}-${record.deployRunAttempt}`, { record, file: "receipt.json", extras: [] });
    for (const [args, value] of [
      [["merge-base", "--is-ancestor", record.verifiedSha, SHA], ""],
      [["rev-parse", `${record.verifiedSha}^{tree}`], `${record.treeSha}\n`],
      [["diff", "--name-status", "-z", "--find-renames", record.verifiedSha, SHA], diff],
    ]) git.set(JSON.stringify(args), value);
  }
  const calls = [], logs = [], unexpected = [];
  const rejectCommand = (command, args) => { unexpected.push([command, ...args]); throw new Error("UNEXPECTED_FIXTURE_COMMAND"); };
  const execute = (command, args) => {
    calls.push([command, ...args]);
    if (command === "git") {
      if (!git.has(JSON.stringify(args))) return rejectCommand(command, args);
      return git.get(JSON.stringify(args));
    }
    if (command === "gh" && args.length === 4 && JSON.stringify(args.slice(0, 3)) === '["api","--hostname","github.com"]') {
      if (!api.has(args[3])) return rejectCommand(command, args);
      const value = api.get(args[3]);
      if (value instanceof Error) throw value;
      return typeof value === "string" ? value : JSON.stringify(value);
    }
    if (command === "gh" && args.length === 9 && args[0] === "run" && args[1] === "download") {
      const download = downloads.get(args[6]);
      assert.ok(download, "only exact fixture artifact names may be downloaded");
      assert.deepEqual(args.slice(0, 8), ["run", "download", download.record.deployRunId, "--repo", `github.com/${REPO}`, "--name", args[6], "--dir"]);
      const destination = args[8];
      assert.equal(dirname(destination), directory);
      assert.ok(lstatSync(destination).isDirectory() && !lstatSync(destination).isSymbolicLink());
      assert.deepEqual(readdirSync(destination), [], "mock download requires a fresh empty directory");
      for (const file of [download.file, ...download.extras]) {
        assert.match(file, /^[A-Za-z][A-Za-z0-9.-]*\.json$/);
        writeFileSync(join(destination, file), JSON.stringify(download.record), { flag: "wx" });
      }
      return "";
    }
    return rejectCommand(command, args);
  };
  const invoke = async (action = "decide", patch = {}) => {
    const commandMock = t.mock.method(childProcess, "execFileSync", execute);
    const stdoutMock = t.mock.method(process.stdout, "write", (value) => { logs.push(String(value)); return true; });
    syncBuiltinESMExports();
    try { await main([action, "backend", directory], { ...env, ...patch }); }
    finally {
      stdoutMock.mock.restore(); commandMock.mock.restore(); syncBuiltinESMExports();
      assert.deepEqual(unexpected, [], "no real or unexpected subprocess may be invoked");
    }
  };
  return { root, directory, output, env, api, git, downloads, calls, logs, urlFile, invoke,
    readOutput: () => readFileSync(output, "utf8"),
    readRecord: (name = "decision.json") => JSON.parse(readFileSync(join(directory, name), "utf8")),
  };
}

test("main verifies and downloads the bound actual receipt before a docs-only skip", { concurrency: false }, async (t) => {
  const f = await fixture(t); await f.invoke();
  const decision = f.readRecord();
  assert.equal(decision.decision, "skip"); assert.equal(decision.reason, "NON_RUNTIME_ONLY");
  assert.equal(decision.baselineSha, BASE_SHA); assert.equal(decision.configSha256, CONFIG);
  assert.equal(f.readOutput(), "decision=skip\n");
  assert.ok(f.calls.some((call) => call[3] === "github.com" && call[4] === CI_ENDPOINT));
  assert.ok(f.calls.some((call) => call[1] === "run" && call[2] === "download" && call[3] === "900"));
  assert.equal(existsSync(join(f.directory, "receipt.json")), false);
  assert.equal(JSON.parse(f.logs.at(-1)).decision, "skip");
});

test("main bootstraps conservatively without a receipt or provider invocation", { concurrency: false }, async (t) => {
  const f = await fixture(t, { records: [] }); await f.invoke();
  assert.equal(f.readRecord().decision, "deploy"); assert.equal(f.readRecord().baselineSha, null);
  assert.equal(f.readOutput(), "decision=deploy\n");
  assert.ok(f.calls.every((call) => !(call[0] === "gh" && call[1] === "run") && !(call[0] === "git" && call[1] === "diff")));
  assert.equal(existsSync(join(f.directory, "receipt.json")), false);
});

test("main discovers a later config-only rerun outside the 32 workflow rows", { concurrency: false }, async (t) => {
  const earlier = receipt({ deployRunId: "901", verifiedSha: SHA, ciRunId: "111" });
  const later = receipt({ deployRunAttempt: "2", verifiedSha: SHA, ciRunId: "111", configSha256: "e".repeat(64) });
  const f = await fixture(t, { records: [earlier, later], runs: [runFor(earlier)], diff: "",
    artifacts: [artifactFor(earlier), artifactFor(later, "2026-11-14T12:00:00Z")] });
  await f.invoke();
  assert.equal(f.readRecord().decision, "deploy"); assert.equal(f.readRecord().reason, "CONFIG_CHANGED");
  assert.equal(f.readRecord().baselineSha, SHA); assert.equal(f.readOutput(), "decision=deploy\n");
  assert.ok(f.calls.some((call) => call[4] === `${PREFIX}/actions/runs/900/attempts/2`));
  assert.ok(f.calls.some((call) => call[1] === "run" && call[7] === "actual-deployment-backend-900-2"));
  assert.equal(existsSync(join(f.directory, "receipt.json")), false);
});

test("main rejects fork events before any Git or GitHub commands", { concurrency: false }, async (t) => {
  const event = eventFixture(); event.workflow_run.head_repository.full_name = "fork/repository";
  const f = await fixture(t, { event });
  await assert.rejects(f.invoke(), /UNAUTHORIZED_DEPLOY_EVENT/);
  assert.deepEqual(f.calls, []); assert.equal(f.readOutput(), "");
});

test("main rejects API, current source and historical attempt identity failures before output", { concurrency: false }, async (t) => {
  const historical = `${PREFIX}/actions/runs/900/attempts/1`;
  const cases = [
    [CI_ENDPOINT, Object.assign(new Error("FIXTURE_HTTP_403"), { status: 403 })],
    [ARTIFACTS_ENDPOINT, '{"artifacts":[],"artifacts":[]}'],
    [CI_ENDPOINT, { ...eventFixture().workflow_run, head_sha: "d".repeat(40) }],
    [CI_ENDPOINT, { ...eventFixture().workflow_run, run_attempt: 2 }],
    [CI_ENDPOINT, { ...eventFixture().workflow_run, head_repository: { full_name: "fork/repository" } }],
    [`${PREFIX}/commits/main`, { sha: "d".repeat(40) }],
    [ARTIFACTS_ENDPOINT, { artifacts: [{ ...artifactFor(receipt()), workflow_run: { id: 999 } }] }],
    [historical, { ...runFor(receipt()), id: 999 }],
    [historical, { ...runFor(receipt()), run_attempt: 2 }],
    [historical, { ...runFor(receipt()), path: ".github/workflows/untrusted.yml" }],
    [historical, { ...runFor(receipt()), event: "pull_request" }],
  ];
  for (const [endpoint, payload] of cases) {
    const f = await fixture(t); f.api.set(endpoint, payload);
    await assert.rejects(f.invoke(), /DEPLOY_API_FAILED|INVALID_DEPLOY_PROVENANCE|UNAUTHORIZED_DEPLOY_EVENT|STALE_DEPLOY_CANDIDATE|INVALID_DEPLOY_HISTORY/, endpoint);
    assert.equal(f.readOutput(), "");
  }
});

test("main rejects changed artifact identities and untrusted download contents before output", { concurrency: false }, async (t) => {
  const name = "actual-deployment-backend-900-1", endpoint = `${PREFIX}/actions/runs/900/artifacts?per_page=100`;
  for (const mutate of [
    (f) => { f.downloads.get(name).record = receipt({ deployRunAttempt: "2" }); },
    (f) => { f.downloads.get(name).record = receipt({ verifiedSha: "bad" }); },
    (f) => { f.downloads.get(name).file = "unexpected.json"; },
    (f) => { f.downloads.get(name).extras = ["extra.json"]; },
    (f) => { f.api.set(endpoint, { artifacts: [{ ...artifactFor(receipt()), name: "actual-deployment-backend-900-2" }] }); },
    (f) => { f.api.set(endpoint, { artifacts: [{ ...artifactFor(receipt()), workflow_run: { id: 999 } }] }); },
  ]) {
    const f = await fixture(t); mutate(f);
    await assert.rejects(f.invoke(), /INVALID_DEPLOY_RECORD|INVALID_DEPLOY_FILE|INVALID_DEPLOY_HISTORY/);
    assert.equal(f.readOutput(), "");
  }
});

test("main records only a matching deploy decision using the regular URL data file", { concurrency: false }, async (t) => {
  const f = await fixture(t, { records: [] }); await f.invoke();
  const before = f.calls.length;
  await f.invoke("record", { DEPLOYMENT_URL_FILE: f.urlFile, DEPLOYMENT_URL: "http://ignored.example" });
  const value = f.readRecord("receipt.json");
  assert.equal(value.kind, "actual-deployment-receipt"); assert.equal(value.decision, "deploy");
  assert.equal(value.verifiedSha, SHA); assert.equal(value.deployRunId, "902");
  assert.equal(value.url, "https://api.fixture.example/health/ready");
  assert.ok(f.calls.slice(before).every((call) => call[0] === "git"));
  assert.equal(f.readOutput(), "decision=deploy\n");
  const skipped = await fixture(t); await skipped.invoke();
  await assert.rejects(skipped.invoke("record", { DEPLOYMENT_URL_FILE: skipped.urlFile }), /INVALID_DEPLOY_RECORD/);
  assert.equal(existsSync(join(skipped.directory, "receipt.json")), false);
  assert.equal(skipped.readOutput(), "decision=skip\n");
});
