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

test('Vercel clean URLs keep application rewrites on the extensionless SPA shell', () => {
  const config = JSON.parse(readFileSync(resolve(root, 'client/vercel.json'), 'utf8'));

  assert.equal(config.cleanUrls, true);
  assert.equal(config.trailingSlash, false);
  assert.equal(config.rewrites.length, 2);
  for (const rewrite of config.rewrites) {
    assert.equal(rewrite.destination, '/app');
    assert.doesNotMatch(rewrite.destination, /\.html(?:$|[?#])/);
  }
  for (const path of ['/login', '/forgot-password', '/legal-consent', '/onboarding', '/sql-explorer', '/sql-explorer/erd', '/nosql-explorer', '/admin', '/teams', '/billing/return']) {
    assert.ok(config.rewrites.some(rewrite => new RegExp(`^${rewrite.source}$`).test(path)), `Missing application rewrite: ${path}`);
  }
  for (const path of ['/', '/en', '/docs', '/docs/editor', '/en/docs/editor', '/changelog', '/privacy', '/terms', '/assets/app.js', '/images/landing/workspace.webp', '/api/query', '/missing-public-page']) {
    assert.ok(config.rewrites.every(rewrite => !new RegExp(`^${rewrite.source}$`).test(path)), `Unexpected application rewrite: ${path}`);
  }
});
