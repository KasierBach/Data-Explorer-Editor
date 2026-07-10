import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const PRESETS = {
  load: {
    concurrency: 20,
    durationMs: 15_000,
    rampMs: 750,
  },
  stress: {
    concurrency: 100,
    durationMs: 30_000,
    rampMs: 2_000,
  },
};

function getPreset(mode) {
  return PRESETS[mode] ?? PRESETS.load;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseHeaders(rawValue) {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('LOAD_TEST_HEADERS must be a JSON object.');
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)]),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[load-test] ${message}`);
    process.exit(1);
  }
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );

  return sorted[index];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorker(workerIndex, context, metrics) {
  const { deadline, initialDelayMs, requestInit, timeoutMs, url } = context;
  if (initialDelayMs > 0) {
    await sleep(Math.round(workerIndex * initialDelayMs));
  }

  while (performance.now() < deadline) {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    let statusKey = 'fetch_error';

    try {
      const response = await fetch(url, {
        ...requestInit,
        signal: controller.signal,
      });
      await response.arrayBuffer();
      statusKey = String(response.status);
      if (response.ok) {
        metrics.ok += 1;
      } else {
        metrics.failed += 1;
      }
    } catch (error) {
      statusKey = error instanceof Error && error.name === 'AbortError'
        ? 'timeout'
        : 'fetch_error';
      metrics.failed += 1;
    } finally {
      clearTimeout(timeoutHandle);
    }

    metrics.requests += 1;
    metrics.latencies.push(performance.now() - startedAt);
    metrics.statusCounts.set(
      statusKey,
      (metrics.statusCounts.get(statusKey) ?? 0) + 1,
    );
  }
}

function printSummary(mode, context, metrics, wallClockMs) {
  const statusCounts = Object.fromEntries(
    [...metrics.statusCounts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  const summary = {
    mode,
    url: context.url,
    method: context.requestInit.method,
    concurrency: context.concurrency,
    durationMs: context.durationMs,
    requests: metrics.requests,
    ok: metrics.ok,
    failed: metrics.failed,
    requestsPerSecond:
      wallClockMs > 0
        ? Number((metrics.requests / (wallClockMs / 1000)).toFixed(2))
        : 0,
    latencyMs: {
      min: metrics.latencies.length
        ? Number(Math.min(...metrics.latencies).toFixed(2))
        : 0,
      p50: Number(percentile(metrics.latencies, 50).toFixed(2)),
      p95: Number(percentile(metrics.latencies, 95).toFixed(2)),
      p99: Number(percentile(metrics.latencies, 99).toFixed(2)),
      max: metrics.latencies.length
        ? Number(Math.max(...metrics.latencies).toFixed(2))
        : 0,
    },
    statusCounts,
  };

  console.log(JSON.stringify(summary, null, 2));
}

function runSelfTest() {
  assert.deepEqual(getPreset('load'), PRESETS.load);
  assert.deepEqual(getPreset('stress'), PRESETS.stress);
  assert.equal(parsePositiveInt('25', 10), 25);
  assert.equal(parsePositiveInt('-1', 10), 10);
  assert.equal(percentile([10, 20, 30, 40], 50), 20);
  assert.equal(percentile([10, 20, 30, 40], 95), 40);
  assert.deepEqual(parseHeaders('{"x-test":"1"}'), { 'x-test': '1' });
  console.log('[load-test] self-test passed');
}

async function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }

  const mode = process.argv[2] === 'stress' ? 'stress' : 'load';
  const preset = getPreset(mode);
  const concurrency = parsePositiveInt(
    process.env.LOAD_TEST_CONCURRENCY,
    preset.concurrency,
  );
  const durationMs = parsePositiveInt(
    process.env.LOAD_TEST_DURATION_MS,
    preset.durationMs,
  );
  const rampMs = parsePositiveInt(process.env.LOAD_TEST_RAMP_MS, preset.rampMs);
  const timeoutMs = parsePositiveInt(process.env.LOAD_TEST_TIMEOUT_MS, 10_000);
  const url =
    process.env.LOAD_TEST_URL ?? 'http://127.0.0.1:3001/api/health';
  const method = (process.env.LOAD_TEST_METHOD ?? 'GET').toUpperCase();
  const headers = parseHeaders(process.env.LOAD_TEST_HEADERS);
  const token = process.env.LOAD_TEST_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const body = process.env.LOAD_TEST_BODY;
  if (body && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const requestInit = {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
    redirect: 'manual',
  };
  const metrics = {
    requests: 0,
    ok: 0,
    failed: 0,
    latencies: [],
    statusCounts: new Map(),
  };
  const start = performance.now();
  const context = {
    url,
    concurrency,
    durationMs,
    timeoutMs,
    deadline: start + durationMs,
    initialDelayMs: concurrency > 0 ? rampMs / concurrency : 0,
    requestInit,
  };

  console.log(
    `[load-test] mode=${mode} concurrency=${concurrency} durationMs=${durationMs} url=${url}`,
  );

  await Promise.all(
    Array.from({ length: concurrency }, (_, workerIndex) =>
      runWorker(workerIndex, context, metrics),
    ),
  );

  const wallClockMs = performance.now() - start;
  printSummary(mode, context, metrics, wallClockMs);

  if (
    process.env.LOAD_TEST_FAIL_ON_ERRORS === 'true' &&
    metrics.failed > 0
  ) {
    process.exitCode = 1;
  }
}

await main();
