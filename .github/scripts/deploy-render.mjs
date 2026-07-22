import { pathToFileURL } from "node:url";

const POLL_INTERVAL_MS = 10_000;
const DEPLOY_TIMEOUT_MS = 45 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_DEPLOY_TIMEOUT_MS = 60_000;
const MAX_DEPLOY_TIMEOUT_MS = 2 * 60 * 60_000;

export function buildDeployHookUrl(rawUrl, commitSha) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("RENDER_DEPLOY_HOOK_URL must use HTTPS");
  }
  url.searchParams.set("ref", commitSha);
  return url;
}

export function extractVersion(payload) {
  return payload?.data?.version ?? payload?.version;
}

export function extractDeployId(payload) {
  return payload?.id ?? payload?.deploy?.id;
}

export function resolveDeployTimeoutMs(rawValue) {
  if (rawValue === undefined || rawValue === "") return DEPLOY_TIMEOUT_MS;
  const value = Number(rawValue);
  if (
    !Number.isInteger(value) ||
    value < MIN_DEPLOY_TIMEOUT_MS ||
    value > MAX_DEPLOY_TIMEOUT_MS
  ) {
    throw new Error(
      `RENDER_DEPLOY_TIMEOUT_MS must be an integer between ${MIN_DEPLOY_TIMEOUT_MS} and ${MAX_DEPLOY_TIMEOUT_MS}`,
    );
  }
  return value;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function waitForDeployment(apiUrl, commitSha, options = {}) {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEPLOY_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const readinessUrl = new URL("/api/health/ready", apiUrl);
  let attempt = 0;
  let lastObservation = "no response received";

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const response = await request(readinessUrl, {
        headers: { accept: "application/json" },
      });
      const payload = response.ok ? await readJson(response) : undefined;
      const version = extractVersion(payload);
      lastObservation = `HTTP ${response.status}, version ${version ?? "unavailable"}`;
      if (response.ok && version === commitSha) {
        return;
      }
    } catch (error) {
      lastObservation = error.message;
    }
    if (attempt === 1 || attempt % 6 === 0) {
      console.log(`Readiness pending: ${lastObservation}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Render did not expose commit ${commitSha} within ${Math.round(timeoutMs / 60_000)} minutes; last readiness result: ${lastObservation}`,
  );
}

export async function main(env = process.env) {
  const required = [
    "RENDER_DEPLOY_HOOK_URL",
    "PRODUCTION_API_URL",
    "COMMIT_SHA",
  ];
  for (const name of required) {
    if (!env[name])
      throw new Error(`Missing required environment variable: ${name}`);
  }

  const hookUrl = buildDeployHookUrl(
    env.RENDER_DEPLOY_HOOK_URL,
    env.COMMIT_SHA,
  );
  const response = await request(hookUrl, { method: "POST" });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(`Render deploy hook returned HTTP ${response.status}`);
  }

  const deployId = extractDeployId(payload);
  console.log(
    `Render deploy hook returned HTTP ${response.status}${deployId ? ` for deploy ${deployId}` : ""}`,
  );
  await waitForDeployment(env.PRODUCTION_API_URL, env.COMMIT_SHA, {
    timeoutMs: resolveDeployTimeoutMs(env.RENDER_DEPLOY_TIMEOUT_MS),
  });
  console.log(`Production is ready on commit ${env.COMMIT_SHA}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
