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

## Test fixtures and evidence

CI starts only the compose fixtures in `server/test/compose.e2e.yml` and `compose.r03.yml`, under an owned project per job/run; both teardown steps run with `always()`. PostgreSQL uses `data_explorer_e2e` on loopback15432, Redis DB15 on16379, MongoDB17017 and MySQL13306. MySQL compose enables function creation needed by the native suite. Never migrate a workstation or production URL for these jobs.

For a clean local checkout without `server/.env`, set `E2E_DATABASE_URL=postgresql://e2e:e2e-local-only@127.0.0.1:15432/data_explorer_e2e`, `E2E_REDIS_URL=redis://127.0.0.1:16379/15`, and `DATABASE_URL` to the same dedicated PostgreSQL URL. Start the compose fixtures, run `npm ci` in both packages, server `npm run prisma:generate`, `npx prisma migrate deploy`, `npm run build`, then client `npm run test:full-stack`. The browser fixture invokes the actual built API bootstrap, sanitized fixture-only environment and real login; no API routes are mocked. Keep the existing `test:e2e` suite too. Local uncommitted changes need a byte-verified clean export; checking out HEAD alone omits them.

The server static gate is `npm run typecheck` (`tsc --noEmit --incremental false --project tsconfig.json`) after `npm run prisma:generate`. It includes unit and E2E test sources through the existing full tsconfig; the production Nest build alone excludes specs and does not replace this check. Keep compiler strictness and source inclusion unchanged when repairing fixture types.

Coverage floors preserve all production source: client18.08% lines/11.07% branches, server55.32% lines/46.88% branches at R10 baseline. Coverage provider and reports are project dependencies. Planned targets35/25 and65/55 remain management goals; do not lower a floor or remove source to pass. Lint ignores only generated coverage/browser reports alongside existing build output; test/source rules remain active.

SHA-named CI artifacts contain coverage, backend JSON/logs, fixture logs and failed-browser traces/screenshots/HTML reports. A local pass is not evidence that GitHub ran that SHA. Existing high/critical audit allowlists are unchanged; moderate advisories still appear in the full audit inventory.

## Rollback

Deploy the previous immutable GHCR SHA tag, or redeploy the prior Render commit. Do not roll production schema backward automatically; Prisma migration rollback needs a reviewed, explicit migration.
