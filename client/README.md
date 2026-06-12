# Data Explorer Client

The `client/` workspace is the React 19 + Vite frontend for Data Explorer v3.6.2. It contains the SQL IDE, NoSQL workspace, AI assistant panel, team surfaces, docs pages, dashboards, and the landing experience.

## Main areas

- `src/presentation/modules/Query`: SQL editor, results panel, AI assistant integration, history, and execution actions
- `src/presentation/modules/NoSqlExplorer`: MongoDB-oriented workspace, Tree JSON browsing, schema analysis, visualization, and aggregation builder flows
- `src/presentation/modules/Visualization`: ERD and relational visual workspaces
- `src/presentation/modules/Dashboard`: metrics, charts, and overview surfaces
- `src/presentation/modules/Layout`: shell, navbar, mobile/desktop mode behavior, dialogs, and top-level chrome
- `src/presentation/components/docs`: in-app bilingual documentation system
- `src/core` and `src/infrastructure`: shared state, API wiring, and frontend plumbing

## Local setup

```bash
cd client
npm install
npm run dev
```

If you need to point the UI at a custom backend, create `client/.env` with:

```env
VITE_API_URL=http://localhost:3001/api
```

The default local frontend URL is `http://localhost:5173`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build the production bundle |
| `npm run lint` | Lint the client codebase |
| `npm run test` | Run Vitest |
| `npm run preview` | Preview the built frontend locally |

## Notes

- The root repo script `npm run dev` starts both server and client together, but it still expects `server/node_modules` and `client/node_modules` to be installed first.
- The in-app docs page is the most detailed product guide for end users and operators.
- The backend must expose a reachable `VITE_API_URL`, otherwise login, query execution, AI calls, and live workspace data will fail in the client.

For the broader project overview, combined setup instructions, and env matrix, see `../README.md`.
