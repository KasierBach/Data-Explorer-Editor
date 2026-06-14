import { createRequire } from 'module';
import { performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
require('reflect-metadata');
require('ts-node/register/transpile-only');

const { SearchService } = require('../../src/search/search.service.ts');
const {
  SearchIndexRepository,
} = require('../../src/search/search-index.repository.ts');

function forceGc() {
  if (typeof global.gc === 'function') {
    global.gc();
  }
}

function round(value) {
  return Number(value.toFixed(3));
}

function toMiB(bytes) {
  return round(bytes / (1024 * 1024));
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, sample) => total + sample, 0);
  const pick = (percentile) => {
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * percentile) - 1),
    );
    return sorted[index];
  };

  return {
    minMs: round(sorted[0] ?? 0),
    avgMs: round(sum / Math.max(sorted.length, 1)),
    p50Ms: round(pick(0.5) ?? 0),
    p95Ms: round(pick(0.95) ?? 0),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
}

class FakeRedisClient {
  constructor() {
    this.sets = new Map();
    this.hashes = new Map();
  }

  ensureSet(key) {
    let target = this.sets.get(key);
    if (!target) {
      target = new Set();
      this.sets.set(key, target);
    }
    return target;
  }

  ensureHash(key) {
    let target = this.hashes.get(key);
    if (!target) {
      target = new Map();
      this.hashes.set(key, target);
    }
    return target;
  }

  async smembers(key) {
    return [...(this.sets.get(key) ?? new Set())];
  }

  async del(...keys) {
    for (const key of keys) {
      this.sets.delete(key);
      this.hashes.delete(key);
    }
  }

  async hmget(key, ...fields) {
    const target = this.hashes.get(key) ?? new Map();
    return fields.map((field) => target.get(field) ?? null);
  }

  async hscan(key, _cursor, _countLabel, _count) {
    const target = this.hashes.get(key) ?? new Map();
    const chunk = [];
    for (const [field, value] of target.entries()) {
      chunk.push(field, value);
    }
    return ['0', chunk];
  }

  pipeline() {
    const commands = [];
    const pipeline = {
      sadd: (key, ...values) => {
        commands.push(async () => {
          const target = this.ensureSet(key);
          for (const value of values) {
            target.add(value);
          }
        });
        return pipeline;
      },
      hset: (key, field, value) => {
        commands.push(async () => {
          this.ensureHash(key).set(field, value);
        });
        return pipeline;
      },
      exec: async () => {
        for (const command of commands) {
          await command();
        }
        return [];
      },
    };
    return pipeline;
  }
}

function buildSearchDataset(size) {
  return Array.from({ length: size }, (_, index) => ({
      id: `item-${index}`,
      name: index % 5 === 0 ? `user_${index}` : `table_${index}`,
      type: 'table',
      connectionId: 'conn-1',
      connectionName: 'Primary',
      database: 'main',
      schema: 'public',
    }));
}

async function createService(items) {
  const client = new FakeRedisClient();
  const searchIndexRepository = new SearchIndexRepository({
    getClient: () => client,
  });
  await searchIndexRepository.replaceUserIndex('user-1', items);
  const service = new SearchService(
    {},
    {},
    {
      suggestTablesBySemantic: async () => [],
    },
    searchIndexRepository,
  );
  return service;
}

async function runScenario({ datasetSize, query, warmupRuns, measuredRuns }) {
  const items = buildSearchDataset(datasetSize);
  const service = await createService(items);
  const durations = [];

  for (let index = 0; index < warmupRuns; index += 1) {
    await service.search('user-1', query);
  }

  forceGc();
  const heapBefore = process.memoryUsage().heapUsed;

  let finalResultCount = 0;
  for (let index = 0; index < measuredRuns; index += 1) {
    const startedAt = performance.now();
    const results = await service.search('user-1', query);
    durations.push(performance.now() - startedAt);
    finalResultCount = results.length;
  }

  forceGc();
  const heapAfter = process.memoryUsage().heapUsed;

  return {
    datasetSize,
    query,
    measuredRuns,
    keywordMatchCountEstimate: Math.floor(datasetSize / 5),
    returnedResultCount: finalResultCount,
    heapDeltaBytes: heapAfter - heapBefore,
    heapDeltaMiB: toMiB(heapAfter - heapBefore),
    ...summarize(durations),
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const scenarios = [];

  for (const datasetSize of [1_000, 10_000, 50_000]) {
    scenarios.push(
      await runScenario({
        datasetSize,
        query: 'user_',
        warmupRuns: 2,
        measuredRuns: 8,
      }),
    );
  }

  const payload = {
    benchmark: 'search',
    startedAt,
    node: process.version,
    platform: process.platform,
    notes: [
      'Exercises the current SearchService keyword path through SearchIndexRepository using an in-memory Redis double.',
      'AI semantic fallback is intentionally disabled to isolate keyword lookup cost.',
      'Results are synthetic and measure in-process latency, not network or real Redis latency.',
    ],
    scenarios,
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
