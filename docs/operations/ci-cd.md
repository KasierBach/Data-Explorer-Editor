# Production CI/CD

## What runs

- Pull requests to `main`: client and server install, lint, unit tests, builds, Docker image builds, dependency review, and CodeQL.
- Pushes to `main`: the same verification runs, then publishes immutable SHA-tagged and `main` Docker images to GHCR.
- A successful `main` CI push triggers the Render backend deploy hook. Vercel remains responsible for the existing frontend Git deployment.

## Configure once

1. In GitHub branch rules for `main`, require `Client`, `Server`, `Container images`, `Dependency review`, and `CodeQL` before merging.
2. Create the `production` environment and add its `RENDER_DEPLOY_HOOK_URL` secret from the Render service's deploy hook. The deploy job fails closed until this exists.
3. If GHCR publishing reports a permission error, allow GitHub Actions to write packages for this repository.
4. Keep the Vercel project connected to `main`; the existing Vercel Git integration deploys the frontend after the push.

## Rollback

Deploy the previous immutable GHCR SHA tag, or redeploy the prior Render commit. Do not roll production schema backward automatically; Prisma migration rollback needs a reviewed, explicit migration.