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

test('CI installs a checksum-pinned Syft with bounded retries before publishing images', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
  const expectedArchiveHash = '8fcb33017a0dc1058298c923c436d19dfa68ae93968e0b423248542e3afb9fc3';

  assert.match(workflow, /SYFT_VERSION: 1\.51\.1/);
  assert.match(workflow, new RegExp(`SYFT_SHA256: ${expectedArchiveHash}`));
  assert.match(workflow, /curl --fail --location --show-error/);
  assert.match(workflow, /--connect-timeout 15 --max-time 180/);
  assert.match(workflow, /--retry 5 --retry-delay 5 --retry-max-time 600 --retry-all-errors/);
  assert.match(workflow, /sha256sum --check --strict/);
  assert.ok(workflow.indexOf('sha256sum --check --strict') < workflow.indexOf('tar -xzf'));
  assert.doesNotMatch(workflow, /anchore\/sbom-action|continue-on-error:|SYFT_VERSION: latest/);
  assert.match(workflow, /syft scan "\$IMAGE_PREFIX\/server:\$\{GITHUB_SHA\}" --output "spdx-json=sbom-server-\$\{GITHUB_SHA\}\.spdx\.json"/);
  assert.match(workflow, /syft scan "\$IMAGE_PREFIX\/client:\$\{GITHUB_SHA\}" --output "spdx-json=sbom-client-\$\{GITHUB_SHA\}\.spdx\.json"/);
  assert.match(workflow, /name: sbom-server-\$\{\{ github\.sha \}\}\.spdx\.json[\s\S]*path: sbom-server-\$\{\{ github\.sha \}\}\.spdx\.json/);
  assert.match(workflow, /name: sbom-client-\$\{\{ github\.sha \}\}\.spdx\.json[\s\S]*path: sbom-client-\$\{\{ github\.sha \}\}\.spdx\.json/);
  assert.equal((workflow.match(/if-no-files-found: error/g) ?? []).length, 2);
  assert.equal((workflow.match(/retention-days: 30/g) ?? []).length, 2);
  assert.ok(workflow.indexOf('name: Generate SBOM files') < workflow.indexOf('name: Publish images'));
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
