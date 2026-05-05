# Data Explorer Prioritized Backlog

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this backlog item-by-item. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise Data Explorer from a strong all-in-one database workspace into a more reliable, faster, and more competitive product by closing the biggest gaps in freshness, collaboration depth, and power-user ergonomics.

**Architecture:** Keep the current monorepo split intact and improve the system along three axes: data freshness, collaboration/workspace depth, and performance/UX polish. Favor small focused changes inside the existing `server/src/*` services and `client/src/presentation/*` feature modules rather than introducing a new platform layer. Where possible, reuse the current organization/resource/permission model instead of adding parallel concepts.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis, React 19, Vite, Zustand, TanStack Query, Radix UI, Tailwind CSS, Monaco Editor, SSE, Jest, Vitest.

---

## Priority Map

### P0: Must fix first
- Query cache invalidation and stale data freshness
- Search index auto-sync and metadata freshness
- Remove brittle UI timing/workaround code that risks race conditions

### P1: High leverage
- Version history and restore for saved workspace artifacts
- Query/project organization model that feels closer to a real IDE
- Presence / follow mode for collaboration
- Better explain-plan and data profiling surfaces

### P2: Competitive polish
- Backup / restore workflows
- Schema diff and migration review surfaces
- Bundle size reduction and code splitting cleanup
- Better mobile discoverability and surface-level ergonomics

## Task 1: Make data freshness reliable

**Files:**
- Modify: `server/src/query/query.service.ts`
- Modify: `server/src/search/search.service.ts`
- Modify: `server/src/metadata/metadata.service.ts`
- Modify: `server/src/connections/connections.service.ts`
- Modify: `client/src/presentation/modules/Explorer/ExplorerSidebar.tsx`
- Modify: `client/src/presentation/hooks/useSyncConnections.ts`
- Modify: `client/src/presentation/hooks/useSyncSavedQueries.ts`
- Create: `server/src/query/query.service.spec.ts`

- [ ] **Step 1: Add regression tests that prove stale state is visible today**

Cover these cases:
- a write operation updates a table but the next read can still return cached data
- a schema or connection change does not automatically refresh the global search index
- a metadata refresh still depends on a manual action in the explorer

Run:

```powershell
cd server
npx jest src/query/query.service.spec.ts --runInBand
```

Expected: at least one test exposes the current stale-data behavior.

- [ ] **Step 2: Implement targeted cache invalidation**

Update query write paths so that successful `insert`, `update`, `delete`, `schema`, `seed`, `create database`, `drop database`, and `import` actions invalidate the relevant query cache keys instead of relying only on TTL expiry.

Use the current cache abstraction, but make invalidation explicit after a write succeeds.

- [ ] **Step 3: Auto-sync the search index after connection and metadata changes**

Move index updates closer to the actual change points:
- connection create/update/delete
- metadata refresh
- schema-affecting query actions

Keep the manual sync button as a fallback, but the default path should stay current without user intervention.

- [ ] **Step 4: Remove brittle UI refresh timing**

Replace the manual timing workaround patterns in the explorer and shell flows with explicit state transitions and returned promises where possible.

Pay special attention to:
- `client/src/presentation/modules/Layout/AppShell.tsx`
- `client/src/presentation/modules/Explorer/ExplorerSidebar.tsx`
- `client/src/presentation/pages/DocumentationPage.tsx`

- [ ] **Step 5: Verify the backend and client builds**

Run:

```powershell
cd server
npm run build

cd ../client
npm run build
```

Expected: both builds succeed and the freshness changes do not introduce new runtime assumptions.

## Task 2: Add real version history for saved work

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/saved-queries/saved-queries.service.ts`
- Modify: `server/src/erd-workspaces/erd-workspaces.service.ts`
- Modify: `server/src/dashboards/dashboards.service.ts`
- Create: `server/src/version-history/version-history.module.ts`
- Create: `server/src/version-history/version-history.service.ts`
- Create: `server/src/version-history/version-history.controller.ts`
- Create: `server/src/version-history/dto/*`
- Modify: `client/src/presentation/modules/Query/QueryHistoryDialog.tsx`
- Modify: `client/src/presentation/modules/Query/SavedQueriesDialog.tsx`
- Modify: `client/src/presentation/modules/Visualization/ERDWorkspace/*`
- Modify: `client/src/presentation/modules/Dashboard/*`

- [ ] **Step 1: Define the versioned artifact model**

Add a common version record that can store:
- resource type
- resource id
- version number
- author
- snapshot payload
- created timestamp

Scope the first version to saved queries and ERD workspaces, because those are the safest high-value targets.

- [ ] **Step 2: Make version writes happen automatically**

Create a new snapshot whenever a saved query or ERD workspace is saved, updated, duplicated, or imported.

Keep the restore path explicit and user-confirmed.

- [ ] **Step 3: Expose version browsing and restore endpoints**

Add endpoints to:
- list versions for a resource
- fetch a version snapshot
- restore a previous version

Do not add branching yet. The first pass is linear history only.

- [ ] **Step 4: Surface the history UI**

Expose a version timeline in the query and ERD UIs so users can:
- see who changed what
- compare current vs previous state
- restore a snapshot with confirmation

- [ ] **Step 5: Verify with targeted tests**

Run the relevant service tests and the client build.

Expected outcome:
- history appears where users already work
- restore is reversible only through a new save
- no new permission bypass is introduced

## Task 3: Make collaboration feel live

**Files:**
- Modify: `server/src/notifications/notifications.service.ts`
- Modify: `server/src/notifications/notifications.controller.ts`
- Modify: `server/src/collaboration/collaboration.service.ts`
- Modify: `server/src/teamspaces/teamspaces.service.ts`
- Modify: `client/src/presentation/hooks/useNotifications.ts`
- Modify: `client/src/presentation/pages/TeamPage.tsx`
- Modify: `client/src/presentation/modules/Layout/AppShell.tsx`
- Create: `server/src/presence/*`
- Create: `client/src/presentation/components/presence/*`

- [ ] **Step 1: Add tests for notification delivery and collaboration events**

Cover:
- comment notifications
- resolve notifications
- team activity visibility
- stream authorization

Run:

```powershell
cd server
npx jest src/notifications src/collaboration --runInBand
```

Expected: current event delivery remains stable.

- [ ] **Step 2: Add a lightweight presence model**

Implement presence as a small, per-resource state channel:
- online users
- active resource
- last seen timestamp
- optional follower mode

Do not start with live multi-cursor editing. Presence first, editing later.

- [ ] **Step 3: Render presence in the UI**

Show who is currently active on:
- teamspaces
- query workspaces
- ERD workspaces

Keep it compact so it does not crowd out the editor or data grid.

- [ ] **Step 4: Verify the notifications path in the browser**

Confirm that a comment or activity event appears in the UI without a page reload.

## Task 4: Deepen the IDE workflow

**Files:**
- Modify: `client/src/presentation/modules/Query/QueryEditor.tsx`
- Modify: `client/src/presentation/modules/Query/ResultTable.tsx`
- Modify: `client/src/presentation/modules/Query/QueryPlanVisualizer.tsx`
- Modify: `client/src/presentation/modules/DataGrid/DataGrid.tsx`
- Modify: `client/src/presentation/modules/DataGrid/useDataGridData.ts`
- Modify: `client/src/presentation/modules/DataGrid/useDataGridEditing.ts`
- Modify: `client/src/presentation/components/code-editor/SqlEditor.tsx`
- Modify: `client/src/presentation/components/code-editor/sqlAutocomplete.ts`
- Create: `client/src/presentation/modules/Query/QueryProjectPanel.tsx`

- [ ] **Step 1: Add tests around query workflow behavior**

Cover:
- query tabs keep their schema/database context
- results and explain output stay tied to the executed query
- destructive query confirmation still works

- [ ] **Step 2: Introduce a project-like organization layer for queries**

Let users group saved queries into lightweight collections or folders.

Avoid building a full filesystem. Start with:
- groups
- tags
- pinned queries
- recent queries

- [ ] **Step 3: Improve explain-plan visibility**

Make query plans easier to read by surfacing:
- row estimates
- index hints
- scan types
- obvious regressions or costly steps

Use the current visualizer rather than adding a second plan viewer.

- [ ] **Step 4: Tighten autocomplete and editor interactions**

Focus on:
- less accidental insertion
- better acceptance behavior
- clearer context around schema/database
- reduced friction for multi-line edits

## Task 5: Close the power-user gap against classic DB tools

**Files:**
- Modify: `server/src/database-strategies/*.ts`
- Modify: `server/src/migration/migration.service.ts`
- Modify: `server/src/query/query.service.ts`
- Create: `server/src/schema-diff/*`
- Modify: `client/src/presentation/modules/Visualization/ERDWorkspace/*`
- Modify: `client/src/presentation/modules/Dashboard/*`

- [ ] **Step 1: Add schema diff coverage**

Compare current vs saved schema snapshots and expose:
- added objects
- removed objects
- changed columns
- changed constraints

- [ ] **Step 2: Add safer backup and restore flows**

Start with export/restore for the app-managed metadata and saved artifacts before attempting full database backup orchestration.

- [ ] **Step 3: Add migration review surfaces**

Before applying cross-database changes, show:
- source
- target
- estimated impact
- rollback caveats

- [ ] **Step 4: Verify no destructive shortcut bypasses the current guardrails**

Keep the current read-only and destructive-query protections intact while adding deeper tooling.

## Task 6: Reduce bundle cost and stabilize the client

**Files:**
- Modify: `client/vite.config.ts`
- Modify: `client/src/App.tsx`
- Modify: `client/src/presentation/pages/DocumentationPage.tsx`
- Modify: `client/src/presentation/modules/Layout/AppShell.tsx`
- Modify: `client/src/presentation/modules/Visualization/ERDWorkspace/*`
- Modify: `client/src/presentation/modules/LandingPage/*`

- [ ] **Step 1: Identify the biggest chunks**

Use the current build output to confirm the heaviest vendor bundles and the modules pulling them in.

- [ ] **Step 2: Split by usage**

Move rarely used views behind cleaner dynamic imports:
- docs
- ERD
- visualize
- admin
- team page

- [ ] **Step 3: Remove side-effect-heavy render patterns**

Replace `useMemo` side effects and `setTimeout`-based coordination with explicit effects and promise-driven updates.

- [ ] **Step 4: Verify the app still feels fast enough on mobile**

Check initial navigation, sidebar open/close, and editor entry on narrow screens.

## Coverage Check

This backlog covers the audit findings as follows:

- stale query data and cache freshness -> Task 1
- search index freshness -> Task 1
- brittle timing/workaround code -> Task 1 and Task 6
- version history / restore -> Task 2
- presence / follow mode -> Task 3
- query/project organization -> Task 4
- explain-plan depth -> Task 4
- backup / restore / schema diff -> Task 5
- bundle size and client stability -> Task 6

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6

## Notes

- Do not add a second membership system.
- Do not add live multi-cursor editing before presence exists.
- Do not broaden the scope to a full platform rewrite.
- Prefer focused services and focused components over large cross-cutting refactors.
