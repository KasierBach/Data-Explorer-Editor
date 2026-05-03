# Teamspace, Share, and Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight teamspaces under organizations, let shared resources be assigned to them, and expose a clearer share and permissions UI without introducing a second membership model.

**Architecture:** Keep `Organization` as the only membership boundary. Introduce `Teamspace` as a small organizational container and attach it to `OrganizationResource` so resource grouping stays close to existing permission data. Reuse the current role/resource policy model and extend the Team page and share dialogs with a calmer, more discoverable workspace hierarchy instead of adding more admin chrome.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, React Query, Zustand, Radix UI, Tailwind CSS, Sonner, Vitest/Jest.

---

## UX Direction

**Visual thesis:** a calm workspace hierarchy with strong typography, very little chrome, and no generic dashboard-card grid. Teamspaces should read like organizational sections, not like a separate product.

**Content plan:** left rail for teams/teamspaces, main area for resources grouped by teamspace, compact share dialog for one resource at a time, clear permission presets, and a visible unassigned bucket for anything not yet organized.

**Interaction thesis:** one small motion for dialog entrance, one subtle reveal for expanding teamspace resource groups, and one simple affordance shift for the share dialog when a teamspace is selected. Keep it fast on mobile and avoid ornamental motion.

## Task 1: Add the Teamspace data model and migration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260503190000_add_teamspaces/migration.sql`

- [ ] **Step 1: Add the failing schema change**

Add a `Teamspace` model with `id`, `organizationId`, `name`, `slug`, `description`, `createdBy`, `createdAt`, and `updatedAt`. Extend `OrganizationResource` with optional `teamspaceId`. Keep the relation optional so unassigned resources still work.

- [ ] **Step 2: Apply the migration locally**

Run:

```powershell
cd server
npx prisma migrate dev --name add_teamspaces
```

Expected: Prisma creates the new migration folder and updates the generated client schema.

- [ ] **Step 3: Verify the schema is coherent**

Run:

```powershell
cd server
npx prisma generate
```

Expected: Prisma Client regenerates cleanly and the new `teamspaceId` relation is available in generated types.

- [ ] **Step 4: Commit the schema-only change**

Run:

```powershell
git add server/prisma/schema.prisma server/prisma/migrations/20260503190000_add_teamspaces/migration.sql
git commit -m "feat: add teamspace data model"
```

## Task 2: Build the backend teamspace API and resource assignment flow

**Files:**
- Create: `server/src/teamspaces/teamspaces.module.ts`
- Create: `server/src/teamspaces/teamspaces.controller.ts`
- Create: `server/src/teamspaces/teamspaces.service.ts`
- Create: `server/src/teamspaces/dto/create-teamspace.dto.ts`
- Create: `server/src/teamspaces/dto/update-teamspace.dto.ts`
- Create: `server/src/teamspaces/dto/assign-resource-teamspace.dto.ts`
- Modify: `server/src/app.module.ts`
- Modify: `server/src/organizations/organizations.module.ts`
- Modify: `server/src/organizations/repositories/organizations.repository.ts`
- Modify: `server/src/permissions/services/permissions.service.ts`
- Modify: `server/src/permissions/types/resource-permission-policy.ts` if the share presets need a small helper
- Modify: `server/src/organizations/services/organizations.service.ts` only if the Team page needs summary counts
- Create: `server/src/teamspaces/teamspaces.service.spec.ts`

- [ ] **Step 1: Write failing backend tests first**

Create tests that prove:
- an organization owner can create a teamspace
- a non-member cannot list or mutate teamspaces
- assigning a resource to a teamspace updates `organizationResource.teamspaceId`
- deleting a teamspace clears `teamspaceId` on its resources instead of deleting them

Run:

```powershell
cd server
npx jest src/teamspaces/teamspaces.service.spec.ts --runInBand
```

Expected: tests fail because the module and service do not exist yet.

- [ ] **Step 2: Implement the minimal Teamspace service**

Add a focused service that owns:
- create
- list
- rename
- delete
- assign resource to teamspace
- unassign resource from teamspace

Keep permission checks thin by reusing the existing organization membership and permission helpers rather than inventing new policy logic.

- [ ] **Step 3: Wire the controller and module**

Expose endpoints for:
- `GET /organizations/:organizationId/teamspaces`
- `POST /organizations/:organizationId/teamspaces`
- `PATCH /organizations/:organizationId/teamspaces/:teamspaceId`
- `DELETE /organizations/:organizationId/teamspaces/:teamspaceId`
- `PATCH /organizations/:organizationId/resources/:resourceType/:resourceId/teamspace`

Register the module in `AppModule` and import it wherever the organization and permission modules need access.

- [ ] **Step 4: Verify the backend build**

Run:

```powershell
cd server
npm run build
```

Expected: Nest builds cleanly and Prisma types reflect the new schema.

- [ ] **Step 5: Commit the backend layer**

Run:

```powershell
git add server/src/teamspaces server/src/app.module.ts server/src/organizations server/src/permissions server/prisma
git commit -m "feat: add teamspace backend api"
```

## Task 3: Update the Team page and share UX to make teamspaces visible

**Files:**
- Modify: `client/src/presentation/pages/TeamPage.tsx`
- Modify: `client/src/core/services/OrganizationService.ts`
- Modify: `client/src/presentation/modules/Connection/ShareConnectionDialog.tsx`
- Modify: `client/src/presentation/modules/Dashboard/SaveToDashboardDialog.tsx` if dashboard sharing needs the same flow
- Modify: `client/src/presentation/modules/Visualization/ERDWorkspace/components/SaveERDWorkspaceDialog.tsx` if ERD save/share needs the same flow
- Create: `client/src/core/services/TeamspaceService.ts` only if keeping teamspace APIs separate from organization APIs improves readability
- Create: `client/src/presentation/pages/TeamPage/components/TeamspacesPanel.tsx` if the Team page starts to grow too large
- Create: `client/src/presentation/modules/Sharing/ResourceShareDialog.tsx` only if the current share dialogs become too duplicated
- Create: `client/src/presentation/pages/TeamPage/TeamPage.spec.tsx`

- [ ] **Step 1: Write failing UI tests for teamspaces and sharing**

Create tests that prove:
- the Team page renders a teamspaces section
- unassigned resources render separately from teamspace-grouped resources
- the share dialog shows a teamspace selector
- the default permission preset is `view only`
- selecting a teamspace persists in the share flow

Run:

```powershell
cd client
npx vitest run src/presentation/pages/TeamPage.spec.tsx
```

Expected: tests fail until the UI and service wiring exist.

- [ ] **Step 2: Keep the Team page layout calm and readable**

Update the Team page with:
- a left rail for teams, pending invites, and teamspaces
- a main content area that groups resources by teamspace
- a clear unassigned section for resources not yet organized
- compact actions instead of adding another card mosaic

Use restrained layout choices:
- section headings over nested panels
- only one accent color for the active state
- avoid duplicating borders around every block

- [ ] **Step 3: Update share dialogs to support teamspace assignment**

Make the share flow reusable across resource types:
- connection
- query
- dashboard
- ERD workspace

The dialog should expose:
- target organization
- target teamspace
- permission preset
- a short confirmation message describing the effect

Default to `view only`, with `comment`, `edit`, and `manage` as explicit alternatives.

- [ ] **Step 4: Verify mobile and desktop behavior**

Run:

```powershell
cd client
npm run build
```

Expected: the Team page and share dialogs build cleanly and stay usable on mobile-sized layouts.

- [ ] **Step 5: Commit the UI layer**

Run:

```powershell
git add client/src/presentation/pages/TeamPage.tsx client/src/core/services/OrganizationService.ts client/src/presentation/modules/Connection/ShareConnectionDialog.tsx client/src/presentation/modules/Dashboard/SaveToDashboardDialog.tsx client/src/presentation/modules/Visualization/ERDWorkspace/components/SaveERDWorkspaceDialog.tsx client/src/presentation/pages/TeamPage client/src/core/services/TeamspaceService.ts client/src/presentation/modules/Sharing/ResourceShareDialog.tsx
git commit -m "feat: surface teamspaces in team and share flows"
```

## Task 4: Add regression coverage and finish the rollout

**Files:**
- Modify: `server/src/organizations/services/organizations.service.ts` if the Team page needs teamspace counts or summaries
- Create: `server/src/teamspaces/teamspaces.controller.spec.ts`
- Create: `server/src/teamspaces/teamspaces.service.spec.ts` if not already added
- Create: `client/src/presentation/modules/Connection/ShareConnectionDialog.spec.tsx`
- Create: `client/src/presentation/pages/TeamPage/TeamPage.spec.tsx` if not already added
- Modify: `docs/superpowers/specs/2026-05-03-teamspace-share-permissions-design.md` only if the implementation reveals a scope mismatch

- [ ] **Step 1: Add regression tests for current collaboration flows**

Cover these existing behaviors so the new work does not break them:
- invite / accept / decline
- comments and mentions
- activity feed
- shared resource loading
- mobile navigation to Teams

Run:

```powershell
cd server
npx jest --runInBand
```

and:

```powershell
cd client
npx vitest run
```

Expected: the important collaboration flows still pass after the teamspace work lands.

- [ ] **Step 2: Run full builds after the last integration pass**

Run:

```powershell
cd server
npm run build

cd ../client
npm run build
```

Expected: both builds pass with the new schema, backend APIs, and Team page updates.

- [ ] **Step 3: Final cleanup commit**

Run:

```powershell
git add server client docs
git commit -m "feat: add teamspaces and share permissions"
```

## Coverage Check

This plan covers the spec requirements as follows:

- teamspaces / shared collections -> Tasks 1, 2, 3
- share dialog -> Task 3
- granular permissions UX -> Task 2 and Task 3
- mobile-friendly discoverability -> Task 3
- no second membership model -> enforced in Task 1 and Task 2
- regression safety -> Task 4

## Notes for the implementer

- Prefer small services and small components.
- Do not add teamspace members or nested teamspaces in this pass.
- Keep resource policies as the source of truth for access control.
- Use the UI to clarify permissions, not to expose raw JSON.
- Keep the Team page organized with sections and rails instead of card grids.
