# Data Explorer

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#license)

**Data Explorer** is a high-fidelity, high-performance database management and visualization IDE. It provides a unified, intelligent interface for developers and data engineers to explore, query, and visualize multi-engine databases, all supercharged by a context-aware AI.

---

## Key Features

### AI Assistant and Routing
- **Context-Aware SQL Generation**: Describe complex data needs in natural language and the AI generates SQL based on your live schema and foreign key relationships.
- **Vision Integration**: Upload screenshots of DB diagrams or whiteboards for AI-assisted schema reconstruction and query help.
- **Global Assistant Panel**: A resizable, toggleable sidebar available across major modules with SSE-based streaming responses.
- **Provider-Aware Routing**: Gemini remains the premium lane, while Cerebras and OpenRouter can be configured as lower-cost or fallback lanes.
- **Intelligent Model Fallback**: The AI layer can iterate through providers and models when a requested lane fails, helping keep generation more resilient.
- **Surgical Precision Autocomplete**: Inline AI suggestions prioritize exact SQL syntax completion without unnecessary explanations.
- **Chain Tabbing**: Accept multi-line AI suggestions incrementally with the `Tab` key for fast editing flow.
- **Chat Persistence**: Conversation history is stored in app state for continuity across sessions.

### Multi-Database Strategy
- **Unified Engine Architecture**: Connect to multiple engines through a strategy-based backend:
  - **PostgreSQL** (Neon, Supabase, RDS, Local)
  - **MySQL** (PlanetScale, Local, TiDB)
  - **SQL Server** (Azure SQL, Local MSSQL)
  - **ClickHouse**
  - **MongoDB** and **MongoDB Atlas (SRV)**
  - **Redis** (for caching and session storage)
- **Enterprise-Grade Credential Protection**: Saved connection passwords are encrypted using **AES-256-GCM** before persistence.
- **Connection Safety Controls**: Each saved connection can now be configured as read-only and can independently allow or block query execution, schema changes, and import/export flows.
- **Connection Health Visibility**: Saved connections track their last health-check result, latency, and last successful connection timestamp so operators can spot broken credentials or degraded endpoints faster.
- **Centralized Persistence**: Connections are stored in the app database so they survive client refreshes and redeployments.
- **Real-time Discovery**: Fast schema inspection for tables, columns, views, indexes, and metadata.
- **Cross-DB Browsing**: Jump between databases and schemas in a single workspace.

### Redis Infrastructure
- **Caching Layer**: Redis backs repeated metadata reads and query results so the app stays responsive under load.
- **Notification Bus**: SSE notifications are broadcast through Redis Pub/Sub for progress updates and system messages.
- **Rate Limiting**: Redis keeps API throttling consistent across multiple backend instances.
- **Background Work**: Export, sync, and other long-running tasks can be queued without blocking the UI.
- **Search Indexing**: Global search and metadata lookups use Redis-backed indexing for fast workspace navigation.

### Team Collaboration
- **Team Workspace**: Create teams, invite members, and manage roles from the Team page.
- **Shared Resources**: Teams can share connections, queries, and dashboards.
- **Role-Based Membership**: Invite users as viewers, members, or admins depending on how much control they need.
- **Mobile Entry Point**: Teams can be opened directly from the mobile avatar menu.
- **Activity Visibility**: Shared dashboard activity and team-level usage signals help collaborators see what changed.

### Entity Relationship Diagrams (ERD)
- **Intelligent Auto-Layout**: Dynamic graph generation using React Flow with automatic node positioning.
- **Schema Exploration**: Visualize table structures and relationships in an ERD-style workspace.
- **Visual Intelligence**: Primary and foreign keys are highlighted for fast structural understanding.

### Analytics and Insights
- **Heuristic Dashboard**: Surface connection health, storage distribution, and table usage metrics.
- **Visual Intelligence**: Interactive charts powered by Recharts for operational visibility.
- **Table Distribution**: Heatmaps and row-count style analytics to spot bottlenecks quickly.

### Pro SQL Workspace
- **Monaco Engine**: VS Code-grade editing experience with advanced syntax highlighting and multi-cursor support.
- **Schema-Aware IntelliSense**: Deep autocompletion that understands your tables, columns, and custom types.
- **Smart Safeguards and Optimization**: Automatic limit injection, pagination support, and per-engine query guards help prevent accidental OOM scenarios.
- **Backend-Enforced Guardrails**: Read-only and restricted connections are enforced server-side, so blocked updates, deletes, DDL, and imports cannot be bypassed by skipping the UI.
- **Keyboard Shortcuts**: Use `Ctrl+Enter` to run, `Ctrl+S` to save, and `Ctrl+H` to open history.
- **Execution Analytics**: Query plans and execution timing are surfaced in the workspace.
- **Tabbed Results**: Separate panes for data, messages, and explain output.
- **Export Capabilities**: Export result data as **CSV**, **JSON**, or **SQL** from the grid tooling.

### Premium UI and Responsive Experience
- **Fully Responsive Architecture**: Works across mobile and desktop layouts.
- **Mobile-Adaptive Interface**:
  - Animated menu and drawer patterns
  - Touch-friendly controls
  - Overlay navigation for constrained screens
  - Horizontal tab management for dense workflows
- **High-Density Desktop Mode**: Designed for productivity with compact, information-rich layouts.
- **Modern UI System**: Uses Radix UI, Tailwind, motion, and a componentized feature-driven structure.
- **Standardized API Communication**: Consistent response shapes keep frontend handling predictable.
- **Uptime Monitoring Ready**: Exposes `/api/health` for monitoring and host keep-alive setups.

---

## Tech Stack and Ecosystem

### Frontend (Client-Side)

| Layer | Technologies |
|---|---|
| **Core Framework** | React 19, Vite, TypeScript |
| **State Management** | Zustand, TanStack Query v5 |
| **UI Components** | Radix UI, Shadcn UI, Tailwind CSS |
| **Visualizations** | React Flow, Recharts, Lucide Icons |
| **Editor** | Monaco Editor |
| **Animations** | Framer Motion, CSS Keyframes, Intersection Observer |

### Backend (Server-Side)

| Layer | Technologies |
|---|---|
| **Architecture** | NestJS |
| **ORM / Persistence** | Prisma |
| **AI Engine** | Google Generative AI (Gemini API), SSE Streaming |
| **Engines Support** | `pg`, `mysql2`, `mssql`, `mongodb`, `@clickhouse/client` |
| **Security** | JWT, Passport.js, AES-256-GCM encryption |
| **Infrastructure** | Redis for caching, notifications, rate limiting, search, and background jobs |

---

## Project Architecture and Structure

```bash
Data Explorer/
├── client/                                # React + Vite frontend application
│   └── src/
│       ├── core/                          # Client-side domain layer and shared app logic
│       ├── infrastructure/                # Infra-specific frontend plumbing and bootstrapping
│       ├── lib/                           # Small shared utilities such as class merging helpers
│       ├── presentation/                  # UI layer and feature composition
│       │   ├── components/                # Reusable UI pieces, docs primitives, code editor pieces
│       │   ├── hooks/                     # UI/data hooks such as schema sync and media queries
│       │   ├── modules/                   # Feature-driven application modules
│       │   │   ├── Connection/            # Connection dialog and connection management flows
│       │   │   ├── Dashboard/             # Insights and analytics dashboards
│       │   │   ├── DataGrid/              # Result grid, export, import, and table data tools
│       │   │   ├── Explorer/              # Sidebar tree, navigation, and database explorer UX
│       │   │   ├── LandingPage/           # Marketing/landing page sections
│       │   │   ├── Layout/                # AppShell, navbar, profile dialog, and shell composition
│       │   │   ├── Migration/             # Migration workflow UI and progress surfaces
│       │   │   ├── NoSqlExplorer/         # MongoDB-focused workspace and JSON exploration
│       │   │   ├── Query/                 # SQL editor, AI assistant, history, results, explain plans
│       │   │   └── Visualization/         # ERD and visual exploration workspaces
│       │   └── pages/                     # Route-level entry pages such as login, docs, admin, teams
├── server/                                # NestJS backend API
│   ├── prisma/                            # Prisma schema, migrations/config, and generated setup inputs
│   └── src/
│       ├── ai/                            # Gemini integration, prompts, chat, streaming, autocomplete
│       ├── audit/                         # Audit logging and audit history APIs
│       ├── auth/                          # JWT auth, OAuth, token exchange, guards, roles
│       ├── connections/                   # Saved connection lifecycle and persistence
│       ├── database-strategies/           # Per-engine query/metadata/export strategy implementations
│       ├── migration/                     # Cross-database migration orchestration and progress streaming
│       ├── notifications/                 # SSE notification streaming and Redis pub/sub
│       ├── query/                         # Query execution, DML helpers, and result APIs
│       ├── search/                        # Redis-backed search and metadata indexing
│       ├── users/                         # User profile, settings, roles, billing, onboarding
│       └── utils/                         # Encryption, SQL guards, and backend utility helpers
├── docker-compose.yml                     # Local container orchestration for db + backend + frontend
├── package.json                           # Root dev scripts for running client and server together
├── .env.example                           # Root Docker-friendly example values
├── server/.env.example                    # Backend env template for local/dev/prod setup
└── README.md                              # Project overview and setup guide
```

---

## Comprehensive User Guide

### 1. Connection Management
- **Universal Drivers**: Click the `+` in the Explorer sidebar to add a new connection. The main UI currently exposes **PostgreSQL**, **MySQL**, **SQL Server**, **ClickHouse**, **MongoDB**, and **MongoDB Atlas (SRV)**.
- **Metadata Sync**: After connecting, the app crawls your schema and builds the tree view.
- **Switching Context**: Move between saved connections and databases from the same workspace.

### 2. Pro SQL Workspace
- **Multi-Tab Editing**: Open multiple SQL tabs and execute with **Ctrl/Cmd + Enter**.
- **Smart IntelliSense**: Schema-aware suggestions are available inside the editor.
- **Explain and Analyze**: Use the explain action to inspect query plans directly in the results panel.
- **Saved Queries and History**: Save reusable queries and reopen recent executions quickly.
- **Query Guardrails**: Read-only and restricted connections are enforced at both UI and server levels.

### 3. Team Collaboration
- **Invite and Manage Members**: Create teams, invite members by email, and assign roles.
- **Share Work**: Connections, queries, and dashboards can be shared to a team from the Team page.
- **Track Team Activity**: Team dashboards and activity feeds help you see what the group has been using recently.
- **Open on Mobile**: Teams is available from the avatar menu on mobile, even when the desktop navigation is collapsed.

### 4. Using the AI Assistant
- **Contextual Knowledge**: The assistant is aware of your active connection, schema context, and current workspace state.
- **Vision Features**: Drop in screenshots or reference material for AI-assisted schema and SQL help.
- **Prompt Engineering**: Ask practical questions like:
  - `"Summarize the relationship between orders and customers"`
  - `"Find the top 5 customers with high churn risk based on transaction volume"`

### 5. Interactive Visualizations
- **ERD Exploration**: Open the ERD module to inspect table relationships visually.
- **Insights Dashboard**: Review health signals, charts, and high-level usage indicators.
- **NoSQL Workspace**: MongoDB-oriented flows are available through the NoSQL explorer modules.

### 6. Redis Infrastructure
- **Redis-backed Search**: The backend keeps a fast metadata index in Redis so global search and workspace lookups stay responsive.
- **Notification Streaming**: Long-running operations publish progress through Redis Pub/Sub and SSE.
- **Shared Throttling**: If you run multiple backend instances, Redis keeps rate limits aligned across the cluster.
- **Job Processing**: Export and sync flows rely on Redis-backed queues so the UI stays responsive while work happens in the background.

---

## Installation and Local Development

### Requirements
- **Node.js 20+**
- **npm**
- **PostgreSQL** for the app metadata database
- **Redis** for caching, notifications, search, and background jobs
- **Google Gemini API Key** (optional, only needed for AI features)
- **Docker and Docker Compose** (optional, for the containerized path)

---

## One-Click Docker Deployment (Recommended)

This is the fastest way to run **Data Explorer** locally with PostgreSQL, Redis, the backend API, and an Nginx-served frontend.

1. **Environment Setup**
   - Copy `server/.env.example` to `server/.env`.
   - Fill in at least `JWT_SECRET`, `ENCRYPTION_KEY`, and any optional AI or OAuth variables you want to use.
   - Sync the Prisma schema before first boot:
     ```bash
     npx prisma db push
     ```
   - If you are serving the frontend through Docker on port `80`, set:
     - `FRONTEND_URL=http://localhost`

2. **Launch**
   ```bash
   docker-compose up --build -d
   ```

### Access Points
- **Web Interface**: [http://localhost](http://localhost)
- **Backend API**: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- **Primary Database**: `localhost:5435`
  - user: `postgres`
  - password: `postgres`
  - database: `data_explorer`
- **Redis**: `localhost:6379` (for caching, notifications, and rate limiting)

Note:
- `docker-compose.yml` reads backend env vars from `server/.env`, not from the root `.env.example`.
- The backend container listens on port `3001`.
- The frontend build arg defaults to `VITE_API_URL=http://localhost:3001/api`.
- The Docker stack starts Redis automatically, so no separate Redis install is needed in that path.

---

### Initial Setup
1. **Clone and Install**
   ```bash
   git clone https://github.com/KasierBach/Data-Explorer-Editor.git
   cd Data-Explorer-Editor
   npm install
   ```

2. **Backend Configuration**
   ```bash
   cd server
   npm install
   cp .env.example .env
   npx prisma generate
   npx prisma db push
   npm run start:dev
   ```

   Recommended local values in `server/.env`:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5435/data_explorer
   REDIS_URL=redis://localhost:6379
   FRONTEND_URL=http://localhost:5173
   PORT=3001
   JWT_SECRET=replace-with-a-random-secret-at-least-32-bytes-long
   ENCRYPTION_KEY=replace-with-exactly-32-random-characters
   ```

3. **Frontend Configuration**
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

   Optional `client/.env`:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```

4. **Launch**
   Visit **[http://localhost:5173](http://localhost:5173)** to start exploring.

5. **Run Both from Root**
   ```bash
   npm run dev
   ```

---

## Configuration

### Environment Variables

The backend reads configuration from `server/.env`. The frontend reads `VITE_API_URL` from `client/.env` or from the Docker build arg.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Connection string for the app's central PostgreSQL database. Docker default: `postgresql://postgres:postgres@db:5432/data_explorer`. |
| `REDIS_URL` | No | Redis connection string for caching, notifications, and throttling. Docker default: `redis://redis:6379`. |
| `GEMINI_API_KEY` | No | Google Gemini API key used to enable AI features. |
| `AI_PROVIDER_TIMEOUT_MS` | No | Timeout in milliseconds for AI provider requests. Default: `15000`. |
| `AI_STREAM_IDLE_TIMEOUT_MS` | No | Idle timeout in milliseconds for streaming AI responses. Default: `15000`. |
| `CEREBRAS_API_KEY` | No | Optional lower-cost AI provider key used by AI routing in `Auto` / `Fast` mode. |
| `CEREBRAS_BASE_URL` | No | Base URL for Cerebras' OpenAI-compatible API. Default: `https://api.cerebras.ai/v1`. |
| `CEREBRAS_CHAT_MODEL` | No | Preferred Cerebras chat model for cheaper AI routing. |
| `OPENROUTER_API_KEY` | No | Optional fallback AI provider key used when you want more free/cheap routing options. |
| `OPENROUTER_BASE_URL` | No | Base URL for OpenRouter. Default: `https://openrouter.ai/api/v1`. |
| `OPENROUTER_CHAT_MODEL` | No | OpenRouter model slug to use in `Auto` / `Fast` mode. |
| `JWT_SECRET` | Yes | Strong secret used to sign access tokens. Placeholder values are rejected. |
| `REFRESH_TOKEN_SECRET` | No | Recommended separate secret for refresh-token cookies. If omitted, the app falls back to `JWT_SECRET`. |
| `ENCRYPTION_KEY` | Yes | Exactly **32 characters**, used to encrypt saved database connection passwords. |
| `LEGACY_ENCRYPTION_KEYS` | No | Comma-separated list of older keys used to decrypt connections saved before the hardening update. |
| `PORT` | No | Server port. Local default: `3001`. |
| `FRONTEND_URL` | Yes | Frontend URL used for CORS and OAuth redirects. Use `http://localhost:5173` for Vite local dev, or `http://localhost` when serving the frontend through Docker on port `80`. |
| `ALLOW_INTERNAL_IPS` | No | Recommended default is `false`. Local development still allows `localhost`, `127.0.0.1`, and `::1`. |
| `GOOGLE_CLIENT_ID` | No | Google login client ID. |
| `GOOGLE_CLIENT_SECRET` | No | Google login client secret. |
| `GOOGLE_CALLBACK_URL` | No | Google OAuth callback URL. Local default: `http://localhost:3001/api/auth/google/callback`. |
| `GITHUB_CLIENT_ID` | No | GitHub login client ID. |
| `GITHUB_CLIENT_SECRET` | No | GitHub login client secret. |
| `GITHUB_CALLBACK_URL` | No | GitHub OAuth callback URL. Local default: `http://localhost:3001/api/auth/github/callback`. |
| `MAIL_USER` | No | Email address or sender used for system mail. |
| `MAIL_PASS` | No | App password or provider API key. |
| `VITE_API_URL` | No | Frontend backend API URL. Default: `http://localhost:3001/api`. |

---

## Security and Production Notes

Recent hardening introduced a few important changes:

- **Safer OAuth flow**: Google and GitHub login no longer return bearer tokens in the query string. The frontend now receives `/login#code=...` and exchanges it for a normal token.
- **Stronger secret enforcement**: Weak or placeholder `JWT_SECRET` values prevent the backend from starting.
- **Encrypted connection credentials**: Saved DB connection passwords are encrypted with **AES-256-GCM**, and the backend supports `LEGACY_ENCRYPTION_KEYS` to preserve older saved connections.
- **Localhost still works in development**: The SSRF validator is fail-closed for unsafe hosts, while local development still allows `localhost`, `127.0.0.1`, and `::1`.
- **Reduced XSS exposure**: AI markdown no longer renders raw HTML in the client.
- **Safer session handling**: Refresh tokens now live in `httpOnly` cookies, while access tokens stay in memory and are re-bootstrapped through `/auth/refresh`.
- **AI request guardrails**: Provider calls now use request timeouts and streaming idle timeouts so a slow lane cannot hang the backend indefinitely.

---

## OAuth Flow Notes

If you configure Google or GitHub login, make sure:

- `FRONTEND_URL` matches the frontend origin you are actually using
- callback URLs in your OAuth provider match your local or production backend
- after login, the app redirects in this format:

```text
/login#code=...
```

The frontend then calls the exchange endpoint to convert the short-lived code into a normal access token.

---

## Legacy Connection Compatibility

If older saved DB connections stopped working after changing `ENCRYPTION_KEY`, you can add:

```env
LEGACY_ENCRYPTION_KEYS=12345678901234567890123456789012,abcdefghijklmnopqrstuvwxyz123456
```

Notes:

- Each key must be exactly **32 characters**
- In local development, the system automatically tries the old fallback key to reduce the chance that you need to re-enter passwords
- If an old password was encrypted with a key you no longer have, it cannot be recovered from the stored data

---

## Build, Test, and Troubleshooting

### Build

```bash
cd client
npm run build

cd ../server
npm run build
```

### Test

```bash
cd client
npm test

cd ../server
npm test
```

### Common Issues

- **Google / GitHub login is not working**
  - Check `JWT_SECRET`
  - Check the callback URLs in your OAuth provider
  - Check `FRONTEND_URL`

- **Older saved connections no longer work**
  - Check `ENCRYPTION_KEY`
  - Add `LEGACY_ENCRYPTION_KEYS` if you previously used another key
  - Restart the backend after updating env values

- **Localhost databases do not connect**
  - Local development already allows `localhost`, `127.0.0.1`, and `::1`
  - Only enable `ALLOW_INTERNAL_IPS=true` if you intentionally need broader private-network access

- **Prisma build fails with `EPERM` on Windows**
  - This usually happens because the backend dev server is still locking the Prisma engine file
  - Stop the running backend process and build again

---

## Contributing and Support

- **Bug Reports**: Open an issue on the [GitHub Repo](https://github.com/KasierBach/Data-Explorer-Editor/issues).
- **Custom Adapters**: New database engine support can be added via the `database-strategies` module.

## License

This project is licensed under the **MIT License**.
