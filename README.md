# Data Explorer

[![CI](https://github.com/KasierBach/Data-Explorer-Editor/actions/workflows/ci.yml/badge.svg)](https://github.com/KasierBach/Data-Explorer-Editor/actions/workflows/ci.yml)
[![CodeQL](https://github.com/KasierBach/Data-Explorer-Editor/actions/workflows/codeql.yml/badge.svg)](https://github.com/KasierBach/Data-Explorer-Editor/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.6.7-blue.svg)](package.json)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0055FF?logo=framer&logoColor=white)](https://motion.dev/)

[![Node.js](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-Infrastructure-DC382D?logo=redis&logoColor=white)](https://redis.io/)

[![Docker](https://img.shields.io/badge/Docker-Containers-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33)](https://playwright.dev/)

A web-based SQL and NoSQL workspace for exploring schemas, running queries, visualizing results, and collaborating with optional AI assistance.

**[Live demo](https://data-explorer-editor.vercel.app/) · [User guide](https://data-explorer-editor.vercel.app/docs) · [Documentation](docs/README.md) · [Report a bug](https://github.com/KasierBach/Data-Explorer-Editor/issues)**

## Highlights

- **SQL workspace:** Monaco editor, multiple tabs, saved queries, history, query cancellation, execution plans, and ordered SQL steps.
- **Database exploration:** schema navigation, server-side pagination, result export, and connection health checks.
- **NoSQL tools:** MongoDB JSON/tree and grid views, aggregation building, schema analysis, and bounded Redis browsing.
- **Visualizations:** entity-relationship diagrams and charts built from query results.
- **Team collaboration:** teamspaces, shared resources, resource permissions, comments, mentions, and activity notifications.
- **Optional AI:** SQL generation, explanations, autocomplete, and attachment-aware assistance with configurable models and OpenAI-compatible providers.
- **Workspace preferences:** English/Vietnamese, light/dark themes, mobile navigation, and persistent editor drafts.

## Quick Start

Choose **Docker** for a local containerized setup or **development mode** to work on the source.

The application uses its own PostgreSQL database for accounts and workspace metadata, plus Redis for infrastructure. These are separate from the databases you connect to and browse.

### Prerequisites

- Git and either Docker with Compose, or Node.js 22 and npm.
- Development mode also needs PostgreSQL and Redis; the supplied Compose stack provides PostgreSQL 15 and Redis 7.
- AI, OAuth, mail, and billing integrations require separate provider configuration. **AI keys are not required for the core database workspace.**

Clone the repository:

```bash
git clone https://github.com/KasierBach/Data-Explorer-Editor.git
cd Data-Explorer-Editor
```

### Option A: Run locally with Docker

1. Create the backend configuration from the template:

   ```bash
   cp server/.env.example server/.env
   ```

   Replace `JWT_SECRET` and `ENCRYPTION_KEY` with real random values; a separate `REFRESH_TOKEN_SECRET` is recommended. Clear unused sample AI/OAuth/mail credentials. Do not overwrite an existing configuration.

2. Set `POSTGRES_PASSWORD` in a root `.env` file if you want to override the **local-only** default, `change-me-local`. Use a URL-safe password with this Compose configuration. The root `.env` controls Compose interpolation; backend settings come from `server/.env`.

3. Start the stack:

   ```bash
   docker compose up --build -d
   ```

   The `migrate` service applies committed Prisma migrations before the backend starts. Compose supplies the container database, Redis, and local frontend URLs automatically.

| Service | Local address |
| --- | --- |
| Web application | <http://localhost> |
| API readiness | <http://localhost:3001/api/health/ready> |
| Application PostgreSQL | `127.0.0.1:5435`, database `data_explorer`, user `postgres` |
| Redis | `127.0.0.1:6379` |

Published ports bind to loopback by default. This is a **local development setup**, not an Internet-facing production configuration. PostgreSQL and Redis use persistent Docker volumes; changing `POSTGRES_PASSWORD` does not change the password already initialized in an existing database volume.

### Option B: Run in development mode

Install all three packages; the root package does not install the client and server dependencies:

```bash
npm ci
npm ci --prefix server
npm ci --prefix client
cp server/.env.example server/.env
```

If using the supplied local database containers:

```bash
docker compose up -d db redis
```

Edit `server/.env`. For fresh containers using the default local password:

```env
DATABASE_URL=postgresql://postgres:change-me-local@127.0.0.1:5435/data_explorer
REDIS_URL=redis://127.0.0.1:6379
FRONTEND_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:3001/api
PORT=3001
```

If you changed `POSTGRES_PASSWORD`, make `DATABASE_URL` match it. Supply the required security values below and clear unused sample provider credentials before starting the API.

Create `client/.env` for local development:

```env
VITE_API_URL=http://localhost:3001/api
```

The committed client template is aimed at a hosted backend; do not copy it unchanged for local development.

Generate Prisma, apply migrations to the configured **application database**, and launch:

```bash
npm run prisma:generate --prefix server
cd server
npx prisma migrate deploy
cd ..
npm run dev
```

Open <http://localhost:5173>. You can also use `npm run server` and `npm run client` from the root to start them separately.

Commands above use a POSIX-style shell such as Git Bash. In PowerShell, use `Copy-Item server/.env.example server/.env` instead of `cp`.

## Database Capabilities

An engine adapter does not imply identical query, schema, or editing capabilities across every database.

| Engine | Query and browsing interface | Structured grid update/delete |
| --- | --- | --- |
| PostgreSQL / CockroachDB | SQL, schema exploration, result grids | Supported for compatible primary-key identities |
| MySQL / MariaDB | SQL, schema exploration, result grids | Supported for compatible primary-key identities |
| SQL Server | SQL, schema exploration, result grids | Supported for compatible primary-key identities |
| SQLite | SQL and server-side file connections | Supported for compatible primary-key identities; `main` only |
| ClickHouse | SQL, metadata, result grids | Not supported |
| MongoDB / MongoDB Atlas | JSON commands, collections, aggregation tools | Not supported |
| Redis | Bounded read-only commands and key browsing | Not supported |

Connection permissions can disable execution, schema changes, or import/export independently. Updates and deletes require safe row identity; primary-key columns are not editable. Insertion follows a separate engine-specific path.

### Important limits

- Raw SQL results have a protective **50,000-row hard ceiling**. Table browsing uses bounded pagination, with a maximum requested page size of **1,000**.
- Redis browsing uses strict item, byte, and scan-work limits. Its bounded read path requires Redis 7+ and permission to run the internal read-only scripts; a restricted Redis ACL can reject these operations.
- AI generation is separate from query execution. Review generated SQL/commands before running them; high-impact operations can require confirmation.
- Organization JSON export covers workspace artifacts and sharing metadata, **not connected-database dumps or a full server backup**. It is not a transactionally consistent snapshot; pause concurrent artifact edits when consistency matters.
- Data transfers are engine-dependent and may partially commit. Do not assume automatic resume, whole-transfer rollback, or safe retry after an unknown outcome.

## Configuration Essentials

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Application PostgreSQL connection; keep separate from databases being browsed |
| `REDIS_URL` | Application Redis connection |
| `JWT_SECRET` | Random access-token signing secret, at least **32 bytes** |
| `REFRESH_TOKEN_SECRET` | Recommended independent refresh-token signing secret |
| `ENCRYPTION_KEY` | Exactly **32 UTF-8 bytes** for saved connection-password encryption |
| `FRONTEND_URL` | Allowed frontend origin for CORS and redirects |
| `API_PUBLIC_URL` | Public backend URL used by integrations; Render can derive it from its platform URL |
| `VITE_API_URL` | Client's backend API URL; set at development/build time |

Use randomly generated secrets, not the placeholders in the examples. A 64-character hexadecimal string is **not** a 32-byte encryption key in this configuration. Never put secrets in `VITE_*` variables: those values can be included in the browser bundle.

See [backend environment examples](server/.env.example) and [frontend deployment examples](client/.env.example) for optional AI, OAuth, mail, and integration settings. Keep `.env` files out of Git. Leave `ALLOW_INSECURE_DATABASE_TLS=false` in production; only permit private-network access deliberately.

## Development and Testing

Run the package-level checks from the repository root after installing dependencies and generating Prisma:

```bash
npm run lint --prefix client
npm run test:ci --prefix client
npm run build --prefix client

npm run typecheck --prefix server
npm run lint --prefix server
npm run test:ci --prefix server
npm run build --prefix server
```

Coverage commands are `npm run test:cov --prefix client` and `npm run test:cov --prefix server`.

Browser tests require installed Playwright browsers:

```bash
cd client
npx playwright install chromium firefox webkit
npm run typecheck:browser
npm run test:e2e -- --workers=1 --retries=0
```

The browser E2E suite uses mock API fixtures. Server integration and browser-to-real-backend suites require isolated Docker fixtures and a checkout without workstation secrets; see [CI configuration](.github/workflows/ci.yml) for the maintained setup. Do not substitute production connection strings or run migrations/reset commands against a live database to prepare tests.

CI checks include lint, types, unit/coverage tests, native integration tests, browser tests, full-stack flows, dependency audits, container scans, and SBOM generation. These checks do not certify every engine, deployment topology, or external provider.

### Project structure

```text
client/       React application, browser tests, and build tooling
server/       NestJS API, engine adapters, Prisma migrations, and integration tests
docs/         Maintained public guides
.github/      CI, deployment workflows, and repository automation
```

## Tech Stack and Ecosystem

### Frontend (Client-Side)

| Layer | Technologies | Role |
| --- | --- | --- |
| **Core framework** | React 19, Vite 7, TypeScript | Application UI, development server, and production builds |
| **Routing** | React Router 7 | Public pages and authenticated SQL/NoSQL workspaces |
| **State management** | Zustand, TanStack Query v5 | Workspace preferences, persisted drafts, server-state fetching, and cache lifecycle |
| **UI components** | Radix UI, shadcn-style components, Tailwind CSS 4, Lucide Icons | Dialogs, menus, forms, themes, and workspace controls |
| **SQL editor** | Monaco Editor, `@monaco-editor/react`, `sql-formatter` | Editing, schema-aware suggestions, and SQL formatting |
| **Result grids** | TanStack Table, TanStack Virtual | Table rendering, row interactions, and virtualized results |
| **Diagrams and charts** | React Flow, Dagre, Recharts | ERD layout and result-driven visualizations |
| **Motion and layout** | Framer Motion, CSS transitions, React Resizable Panels | Animations and adjustable workspace panels |
| **Content and files** | React Markdown, SheetJS (`xlsx`), PDF.js | Markdown presentation and spreadsheet/PDF tooling |

### Backend (Server-Side)

| Layer | Technologies | Role |
| --- | --- | --- |
| **API framework** | NestJS 11, Express, TypeScript | Feature modules, controllers, dependency injection, and HTTP endpoints |
| **Application persistence** | PostgreSQL, Prisma 6.19.3, `@prisma/adapter-pg` | Accounts, connections, saved queries, and collaboration metadata |
| **SQL drivers** | `pg`, `mysql2`, `mssql`, `better-sqlite3`, `@clickhouse/client` | PostgreSQL/CockroachDB, MySQL/MariaDB, SQL Server, SQLite, and ClickHouse adapters |
| **NoSQL drivers** | MongoDB Node.js driver, `ioredis` | MongoDB/Atlas connections and bounded Redis operations |
| **Caching and coordination** | Redis, Keyv/cache-manager, Pub/Sub | Metadata/count caching, freshness, notifications, presence, and search infrastructure |
| **Background jobs** | BullMQ | Queued processing and job lifecycle management |
| **Authentication and security** | JWT, Passport.js, bcryptjs, AES-256-GCM, Helmet | Session authentication, password hashing, credential encryption, and HTTP hardening |
| **Validation and logging** | class-validator, class-transformer, Pino | Request validation, DTO transformation, and structured logs |
| **AI integrations** | Google Gen AI SDK, OpenAI-compatible provider APIs, SSE | Configurable generation, explanations, and streamed responses |

### Testing and Delivery

| Area | Tools | Scope |
| --- | --- | --- |
| **Unit and component tests** | Vitest, Testing Library, Jest | Client components/services and backend unit tests |
| **Browser and accessibility tests** | Playwright, Axe | Browser interactions, responsive layouts, and automated accessibility checks |
| **Native integration fixtures** | Docker Compose, PostgreSQL, Redis, MongoDB, MySQL | Isolated API and full-stack verification with synthetic data |
| **Code quality** | TypeScript, ESLint, Prettier | Type checking, linting, and formatting |
| **CI and supply-chain checks** | GitHub Actions, CodeQL, npm audit, Trivy, SBOM generation | Automated verification and dependency/container analysis |
| **Local containers** | Docker Compose, Nginx | Local services and a container-served frontend |
| **Production delivery** | Render, Vercel, GitHub Actions | CI-gated backend and frontend deployment |

Driver availability does not imply identical engine capabilities. External AI providers and production hosts require their own configuration and credentials.

## Deployment

[CI/CD operations](docs/operations/ci-cd.md) covers the Render backend and Vercel frontend setup.

A successful CI run from a push to `main` triggers the configured delivery workflows for the tested commit. Deployment requires the corresponding Render/Vercel secrets and any configured production-environment approvals. Backend delivery verifies `/api/health/ready` and the deployed commit; `/api/health/live` is process liveness only.

**Back up the application database before migrations.** Plan compatibility or a maintenance window for upgrades. Rolling back an application release does not automatically roll back database changes.

## Security and Data Handling

- Saved connection passwords are encrypted using AES-256-GCM; this does not mean all application data is encrypted.
- Authorization and connection policies are enforced on the backend. Prefer least-privilege database accounts, especially when connecting to production data.
- Refresh tokens use HTTP-only cookies; access tokens are held in memory and restored through the session flow.
- Default AI context uses schema metadata. Prompts, selected context, and uploaded files may contain sensitive information and are sent to the configured external provider; review what you submit.
- Redis count/metadata caching uses freshness invalidation. Do not assume every raw-query result is cached.
- Never commit real credentials, customer data, database exports, or internal security reports. Remove sensitive content from issue screenshots and logs.

## Troubleshooting

### The API does not start or cannot connect to PostgreSQL

- Check `DATABASE_URL` in `server/.env` and confirm PostgreSQL is running.
- If using Compose's database from a host-run API, use `127.0.0.1:5435`, not the container hostname `db`.
- The Compose default password is `change-me-local`. Match any `POSTGRES_PASSWORD` override in your connection URL; an existing database volume retains its original password.
- Check migration errors before retrying startup. Do not delete a database volume to work around a credentials or migration problem.

### Docker services stay unhealthy

From the repository root, inspect service status and recent logs:

```bash
docker compose ps -a
docker compose logs --tail=100 db redis migrate backend
```

The backend waits for PostgreSQL, Redis, and the `migrate` service. Fix the first failing dependency rather than repeatedly restarting the whole stack. Remove credentials and private data before sharing logs.

### The frontend cannot reach the API

- Set `VITE_API_URL=http://localhost:3001/api` for local development. The committed client template points to a hosted backend.
- Set `FRONTEND_URL` to the actual browser origin: `http://localhost:5173` for Vite or `http://localhost` for the supplied Docker frontend.
- Restart Vite after changing `client/.env`; rebuild/redeploy production bundles after changing `VITE_API_URL`.
- Confirm the API responds at `/api/health/ready`. A browser CORS error can also mean the API is unavailable or the configured origins do not match.

### Redis-dependent features fail

- Verify `REDIS_URL` and the Redis service. A host-run API uses `127.0.0.1:6379`; Compose supplies `redis://redis:6379` inside containers.
- Redis database browsing requires Redis 7+ and ACL permission for the internal read-only scripts. If a command is rejected, check the returned capability/ACL error rather than enabling arbitrary scripting.
- Oversized collections or scan work can be rejected by the browsing safety limits. Use a smaller supported scope; do not assume a rejected export is complete.

### Production startup rejects a secret

- Replace sample values with real randomly generated secrets. `JWT_SECRET` must be at least 32 bytes; `ENCRYPTION_KEY` must be exactly 32 UTF-8 bytes.
- Check for accidental whitespace, Unicode byte-length differences, or a 64-character hex string being used as the encryption key.
- Keep the encryption key stable across deployments. Do not rotate it casually to fix an unrelated startup error.

### Saved connections stop working after a key change

- Restore the previous `ENCRYPTION_KEY` if the change was accidental, or configure retained keys through `LEGACY_ENCRYPTION_KEYS` when performing a deliberate rotation.
- Each legacy key must meet the 32-byte requirement. Keep old keys in secret storage, never in the README, logs, or a public issue.
- Without the original encryption key, stored encrypted passwords cannot be recovered; re-enter the connection credentials instead.

### Prisma generation fails with `EPERM` on Windows

- A running backend can hold a Prisma file open. Stop the relevant local development process, then retry generation or the server build.
- `npm run build --prefix server` uses the maintained generation wrapper, which checks whether the existing client matches the schema.
- Do not suppress generation errors, delete database data, or run `prisma migrate reset` to fix a file-lock issue.

### Google/GitHub login or AI features do not work

- OAuth requires provider credentials and callback URLs that match the running backend. Check `FRONTEND_URL`, the corresponding callback variable, and the provider's registered callback.
- AI features require a configured provider key/endpoint and an available model. Check role-specific model selection, provider access, and timeout/error feedback.
- Do not put provider secrets in `VITE_*` variables or paste them into issue reports. Database browsing does not require AI configuration.

### An upgrade reports a migration conflict

Back up the application database and compare its migration history with the release before making changes. For an existing database, baseline/repair decisions require schema inspection; do not blindly mark migrations as applied or reset a live database. See the [deployment guide](docs/operations/ci-cd.md) for the release flow.

## Support and Contributing

[Open an issue](https://github.com/KasierBach/Data-Explorer-Editor/issues) with the affected version, reproduction steps, and sanitized logs. Contributions should stay focused, include relevant tests, and pass the package-level checks.

Do not post credentials or sensitive vulnerability details in public issues. Use GitHub private vulnerability reporting if it is enabled for the repository.

## License

Data Explorer is available under the [MIT License](LICENSE).
