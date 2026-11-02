# R14 — Native BSON reads and Redis key browsing

Status: VERIFIED_LOCAL for this bounded read-path package. R14 overall remains DOING_BOUNDED. Baseline HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`, branch `codex/roadmap-r00`; cumulative R00–R14 work and `.zcode/` were retained. No reset, stash, commit, push, deployment, payment/provider call, or global Docker prune was performed.

See [current R14 boundaries](R14-REPORT.md), [verification manifest](r14-native-verification-2026-10-31.json), and [earlier cleanup evidence](CLEANUP-2026-10-31.md).

## Scope and impact

Production changes are limited to:

- `server/src/database-strategies/mongodb.strategy.ts`: BSON value normalization and sampled column inference.
- `server/src/database-strategies/redis.strategy.ts`: existing SCAN/KEYS key-list syntax, pagination, and duplicate handling.
- `server/test/compose.e2e.yml`: ephemeral Redis `/data` tmpfs; no application Compose volume policy changed.

Maintained regressions are `server/src/database-strategies/redis-scan.r14.spec.ts` and `server/test/nosql-read-types-r14.e2e-spec.ts`. They retain the existing test-discovery conventions. No client, DTO, dependency, database schema, permission, typed-write, billing, or migration-resume contract changed.

Pre-edit GitNexus upstream impacts resolved the exact production symbols: Mongo serializer/type inference LOW with no recognized callers; Mongo executeQuery LOW with two direct references; Redis executeQuery LOW with two direct references; scanKeys LOW with two direct callers/eight upstream symbols/one recognized schema-context flow; getTables LOW with three direct callers/one flow; Mongo getColumns LOW with two direct references/one flow. These are graph lower bounds: strategy dispatch and recursive callbacks are checked through maintained native/unit regressions rather than assuming zero dynamic callers. Test helpers not yet indexed returned UNKNOWN; that was not treated as a safety finding.

## Reproduction and repair

The frozen affected baseline passed **83 tests in four suites**, before any production edit.

The first native HTTP read suite ran **18 tests: 3 passed, 15 failed**. It confirmed that:

- MongoDB Long, Binary and Timestamp values were flattened into internal `high/low/buffer/position` fields instead of preserving the observed read value.
- `useBigInt64` returned an HTTP 500 because native bigint could not be JSON-serialized.
- BSON column inference treated opaque values as ordinary documents and consumed the column budget on internal storage fields.
- Redis exact patterns and glob patterns without `*` fell back to the entire database; SCAN TYPE was ignored, malformed syntax succeeded, and scanning only `limit + offset` prevented the next-page lookahead.

Two initial `distinct` cases instead encountered the existing read-only denial. The fixture was corrected to use an owner-controlled writable connection for those read operations, and a separate maintained test preserves the read-only `distinct` denial. No guard was relaxed. The corrected first-repair suite passed **19/19**.

An additional native array-metadata test then produced **1 failure / 19 passes**: arrays of BSON values still expanded opaque fields and hid an ordinary document later in the array. Column inference now selects an actual ordinary-document element rather than the first object-like BSON value. The complete focused native package passed **20/20** afterward.

### BSON output

- ObjectId remains its string identity and Date retains its service-level Date value, becoming ISO text at the HTTP JSON boundary.
- Decimal128 is an exact decimal string.
- BSON Long is converted through its exact integer representation: safe integers remain numbers, unsafe integers are decimal strings. Driver-requested native bigint is a decimal string, so no JSON exception occurs.
- Other BSON values with native `toJSON` use that result recursively. Binary follows the driver's base64 JSON representation; Timestamp follows its native JSON representation. Ordinary user documents with fields named `high`, `low`, and `unsigned` remain ordinary documents.
- Column inference names opaque BSON types and does not recursively expand their storage members, including when they appear inside arrays.

This is a read/display contract, not an Extended JSON import/export or subtype-preserving typed-write round trip. Binary bytes are verified against base64 output; Binary subtype restoration, typed mutation and full BSON schema fidelity are not claimed.

### Redis key lists

- Preserve the existing table-shaped key result rather than replacing it with the native raw cursor tuple.
- Validate `KEYS pattern` and SCAN cursor/options. Apply MATCH/COUNT/TYPE; keep the count hint within the existing 500-key command cap.
- Traverse empty batches and deduplicate keys. Collect one extra unique key for `hasNextPage`, with the requested offset/limit applied to the result.
- Report `totalCount` only after a traversal starting at cursor zero reaches the terminal cursor. A partial traversal or a nonzero-cursor suffix does not claim the entire keyspace count. Strategy count status is unavailable when traversal is incomplete; QueryService's existing optional-count policy remains unchanged.
- Keep the native read whitelist, WRONGTYPE error mapping, owner isolation and read-only write denial. Native reads preserve the stored Unicode value, key types and positive TTL without resetting expiry.

Redis SCAN is not a stable snapshot. Concurrent key changes can affect ordering or successive offset pages; a terminal traversal is not an atomic count under writes. COUNT is a hint, and a sparse MATCH may traverse many batches. This package verifies bounded result size/lookahead, not a new whole-keyspace work budget, cross-process cursor persistence or stable offset pagination under mutation. Whitespace/quoted key tokenization and Redis write/TTL-copy policies remain outside this correction.

## Final verification

| Gate | Result |
|---|---|
| Frozen affected baseline | 83/83 tests, four suites, exit0 |
| Redis scan edge cases plus existing Mongo/Redis driver tests | 48/48, three suites, exit0 |
| Focused native HTTP/read metadata | 20/20, exit0 |
| Full server unit/coverage | 772/772, 97 suites, exit0 |
| Full native API | 183/183, 20 suites, guards2/2, exit0 with detectOpenHandles |
| Server scoped/full lint, production build | exit0 |
| CI advisory-allowlist audit | exit0; existing allowlist unchanged |
| Prisma generation helper | 4/4, exit0 |

All-source server coverage: **55.69% lines, 47.28% branches, 49.97% functions, 54.87% statements**. Coverage inclusion and thresholds were unchanged. Client code did not change; the preceding client/browser/full-stack results remain historical evidence for their tested snapshots, not new runs of this backend package.

At this 31/10 native-read snapshot, full `tsc --noEmit` reported **seven inherited test diagnostics**. A CompilerHost comparison using the two strategy files from the prior verified source snapshot reproduced the same seven diagnostics before and after this package, with **zero new diagnostics**. Production build and Jest gates passed; the native-read snapshot did not claim full test-source typechecking was green. The historical diagnostic ledger remains in `typecheck-baseline-comparison.json`. A later [R10 test-type package](R10-TEST-TYPES-REPORT.md), verified01/11, closes the seven diagnostics and adds the full-source CI typecheck gate; see its separate [manifest](test-types-verification-2026-11-01.json), not a rewrite of this package's historical results.

## Review and cleanup

Self-review checked the narrow diff, caller compatibility, numerical precision, opaque BSON handling, native Redis syntax/pagination and error/permission boundaries. No independent-review success is claimed; the read-only contract lookup agent could not finish because of a provider rate limit.

OOP/SOLID responsibilities remain in the existing strategies; no new hierarchy or framework was added. KISS/YAGNI reuse native BSON conversion and ioredis overloads. DRY centralizes key-list option validation and traversal for query/tree callers. Existing recursive metadata depth/column limits and cleanup sequencing remain intact. C01–C05/C07–C08/C10 apply to typed values, trust boundaries, lifecycle, errors, fixtures and compatibility; no performance improvement or scale certification is claimed under C09.

The fixture reused existing image IDs with `--pull never`, published only loopback ports, and used tmpfs for PostgreSQL, MongoDB, MySQL and Redis. Native test teardown removed owned users/connections, Mongo databases and Redis key prefixes; readback found no remaining synthetic records. Docker teardown removed only the four owned containers and their network. All **19 pre-existing volumes**, original image tags, and other-project containers were unchanged; **zero new volumes** were created. No installed dependency checkout was copied for this run.

Final GitNexus `compare main` reports **CRITICAL: 109 files, 376 changed symbols, 132 affected flows** for the cumulative preserved work. Keep this integration warning visible; concern-split review and release gates remain necessary. Current scope hashes and historical snapshots are stored separately; earlier manifests were not rewritten to appear to cover this newer tree.

## Remaining roadmap boundaries

R14 stays DOING_BOUNDED. CSV NULL-versus-empty, typed Mongo mutation, migration partial/resume semantics, Redis writes or TTL-copy workflows, measured multi-replica need/caps, provider sandboxes, real browser zoom/screen-reader acceptance and remote CI remain open or explicitly unverified. R13 still needs an approved entitlement/lifecycle matrix; this technical read-path correction does not approve or create one.
