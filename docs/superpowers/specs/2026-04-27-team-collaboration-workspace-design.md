# Team Collaboration Workspace Design

Date: 2026-04-27

## Goal

Turn the current team page into a real collaboration surface for data work, not just a member/admin screen. The target is a shared workspace where teams can organize resources, discuss changes, and track activity around database work.

## Current Foundation

The repo already has a solid base:

- Team routing exists at `/teams` in [`client/src/App.tsx`](../../../client/src/App.tsx)
- The team screen already manages team creation, member invites, role updates, and shared connections/queries/dashboards in [`client/src/presentation/pages/TeamPage.tsx`](../../../client/src/presentation/pages/TeamPage.tsx)
- Mobile access to Teams already exists through the avatar menu in [`client/src/presentation/modules/Layout/Navbar/components/NavUserSection.tsx`](../../../client/src/presentation/modules/Layout/Navbar/components/NavUserSection.tsx)
- Notifications already stream through SSE and Redis-backed infrastructure in [`client/src/presentation/hooks/useNotifications.ts`](../../../client/src/presentation/hooks/useNotifications.ts) and the backend `notifications` module

That means the new work should extend existing collaboration flows, not replace them.

## Product Direction

The product should feel like a **database collaboration workspace**:

- teams own shared resources
- people can discuss those resources in context
- the system tracks what changed
- permissions are clear and resource-aware
- mobile users can still find and use team tools without hidden navigation

## Scope

### MVP

1. Teamspaces / shared collections
2. Comments on shared resources
3. `@mentions` in comments
4. Team activity feed
5. Notifications for collaboration events
6. Granular resource permissions

### Phase 2

1. Version history and diff for shared queries and dashboards
2. Follow mode for shared resources
3. Team search for people and resources
4. Better resource ownership and audit views

### Phase 3

1. Presence indicators
2. Live co-edit for safe text surfaces
3. Approval flow for sensitive actions
4. Onboarding templates and starter packs

## Non-Goals

- Real-time multi-cursor editing for every screen
- A full chat product
- A full enterprise workflow engine
- Schema migration orchestration from the team page itself

These are useful later, but they are too heavy for the first collaboration pass.

## Proposed UX

### Team Page

The existing Team page becomes the main collaboration hub:

- left sidebar: team list and team switching
- center: team details
- tabs: members, connections, queries, dashboards, activity
- action area: invite, share, manage permissions

### Resource Views

Shared connections, queries, and dashboards should expose:

- who owns or shared the resource
- current permissions
- comment thread entry point
- activity/history summary

### Mobile

Mobile should keep the existing avatar-menu entry point and add compact team actions inside the team page itself. The goal is no hidden team-only experience on small screens.

## Data Model Direction

The implementation should likely introduce or extend the following concepts:

- `Team` / `Organization`
- `TeamMember`
- `SharedResource`
- `ResourcePermission`
- `CommentThread`
- `Comment`
- `Mention`
- `ActivityEvent`
- `ResourceVersion`

The exact schema can follow existing backend conventions, but the model should stay resource-centric instead of team-only.

## Permissions

Recommended permission levels:

- `view`
- `comment`
- `edit`
- `manage`
- `share`

Rules:

- `view` can inspect shared resources
- `comment` can participate in discussions
- `edit` can modify the resource content
- `manage` can change membership or permissions for that resource
- `share` can grant access onward

## Activity and Notifications

The collaboration system should emit activity events for:

- team creation
- invite sent / accepted / removed
- role changes
- resource shared / unshared
- comment created / resolved
- permission changed
- resource updated

Those events should feed:

- the team activity tab
- the global notifications stream
- future audit and history screens

## Implementation Notes

- Reuse existing team and notification foundations instead of adding a parallel collaboration stack
- Keep the first pass focused on shared data resources, not general document editing
- Prefer small, well-bounded modules for comments, permissions, and activity
- Make mobile support explicit so the feature set is discoverable on phones

## Acceptance Criteria

The collaboration workspace is good enough when:

- a user can open `/teams` and understand what their team owns
- shared resources show who can view, comment, or edit them
- comments and mentions create visible collaboration signals
- activity history shows meaningful team changes
- the same flows remain usable on mobile

## Open Questions

1. Should comments attach to the resource root only, or should we support threaded comments on specific objects inside a resource?
2. Should `share` be a separate permission, or should `manage` also imply sharing?
3. Which resources should be in the MVP first: connections, queries, or dashboards?

