# R10 — Full test-source TypeScript gate

Status: VERIFIED_LOCAL for this test-harness/static-gate package. Started on 2026-10-31 and verified on 2026-11-01, Asia/Saigon. Evidence keeps its original run directory `output/roadmap-r10-test-types-20261031/`.

Baseline HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`, branch `codex/roadmap-r00`. All cumulative R00–R14 work and `.zcode/` remain preserved; no reset, stash, commit, push, publish, deploy, or external provider operation was performed.

See [R10 report](R10-REPORT.md), [verification manifest](test-types-verification-2026-11-01.json), and the historical [R14 native-read report](R14-NATIVE-READ-REPORT.md).

## Scope and impact

The seven inherited compiler diagnostics were repaired in five existing test files:

| File | Correction |
|---|---|
| `server/src/ai/ai.controller.spec.ts` | Use a typed Express module mock for the denied SSE response, without casting an incomplete object to the entire Response contract. |
| `server/src/migration/migration-lifecycle.r05.spec.ts` | Declare the Jest importData mock with the existing strategy method's Parameters and ReturnType. Its default result and all failure/acknowledgment cases remain unchanged. |
| `server/test/cache-freshness-r08.e2e-spec.ts` | Describe the existing numeric MongoDB `_id` fixture explicitly and require the completed migration's jobId before removing its owned job. |
| `server/test/cache-lifecycle-r10.e2e-spec.ts` | Supply `KeyvRedis<unknown>` for the existing adapter reference. |
| `server/test/comment-persistence-r09.e2e-spec.ts` | Declare the existing resource ID array as `string[]` instead of an inferred `never[]`. |

The durable command is `npm run typecheck` in `server/`:

```text
tsc --noEmit --incremental false --project tsconfig.json
```

The server job in `.github/workflows/ci.yml` now invokes it immediately after Prisma generation. The existing full tsconfig includes unit and E2E test sources; the Nest production build, which excludes specs, does not replace this gate. The corresponding commands are documented in the server README, CI/CD guide, and roadmap.

No production TypeScript file, tsconfig option, test discovery setting, package lockfile, dependency, schema, fixture URL, permission, limiter, timeout, retry or coverage floor was changed.

Pre-edit GitNexus impacts: the five test files resolved LOW with no recognized external callers; migration setup resolved LOW with one same-suite caller. The package file resolved LOW with one direct reference, but graph counts are not a dependency-compatibility test. The CI file lookup returned UNKNOWN/not indexed, so its command order and syntax were verified directly with the package command, negative compiler control and pinned local actionlint. These static counts are lower bounds, not runtime safety proof.

## Frozen baseline and negative control

Before edits, full test-source TypeScript checking returned exit2 with the same seven diagnostics documented by the preceding R14 package. Affected unit tests passed **22/22** in two suites, and affected native cache/comment tests passed **27/27** in three suites.

After repair, `npm run typecheck` returned exit0 with **zero diagnostics**, including a final check after Prisma generation and production build.

The negative control did not restore files in the working tree. A CompilerHost read overlay supplied the five captured pre-edit test files to the same compiler, with unchanged roots/options. It reproduced **all seven original diagnostics**; the real current files produced **zero**. This demonstrates that the gate detects the old fixture type errors instead of excluding those tests or suppressing diagnostics.

The five files retain all **165 existing expect calls**: 21 AI, 43 migration, 52 cache freshness, 6 cache lifecycle and 43 comments. Assertion counts alone do not establish correctness; native/unit suites also executed the same expectations. The jobId guard adds a fail-fast invariant rather than an early return or success fallback.

For the annotation-only migration, Keyv and resource-array changes, emitted JavaScript syntax trees match the baseline after ignoring source positions/trivia. The raw Keyv output still differs because a property chain wraps across a line; that unsuccessful byte comparison and the printer-based check are retained rather than rewritten as passes. The SSE mock construction and jobId invariant have intentional runtime differences and were verified by affected/full regression tests, not by annotation-erasure claims.

## Final gates

| Gate | Result |
|---|---|
| Full test-source compiler | Zero diagnostics, exit0, before tests and after build |
| Negative compiler control | Seven errors restored through read overlays; zero with current source |
| Affected unit regression | 22/22, exit0 |
| Frozen affected native baseline | 27/27, exit0 |
| Full server unit/coverage | 772/772, 97 suites, exit0 |
| R09 native isolated verification | 12/12, exit0 |
| Final full native API | 183/183, 20 suites, environment guards2/2, detectOpenHandles, exit0 |
| Full server lint, production build | exit0 |
| Existing CI audit allowlist gate | exit0; unchanged allowlist |
| Prisma generation helper | 4/4, exit0 |
| CI workflow actionlint | exit0 using the existing image ID, network disabled, no pull |

All-source server coverage is **55.69% lines, 47.28% branches, 49.97% functions, 54.87% statements**. The scope and thresholds are unchanged. No new client/browser/full-stack/container verification is claimed for this test-only patch; earlier runs remain tied to their original snapshots. Remote GitHub Actions has not run the uncommitted tree.

## Intermediate native failure remains visible

The initial full-native run returned **181 passed / 2 failed**. R09's author/admin mutation test exceeded its unchanged five-second test budget, followed by an ECONNRESET in a permission-revocation test. At that point the compiler negative control and index refresh had also been running. That timing is an observation, not proof of the failure's cause.

No retry/timeout/assertion setting or production method was changed after that failure. R09 alone passed **12/12**; a subsequent complete native run, performed sequentially without those other tasks, passed **183/183**. The initial failure logs and result JSON remain in evidence. These results establish the final local gate outcome, not a claim that the R09 suite can no longer be timing-sensitive or flaky. Its emitted JavaScript was unchanged by the array annotation correction.

## Review and cleanup

Self-review checked the narrow baseline diff, compiler options/source inclusion, assertion preservation, production/lockfile hashes, fixture ownership and cleanup. No independent reviewer completion is claimed.

OOP/SOLID: the existing Express, Jest and strategy type contracts describe fixture surfaces; no production contract was broadened to fit a mock. KISS/DRY/YAGNI: reuse Parameters/ReturnType and existing installed tooling; no mock library, compiler plugin, framework, duplicate policy or generic harness was introduced. Existing lifecycle/transaction/cleanup nesting remains unchanged. C01/C04/C08/C10 cover typed invariants, owned job cleanup, behavioral regression and CI compatibility; security/data/money cases remain in the full native suite. No performance or scale claim is made.

Fixtures reused existing pinned image IDs with `--pull never`, only loopback ports, and tmpfs data directories. Post-test database checks returned zero User/Connection/Organization/Payment/BillingSubscription rows; Docker teardown removed only the four owned containers and network. All **19 pre-existing volumes**, original image tags and other-project containers were preserved; **zero new volumes** were created. No dependency checkout was installed or copied during this package.

Final cumulative GitNexus counts and current source hashes are in the manifest. The risk remains CRITICAL for the preserved R00–R14 work; it is an integration warning, not a new runtime failure.

## Roadmap status

The inherited test-source TypeScript blocker is closed locally and guarded in CI configuration. R10 overall remains VERIFIED_LOCAL until its remote/SHA acceptance is established. R13 still requires an approved entitlement/lifecycle matrix. R14 remains DOING_BOUNDED for undecided typed-write, CSV NULL, resume, scale/provider and manual acceptance boundaries. This package does not approve product policies or turn local gates into release/deployment evidence.
