# Pre-push hardening — 03/11/2026

Status: **IN_PROGRESS_LOCAL**, not release-ready. Branch `codex/roadmap-r00`; review baseline `78b8221a62484d44a425f9f54e4ccbda0ec136a1`. All work remains local: no push, PR, merge, provider call, image publication or deployment.

## Why this follow-up exists

Two completed read-only reviews found six actionable defects after the earlier R00–R14 gates. A third commit/artifact review failed to produce a report and is not counted as independent acceptance. The earlier reports/manifests remain historical evidence; their local passes do not cover these newly exercised boundaries.

| Finding | Initial severity | Follow-up scope |
|---|---|---|
| Migration bypassed connection/team import restrictions | High | Authorize before enqueue and reauthorize actual endpoints in the worker; normalize effective database and identifiers consistently. |
| Redis complete reads could materialize unbounded collections | High | Cardinality, byte and scan-work limits must be proved before materialization, atomically with reads; never truncate exports silently. |
| Inner/literal/ambiguous SQL pagination could suppress an outer cap | High | One dialect-aware lexical analysis for actual outer SELECT bounds, rewriting and driver dialect propagation. |
| Native AvatarEditor and Radix Profile competed for focus/Escape | High | Nested Radix child, busy-state dismissal guards and exact child/parent opener restoration. |
| Automatic logout allowed old requests to regain ownership after same-user login | Medium | All automatic logout branches invalidate request generation; preserve genuine in-session refresh and one-time auth replay. |
| Profile close accessible name was English in Vietnamese mode | Low | Optional localized close label in the shared dialog primitive. |

## Results recorded so far

- Dialog-label RED: **2 failed / 2 passed**. Optional label was leaked to the DOM and Profile still exposed `Close` in Vietnamese.
- Native-avatar isolated negative control: **2 failed / 0 passed**, Chromium and Firefox. The old modal lost child focus on Chromium and closed the parent on Escape on Firefox. The control used an isolated export, not a temporary rollback of the working tree.
- Dialog GREEN: **7/7 unit**, four files; **8/8 browser**, Chromium and Firefox, one worker and retries 0. Includes child focus, Escape ordering, exact opener restoration, Axe checks and Vietnamese close labeling. Crop geometry/encoding are unchanged.
- Terminal-logout RED: **4 failed / 11 passed**. Covers stale success with reused/new tokens, stale PATCH replay and obsolete refresh restore.
- Complete logout regression GREEN: **30/30** across API-session, API service, no-write-retry and auth-slice tests. Includes malformed refresh and network failure plus exact-once logout.
- Full client lint and coverage gate before the final two parameterized session cases: **187/187**, 55 files, exit 0; **19.03% lines / 12.06% branches / 15.53% functions / 18.08% statements**. Floors/source scope unchanged. Runtime source did not change after this gate; final added session test cases are separately green.
- Browser full matrix: **236/236**, Chromium, Firefox, mobile Chromium and mobile WebKit; one worker, retries 0, exit 0, **14.1 minutes**. Four extra runs cover nested avatar focus and Vietnamese close labeling. Client build/bundle budget pass; a runtime-file SHA-256 binding records unchanged source during the browser gate.
- All E2E/full-stack/config TypeScript: **18 inputs, zero diagnostics** after adding the pinned missing PostgreSQL dev types. The maintained `typecheck:browser` command discovers these inputs; it is not an exclusion or reduced-source check.
- Redis atomic follow-up: focused unit **75/75**, native Redis7 **10/10**, exit 0 with `--detectOpenHandles`; fixture project `data-explorer-prepush-redis-20261103` removed, container/network zero, host volume set **19 before / 19 after**, no difference. The RED controls reproduce old races/materialization; their initially truncated count is not used as an authoritative number. The **1 MiB reserve is conservative Redis payload/storage-plus-expansion accounting, not JSON/Node heap or Redis/Lua peak allocation**. Quicklist/unknown encodings, collections above 500 backing items and keyspaces above 5,000 explicitly fail closed; exports never silently truncate.
- Migration follow-up focused **90/90**, three suites, after the initial **23 fail / 51 pass**, queued-endpoint **5 fail / 44 pass**, explicit ClickHouse/PG-default **8 fail / 81 pass**, and implicit ClickHouse `default` **1 fail / 22 pass** controls. Actual effective databases are pinned through canonical DTO, queue endpoint snapshots, pools, metadata, transfer and freshness. PostgreSQL/Cockroach require explicit databases; ClickHouse resolves its existing `default` behavior before policy checks.
- Final backend committed-source gate at `a30d7b5`: **984/984 tests, 97 suites**; coverage **58.05% lines / 50.96% branches / 52.09% functions / 57.11% statements**; lint, typecheck and build exit 0, no coverage/source-budget changes.
- Final native API gate at the same source: **218/218**, **22 suites**, **zero skipped**, `--detectOpenHandles`, exit 0. Includes new migration policy/effective-database, Redis7 safety and maintained PostgreSQL outer-cap suites. The preceding native run **217 pass / 1 fail** is retained: COUNT-wrapper construction lost a trailing observation marker, so R07 could not see its count phase in the unchanged three-second observation budget. Keeping the marker safely outside the wrapper closed that regression; the full final native suite was rerun, not inferred from a focused pass.
- Full server compatibility run before follow-up backend repairs: **789 passed / 12 failed**, 97 suites. All twelve failures were the R05 lifecycle mock missing `getMigrationConnection`; this is a fixture compatibility regression, not twelve independent product defects. Updating only that mock retained all lifecycle assertions; focused migration/lifecycle/connections GREEN **42/42**.
- CI, audit/deploy helpers, Prisma-generation helper and public-prerender tests: **15/15**, exit 0.

Evidence is retained under ignored `output/prepush-hardening-20261103/` and the earlier `output/prepush-*.log` files. Raw logs/traces are local evidence, not repository-portable or remote-CI execution.

## Independent-review follow-up

A bounded review of the dialog repair found no actionable regressions. Apply success/failure transitions, Edit-current opener, component-unmount cancellation, backdrop geometry and WebKit remain additional test limits, not claimed acceptance.

Backend follow-up reviews identified incomplete first repairs: terminal request logout still bypassed generation invalidation; SQL still accepted numeric prefixes, dollar literals, percent/ties/compound query bounds and unsafe insertion; migration authorized a schema database without carrying it into pool/freshness; Redis preflight/read separation left a race and zero-length ranges could become `0,-1`. Those first focused passes are not relabelled as final closure. Independent SQL re-review found and verified repairs for line-comment termination before locking/settings tails and parenthesized TOP projections. The maintained native PostgreSQL suite also proves rowCount is bounded before the driver-defense slice.

The clean full-stack run at `a30d7b5` was **2 pass / 1 fail**, exit 1: reload after a successful saved-query POST displayed an empty Monaco draft. The editor persists tab SQL after a 500ms debounce that execution/count updates restart, while save completion stores only the saved-query ID. Source confirms a reachable durability race; that occurrence is strongly supported by timing/render evidence but the trace did not contain a localStorage snapshot. A pre-navigation save toast shows the callback completed, so it is not labelled a definitely interrupted save callback. The failed run is retained.

### Saved-draft closure and requested UI restoration

- `7c33570` restores the original header layout, control order, sizes, gradient and animation requested by the user. Its 25 visual JSX properties match `main` after normalizing line endings; nonvisual accessible names, pressed state and Profile focus restoration remain. No new redesign was introduced.
- `b620685` flushes current SQL to the originating persisted tab before create/dialog/owner-update requests. Completion merges only the saved-query ID, never stale response SQL. Ordinary 500ms editing debounce, result metadata and explicit execution behavior remain unchanged.
- Deterministic original-source RED: **5 failed / 3 passed**; fixed component GREEN: **8/8**, including actual Zustand rehydration, both owner-update entry points, newer edits/tab switching, replacement-session isolation and no automatic execution.
- Final client coverage at that source: **197/197**, **56 files**, exit 0; **21.01% lines / 13.73% branches / 17.42% functions / 20.04% statements**. Full lint has zero errors and the inherited Fast Refresh warning; complete browser/full-stack TypeScript and production build/bundle budget exit 0. Coverage source/floors, assertions and retries are unchanged.
- Clean browser-to-real-backend rerun: **3/3**, one worker, retries 0, exit 0. The isolated verification copy translates only fixture API port 3001 to 13001 so it does not replace the running workstation backend; timing and assertions are unchanged. All **796** copied source files match their recorded root hashes; no `server/.env` was copied, and retained clean dependencies have identical lockfiles. Fresh fixtures applied nine migrations, then project-owned cleanup exited 0 with **19 volumes before / 19 after**, no difference.
- Independent bounded static review found no actionable regression. Failed-save responses and responses arriving after newer SQL has already debounced are additional coverage limits, not claimed acceptance.
- Backend source remains identical across all **408** paths bound to `a30d7b5`; its **984/984** unit and **218/218** native results remain valid unchanged-source evidence, not new runs. The server runtime image built successfully and its bundled Prisma CLI reported **6.19.3**.
- The earlier **236/236** browser matrix preceded the requested header restoration and saved-draft fix. It is **not** relabelled as a pass on `b620685`; final whole-matrix/viewport acceptance remains pending. The affected query-lifecycle and Profile/Avatar browser suites were rerun on the frozen final source: **14/14**, Chromium/Firefox, one worker, retries 0, exit 0. The current client-container build also exited 0; image build is not a vulnerability-scan or production-acceptance claim.
- Final GitNexus rebuild: **7,673 nodes / 20,408 edges / 233 flows**. Staged UI restoration was LOW (one file); staged saved-draft source/tests was MEDIUM (two files, one affected indexed flow). `compare main` for the complete committed branch is **CRITICAL: 243 files / 1,139 symbols / 133 flows**. This is cumulative integration scope, not a new failing test; preserve the warning during review.

## Commit reconstruction and migration provenance

- Commits `165684d` and `3540dc0` introduced a deployment-documentation regression before its companion guide update in `0ebe6e4`. Memory-only tests of those exact trees gave Render PASS / frontend-docs FAIL; the later/current tree passes both. This is an intermediate-history defect, not a current runtime failure. No claim is made that every reconstructed commit was independently green; any selective backport needs its companion fixes. The history was not rewritten to hide it.
- R09 migration EOF whitespace was changed during commit reconstruction. Restoring exactly the original final LF reproduces historical SHA-256 `1a615e8dc2f5b985db2962369fa1dfa0e177c2e2c98706cccb1c044ffe2a0fac`; the SQL statements are unchanged. The original checksum is preserved in a normal follow-up commit, and the same final LF is restored in the four retained historical checkouts whose migration was changed during reconstruction; all four now match the original historical hash again. Commit objects built with the one-LF variant remain historical reconstruction artifacts rather than being silently rewritten. `.gitattributes` exempts only this migration's historical blank final line from `blank-at-eof`; other whitespace checks remain enabled. Shared/production migration history was not inspected or rewritten; rollout still requires an operator check.
- All browser/full-stack/config TypeScript sources (18 inputs) exposed a missing `@types/pg` declaration referenced by the maintained full-stack test. Add pinned server dev dependency `@types/pg@8.23.1`, not a production library change; `client typecheck:browser` now discovers all E2E/full-stack `.ts` plus both configs, and CI runs it after both installs/server build. This also exposes real PG/billing fixture annotations previously masked by missing declarations; those must be repaired rather than skipped.

## Constraints preserved

- No arbitrary entitlement, billing lifecycle, BSON typed-write, CSV NULL sentinel, Redis overwrite/TTL or migration-resume contract was added.
- R13 remains **BLOCKED_PRODUCT_DECISION** and R14 remains **BLOCKED_PRODUCT_CONTRACT**.
- Permission/replay/partial-write and cleanup assertions stay active. No timeout/retry increase, skip, reduced source inclusion or coverage-floor change.
- Local synthetic fixtures only; no production/workstation database migrations. Docker cleanup remains project-owned, never global prune.
- Actual zoom/screen-reader, provider sandbox, multi-replica/load, remote GitHub Actions, publication/deployment and production acceptance remain unverified.

## Remaining acceptance

The saved-draft defect is **VERIFIED_LOCAL** at `b620685`: focused RED→GREEN, full client lint/coverage/types/build, affected browser suites, clean browser-to-real-backend and current client-container build are complete. Backend/native/runtime-Prisma evidence remains bound to unchanged server source. To keep this follow-up bounded after the user's request for speed, the full browser matrix was not repeated after the requested UI restoration; all-viewport/header, full-matrix, current image vulnerability-scan/SBOM, remote CI and production/manual acceptance remain pending. No timeout/retry, skip, assertion, source-inclusion or coverage-floor change was used. The overall status stays `IN_PROGRESS_LOCAL`, not Draft-PR/release-ready.
