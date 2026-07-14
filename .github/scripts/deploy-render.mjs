import { pathToFileURL } from "node:url";

const POLL_INTERVAL_MS = 10_000;
const DEPLOY_TIMEOUT_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

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

  while (Date.now() < deadline) {
    try {
      const response = await request(readinessUrl, {
        headers: { accept: "application/json" },
      });
      if (response.ok && extractVersion(await response.json()) === commitSha) {
        return;
      }
    } catch (error) {
      console.log(`Readiness check pending: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Render did not expose commit ${commitSha} before timeout`);
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
  if (!response.ok) {
    throw new Error(`Render deploy hook returned HTTP ${response.status}`);
  }

  console.log(`Render accepted deployment for ${env.COMMIT_SHA}`);
  await waitForDeployment(env.PRODUCTION_API_URL, env.COMMIT_SHA);
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
