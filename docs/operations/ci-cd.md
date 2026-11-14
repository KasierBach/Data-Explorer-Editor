# Production CI/CD

## What runs

- Pull requests to `main`: client/server install, lint, full server TypeScript checking including unit/E2E sources after Prisma generation, all-source coverage floors, builds, backend E2E against PostgreSQL/Redis/MongoDB/MySQL, mock browser regressions, a separate browser-to-real-API/PostgreSQL job, Docker image builds, dependency review, and CodeQL.
- Pushes to `main`: the same verification runs, then publishes immutable SHA-tagged and `main` Docker images to GHCR.
- A successful `main` CI push triggers the Render backend deploy hook. The dedicated `Deploy production frontend` workflow checks out that verified SHA, builds with Vercel CLI, and deploys the prebuilt frontend; Vercel Git deployment stays disabled to avoid duplicate releases.

## Configure once

1. In GitHub branch rules for `main`, require `Client`, `Server`, `Full-stack browser`, `Container images`, `Dependency review`, and `CodeQL` before merging.
2. Create the `production` environment and add its `RENDER_DEPLOY_HOOK_URL` secret from the Render service's deploy hook. The deploy job fails closed until this exists.
3. If GHCR publishing reports a permission error, allow GitHub Actions to write packages for this repository.
4. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` to the `production` environment. Keep Vercel Git deployment disabled (`deploymentEnabled: false`); `.github/workflows/deploy-frontend.yml` deploys the CI-verified SHA after a successful push to `main`.

## Client browser pipeline

```text
Client checks and build ──> Client browser shard 1/4 ─┐
                       ├─> Client browser shard 2/4 ─┤
                       ├─> Client browser shard 3/4 ─┤─> Client
                       └─> Client browser shard 4/4 ─┘
Client + Server ──> Full-stack browser ──> Container images
```

`Client checks and build` retains audit, lint, complete unit coverage, prerender checks and the complete production build. It builds once with `VITE_API_URL=http://localhost:3001/api`, then seals the entire `dist` (including public HTML, sitemap and hidden `.vite` manifest) together with the full browser inventory and sixteen project-leg inventories. Each job uses that verified build with a preview-only CI configuration; it does not rebuild. The default local `npm run test:e2e` still builds automatically.

The matrix is four jobs with one Playwright worker each, `fail-fast: false` and at most four jobs in parallel. Each job runs a quarter of each existing project sequentially, with native `--project` and `--shard=N/4`. The project order is Chromium, Firefox, mobile Chrome and mobile WebKit; the native shard index is `((job - 1 + projectOrdinal) % 4) + 1`:

| Job | Chromium | Firefox | Mobile Chrome | Mobile WebKit |
| --- | --- | --- | --- | --- |
| 1 | 1/4 | 2/4 | 3/4 | 4/4 |
| 2 | 2/4 | 3/4 | 4/4 | 1/4 |
| 3 | 3/4 | 4/4 | 1/4 | 2/4 |
| 4 | 4/4 | 1/4 | 2/4 | 3/4 |

The `shard-index` helper supplies this mapping to both inventory generation and execution; do not reimplement it in workflow arithmetic. Rotation keeps native test groups intact and spreads WebKit and late-file work across runners instead of packing all WebKit into one job. It balances project exposure, not measured test durations. The browser step has one shared 20-minute deadline across its four sequential legs; the job cap remains 25 minutes. An ordinary failed leg does not hide later diagnostics, but the step fails if any test or recorder fails. All original CI retries and per-test timeouts remain unchanged. Sharding does not isolate shared backend state: these browser tests use mock routes, while Server and full-stack continue to own separate real database fixtures.

Build and report artifacts bind the checked-out commit and tree, workflow run and attempt, client lockfile, Node/Playwright versions, API variant and file checksums. Artifact names include SHA/run/attempt; downloads never reuse another run or SHA. No `.env`, `node_modules` or credentials belong in the sealed build. Each job artifact retains `ci-results/<project>/` and `test-results/<project>/`; separate output paths prevent a later invocation from deleting an earlier report or trace. Every leg manifest records the outer job, selected project, mapped native shard, actual test exit code/outcome and inventory/report/blob hashes. Shard folders must not be flattened when downloaded.

The required check remains **`Client`**. It always runs the aggregate gate, merges sixteen validated blob reports for HTML/JSON diagnostics and only passes when the build and matrix jobs succeeded, all sixteen nonempty mapped legs match their assigned inventories, each project's four native parts cover that project exactly, the four outer jobs cover the full inventory, and the merged report preserves every identity, outcome and attempt history. Missing, corrupt, stale, cancelled, failed or skipped producer evidence fails the gate; a partial diagnostic merge is not a pass. Existing source-declared browser/mobile skips retain their annotations and are counted separately from expected passes. Retries, flaky tests, timed-out and interrupted attempts are also reported separately. Native merged metadata sums workers across sixteen sequential invocations; it is not evidence of sixteen simultaneous workers. The gate verifies one worker per leg and the workflow permits only four concurrent jobs.

For a local shard using the normal build-on-run configuration:

```sh
npm --prefix client run test:e2e -- --shard=1/4 --workers=1
```

For the preview-only CI configuration, use a clean, credential-free checkout at the candidate commit, build with the explicit mock API URL, and generate `--list --reporter=json` inventories under `CI=true`: one full inventory plus every outer-job/project leg using `shard-index <job> <project>`. Seal/install with `.github/scripts/browser-ci-artifacts.mjs`. Set `BROWSER_BUILD_ARTIFACT` to that same-run artifact and invoke `playwright test --config=playwright.ci.config.ts --project=<project> --shard=<mapped-index>/4 --workers=1 --output=test-results/<project>`, with JSON/blob output-file overrides under `ci-results/<project>/`. A dirty checkout or mismatched installed `dist` is deliberately refused; do not disable source verification for a smoke test.

Compare elapsed build/setup/test/merge durations and all result counts from real CI runs before extending this optimization. Four shards do not imply a fourfold wall-clock speedup: setup repeats, runner scheduling and the longest shard remain on the critical path. No changed-path test skipping, cross-SHA evidence reuse, full-stack rebuild deduplication or deploy-gate reduction is included.

## Test fixtures and evidence

CI starts only the compose fixtures in `server/test/compose.e2e.yml` and `compose.r03.yml`, under an owned project per job/run; both teardown steps run with `always()`. PostgreSQL uses `data_explorer_e2e` on loopback15432, Redis DB15 on16379, MongoDB17017 and MySQL13306. MySQL compose enables function creation needed by the native suite. Never migrate a workstation or production URL for these jobs.

For a clean local checkout without `server/.env`, set `E2E_DATABASE_URL=postgresql://e2e:e2e-local-only@127.0.0.1:15432/data_explorer_e2e`, `E2E_REDIS_URL=redis://127.0.0.1:16379/15`, and `DATABASE_URL` to the same dedicated PostgreSQL URL. Start the compose fixtures, run `npm ci` in both packages, server `npm run prisma:generate`, `npx prisma migrate deploy`, `npm run build`, then client `npm run test:full-stack`. The browser fixture invokes the actual built API bootstrap, sanitized fixture-only environment and real login; no API routes are mocked. Keep the existing `test:e2e` suite too. Local uncommitted changes need a byte-verified clean export; checking out HEAD alone omits them.

The server static gate is `npm run typecheck` (`tsc --noEmit --incremental false --project tsconfig.json`) after `npm run prisma:generate`. It includes unit and E2E test sources through the existing full tsconfig; the production Nest build alone excludes specs and does not replace this check. Keep compiler strictness and source inclusion unchanged when repairing fixture types.

Coverage floors preserve all production source: client18.08% lines/11.07% branches, server55.32% lines/46.88% branches at R10 baseline. Coverage provider and reports are project dependencies. Planned targets35/25 and65/55 remain management goals; do not lower a floor or remove source to pass. Lint ignores only generated coverage/browser reports alongside existing build output; test/source rules remain active.

SHA-named CI artifacts contain coverage, backend JSON/logs, fixture logs and failed-browser traces/screenshots/HTML reports. A local pass is not evidence that GitHub ran that SHA. Existing high/critical audit allowlists are unchanged; moderate advisories still appear in the full audit inventory.

## Rollback

Deploy the previous immutable GHCR SHA tag, or redeploy the prior Render commit. Do not roll production schema backward automatically; Prisma migration rollback needs a reviewed, explicit migration.
