# Teamspace, Share, and Permissions Design

Date: 2026-05-03

## Goal

Turn the current team collaboration surface into a clearer workspace hierarchy without making the product heavier than it needs to be.

The first pass should help teams answer three questions quickly:
- what shared spaces exist?
- which resources belong to each space?
- who can view, comment, edit, manage, or share them?

## Current Foundation

The repo already has a strong base to build on:

- Team routing exists at `/teams` in [`client/src/App.tsx`](../../../client/src/App.tsx)
- Team membership, invites, accept/decline, comments, and activity already exist in the team and collaboration modules
- Shared resource policies already exist through `OrganizationResource` and `PermissionsService`
- Connection sharing already has a visible UI entry point in [`client/src/presentation/modules/Connection/ShareConnectionDialog.tsx`](../../../client/src/presentation/modules/Connection/ShareConnectionDialog.tsx)
- The app already has a clear organization model, so we do not need to invent a second member system

That means the right move is to extend the current organization-based model, not replace it.

## Product Direction

The product should feel like a **database collaboration workspace**:

- organizations remain the top-level boundary
- teamspaces are lightweight containers inside an organization
- shared resources can be grouped into a teamspace or left unassigned
- permissions stay role-aware and resource-aware
- the share flow stays simple enough to use on mobile and desktop

## Core Design Decision

### Teamspaces Are Organizational Containers

Teamspaces are **not** a new membership system.

They do not have their own members, roles, or invitations in the MVP.

Instead:
- `Organization` continues to own access control
- `Teamspace` only provides workspace hierarchy and resource grouping
- resource access still flows through the existing permission model

This keeps the feature aligned with YAGNI and avoids duplicating governance logic.

## Scope

### MVP

1. Teamspace CRUD inside an organization
2. Assign shared resources to a teamspace
3. Show teamspaces on the Team page
4. Group shared resources by teamspace
5. Add a teamspace selector to share dialogs
6. Keep permissions role-based and explicit through a friendly UI

### Phase 2

1. Teamspace archive / restore
2. Teamspace search
3. Resource filters by teamspace
4. Teamspace counts and summary metrics
5. Stronger share presets for common collaboration patterns

### Phase 3

1. Version history on shared resources
2. Follow mode for specific teamspaces or resources
3. Presence indicators
4. Live edit for safe text surfaces

## Non-Goals

- separate teamspace membership
- nested teamspaces
- live multi-cursor editing
- a full chat or issue tracker
- a brand new ACL system unrelated to the current role-based model
- changing the organization membership model

## Data Model

### New Model

Add a `Teamspace` model with:
- `id`
- `organizationId`
- `name`
- `slug`
- `description`
- `createdBy`
- `createdAt`
- `updatedAt`

### Existing Model Extension

Extend `OrganizationResource` with:
- `teamspaceId` as an optional foreign key

This keeps resource grouping where the permission metadata already lives.

### Ownership Rules

- A teamspace belongs to exactly one organization
- A resource can belong to at most one teamspace
- A resource can also be unassigned
- If a resource is unshared or removed, its teamspace assignment should clear with it
- If a teamspace is deleted, its resources should become unassigned, not deleted
- If a resource is created or shared from inside a selected teamspace context, it should default to that teamspace; otherwise it remains unassigned

## Backend Design

### New Feature Module

Add a focused `teamspaces` module:
- `TeamspacesController`
- `TeamspacesService`
- optional repository wrapper if it keeps the service clean

Keep responsibilities separated:
- `OrganizationsService` stays responsible for organization membership and high-level team metadata
- `TeamspacesService` handles teamspace CRUD and resource assignment
- `PermissionsService` remains the single place for permission evaluation

### API Surface

Recommended endpoints:

- `GET /organizations/:organizationId/teamspaces`
- `POST /organizations/:organizationId/teamspaces`
- `PATCH /organizations/:organizationId/teamspaces/:teamspaceId`
- `DELETE /organizations/:organizationId/teamspaces/:teamspaceId`
- `PATCH /organizations/:organizationId/resources/:resourceType/:resourceId/teamspace`
- `GET /organizations/:organizationId/resources?teamspaceId=...`

The `resources` update endpoint should attach or detach a resource from a teamspace without changing its access policy.

### Permission Rules

Keep the current role-based policy model, but expose it through a cleaner share UX.

Recommended permissions:
- `view`
- `comment`
- `edit`
- `manage`
- `share`

Rules:
- `view` allows reading the resource
- `comment` allows discussion on the resource
- `edit` allows modifying content
- `manage` allows changing resource settings and collaboration state
- `share` allows granting access onward

For MVP, the UI should offer a small set of share presets instead of a raw permission matrix.

### Error Handling

Backend failures should be explicit and predictable:

- invalid teamspace ID for another organization returns `404`
- invalid resource type or resource ID returns `404`
- permission changes without access return `403`
- deleting a teamspace should never delete the underlying resources
- shared resource updates should be idempotent where possible

## Frontend Design

### Team Page

The Team page becomes the main workspace hub:

- left rail: team list, pending invitations, and teamspaces
- main area: team details and resource lists
- resource sections grouped by teamspace, then an unassigned bucket
- teamspace create/edit/delete actions available from compact controls

### Share Dialog

The share flow should be reusable across resource types:

- connection
- saved query
- dashboard
- ERD workspace

The dialog should expose:
- target organization
- target teamspace
- access preset
- confirmation copy that explains what changes

Default behavior:
- the default access preset should be `view only`
- the user can switch to `comment`, `edit`, or `manage`
- if the user has already selected a teamspace in the current UI context, the dialog should preselect it

The UI should stay simple enough for mobile use.

### Permission UX

The user should not need to understand raw policy JSON.

The share dialog should offer clear presets such as:
- view only
- comment
- edit
- manage

Custom role-by-role overrides can come later if the product proves the need.

### Mobile

Mobile should keep the current team entry point and show teamspaces in a compact list or drawer pattern.

No separate mobile-only experience is needed for teamspaces.

## Implementation Principles

The implementation should follow:
- OOP: small services with one job each
- SOLID: isolate teamspace logic from organization membership logic
- KISS: keep the first version as a simple container plus resource assignment
- DRY: reuse the existing resource-policy model and share patterns
- YAGNI: do not add teamspace members or nested spaces yet

## Testing Strategy

### Backend

Add tests for:
- teamspace creation
- teamspace rename
- teamspace deletion
- resource assignment and unassignment
- permission failures across organizations

### Frontend

Add tests for:
- Team page renders teamspaces and unassigned resources
- share dialog shows teamspace selection
- permission presets are applied without breaking existing flows
- mobile layout remains usable

### Regression Checks

Verify existing flows still work:
- invite / accept / decline
- comments and mentions
- activity feed
- shared resource loading
- mobile navigation to Teams

## Rollout Plan

1. Add database schema and migration
2. Add backend endpoints and service logic
3. Extend Team page to show teamspaces
4. Extend share dialog to assign teamspace and permission preset
5. Verify mobile and desktop flows

## Acceptance Criteria

The feature is good enough when:

- a user can create a teamspace inside an organization
- a user can assign a shared resource to a teamspace
- the Team page clearly groups resources by teamspace
- the share dialog can choose a teamspace and access preset
- the current permission model still protects shared resources
- nothing in the current invite/comment/activity flow regresses
- teamspace deletion unassigns resources after a confirmation prompt that shows how many resources will be affected

## Source References

- [client/src/App.tsx](/D:/Data%20Explorer/client/src/App.tsx)
- [client/src/presentation/pages/TeamPage.tsx](/D:/Data%20Explorer/client/src/presentation/pages/TeamPage.tsx)
- [client/src/presentation/modules/Connection/ShareConnectionDialog.tsx](/D:/Data%20Explorer/client/src/presentation/modules/Connection/ShareConnectionDialog.tsx)
- [server/src/permissions/services/permissions.service.ts](/D:/Data%20Explorer/server/src/permissions/services/permissions.service.ts)
- [server/src/permissions/types/resource-permission-policy.ts](/D:/Data%20Explorer/server/src/permissions/types/resource-permission-policy.ts)
- [server/src/organizations/services/organizations.service.ts](/D:/Data%20Explorer/server/src/organizations/services/organizations.service.ts)
- [server/src/organizations/organizations.controller.ts](/D:/Data%20Explorer/server/src/organizations/organizations.controller.ts)
- [Notion comments, mentions, and reactions](https://www.notion.com/help/comments-mentions-and-reminders)
- [Notion manage teamspaces](https://www.notion.com/help/manage-teamspaces)
- [Airtable commenting in Airtable](https://support.airtable.com/docs/commenting-in-airtable)
- [Airtable workspace permissions](https://support.airtable.com/docs/workspace-permissions)
- [Navicat Collaboration](https://www.navicat.com/en/navicat-collaboration)
- [DataGrip query files](https://www.jetbrains.com/help/datagrip/query-files.html)
- [DataGrip code completion](https://www.jetbrains.com/help/datagrip/auto-completing-code.html)
- [pgAdmin features](https://www.pgadmin.org/features/)
- [Supabase realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase presence](https://supabase.com/docs/guides/realtime/presence)
