import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const scenario of ['stub', 'stale-schema', 'fresh-schema', 'failed-generation']) {
  test(`Prisma build generation: ${scenario}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'r10-prisma-build-'));
    try {
      for (const folder of ['scripts', 'prisma', 'node_modules/.prisma/client', 'node_modules/prisma/build']) mkdirSync(join(root, folder), { recursive: true });
      copyFileSync(new URL('./prisma-generate-safe.mjs', import.meta.url), join(root, 'scripts/prisma-generate-safe.mjs'));
      writeFileSync(join(root, 'prisma/schema.prisma'), 'current-schema');
      const marker = join(root, 'node_modules/.prisma/client/index.js');
      const generatedSchema = join(root, 'node_modules/.prisma/client/schema.prisma');
      writeFileSync(marker, 'stub-or-client');
      utimesSync(marker, new Date('2030-01-01'), new Date('2030-01-01'));
      if (scenario !== 'stub') writeFileSync(generatedSchema, scenario === 'fresh-schema' ? 'current-schema' : 'old-schema');
      writeFileSync(join(root, 'node_modules/prisma/build/index.js'), scenario === 'failed-generation'
        ? "console.error('EPERM fixture generation failed'); process.exit(1);"
        : "const fs=require('node:fs');fs.copyFileSync('prisma/schema.prisma','node_modules/.prisma/client/schema.prisma');fs.writeFileSync('generated','yes');");
      const result = spawnSync(process.execPath, [join(root, 'scripts/prisma-generate-safe.mjs')], { encoding: 'utf8' });
      assert.equal(result.status, scenario === 'failed-generation' ? 1 : 0, result.stdout + result.stderr);
      if (scenario === 'fresh-schema') assert.match(result.stdout, /skipping generate/);
      else if (scenario !== 'failed-generation') assert.equal(readFileSync(generatedSchema, 'utf8'), 'current-schema');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
