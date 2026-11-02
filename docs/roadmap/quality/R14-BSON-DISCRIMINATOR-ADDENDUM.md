# R14 — BSON discriminator hardening addendum

Status: VERIFIED_LOCAL for this bounded read-path addendum on 2026-11-01, Asia/Saigon. R14 overall remains DOING_BOUNDED and R13 remains BLOCKED_PRODUCT_DECISION. Baseline HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`, branch `codex/roadmap-r00`; all cumulative uncommitted R00–R14 work and `.zcode/` were retained. No reset, stash, commit, push, deployment, dependency change, payment/provider call, or global Docker prune was performed.

See [current R14 boundaries](R14-REPORT.md), historical [31/10 native report](R14-NATIVE-READ-REPORT.md), and [verification manifest](r14-bson-discriminator-verification-2026-11-01.json). The 31/10 report and manifest remain historical snapshots and are not rewritten to cover this newer tree.

## Scope and impact

The production change is limited to `server/src/database-strategies/mongodb.strategy.ts`; maintained regressions are in `server/src/tests/database-strategies/mongodb.strategy.spec.ts` and `server/test/nosql-read-types-r14.e2e-spec.ts`.

The defect shared the existing BSON read/metadata boundary: an ordinary user document containing `_bsontype: "ObjectId"` was treated as a driver BSON instance. Query output collapsed that document to `"[object Object]"`, while metadata hid its nested user fields. The correction no longer trusts a string field. Compatible BSON 7 values are recognized through the BSON global type and version symbols; normal MongoDB `RegExp` results, MinKey and MaxKey receive explicit stable output.

Pre-edit GitNexus impact was LOW for serializer/type inference with no recognized callers. `getColumns` was LOW with two direct callers, four upstream symbols, two modules and one recognized schema-context flow. These counts are lower bounds because strategy dispatch and recursion are dynamic; unit/native/full gates are the runtime evidence. Final cumulative `all` and `compare main` remain CRITICAL: 110 files, 380 symbols, 132 flows.

## Reproduction and repair

The focused unit RED reproduced the ordinary-document collision: expected the full object but received `"[object Object]"`; the other 14 Mongo strategy cases passed. A native fixture was created server-side with `$arrayToObject` because the Node driver correctly refuses to encode a forged `_bsontype` object directly. Its initial syntax was wrong and failed before application code; that harness failure is retained as such. After correction, native query and metadata preserved the literal discriminator document and all 20 inherited native cases.

Independent review then found three Medium issues in the first repair:

1. The MongoDB driver reads stored BSON regex as native JavaScript `RegExp`; generic object serialization returned `{}`.
2. BSON MinKey/MaxKey had no `toJSON` or enumerable state and would both return `{}`.
3. `instanceof BSONValue` was tied to one package copy/realm.

All three were addressed and re-reviewed with no remaining finding:

- native `RegExp` becomes `{ pattern, options }` and metadata type `regexp`;
- MinKey/MaxKey become `{ $minKey: 1 }` / `{ $maxKey: 1 }`;
- BSON recognition uses `Symbol.for('@@mdb.bson.type')` plus the BSON 7 version brand, with a synthetic compatible cross-copy regression;
- ordinary documents with a BSON-looking string field remain ordinary documents.

The correction does not turn this into a typed-write or full Extended JSON contract. BSON recognition is pinned to installed major version 7; a future major upgrade requires review. Foreign-realm JavaScript `RegExp` objects are not claimed, while normal driver results are same-realm. Cross-copy branding is tested synthetically rather than by installing a second BSON package.

## Verification

| Gate | Result |
|---|---|
| Focused Mongo strategy final | 18/18, exit 0 |
| Focused native BSON/Redis final | 21/21, environment guards 2/2, exit 0 with `detectOpenHandles` |
| Full server unit/coverage final | 776/776, 97 suites, exit 0 |
| Full native API final, sequential | 184/184, 20 suites, environment guards 2/2, exit 0 with `detectOpenHandles` |
| Full test-source TypeScript | 0 diagnostics, exit 0 |
| Full server lint and production build | exit 0 |
| CI advisory-allowlist audit | exit 0; allowlist unchanged |
| Prisma generation helper | 4/4, exit 0 |
| Independent focused re-review | no remaining findings |
| `git diff --check` | exit 0; only inherited CRLF conversion warnings on unrelated files |

All-source server coverage: **55.74% lines, 47.36% branches, 50.02% functions, 54.92% statements**. Scope and thresholds were not relaxed.

An initial full-native run overlapped the final coverage run. All 184 test bodies passed, but R04 `afterAll` exceeded its unchanged 120-second hook budget, so that run is recorded as failed and is not used as the final gate. No timeout/retry/assertion/source change followed. A clean sequential run on a fresh fixture passed 184/184. This establishes the final local result, not elimination of timing sensitivity under competing workloads.

Client/browser/full-stack/container-image checks were not rerun because this addendum changes only backend MongoDB normalization/tests. Earlier client/browser/full-stack results retain only their original snapshot qualification. Remote GitHub Actions, release SHA and deployment remain NOT_RUN.

## Cleanup and remaining boundaries

Each native run used a uniquely named Compose project, loopback-only ports and tmpfs stores. The owned PostgreSQL, Redis, MongoDB and MySQL containers and network were inspected before removal. Final checks found no owned container/network and the host retained 19 volumes; no global prune was used.

R14 remains DOING_BOUNDED. CSV NULL-versus-empty, typed Mongo mutation/subtype-preserving writes, migration partial/resume semantics, Redis write/TTL-copy contracts, measured multi-replica ownership/caps, provider sandboxes, actual zoom/screen-reader acceptance and remote CI remain blocked or unverified. This addendum does not approve the R13 entitlement/lifecycle matrix.
