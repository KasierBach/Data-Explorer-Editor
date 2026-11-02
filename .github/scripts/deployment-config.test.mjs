import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)), '..');

test('Render uses the bundled Prisma CLI available in the runtime image', () => {
  const render = readFileSync(resolve(root, 'render.yaml'), 'utf8');
  const dockerfile = readFileSync(resolve(root, 'server/Dockerfile'), 'utf8');

  assert.match(render, /node node_modules\/prisma\/build\/index\.js migrate deploy/);
  assert.doesNotMatch(render, /\bnpx prisma migrate deploy\b/);
  assert.match(dockerfile, /\/usr\/local\/bin\/npx/);
});

test('frontend operations guide matches workflow-driven Vercel deployment', () => {
  const guide = readFileSync(resolve(root, 'docs/operations/ci-cd.md'), 'utf8');
  const workflow = readFileSync(resolve(root, '.github/workflows/deploy-frontend.yml'), 'utf8');
  const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  const clientVercel = JSON.parse(
    readFileSync(resolve(root, 'client/vercel.json'), 'utf8'),
  );

  assert.match(guide, /Deploy production frontend/);
  assert.match(guide, /VERCEL_TOKEN/);
  assert.match(workflow, /vercel@59\.6\.2 deploy --prebuilt --prod/);
  assert.equal(vercel.git.deploymentEnabled, false);
  assert.equal(clientVercel.git.deploymentEnabled, false);
});
