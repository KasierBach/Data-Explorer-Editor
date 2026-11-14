import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BROWSER_API_URL, BROWSER_PROJECTS, SHARD_TOTAL, assertBinding,
  assertSameBinding, assertShardPartition, assertUpstreamSuccess,
  assessBrowserResults, flattenBrowserReport, parseBrowserJson, prepareReports,
  recordShard, sealBuild, verifyBuild, verifyGate,
} from "./browser-ci-artifacts.mjs";

const SKIP_REASON = "Desktop Chromium preview only";
const SOURCE = `import { test, expect } from "@playwright/test";

test.describe("preview", () => {
  test("renders preview", async ({ page, isMobile, browserName }) => {
    test.skip(isMobile || browserName === "firefox", "${SKIP_REASON}");
    await expect(page).toHaveTitle("Preview");
  });

  test("exports selection", async ({ page }) => {
    await expect(page.locator("[data-export]")).toBeVisible();
  });
});
`;
const binding = (overrides = {}) => ({
  formatVersion: 1, releaseSha: "a".repeat(40), treeSha: "b".repeat(40),
  runId: "314159", runAttempt: "2", lockSha256: "c".repeat(64),
  nodeVersion: process.version, playwrightVersion: "1.56.1",
  apiUrl: BROWSER_API_URL, variant: "browser-mock-preview-v1", ...overrides,
});
const attempt = (status = "passed", retry = 0) => ({
  status, retry, workerIndex: 0, parallelIndex: 0, duration: 12,
  startTime: "2026-11-14T12:00:00.000Z", stdout: [], stderr: [], attachments: [],
});
function browserReport(projects = BROWSER_PROJECTS) {
  return {
    config: {
      rootDir: "/fixture/client/e2e", workers: 1, shard: null, metadata: binding(),
      projects: projects.map((name) => ({ name, testDir: "/fixture/client/e2e", retries: 1, timeout: 30_000 })),
    },
    suites: [{ title: "preview.spec.ts", file: "preview.spec.ts", specs: [], suites: [{
      title: "preview", file: "preview.spec.ts", line: 3, column: 1,
      specs: [["renders preview", 4], ["exports selection", 9]].map(([title, line]) => ({
        id: `preview-${line}`, title, file: "preview.spec.ts", line, column: 3, ok: true,
        tests: projects.map((projectName) => ({
          projectName, projectId: projectName, expectedStatus: "passed", status: "expected",
          timeout: 30_000, annotations: [], results: [attempt()],
        })),
      })),
    }] }],
    errors: [],
    stats: { expected: projects.length * 2, unexpected: 0, flaky: 0, skipped: 0, duration: 1250 },
  };
}
const specsOf = (report) => report.suites[0].suites[0].specs;
const testsOf = (report) => specsOf(report).flatMap((spec) => spec.tests);
const keysOf = (report) => flattenBrowserReport(report).map((row) => row.key);
const partition = (rows) => BROWSER_PROJECTS.map((project) => rows.filter((row) => row.project === project));
function updateStats(report) {
  for (const status of ["expected", "unexpected", "flaky", "skipped"]) {
    report.stats[status] = testsOf(report).filter((entry) => entry.status === status).length;
  }
  return report;
}

async function buildFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "browser-ci-artifacts-test-"));
  const previousApi = process.env.VITE_API_URL;
  process.env.VITE_API_URL = BROWSER_API_URL;
  t.after(async () => {
    if (previousApi === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = previousApi;
    await rm(root, { recursive: true, force: true });
  });
  const clientRoot = join(root, "client");
  const directory = join(root, "artifact");
  for (const path of [directory, join(clientRoot, "e2e"), join(clientRoot, "node_modules", "typescript", "lib")]) {
    await mkdir(path, { recursive: true });
  }
  const lock = JSON.stringify({ name: "browser-ci-fixture", lockfileVersion: 3, packages: { "": { version: "1.0.0" } } });
  await writeFile(join(clientRoot, "package.json"), JSON.stringify({ name: "browser-ci-fixture", private: true }));
  await writeFile(join(clientRoot, "package-lock.json"), lock);
  // Copy one compiler file; never link installed node_modules into the cleanup tree.
  const requireClient = createRequire(new URL("../../client/package.json", import.meta.url));
  await copyFile(requireClient.resolve("typescript"), join(clientRoot, "node_modules", "typescript", "lib", "typescript.js"));
  await writeFile(join(clientRoot, "node_modules", "typescript", "package.json"), JSON.stringify({ main: "lib/typescript.js", type: "commonjs" }));
  await writeFile(join(clientRoot, "e2e", "preview.spec.ts"), SOURCE);
  const dist = {
    "app.html": "<!doctype html><div id='root'></div>", "index.html": "<!doctype html><title>Preview</title>",
    ".vite/manifest.json": '{"src/main.tsx":{"file":"assets/app.js","isEntry":true}}',
    "public-routes.json": '["/"]', "sitemap.xml": "<urlset><url><loc>https://example.test/</loc></url></urlset>",
    "assets/app.js": "console.log('preview fixture');\n",
  };
  for (const [path, bytes] of Object.entries(dist)) {
    const destination = join(clientRoot, "dist", path);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, bytes);
  }
  const context = binding({ lockSha256: createHash("sha256").update(lock).digest("hex") });
  const inventory = browserReport();
  Object.assign(inventory.config, {
    rootDir: join(clientRoot, "e2e"), metadata: context,
    fullyParallel: true, forbidOnly: true, workers: 1, maxFailures: 0,
  });
  for (const project of inventory.config.projects) {
    Object.assign(project, { testDir: inventory.config.rootDir, repeatEach: 1, retries: 2, timeout: 60_000 });
  }
  for (const entry of testsOf(inventory)) Object.assign(entry, { status: "skipped", results: [], timeout: 60_000 });
  updateStats(inventory);
  const inventoryNames = ["inventory.json", ...BROWSER_PROJECTS.map((_, index) => `inventory-${index + 1}.json`)];
  for (const [index, name] of inventoryNames.entries()) {
    const report = structuredClone(inventory);
    if (index) {
      report.config.shard = { current: index, total: SHARD_TOTAL };
      for (const spec of specsOf(report)) spec.tests = spec.tests.filter((entry) => entry.projectName === BROWSER_PROJECTS[index - 1]);
      updateStats(report);
    }
    await writeFile(join(directory, name), JSON.stringify(report));
  }
  return { root, clientRoot, directory, context, inventory, inventoryNames };
}

test("parses realistic nested browser JSON without changing its data", () => {
  const report = browserReport();
  assert.deepEqual(parseBrowserJson(JSON.stringify(report)), report);
  assert.deepEqual(parseBrowserJson('{"note":"__proto__","nested":[true,false,null,1.5]}'), { note: "__proto__", nested: [true, false, null, 1.5] });
  for (const text of ['{"suites":[}', "{} null", "1e999"]) assert.throws(() => parseBrowserJson(text));
});

test("rejects nested duplicate keys, including escaped equivalent keys", () => {
  for (const text of ['{"suites":[{"title":"a","title":"b"}]}', '{"projectName":"chromium","project\\u004eame":"firefox"}']) {
    assert.throws(() => parseBrowserJson(text), /DUPLICATE_OR_UNSAFE_JSON_KEY/);
  }
});

test("rejects prototype-related keys at any depth", () => {
  for (const key of ["__proto__", "constructor", "prototype", "__pro\\u0074o__"]) {
    assert.throws(() => parseBrowserJson(`{"suites":[{"${key}":{}}]}`), /DUPLICATE_OR_UNSAFE_JSON_KEY/);
  }
});

test("enforces the JSON nesting boundary", () => {
  assert.doesNotThrow(() => parseBrowserJson("[".repeat(64) + "0" + "]".repeat(64)));
  assert.throws(() => parseBrowserJson("[".repeat(65) + "0" + "]".repeat(65)), /REPORT_STRUCTURE_LIMIT/);
});

test("bounds report bytes and individual strings before accepting JSON", () => {
  assert.throws(() => parseBrowserJson(" ".repeat(32 * 1024 * 1024) + "{}"), /REPORT_BYTE_LIMIT/);
  assert.throws(() => parseBrowserJson(JSON.stringify("x".repeat(1024 * 1024 + 1))), /REPORT_STRING_LIMIT/);
});

test("accepts a complete binding and a manifest carrying that same binding", () => {
  assert.doesNotThrow(() => assertBinding(binding()));
  assert.doesNotThrow(() => assertSameBinding({ ...binding(), kind: "sealed-client-browser-build" }, binding()));
});

test("rejects valid but different source, run, lock, Node and Playwright bindings", () => {
  const changes = {
    releaseSha: "d".repeat(40), treeSha: "e".repeat(40), runId: "314160", runAttempt: "3",
    lockSha256: "f".repeat(64), nodeVersion: "v22.999.0", playwrightVersion: "1.57.0",
  };
  for (const [key, value] of Object.entries(changes)) {
    assert.throws(() => assertSameBinding(binding({ [key]: value }), binding()), /BUILD_SOURCE_OR_RUN_MISMATCH/, key);
  }
});

test("rejects malformed identities, unsupported versions and a changed API variant", () => {
  const changes = {
    formatVersion: 2, releaseSha: "abc", treeSha: "g".repeat(40), runId: "0", runAttempt: "0",
    lockSha256: "a".repeat(63), nodeVersion: "v20.19.0", playwrightVersion: "1.56.1-beta",
    apiUrl: `${BROWSER_API_URL}/`, variant: "production",
  };
  for (const [key, value] of Object.entries(changes)) {
    assert.throws(() => assertSameBinding(binding({ [key]: value }), binding()), /INVALID_BUILD_BINDING/, key);
  }
});

test("flattens to stable sorted identities despite report ordering, root and opaque IDs", () => {
  const original = browserReport();
  const reordered = structuredClone(original);
  reordered.config.rootDir = "/another/checkout/client/e2e";
  specsOf(reordered).reverse();
  for (const spec of specsOf(reordered)) { spec.id = `other-${spec.id}`; spec.tests.reverse(); }
  assert.deepEqual(keysOf(reordered), keysOf(original));
  const rows = flattenBrowserReport(original);
  assert.equal(new Set(rows.map((row) => row.key)).size, BROWSER_PROJECTS.length * 2);
  assert.deepEqual(rows.map((row) => row.key), rows.map((row) => row.key).sort((a, b) => a.localeCompare(b)));
});

test("accepts merged JSON without opaque project IDs while retaining stable identities", () => {
  const report = browserReport();
  const expected = flattenBrowserReport(report);
  for (const entry of testsOf(report)) delete entry.projectId;
  assert.deepEqual(flattenBrowserReport(report), expected);
  testsOf(report)[0].projectId = 7;
  assert.throws(() => flattenBrowserReport(report), /INVALID_BROWSER_TEST/);
});

test("distinguishes projects, specs, suite paths and source locations", () => {
  const baseline = keysOf(browserReport(["chromium"]));
  for (const patch of [{ file: "nested/preview.spec.ts" }, { line: 5 }, { column: 4 }, { title: "another preview" }]) {
    const report = browserReport(["chromium"]);
    Object.assign(specsOf(report)[0], patch);
    assert.notDeepEqual(keysOf(report), baseline);
  }
  assert.ok(keysOf(browserReport(["firefox"])).every((key) => !baseline.includes(key)));
  const report = browserReport(["chromium"]);
  report.suites[0].suites[0].title = "another suite";
  assert.notDeepEqual(keysOf(report), baseline);
  specsOf(report)[0].file = "nested/preview.spec.ts";
  const windows = structuredClone(report);
  specsOf(windows)[0].file = "nested\\preview.spec.ts";
  assert.deepEqual(keysOf(windows), keysOf(report));
});

test("rejects duplicate project tests and duplicate specs even with different IDs", () => {
  const report = browserReport();
  specsOf(report)[0].tests.push(structuredClone(specsOf(report)[0].tests[0]));
  assert.throws(() => flattenBrowserReport(report), /DUPLICATE_BROWSER_TEST/);
  const duplicateSpec = browserReport();
  specsOf(duplicateSpec).push({ ...structuredClone(specsOf(duplicateSpec)[0]), id: "different-id" });
  assert.throws(() => flattenBrowserReport(duplicateSpec), /DUPLICATE_BROWSER_TEST/);
});

test("rejects empty inventories, unsafe test files and undeclared projects", () => {
  assert.throws(() => flattenBrowserReport({ ...browserReport(), suites: [] }), /EMPTY_BROWSER_INVENTORY/);
  const empty = browserReport();
  for (const spec of specsOf(empty)) spec.tests = [];
  assert.throws(() => flattenBrowserReport(empty), /EMPTY_BROWSER_INVENTORY/);
  for (const file of ["../preview.spec.ts", "/preview.spec.ts", "preview.test.ts"]) {
    const report = browserReport(); specsOf(report)[0].file = file;
    assert.throws(() => flattenBrowserReport(report), /UNSAFE_ARTIFACT_PATH|INVALID_BROWSER_TEST_FILE/);
  }
  const report = browserReport(); testsOf(report)[0].projectName = "webkit";
  assert.throws(() => flattenBrowserReport(report), /INVALID_BROWSER_TEST/);
});

test("accepts exactly four nonempty disjoint shards covering the inventory", () => {
  const inventory = flattenBrowserReport(browserReport());
  assert.equal(SHARD_TOTAL, 4);
  assert.doesNotThrow(() => assertShardPartition(inventory, partition(inventory)));
});

test("rejects missing, extra and empty shards", () => {
  const inventory = flattenBrowserReport(browserReport());
  const shards = partition(inventory);
  for (const invalid of [shards.slice(1), [...shards, shards[0]], [[], ...shards.slice(1)]]) {
    assert.throws(() => assertShardPartition(inventory, invalid), /MISSING_BROWSER_SHARD/);
  }
});

test("rejects overlapping shards instead of treating duplicate coverage as complete", () => {
  const inventory = flattenBrowserReport(browserReport());
  const shards = partition(inventory);
  shards[1].push(shards[0][0]);
  assert.throws(() => assertShardPartition(inventory, shards), /OVERLAPPING_BROWSER_SHARDS/);
});

test("rejects a missing test or changed location even when all four shards exist", () => {
  const inventory = flattenBrowserReport(browserReport());
  const missing = partition(inventory); missing[0].pop();
  assert.throws(() => assertShardPartition(inventory, missing), /BROWSER_TEST_INVENTORY_MISMATCH/);
  const changed = browserReport(); specsOf(changed)[0].column++;
  assert.throws(() => assertShardPartition(inventory, partition(flattenBrowserReport(changed))), /BROWSER_TEST_INVENTORY_MISMATCH/);
});

test("preserves pass, failure, flaky, retry, timeout, interruption and skip accounting", () => {
  const report = browserReport();
  const entries = testsOf(report);
  entries[5].expectedStatus = "failed";
  entries[6].expectedStatus = "skipped";
  const expected = flattenBrowserReport(report);
  Object.assign(entries[1], { status: "unexpected", results: [attempt("failed")] });
  Object.assign(entries[2], { status: "flaky", results: [attempt("timedOut"), attempt("passed", 1)] });
  Object.assign(entries[3], { status: "flaky", results: [attempt("failed"), attempt("failed", 1), attempt("passed", 2)] });
  Object.assign(entries[4], { status: "unexpected", results: [attempt("failed"), attempt("interrupted", 1)] });
  entries[5].results = [attempt("failed")];
  Object.assign(entries[6], { status: "skipped", results: [attempt("skipped")], annotations: [{ type: "skip", description: "Declared limitation" }] });
  const assessed = assessBrowserResults(updateStats(report), expected, []);
  assert.deepEqual(assessed.counts, { total: entries.length, expected: 3, unexpected: 2, flaky: 2, skipped: 1, retries: 4, timedOutAttempts: 1, interruptedAttempts: 1 });
  assert.equal(assessed.durationMs, 1250);
  assert.equal(assessed.ok, false);
  assert.equal(assessed.rows.filter((row) => row.results.some((result) => result.status === "failed")).length, 4);
});

test("retains successful flaky retries and declared expected failures without erasing them", () => {
  const report = browserReport();
  testsOf(report)[1].expectedStatus = "failed";
  const expected = flattenBrowserReport(report);
  Object.assign(testsOf(report)[0], { status: "flaky", results: [attempt("failed"), attempt("passed", 1)] });
  testsOf(report)[1].results = [attempt("failed")];
  const assessed = assessBrowserResults(updateStats(report), expected, []);
  assert.equal(assessed.ok, true);
  assert.equal(assessed.counts.flaky, 1);
  assert.equal(assessed.counts.retries, 1);
  assert.equal(assessed.counts.unexpected, 0);
  assert.equal(assessed.counts.expected, expected.length - 1);
});

test("rejects unfinished tests and invalid attempt statuses or retry indices", () => {
  const expected = flattenBrowserReport(browserReport());
  const unfinished = browserReport(); testsOf(unfinished)[0].status = "pending";
  assert.throws(() => assessBrowserResults(unfinished, expected, []), /UNFINISHED_BROWSER_TEST/);
  for (const invalid of [attempt("pending"), attempt("passed", -1), attempt("passed", 0.5), attempt("passed", "0")]) {
    const report = browserReport(); testsOf(report)[0].results = [invalid];
    assert.throws(() => assessBrowserResults(report, expected, []), /INVALID_BROWSER_ATTEMPT/);
  }
});

test("rejects undeclared runtime skips, missing annotations and unapproved reasons", () => {
  const report = browserReport();
  const expected = flattenBrowserReport(report);
  const key = expected.find((row) => row.project === "firefox" && row.line === 4).key;
  const entry = testsOf(report)[1];
  Object.assign(entry, { status: "skipped", expectedStatus: "skipped", results: [attempt("skipped")] });
  updateStats(report);
  assert.throws(() => assessBrowserResults(report, expected, []), /UNEXPECTED_BROWSER_SKIP/);
  const policies = [{ key, reasons: [SKIP_REASON] }];
  assert.throws(() => assessBrowserResults(report, expected, policies), /UNEXPECTED_BROWSER_SKIP/);
  entry.annotations = [{ type: "skip", description: "Unreviewed reason" }];
  assert.throws(() => assessBrowserResults(report, expected, policies), /UNEXPECTED_BROWSER_SKIP/);
  entry.annotations = [{ type: "skip", description: SKIP_REASON }];
  assert.throws(() => assessBrowserResults(report, expected, [{ key: "wrong-test", reasons: [SKIP_REASON] }]), /UNEXPECTED_BROWSER_SKIP/);
});

test("accepts annotated approved and declared skips but rejects executed skipped tests", () => {
  const report = browserReport();
  const expected = flattenBrowserReport(report);
  const key = expected.find((row) => row.project === "firefox" && row.line === 4).key;
  Object.assign(testsOf(report)[1], { status: "skipped", expectedStatus: "skipped", results: [attempt("skipped")], annotations: [{ type: "skip", description: SKIP_REASON }] });
  const assessed = assessBrowserResults(updateStats(report), expected, [{ key, reasons: [SKIP_REASON] }]);
  assert.equal(assessed.ok, true);
  assert.equal(assessed.counts.skipped, 1);
  const declared = flattenBrowserReport(report);
  assert.equal(assessBrowserResults(report, declared, []).counts.skipped, 1);
  testsOf(report)[1].results = [attempt("passed")];
  assert.throws(() => assessBrowserResults(report, declared, []), /INVALID_SKIPPED_TEST/);
});

test("rejects empty execution, changed expectations and contradictory passing outcomes", () => {
  const expected = flattenBrowserReport(browserReport());
  for (const status of ["expected", "unexpected", "flaky"]) {
    const report = browserReport(); Object.assign(testsOf(report)[0], { status, results: [] });
    assert.throws(() => assessBrowserResults(updateStats(report), expected, []), /UNEXECUTED_OR_CHANGED_BROWSER_TEST/);
  }
  const changed = browserReport(); testsOf(changed)[0].expectedStatus = "failed";
  assert.throws(() => assessBrowserResults(changed, expected, []), /UNEXECUTED_OR_CHANGED_BROWSER_TEST/);
  const failed = browserReport(); testsOf(failed)[0].results = [attempt("failed")];
  assert.throws(() => assessBrowserResults(failed, expected, []), /BROWSER_ATTEMPT_OUTCOME_MISMATCH/);
});

test("never turns global errors, dishonest counters or invalid duration into green", () => {
  const expected = flattenBrowserReport(browserReport());
  const report = browserReport(); report.errors = [{ message: "Global setup failed" }];
  assert.throws(() => assessBrowserResults(report, expected, []), /BROWSER_GLOBAL_ERROR/);
  for (const status of ["expected", "unexpected", "flaky", "skipped"]) {
    const changed = browserReport(); changed.stats[status]++;
    assert.throws(() => assessBrowserResults(changed, expected, []), /BROWSER_REPORT_COUNT_MISMATCH/);
  }
  for (const duration of [-1, Infinity, undefined]) {
    const changed = browserReport(); changed.stats.duration = duration;
    assert.throws(() => assessBrowserResults(changed, expected, []), /INVALID_BROWSER_DURATION/);
  }
});

test("does not let an undeclared skipped attempt become a passing retry", () => {
  const report = browserReport();
  const expected = flattenBrowserReport(report);
  testsOf(report)[0].results = [attempt("skipped"), attempt("passed", 1)];
  assert.throws(() => assessBrowserResults(report, expected, []));
});

test("requires successful build and shard jobs, not failure, cancellation or skip", () => {
  assert.doesNotThrow(() => assertUpstreamSuccess("success", "success"));
  for (const result of ["failure", "cancelled", "skipped", undefined]) {
    assert.throws(() => assertUpstreamSuccess(result, "success"), /CLIENT_UPSTREAM_NOT_SUCCESSFUL/);
    assert.throws(() => assertUpstreamSuccess("success", result), /CLIENT_UPSTREAM_NOT_SUCCESSFUL/);
  }
});

test("seals and verifies an injected temporary client with source-scoped skip policies", async (t) => {
  const fixture = await buildFixture(t);
  const { directory, clientRoot, context, inventory } = fixture;
  const manifest = await sealBuild(directory, context, clientRoot);
  assert.deepEqual(await verifyBuild(directory, context, false, clientRoot), manifest);
  assert.deepEqual(await verifyBuild(directory, context, true, clientRoot), manifest);
  assert.ok(manifest.files.some((file) => file.path === "dist/assets/app.js"));
  for (const row of flattenBrowserReport(inventory)) {
    const policy = manifest.skipPolicies.find((entry) => entry.key === row.key);
    if (row.line === 4 && row.project !== "chromium") assert.deepEqual(policy?.reasons, [SKIP_REASON]);
    else assert.equal(policy, undefined);
  }
  const results = browserReport();
  for (const entry of specsOf(results)[0].tests.filter((entry) => entry.projectName !== "chromium")) {
    Object.assign(entry, { status: "skipped", expectedStatus: "skipped", results: [attempt("skipped")], annotations: [{ type: "skip", description: SKIP_REASON }] });
  }
  const assessed = assessBrowserResults(updateStats(results), flattenBrowserReport(inventory), manifest.skipPolicies);
  assert.equal(assessed.ok, true);
  assert.equal(assessed.counts.skipped, BROWSER_PROJECTS.length - 1);
});

test("detects changed, added and missing sealed files", async (t) => {
  const { directory, clientRoot, context } = await buildFixture(t);
  await sealBuild(directory, context, clientRoot);
  const asset = join(directory, "dist", "assets", "app.js");
  const original = await readFile(asset);
  await writeFile(asset, "tampered");
  await assert.rejects(() => verifyBuild(directory, context, false, clientRoot), /BUILD_CHECKSUM_OR_INVENTORY_MISMATCH/);
  await writeFile(asset, original);
  const added = join(directory, "dist", "extra.js"); await writeFile(added, "extra");
  await assert.rejects(() => verifyBuild(directory, context, false, clientRoot), /BUILD_CHECKSUM_OR_INVENTORY_MISMATCH/);
  await rm(added); await rm(asset);
  await assert.rejects(() => verifyBuild(directory, context, false, clientRoot), /BUILD_CHECKSUM_OR_INVENTORY_MISMATCH/);
});

test("rejects a different build context and drift in the injected installed dist", async (t) => {
  const { directory, clientRoot, context } = await buildFixture(t);
  await sealBuild(directory, context, clientRoot);
  await assert.rejects(() => verifyBuild(directory, { ...context, runAttempt: "3" }, false, clientRoot), /BUILD_SOURCE_OR_RUN_MISMATCH/);
  await writeFile(join(clientRoot, "dist", "app.html"), "different installed build");
  await assert.rejects(() => verifyBuild(directory, context, true, clientRoot), /INSTALLED_BUILD_MISMATCH/);
  assert.equal((await verifyBuild(directory, context, false, clientRoot)).kind, "sealed-client-browser-build");
});

test("does not seal unreviewed source skip conditions or nonliteral reasons", async (t) => {
  const fixture = await buildFixture(t);
  const cases = [
    ["condition", SOURCE.replace('isMobile || browserName === "firefox"', "unknownFeature"), /UNREVIEWED_RUNTIME_SKIP_CONDITION/],
    ["reason", SOURCE.replace(`"${SKIP_REASON}"`, "skipReason"), /UNREVIEWED_RUNTIME_SKIP_REASON/],
  ];
  for (const [name, source, error] of cases) {
    const directory = join(fixture.root, `policy-${name}`); await mkdir(directory);
    for (const file of fixture.inventoryNames) await copyFile(join(fixture.directory, file), join(directory, file));
    await writeFile(join(fixture.clientRoot, "e2e", "preview.spec.ts"), source);
    await assert.rejects(() => sealBuild(directory, fixture.context, fixture.clientRoot), error);
  }
});

test("rejects failed-then-passed retries misclassified as expected", () => {
  const report = browserReport();
  const expected = flattenBrowserReport(report);
  testsOf(report)[0].results = [attempt("failed"), attempt("passed", 1)];
  assert.throws(() => assessBrowserResults(report, expected, []));
});

test("rejects all-passing attempts misclassified as flaky", () => {
  const report = browserReport();
  const expected = flattenBrowserReport(report);
  testsOf(report)[0].status = "flaky";
  assert.throws(() => assessBrowserResults(updateStats(report), expected, []));
});

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const saveJson = (path, value) => writeFile(path, JSON.stringify(value));
function temporaryEnv(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const set = (entries) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  set(values);
  t.after(() => set(previous));
}
async function assertNoGateSummary(fixture) {
  for (const path of [fixture.summaryPath, fixture.stepSummaryPath]) {
    await assert.rejects(() => readFile(path), { code: "ENOENT" });
  }
}
async function assertRejectedGate(fixture, error) {
  await assert.rejects(() => verifyGate(fixture.directory, fixture.shardRoot, fixture.mergedPath, fixture.context, fixture.clientRoot), error);
  await assertNoGateSummary(fixture);
}
async function gateFixture(t, { record = true } = {}) {
  const fixture = await buildFixture(t);
  const { directory, clientRoot, context, inventory, root } = fixture;
  const build = await sealBuild(directory, context, clientRoot);
  const shardRoot = join(root, "downloads");
  const mergedPath = join(clientRoot, "ci-results", "merged-results.json");
  const summaryPath = join(clientRoot, "ci-results", "summary.json");
  const stepSummaryPath = join(root, "step-summary.txt");
  temporaryEnv(t, {
    BROWSER_TEST_OUTCOME: "success", CLIENT_BUILD_RESULT: "success",
    CLIENT_SHARDS_RESULT: "success", GITHUB_STEP_SUMMARY: stepSummaryPath,
  });
  await mkdir(join(clientRoot, "ci-results"));
  const merged = structuredClone(inventory);
  for (const spec of specsOf(merged)) {
    for (const entry of spec.tests) {
      const skipped = spec.line === 4 && entry.projectName !== "chromium";
      Object.assign(entry, {
        status: skipped ? "skipped" : "expected", expectedStatus: skipped ? "skipped" : "passed",
        results: [attempt(skipped ? "skipped" : "passed")],
        annotations: skipped ? [{ type: "skip", description: SKIP_REASON }] : [],
      });
    }
  }
  Object.assign(specsOf(merged)[1].tests[0], { status: "flaky", results: [attempt("timedOut"), attempt("passed", 1)] });
  for (const entry of testsOf(merged)) delete entry.projectId;
  updateStats(merged);
  merged.stats.duration *= SHARD_TOTAL;
  await saveJson(mergedPath, merged);
  const shards = [];
  for (let index = 0; index < SHARD_TOTAL; index++) {
    const shard = index + 1;
    // upload-artifact preserves ci-results and test-results under their common client ancestor.
    const artifactRoot = join(shardRoot, `browser-shard-${context.releaseSha}-${context.runId}-${context.runAttempt}-${shard}`);
    const output = join(artifactRoot, "ci-results");
    await mkdir(output, { recursive: true });
    await mkdir(join(artifactRoot, "test-results"));
    await saveJson(join(artifactRoot, "test-results", ".last-run.json"), { status: "passed", failedTests: [] });
    const report = structuredClone(merged);
    report.config.shard = { current: shard, total: SHARD_TOTAL };
    for (const spec of specsOf(report)) spec.tests = spec.tests.filter((entry) => entry.projectName === BROWSER_PROJECTS[index]);
    updateStats(report); report.stats.duration = 1250;
    const reportPath = join(output, "results.json");
    const blobPath = join(output, "blob-report.zip");
    const manifestPath = join(output, "shard-manifest.json");
    await saveJson(reportPath, report);
    // A tiny valid empty ZIP with a shard-specific comment; these APIs seal/copy opaque bytes.
    const comment = Buffer.from(`fixture-shard-${shard}`);
    const blob = Buffer.alloc(22 + comment.length);
    blob.writeUInt32LE(0x06054b50, 0); blob.writeUInt16LE(comment.length, 20); comment.copy(blob, 22);
    await writeFile(blobPath, blob);
    const manifest = record ? await recordShard(output, directory, context, shard, clientRoot) : undefined;
    shards.push({ shard, artifactRoot, directory: output, reportPath, blobPath, manifestPath, report, blob, manifest });
  }
  return { ...fixture, build, shardRoot, shards, merged, mergedPath, summaryPath, stepSummaryPath };
}

test("completes the full gate from nested downloaded shard artifacts only", async (t) => {
  const fixture = await gateFixture(t);
  await assertNoGateSummary(fixture);
  const prepared = await prepareReports(fixture.shardRoot, fixture.context, fixture.clientRoot);
  assert.deepEqual(prepared, { copied: SHARD_TOTAL, expected: SHARD_TOTAL, partial: false });
  for (const shard of fixture.shards) {
    assert.deepEqual(await readFile(join(fixture.clientRoot, "all-blob-reports", `shard-${shard.shard}.zip`)), shard.blob);
  }
  await assertNoGateSummary(fixture);
  const summary = await verifyGate(fixture.directory, fixture.shardRoot, fixture.mergedPath, fixture.context, fixture.clientRoot);
  const total = testsOf(fixture.merged).length;
  assert.deepEqual(summary.counts, {
    total, expected: total - BROWSER_PROJECTS.length, unexpected: 0, flaky: 1,
    skipped: BROWSER_PROJECTS.length - 1, retries: 1, timedOutAttempts: 1, interruptedAttempts: 0,
  });
  assert.equal(summary.kind, "complete-client-browser-gate");
  assert.equal(summary.complete, true);
  assert.equal(summary.shardTotal, SHARD_TOTAL);
  assert.equal(summary.workersPerShard, 1);
  assert.equal(summary.inventorySha256, digest(await readFile(join(fixture.directory, "inventory.json"))));
  assert.deepEqual(JSON.parse(await readFile(fixture.summaryPath, "utf8")), summary);
  assert.match(await readFile(fixture.stepSummaryPath, "utf8"), /## Browser gate/);
});

test("recordShard rejects missing, malformed, stale and wrongly routed reports", async (t) => {
  const fixture = await gateFixture(t, { record: false });
  const shard = fixture.shards[0];
  const bytes = await readFile(shard.reportPath);
  const cases = [
    ["missing", undefined, { code: "ENOENT" }],
    ["malformed", '{"suites":[}', /INVALID_REPORT_JSON/],
    ["stale", (report) => { report.config.metadata.runAttempt = "3"; }, /BUILD_SOURCE_OR_RUN_MISMATCH/],
    ["wrong shard", (report) => { report.config.shard.current = 2; }, /WRONG_BROWSER_SHARD/],
    ["wrong workers", (report) => { report.config.workers = 2; }, /WRONG_BROWSER_SHARD/],
  ];
  for (const [name, change, error] of cases) {
    if (change === undefined) await rm(shard.reportPath);
    else if (typeof change === "string") await writeFile(shard.reportPath, change);
    else { const report = structuredClone(shard.report); change(report); await saveJson(shard.reportPath, report); }
    await assert.rejects(() => recordShard(shard.directory, fixture.directory, fixture.context, shard.shard, fixture.clientRoot), error, name);
    await assert.rejects(() => readFile(shard.manifestPath), { code: "ENOENT" });
    await assertNoGateSummary(fixture);
    await writeFile(shard.reportPath, bytes);
  }
});

test("recordShard rejects absent or empty blobs and unexecuted step outcomes", async (t) => {
  const fixture = await gateFixture(t, { record: false });
  const shard = fixture.shards[0];
  await rm(shard.blobPath);
  await assert.rejects(() => recordShard(shard.directory, fixture.directory, fixture.context, 1, fixture.clientRoot), { code: "ENOENT" });
  await writeFile(shard.blobPath, Buffer.alloc(0));
  await assert.rejects(() => recordShard(shard.directory, fixture.directory, fixture.context, 1, fixture.clientRoot), /MISSING_BLOB_REPORT/);
  await writeFile(shard.blobPath, shard.blob);
  for (const outcome of ["skipped", "cancelled", undefined]) {
    if (outcome === undefined) delete process.env.BROWSER_TEST_OUTCOME;
    else process.env.BROWSER_TEST_OUTCOME = outcome;
    await assert.rejects(() => recordShard(shard.directory, fixture.directory, fixture.context, 1, fixture.clientRoot), /UNEXECUTED_BROWSER_SHARD/);
  }
  process.env.BROWSER_TEST_OUTCOME = "success";
  await assert.rejects(() => readFile(shard.manifestPath), { code: "ENOENT" });
  await assertNoGateSummary(fixture);
});

test("records failing shard diagnostics but never publishes a complete gate for them", async (t) => {
  const fixture = await gateFixture(t, { record: false });
  for (const shard of fixture.shards) {
    if (shard.shard === 1) {
      Object.assign(testsOf(shard.report)[0], { status: "unexpected", results: [attempt("failed")] });
      await saveJson(shard.reportPath, updateStats(shard.report));
    }
    process.env.BROWSER_TEST_OUTCOME = shard.shard === 1 ? "failure" : "success";
    shard.manifest = await recordShard(shard.directory, fixture.directory, fixture.context, shard.shard, fixture.clientRoot);
    assert.equal(shard.manifest.reportSha256, digest(await readFile(shard.reportPath)));
    assert.equal(shard.manifest.blobSha256, digest(shard.blob));
  }
  assert.equal(fixture.shards[0].manifest.testStepOutcome, "failure");
  assert.equal(fixture.shards[0].manifest.ok, false);
  assert.equal(fixture.shards[0].manifest.counts.unexpected, 1);
  assert.deepEqual(JSON.parse(await readFile(fixture.shards[0].manifestPath, "utf8")), fixture.shards[0].manifest);
  await assertRejectedGate(fixture, /MISSING_OR_FAILED_BROWSER_SHARD/);
});

test("prepareReports retains only valid nested blobs and marks partial diagnostics", async (t) => {
  const fixture = await gateFixture(t);
  await writeFile(fixture.shards[1].blobPath, "corrupt blob");
  await saveJson(fixture.shards[2].manifestPath, { ...fixture.shards[2].manifest, runAttempt: "3" });
  await rm(fixture.shards[3].blobPath);
  assert.deepEqual(await prepareReports(fixture.shardRoot, fixture.context, fixture.clientRoot), { copied: 1, expected: SHARD_TOTAL, partial: true });
  assert.deepEqual(await readdir(join(fixture.clientRoot, "all-blob-reports")), ["shard-1.zip"]);
  assert.deepEqual(await readFile(join(fixture.clientRoot, "all-blob-reports", "shard-1.zip")), fixture.shards[0].blob);
  await assertRejectedGate(fixture, /SHARD_REPORT_CHECKSUM_MISMATCH/);
});

test("prepareReports fails closed when no valid downloaded blob exists", async (t) => {
  const { root, clientRoot, context } = await buildFixture(t);
  await assert.rejects(() => prepareReports(join(root, "missing-downloads"), context, clientRoot), /NO_VALID_BLOB_REPORTS/);
  assert.deepEqual(await readdir(join(clientRoot, "all-blob-reports")), []);
  await assert.rejects(() => readFile(join(clientRoot, "ci-results", "summary.json")), { code: "ENOENT" });
});

test("verifyGate cannot complete with a missing shard, manifest, report or blob", async (t) => {
  const fixture = await gateFixture(t);
  const shard = fixture.shards[0];
  for (const path of [shard.manifestPath, shard.reportPath, shard.blobPath]) {
    const bytes = await readFile(path); await rm(path);
    await assertRejectedGate(fixture, { code: "ENOENT" });
    await writeFile(path, bytes);
  }
  const withheld = join(fixture.root, "withheld-shard");
  await rename(shard.artifactRoot, withheld);
  await assertRejectedGate(fixture, { code: "ENOENT" });
  await rename(withheld, shard.artifactRoot);
});

test("verifyGate rejects corrupted bytes, stale bindings and changed shard evidence", async (t) => {
  const fixture = await gateFixture(t);
  const shard = fixture.shards[0];
  const bytes = await readFile(shard.reportPath);
  await writeFile(shard.blobPath, "corrupt blob");
  await assertRejectedGate(fixture, /SHARD_REPORT_CHECKSUM_MISMATCH/);
  await writeFile(shard.blobPath, shard.blob);
  await writeFile(shard.reportPath, Buffer.concat([bytes, Buffer.from(" ")]));
  await assertRejectedGate(fixture, /SHARD_REPORT_CHECKSUM_MISMATCH/);
  await writeFile(shard.reportPath, bytes);
  const cases = [
    ["stale report", (report) => { report.config.metadata.runAttempt = "3"; }, /BUILD_SOURCE_OR_RUN_MISMATCH/],
    ["stale manifest", (_, manifest) => { manifest.runAttempt = "3"; }, /BUILD_SOURCE_OR_RUN_MISMATCH/],
    ["wrong report shard", (report) => { report.config.shard.current = 2; }, /WRONG_BROWSER_SHARD/],
    ["wrong manifest shard", (_, manifest) => { manifest.shard = 2; }, /MISSING_OR_FAILED_BROWSER_SHARD/],
    ["manifest counts", (_, manifest) => { manifest.counts.total++; }, /BROWSER_SHARD_NOT_SUCCESSFUL/],
    ["unexpected execution", (report) => { Object.assign(testsOf(report)[0], { status: "unexpected", results: [attempt("failed")] }); updateStats(report); }, /BROWSER_SHARD_NOT_SUCCESSFUL/],
    ...["failure", "cancelled", "skipped"].map((outcome) => [outcome, (_, manifest) => { manifest.testStepOutcome = outcome; }, /MISSING_OR_FAILED_BROWSER_SHARD/]),
  ];
  for (const [name, change, error] of cases) {
    const report = structuredClone(shard.report); const manifest = structuredClone(shard.manifest);
    change(report, manifest);
    const changedBytes = JSON.stringify(report); manifest.reportSha256 = digest(changedBytes);
    await writeFile(shard.reportPath, changedBytes); await saveJson(shard.manifestPath, manifest);
    await assertRejectedGate(fixture, error);
    await writeFile(shard.reportPath, bytes); await saveJson(shard.manifestPath, shard.manifest);
    t.diagnostic(`case: ${name}`);
  }
});
test("verifyGate requires successful upstream jobs even with complete valid evidence", async (t) => {
  const fixture = await gateFixture(t);
  for (const key of ["CLIENT_BUILD_RESULT", "CLIENT_SHARDS_RESULT"]) {
    for (const outcome of ["failure", "cancelled", "skipped", undefined]) {
      if (outcome === undefined) delete process.env[key]; else process.env[key] = outcome;
      await assertRejectedGate(fixture, /CLIENT_UPSTREAM_NOT_SUCCESSFUL/);
      process.env[key] = "success";
    }
  }
});

test("verifyGate rejects missing, corrupt and inventory/count-tampered merged reports", async (t) => {
  const fixture = await gateFixture(t);
  await rm(fixture.mergedPath);
  await assertRejectedGate(fixture, { code: "ENOENT" });
  await writeFile(fixture.mergedPath, '{"suites":[}');
  await assertRejectedGate(fixture, /INVALID_REPORT_JSON/);
  const cases = [
    ["inventory", (report) => { specsOf(report)[0].column++; }, /BROWSER_TEST_INVENTORY_MISMATCH/],
    ["reported counters", (report) => { report.stats.expected++; }, /BROWSER_REPORT_COUNT_MISMATCH/],
    ["extra honest retry", (report) => { Object.assign(testsOf(report)[0], { status: "flaky", results: [attempt("failed"), attempt("passed", 1)] }); updateStats(report); }, /MERGED_BROWSER_RESULT_MISMATCH/],
    ["unexpected merged outcome", (report) => { Object.assign(testsOf(report)[0], { status: "unexpected", results: [attempt("failed")] }); updateStats(report); }, /MERGED_BROWSER_RESULT_MISMATCH/],
  ];
  for (const [name, change, error] of cases) {
    const report = structuredClone(fixture.merged); change(report);
    await saveJson(fixture.mergedPath, report);
    await assertRejectedGate(fixture, error);
    t.diagnostic(`case: ${name}`);
  }
});
