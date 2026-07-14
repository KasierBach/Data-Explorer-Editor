import assert from "node:assert/strict";
import test from "node:test";
import { buildDeployHookUrl, extractVersion } from "./deploy-render.mjs";

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
