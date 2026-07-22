import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeployHookUrl,
  extractDeployId,
  extractVersion,
  resolveDeployTimeoutMs,
} from "./deploy-render.mjs";

test("pins a Render deploy hook to the verified commit", () => {
  const url = buildDeployHookUrl(
    "https://api.render.com/deploy/srv-example?key=secret",
    "abc123",
  );
  assert.equal(url.searchParams.get("ref"), "abc123");
  assert.equal(url.searchParams.get("key"), "secret");
});

test("rejects an insecure deploy hook", () => {
  assert.throws(
    () => buildDeployHookUrl("http://example.com/hook", "abc123"),
    /HTTPS/,
  );
});

test("extracts the version from the standard API envelope", () => {
  assert.equal(extractVersion({ data: { version: "abc123" } }), "abc123");
});

test("extracts deploy IDs without logging the secret hook URL", () => {
  assert.equal(extractDeployId({ id: "dep-123" }), "dep-123");
  assert.equal(extractDeployId({ deploy: { id: "dep-456" } }), "dep-456");
});

test("uses a bounded configurable deployment timeout", () => {
  assert.equal(resolveDeployTimeoutMs(), 45 * 60_000);
  assert.equal(resolveDeployTimeoutMs("3600000"), 3_600_000);
  assert.throws(() => resolveDeployTimeoutMs("1000"), /between/);
  assert.throws(() => resolveDeployTimeoutMs("invalid"), /between/);
});
