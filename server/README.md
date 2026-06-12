# Data Explorer Server

The `server/` workspace is the NestJS backend for Data Explorer v3.6.2. It owns authentication, saved connections, query execution, AI routing, team collaboration, notifications, billing hooks, and the Redis-backed runtime flows used by the app.

## What lives here

- `src/ai`: prompt building, provider routing, streaming, autocomplete, structured outputs, and attachment-aware AI execution
- `src/auth`: JWT auth, OAuth callbacks, token exchange, guards, and refresh flows
- `src/database-strategies`: per-engine strategies for PostgreSQL, MySQL, SQL Server, ClickHouse, MongoDB, and related metadata/query behavior
- `src/query`: SQL execution, safeguards, result shaping, and history-oriented APIs
- `src/nosql`: MongoDB workspace APIs, collection operations, schema analysis, and aggregation-oriented endpoints
- `src/redis`, `src/notifications`, `src/presence`, `src/search`: Redis-backed infrastructure for queues, SSE notifications, presence tracking, and fast metadata indexing
- `src/users`, `src/teamspaces`, `src/collaboration`, `src/organizations`: user settings, team workspaces, org-level features, and sharing controls

## Local setup

```bash
cd server
npm install
```

1. Create `server/.env` from `server/.env.example`.
2. Set at least `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, and `FRONTEND_URL`.
3. Sync the metadata schema:

```bash
npx prisma db push
```

4. Start the backend in watch mode:

```bash
npm run start:dev
```

The local API default is `http://localhost:3001/api`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run start:dev` | Start the NestJS server in watch mode |
| `npm run start:prod` | Run the compiled production server |
| `npm run build` | Run Prisma generate safely, then build NestJS |
| `npm run lint` | Lint server TypeScript files |
| `npm run test` | Run Jest unit tests |
| `npm run test:e2e` | Run end-to-end tests |

## Production note

For the current repo state, production builds should use:

```bash
npx prisma db push && npm run build
```

`prisma migrate deploy` is not the recommended path for this codebase right now because the migration history is not yet aligned with a clean PostgreSQL deploy flow in every environment.

## Related files

- `server/.env.example`: backend env template
- `prisma/schema.prisma`: central app metadata schema
- `src/main.ts`: NestJS bootstrap
- `../README.md`: full project overview and combined local setup
