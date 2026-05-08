# 🔍 Data Explorer — SQL & NoSQL Feature Gap Analysis

**Ngày**: 2026-05-07 | **So sánh với**: DBeaver, DataGrip, pgAdmin, Studio 3T, MongoDB Compass

---

## 📊 SQL Features — Hiện có vs. Thiếu

### ✅ Đã có (Good coverage)

| Feature | Chi tiết | File |
|---------|----------|------|
| Query execution | Limit/offset pagination, caching, guardrails | [`query.service.ts`](server/src/query/query.service.ts) |
| Schema browsing | Databases, schemas, tables, views, functions, columns | [`IDatabaseStrategy`](server/src/database-strategies/database-strategy.interface.ts:105) |
| CRUD operations | Insert, update, delete rows | [`IDatabaseStrategy`](server/src/database-strategies/database-strategy.interface.ts:94) |
| Schema operations | Add/drop/alter column, add/drop PK/FK, rename column | [`schema-operations.types.ts`](server/src/query/dto/schema-operations.types.ts) |
| Create/drop database | Supported | [`IDatabaseStrategy`](server/src/database-strategies/database-strategy.interface.ts:102) |
| Bulk import | JSON data import | [`IDatabaseStrategy.importData()`](server/src/database-strategies/database-strategy.interface.ts:116) |
| Export stream | Streaming for migration | [`IDatabaseStrategy.exportStream()`](server/src/database-strategies/database-strategy.interface.ts:117) |
| Query guards | Read-only, multi-statement, destructive SQL detection | [`query-guard.util.ts`](server/src/query/query-guard.util.ts) |
| Explain plan | Basic support | [`useExplainPlan.ts`](client/src/presentation/modules/Query/hooks/useExplainPlan.ts) |
| Saved queries | CRUD with folders/tags | [`saved-queries.service.ts`](server/src/saved-queries/saved-queries.service.ts) |
| Query history | Per-session tracking | Client-side store |
| AI assistant | SQL generation, schema-aware autocomplete | [`ai.service.ts`](server/src/ai/ai.service.ts) |
| Monaco editor | Schema-aware IntelliSense | [`SqlEditor.tsx`](client/src/presentation/components/code-editor/SqlEditor.tsx) |
| Data grid | Inline editing, filtering, sorting | [`DataGrid.tsx`](client/src/presentation/modules/DataGrid/DataGrid.tsx) |
| Export | CSV, JSON, SQL | [`DataGridExport.ts`](client/src/presentation/modules/DataGrid/DataGridExport.ts) |
| Table designer | Visual column management | [`TableDesigner.tsx`](client/src/presentation/modules/DataGrid/TableDesigner.tsx) |
| ERD visualization | Auto-layout with React Flow | [`ERDWorkspace/`](client/src/presentation/modules/Visualization/ERDWorkspace) |
| Migration | Cross-database data transfer | [`migration.service.ts`](server/src/migration/migration.service.ts) |
| Database metrics | Table count, size, connections | [`IDatabaseStrategy.getDatabaseMetrics()`](server/src/database-strategies/database-strategy.interface.ts:114) |
| Relationships | FK detection | [`IDatabaseStrategy.getRelationships()`](server/src/database-strategies/database-strategy.interface.ts:113) |
| Index info | View indexes per table | [`FullTableMetadata.indices`](server/src/database-strategies/database-strategy.interface.ts:30) |
| SSH tunnel | Secure connections | [`ssh-tunnel.service.ts`](server/src/connections/ssh-tunnel.service.ts) |
| Connection health | Latency, status tracking | [`checkHealth()`](server/src/connections/connections.service.ts) |

### ❌ Thiếu quan trọng (High Priority Gaps)

| # | Feature | DBeaver | DataGrip | pgAdmin | Mức ưu tiên |
|---|---------|---------|----------|---------|-------------|
| 1 | **Index Management UI** — Create/drop indexes visually | ✅ | ✅ | ✅ | 🔴 High |
| 2 | **View Management** — Create/edit/drop views | ✅ | ✅ | ✅ | 🔴 High |
| 3 | **Stored Procedure Editor** — Edit & execute functions/procedures | ✅ | ✅ | ✅ | 🔴 High |
| 4 | **Trigger Management** — Browse/create/drop triggers | ✅ | ✅ | ✅ | 🟡 Medium |
| 5 | **Constraint Management** — Unique, check, default constraints | ✅ | ✅ | ✅ | 🔴 High |
| 6 | **Transaction Control** — BEGIN/COMMIT/ROLLBACK UI | ✅ | ✅ | ✅ | 🟡 Medium |
| 7 | **Schema Diff/Compare** — Visual diff between two schemas | ✅ | ✅ | ✅ | 🔴 High |
| 8 | **DDL Generation** — "Generate CREATE script" for any object | ✅ | ✅ | ✅ | 🔴 High |
| 9 | **Backup/Restore** — pg_dump/mysqldump integration | ✅ | ❌ | ✅ | 🟡 Medium |
| 10 | **User/Role Management** — Database user CRUD | ✅ | ✅ | ✅ | 🟡 Medium |

### ❌ Thiếu bổ sung (Medium Priority Gaps)

| # | Feature | Mô tả | Mức ưu tiên |
|---|---------|-------|-------------|
| 11 | **Global Data Search** — Search across all tables' data | DBeaver có "Search" tab | 🟡 Medium |
| 12 | **BLOB/CLOB Viewer** — Xem binary data (images, PDFs) | DBeaver có built-in viewer | 🟡 Medium |
| 13 | **Visual Explain Plan** — Tree/graph visualization thay vì raw JSON | DataGrip có visual plan | 🟡 Medium |
| 14 | **Table Partitioning** — Manage partitions (PG declarative partitioning) | pgAdmin có partition manager | 🟢 Low |
| 15 | **Comment/Description Editing** — Sửa table/column comments | DBeaver hỗ trợ | 🟢 Low |
| 16 | **Data Generation** — Fill tables with random/test data | DataGrip có data generator | 🟢 Low |
| 17 | **Maintenance Operations** — VACUUM, ANALYZE, REINDEX | pgAdmin có | 🟢 Low |
| 18 | **Lock/Session Monitoring** — Xem active locks & sessions | pgAdmin có dashboard | 🟢 Low |
| 19 | **Grant Wizard** — Visual permission management | pgAdmin có | 🟢 Low |
| 20 | **Refactoring** — Rename table/column across all usages | DataGrip có | 🟢 Low |
| 21 | **Import from File** — CSV/JSON file upload to table | DBeaver có wizard | 🟡 Medium |
| 22 | **Copy Table** — Duplicate table structure + data | DBeaver có | 🟢 Low |
| 23 | **SQL Formatter** — Có nhưng chỉ basic | DataGrip có advanced formatting | 🟢 Low |
| 24 | **Database Diagram** — Auto-generate diagram from schema | DBeaver/DataGrip có | 🟡 Medium |
| 25 | **Query Tabs** — Multi-tab queries (có nhưng cần cải thiện) | DataGrip có unlimited tabs | 🟢 Low |

---

## 📊 NoSQL/MongoDB Features — Hiện có vs. Thiếu

### ✅ Đã có (Good coverage)

| Feature | Chi tiết | File |
|---------|----------|------|
| Connection | MongoDB + MongoDB Atlas (SRV) | [`MongoDbStrategy`](server/src/database-strategies/mongodb.strategy.ts) |
| Database/collection browsing | Tree hierarchy | [`NoSqlSidebar.tsx`](client/src/presentation/modules/NoSqlExplorer/NoSqlSidebar.tsx) |
| MQL editor | Monaco-based JSON query editor | [`MqlEditor.tsx`](client/src/presentation/modules/NoSqlExplorer/MqlEditor.tsx) |
| CRUD actions | find, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany | [`MongoDbStrategy.executeQuery()`](server/src/database-strategies/mongodb.strategy.ts:94) |
| Aggregation | aggregate pipeline + visual builder | [`NoSqlAggregationBuilderView.tsx`](client/src/presentation/modules/NoSqlExplorer/NoSqlAggregationBuilderView.tsx) |
| Count & distinct | countDocuments, distinct | [`MongoDbStrategy.executeQuery()`](server/src/database-strategies/mongodb.strategy.ts:128) |
| Schema analysis | Sampling-based field inference with stats | [`NoSqlSchemaAnalysisView.tsx`](client/src/presentation/modules/NoSqlExplorer/NoSqlSchemaAnalysisView.tsx) |
| Grid view | Table-style data display | [`NoSqlGridView.tsx`](client/src/presentation/modules/NoSqlExplorer/NoSqlGridView.tsx) |
| JSON tree view | Recursive collapsible JSON | [`JsonTreeView.tsx`](client/src/presentation/modules/NoSqlExplorer/JsonTreeView.tsx) |
| Visualization | Bar/pie/line charts | [`NoSqlVisualizeView.tsx`](client/src/presentation/modules/NoSqlExplorer/NoSqlVisualizeView.tsx) |
| Index viewing | List indexes per collection | [`getFullMetadata()`](server/src/database-strategies/mongodb.strategy.ts:399) |
| Relationship inference | Heuristic-based FK detection | [`getRelationships()`](server/src/database-strategies/mongodb.strategy.ts:424) |
| Database metrics | Collection count, size | [`getDatabaseMetrics()`](server/src/database-strategies/mongodb.strategy.ts:476) |
| Bulk import | insertMany | [`importData()`](server/src/database-strategies/mongodb.strategy.ts:236) |
| NoSQL guardrails | Read-only, action restrictions | [`query-guard.util.ts`](server/src/query/query-guard.util.ts) |
| NoSQL sanitizer | Prevent NoSQL injection | [`nosql-sanitizer.util.ts`](server/src/common/utils/nosql-sanitizer.util.ts) |

### ❌ Thiếu quan trọng (High Priority Gaps)

| # | Feature | Compass | Studio 3T | Mức ưu tiên |
|---|---------|---------|-----------|-------------|
| 1 | **Index Management UI** — Create/drop/compose indexes visually | ✅ | ✅ | 🔴 High |
| 2 | **Explain Plan** — MongoDB explain() with visual output | ✅ | ✅ | 🔴 High |
| 3 | **Validation Rules** — Manage collection schema validation | ✅ | ✅ | 🔴 High |
| 4 | **Aggregation Stage Preview** — Preview results per stage | ✅ | ✅ | 🔴 High |
| 5 | **Collection Stats** — $collStats with storage/index details | ✅ | ✅ | 🟡 Medium |
| 6 | **Bulk Write Operations** — bulkWrite() with ordered/unordered | ❌ | ✅ | 🟡 Medium |
| 7 | **Data Compare/Sync** — Compare collections between environments | ❌ | ✅ | 🟡 Medium |
| 8 | **Import from File** — JSON/CSV file upload to collection | ✅ | ✅ | 🔴 High |

### ❌ Thiếu bổ sung (Medium/Low Priority Gaps)

| # | Feature | Mô tả | Mức ưu tiên |
|---|---------|-------|-------------|
| 9 | **Change Streams** — Real-time change stream viewer | Compass không có, custom tools có | 🟡 Medium |
| 10 | **Replica Set Status** — View replica set topology | ✅ Compass | 🟡 Medium |
| 11 | **Sharding Status** — View shard distribution | ✅ Compass | 🟢 Low |
| 12 | **Oplog Viewer** — Browse oplog entries | Custom tools | 🟢 Low |
| 13 | **User/Role Management** — MongoDB user CRUD | ✅ Compass | 🟡 Medium |
| 14 | **SQL-to-MQL Translation** — Convert SQL → MongoDB query | ❌ | Studio 3T ✅ | 🟡 Medium |
| 15 | **Code Generation** — Generate query code (Node, Python, Java) | ❌ | Studio 3T ✅ | 🟢 Low |
| 16 | **Time Series Collections** — Create/manage time series | ✅ Compass | 🟢 Low |
| 17 | **Search Indexes** — Atlas Search index management | ✅ Compass | 🟢 Low |
| 18 | **GridFS Browser** — View GridFS files | ❌ | Studio 3T ✅ | 🟢 Low |
| 19 | **Transaction Support** — Multi-document transactions UI | ❌ | ❌ | 🟢 Low |
| 20 | **Connection Pool Monitoring** — View active connections | ❌ | ❌ | 🟢 Low |
| 21 | **Collation Support** — Specify collation per query | ✅ Compass | 🟢 Low |
| 22 | **Read Preference** — Choose read preference (primary/secondary) | ✅ Compass | 🟡 Medium |
| 23 | **Write Concern** — Configure write concern per operation | ❌ | Studio 3T ✅ | 🟢 Low |
| 24 | **Collection Rename/Drop** — UI for rename/drop collection | ✅ Compass | 🔴 High |
| 25 | **Document Validation** — Visual document validator | ✅ Compass | 🟡 Medium |

---

## 🎯 Top 10 Features Nên Implement Tiếp

### 🔴 SQL — Critical

1. **Index Management UI** — Visual create/drop indexes với options (unique, partial, expression)
   - Thêm `createIndex()` / `dropIndex()` vào `IDatabaseStrategy`
   - UI: Tab "Indexes" trong TableDesigner

2. **View Management** — Create/edit/drop SQL views
   - Thêm `createView()` / `dropView()` vào `IDatabaseStrategy`
   - UI: Dialog tạo view với SQL editor

3. **Schema Diff** — So sánh schema giữa 2 databases/connections
   - Tận dụng `MigrationComparisonService` đã có
   - UI: Side-by-side diff view

4. **DDL Generation** — Generate CREATE script cho bất kỳ object
   - Thêm `generateDDL()` vào strategy
   - UI: Right-click → "Generate DDL"

5. **Constraint Management** — Unique, check, default constraints
   - Mở rộng `SchemaOperation` types
   - UI: Tab "Constraints" trong TableDesigner

### 🔴 NoSQL — Critical

6. **MongoDB Explain Plan** — explain() với visual output
   - Thêm action `explain` vào `MongoDbStrategy.executeQuery()`
   - UI: Visual plan tree (tương tự SQL explain)

7. **Index Management UI** — Create/drop MongoDB indexes
   - Thêm `createIndex()` / `dropIndex()` vào `MongoDbStrategy`
   - UI: Index tab trong NoSqlSidebar

8. **Collection Management** — Rename/drop/create collections
   - Thêm `renameCollection()` / `dropCollection()` vào `MongoDbStrategy`
   - UI: Context menu trên collection node

9. **Aggregation Stage Preview** — Preview kết quả từng stage
   - Chạy pipeline từng stage, cache intermediate results
   - UI: "Preview" button trên mỗi stage card

10. **File Import** — Import JSON/CSV files vào collection
    - Thêm `importFromFile()` endpoint
    - UI: Upload dialog với mapping options

---

## 📈 Feature Completeness Score

| Category | Hiện có | Tổng cần | % Complete |
|----------|---------|----------|------------|
| **SQL - Query** | 12 | 15 | 80% |
| **SQL - Schema** | 8 | 16 | 50% |
| **SQL - Data** | 7 | 12 | 58% |
| **SQL - Admin** | 3 | 10 | 30% |
| **NoSQL - Query** | 9 | 14 | 64% |
| **NoSQL - Schema** | 4 | 10 | 40% |
| **NoSQL - Data** | 5 | 10 | 50% |
| **NoSQL - Admin** | 2 | 8 | 25% |
| **Tổng** | **50** | **95** | **53%** |

### So sánh với competitors

| Tool | SQL Coverage | NoSQL Coverage | Đặc điểm mạnh |
|------|-------------|----------------|----------------|
| **Data Explorer** | 53% | 45% | AI assistant, modern UI, real-time collab |
| **DBeaver** | 85% | 30% | Comprehensive SQL, plugin-based |
| **DataGrip** | 90% | 20% | Smart refactoring, JetBrains ecosystem |
| **pgAdmin** | 75% | 0% | PostgreSQL-specific, deep admin |
| **Studio 3T** | 10% | 85% | Best MongoDB tool, SQL→MQL migration |
| **MongoDB Compass** | 0% | 75% | Official MongoDB GUI, schema analysis |

**Data Explorer có lợi thế độc nhất**: AI-powered SQL generation + modern collaborative UI. Không cần cover 100% features của DBeaver hay Studio 3T, nhưng nên fill các gap quan trọng nhất (index management, view management, explain plan) để trở thành tool "good enough" cho daily work.
