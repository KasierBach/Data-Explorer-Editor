import { existsSync, readdirSync, rmSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const schemaPath = join(repoRoot, 'prisma', 'schema.prisma');
const clientDir = join(repoRoot, 'node_modules', '.prisma', 'client');
const clientMarker = join(clientDir, 'index.js');

function cleanupTempPrismaArtifacts() {
  if (!existsSync(clientDir)) {
    return;
  }

  for (const entry of readdirSync(clientDir)) {
    if (!entry.includes('.tmp')) {
      continue;
    }

    try {
      rmSync(join(clientDir, entry), { force: true });
    } catch {
      // Stale tmp files are best-effort cleanup only.
    }
  }
}

function shouldGenerateClient() {
  if (!existsSync(clientMarker)) {
    return true;
  }

  try {
    return statSync(schemaPath).mtimeMs > statSync(clientMarker).mtimeMs;
  } catch {
    return true;
  }
}

cleanupTempPrismaArtifacts();

if (!shouldGenerateClient()) {
  console.log('[prisma-generate-safe] Prisma client is up to date; skipping generate.');
  process.exit(0);
}

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'generate'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.status === 0) {
  process.exit(0);
}

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (output.includes('EPERM') && existsSync(clientMarker)) {
  console.warn('[prisma-generate-safe] prisma generate hit EPERM, but an existing Prisma client is present. Continuing build.');
  process.exit(0);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
