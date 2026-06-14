# Data Explorer Performance Baseline

## Scope

This report captures the first synthetic benchmark baseline for the current performance workstream.

The suite is intentionally local-only and safe:
- no live customer data
- no external database writes
- mocked driver and pool layers where practical
- measurements focused on service-path overhead, batching behavior, and memory shape

## Benchmarks

- `npm run bench:search`
- `npm run bench:query-window`
- `npm run bench:migration`

## Method

- `search-benchmark.mjs` exercises the current `SearchService.search()` keyword path with a mocked Redis `SMEMBERS` payload.
- `query-window-benchmark.mjs` exercises the current SQL strategy window path and Mongo aggregate path with mocked in-memory result sets.
- `migration-benchmark.mjs` exercises the current `MigrationService.runMigrationPipeline()` batching logic with a synthetic object stream.

## Result Snapshot

First local run completed on **June 13, 2026** on this workstation with:
- Node `v22.15.0`
- Platform `win32`
- Branch `codex-perf-baseline`

### Search baseline

Command:

```powershell
cd server
npm run bench:search
```

Measured synthetic keyword-path latency:

| Indexed objects | Avg | P95 | Returned rows | Notes |
| --- | ---: | ---: | ---: | --- |
| 1,000 | 1.179ms | 2.009ms | 50 | Full scan cost is still negligible at this size |
| 10,000 | 18.813ms | 24.455ms | 50 | Noticeable linear growth begins |
| 50,000 | 68.427ms | 85.095ms | 50 | Confirms current `SMEMBERS + JSON.parse + filter + sort` path scales poorly |

### Query window baseline

Command:

```powershell
cd server
npm run bench:query-window
```

Measured service-layer overhead:

| Scenario | Avg | P95 | Returned rows | Notes |
| --- | ---: | ---: | ---: | --- |
| SQL page 100 | 0.022ms | 0.077ms | 100 | Pure strategy overhead only, no live DB round-trip |
| SQL page 500 | 0.007ms | 0.039ms | 500 | Still trivial in synthetic mode |
| SQL raw capped 50,000 | 0.096ms | 0.130ms | 50,000 | Shows the current cap path is cheap when the result is already in memory |
| Mongo aggregate 5,000 | 1.099ms | 1.790ms | 5,000 | Includes full-array aggregate materialization in-process |
| Mongo aggregate 50,000 | 10.325ms | 12.104ms | 50,000 | Confirms aggregate cost rises with materialized payload size |

### Migration baseline

Command:

```powershell
cd server
npm run bench:migration
```

Measured coordinator throughput:

| Scenario | Duration | Rows/sec | Batches | Max batch size | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Narrow rows x 20,000 | 42.678ms | 468,629.914 | 10 | 2,000 | Reflects current stream + flush coordination only |
| Wide rows x 20,000 | 28.667ms | 697,663.873 | 10 | 2,000 | Counterintuitively faster because the target write path is mocked |

## Post-Optimization Snapshot

Follow-up local run completed on **June 13, 2026** after the first performance pass.

Ghi chú tiếng Việt: các số dưới đây vẫn là benchmark synthetic trong máy local. Chúng dùng để so sánh đường code trước/sau, không phải cam kết latency production hay throughput database thật.

Vietnamese note: các benchmark này không chạm dữ liệu production, không ghi vào database thật, và chủ yếu đo overhead của service path, cursor/batch behavior, cùng memory shape trong mock.

### Search after indexed lookup refactor

Command:

```powershell
cd server
npm run bench:search
```

| Indexed objects | Avg | P95 | Returned rows | Heap delta | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| 1,000 | 2.508ms | 8.369ms | 50 | 0.032 MiB | Small indexes remain cheap; timing noise dominates |
| 10,000 | 16.236ms | 25.862ms | 50 | -0.001 MiB | Lookup no longer owns a full serialized set scan in `SearchService` |
| 50,000 | 57.975ms | 76.827ms | 50 | 0.001 MiB | Improved from the initial 68.427ms avg / 85.095ms P95 run, but still synthetic and Redis-network-free |

Tiếng Việt: global search đã tách phần lưu trữ index ra `SearchIndexRepository` và dùng candidate lookup thay vì để service tự parse toàn bộ index lớn mỗi lần tìm. Đây là cải thiện thực tế về kiến trúc, còn số tuyệt đối vẫn cần đo lại với Redis thật khi deploy.

English: global search now delegates index storage and candidate lookup to `SearchIndexRepository`, so the service path no longer depends on parsing the entire user index for every query. The architecture is better; real deployment latency still needs live Redis measurement.

### Query window and NoSQL aggregate after cap cleanup

Command:

```powershell
cd server
npm run bench:query-window
```

| Scenario | Avg | P95 | Returned rows | Heap delta | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| SQL page 100 | 0.054ms | 0.166ms | 100 | -0.011 MiB | Explicit page/window path |
| SQL page 500 | 0.012ms | 0.067ms | 500 | 0 MiB | Explicit page/window path |
| SQL raw capped 50,000 | 0.202ms | 0.233ms | 50,000 | 0 MiB | Raw SQL remains protectively capped |
| Mongo aggregate 5,000 | 2.172ms | 3.535ms | 5,000 | 0.022 MiB | Aggregate path now uses cursor-style limiting in the strategy |
| Mongo aggregate 50,000 | 14.463ms | 15.199ms | 50,000 | 0 MiB | Synthetic mock reflects cursor limit/slice behavior, not live Mongo server cost |

Tiếng Việt: SQL table browsing giờ có `/query/table-window` riêng, có `limit`, `offset`, `appliedLimit`, `appliedOffset`, `limitSource`, và `countStatus`. Raw SQL vẫn bị guardrail tối đa 50,000 rows, nhưng UI/response nói rõ hơn thay vì gọi là "No Limit".

English: SQL table browsing now has a dedicated `/query/table-window` contract with explicit limit/offset and count metadata. Raw SQL is still bounded by a protective 50,000-row guardrail, but the response and UI describe that honestly.

Tiếng Việt: Mongo aggregate không còn đi theo đường `toArray()` không giới hạn rồi mới cắt kết quả. Strategy áp cap trên cursor trước khi materialize, trả `truncated`, `appliedLimit`, và `limitSource` để NoSQL UI có thể giải thích khi kết quả bị giới hạn.

English: Mongo aggregate no longer follows an unbounded `toArray()` path before trimming. The strategy applies a cursor cap before materialization and returns `truncated`, `appliedLimit`, and `limitSource` so the NoSQL UI can explain capped results.

### Migration after adaptive batch sizing

Command:

```powershell
cd server
npm run bench:migration
```

| Scenario | Duration | Rows/sec | Batches | Max batch size | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Narrow rows x 20,000 | 121.655ms | 164,399.191 | 10 | 2,000 | Coordinator overhead varies locally; narrow rows keep the larger batch size |
| Wide rows x 20,000 | 49.600ms | 403,224.181 | 14 | 1,500 | Wide-row heuristic reduces batch size instead of always using 2,000 |

Tiếng Việt: migration hiện có batch policy theo engine, số cột, kích thước row ước lượng, và retry khi lỗi batch có khả năng hồi phục. SQL Server import cũng chuyển từ insert từng row sang multi-row parameterized insert.

English: migration now uses an adaptive batch policy based on target engine, column count, estimated row width, and retryable batch failures. SQL Server import also moved from row-by-row inserts to a parameterized multi-row insert path.

## Current Operating Envelope

Tiếng Việt:

- Global search đã bớt phụ thuộc vào full scan ở service layer, nhưng chưa phải search engine phân tán.
- Grid browsing đã có server-side window rõ ràng; raw SQL vẫn có guardrail tối đa 50,000 rows.
- Mongo aggregate đã cap trước materialization; pipeline rất lớn vẫn nên được thu hẹp bằng `$match`, `$project`, hoặc `$limit`.
- Migration có batch sizing thích ứng; benchmark hiện vẫn đo coordinator/mock target, không đo throughput DB thật.
- Redis shared infrastructure đã có `SCAN` helper, presence dùng `HSCAN`, notifications partition theo user channel, và connection pool cleanup có soft pressure guardrail.

English:

- Global search is less tied to service-layer full scans, but it is not a distributed search engine.
- Grid browsing now uses an explicit server-side window; raw SQL still has a 50,000-row guardrail.
- Mongo aggregate caps before materialization; very large pipelines should still be narrowed with `$match`, `$project`, or `$limit`.
- Migration has adaptive batch sizing; the benchmark still measures coordinator/mock-target overhead, not real database write throughput.
- Shared Redis infrastructure now has a `SCAN` helper, presence uses `HSCAN`, notifications are partitioned by user channel, and connection pool cleanup has a soft pressure guardrail.

## Initial Read

- The first useful signal is the search curve. It grows roughly linearly with index size, which matches the current design of loading and parsing the full Redis set on every lookup.
- SQL page-window numbers are not yet a product-level performance claim. They only show that the local strategy wrapper itself is cheap when the database is not the bottleneck.
- Mongo aggregate results are more informative because they directly expose the in-memory materialization behavior we plan to change.
- Migration throughput is only a coordinator baseline. It is not a realistic database write benchmark until the target side includes real insert cost.

## What This Baseline Is Good For

- comparing search before and after removing the full-scan Redis path
- comparing Mongo aggregate before and after removing eager `toArray()` usage
- comparing migration coordinator overhead before and after adaptive batch changes
- detecting accidental regressions in service-level hot paths

## What This Baseline Is Not Good For

- claiming end-user query latency in production
- estimating database throughput on real PostgreSQL, MySQL, MongoDB, or SQL Server instances
- inferring concurrency limits for multi-user workloads
- comparing absolute DB engine performance across providers

## Next Focus

Based on the follow-up run, the next performance work should move toward live-system measurement:

1. Add live Redis benchmark mode for search with a disposable key prefix.
2. Add live database read benchmarks for PostgreSQL, MySQL, SQL Server, MongoDB, and ClickHouse with safe fixture data.
3. Add export/streaming work for arbitrary raw SQL when the user intentionally wants more than the protective result cap.
4. Add production-facing telemetry for pool pressure, query cap hits, migration retry downsizing, and NoSQL aggregate truncation.

## Caveats

- These numbers do not include live database round-trip time.
- These numbers do not represent production concurrency or real Redis network latency.
- They are still useful as a stable before/after baseline for refactors in this repo.
