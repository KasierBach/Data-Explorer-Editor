# Data Explorer – Tree View Comparison Report

> So sánh chi tiết Tree View (SQL + NoSQL) của Data Explorer với các DB tool phổ biến: **pgAdmin 4**, **DataGrip**, **Navicat**, **Supabase**, **DBeaver**, **MongoDB Compass**, **TablePlus**, **HeidiSQL**

---

## 1. Tổng quan kiến trúc Tree View hiện tại

### SQL Tree ([`ExplorerSidebar.tsx`](../client/src/presentation/modules/Explorer/ExplorerSidebar.tsx))
- **Hierarchy**: Connection → Database → Schema → Folder (Tables/Views/Functions) → Table/View/Function → Column
- **Lazy loading**: Mỗi node load children on-demand qua [`useDatabaseHierarchy()`](../client/src/presentation/hooks/useDatabase.ts:15)
- **Context menu** ([`SidebarContextMenu.tsx`](../client/src/presentation/modules/Explorer/SidebarContextMenu.tsx)): SELECT TOP 1000, Count Rows, Script As (SELECT/INSERT/UPDATE/DELETE/CREATE/DROP), Design Table, Copy Name, Truncate, Drop
- **Search**: Local filter + Global search (Redis hybrid search với AI suggestions)
- **Connection selector** ([`ConnectionSelector.tsx`](../client/src/presentation/modules/Explorer/ConnectionSelector.tsx)): Dropdown với DB-type icons, health check, share connection
- **Supported DBs**: PostgreSQL, MySQL, MSSQL, ClickHouse

### NoSQL Tree ([`NoSqlSidebar.tsx`](../client/src/presentation/modules/NoSqlExplorer/NoSqlSidebar.tsx))
- **Hierarchy**: Connection → Database → Collection
- **Reuses** [`TreeNodeItem`](../client/src/presentation/modules/Explorer/TreeNodeItem.tsx) component
- **Context menu**: Refresh, Drop Collection
- **Supported DBs**: MongoDB, MongoDB+SRV, Redis
- **Views**: Grid, JSON Tree, Visualize (charts), Schema Analysis, Aggregation Builder

---

## 2. Bảng so sánh chi tiết

### 2.1 SQL Tree View – Hierarchy & Navigation

| Feature | Data Explorer | pgAdmin 4 | DataGrip | Navicat | DBeaver | Supabase | TablePlus | HeidiSQL |
|---|---|---|---|---|---|---|---|---|
| **Connection → DB → Schema → Table** | ✅ Full hierarchy | ✅ | ✅ | ✅ | ✅ | ✅ (Schema only) | ✅ | ✅ |
| **Lazy load children** | ✅ On-demand | ❌ Load all | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Expand/Collapse all** | ❌ Missing | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Drag & drop** | ❌ | ❌ | ✅ (Drag table to editor) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Multi-select nodes** | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Pin/favorite tables** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Recently used** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Filter by type** | ❌ (search only) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Breadcrumb navigation** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Vertical guide lines** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Active DB indicator** | ✅ Badge "ACTIVE" | ❌ | ✅ Bold | ✅ Highlight | ✅ | ✅ | ✅ | ❌ |

### 2.2 SQL Tree View – Context Menu Actions

| Action | Data Explorer | pgAdmin 4 | DataGrip | Navicat | DBeaver | Supabase | TablePlus | HeidiSQL |
|---|---|---|---|---|---|---|---|---|
| **SELECT TOP N rows** | ✅ TOP 1000 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Count rows** | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Script: SELECT** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Script: INSERT** | ✅ Template | ✅ | ✅ Real data | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Script: UPDATE** | ✅ Template | ✅ | ✅ Real data | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Script: DELETE** | ✅ Template | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Script: CREATE TABLE** | ✅ Template | ✅ | ✅ Full DDL | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Script: DROP** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Script with real column data** | ❌ Generic templates | ❌ | ✅ **Best** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Copy name** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Copy qualified name** | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Copy CREATE statement** | ❌ (template only) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Design/Alter table** | ✅ Basic | ✅ | ✅ | ✅ Full | ✅ | ✅ | ✅ | ✅ |
| **Truncate table** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Drop table** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Rename table** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Duplicate table** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Export data** | ❌ (separate) | ✅ | ✅ | ✅ **Best** | ✅ | ✅ | ✅ | ✅ |
| **Import data** | ❌ (separate) | ✅ | ✅ | ✅ **Best** | ✅ | ✅ | ❌ | ✅ |
| **View data as chart** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Compare tables** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Generate test data** | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

### 2.3 SQL Tree View – Column-level Features

| Feature | Data Explorer | pgAdmin 4 | DataGrip | Navicat | DBeaver | TablePlus |
|---|---|---|---|---|---|---|
| **Show columns under table** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Column type icons** | ✅ PK icon | ❌ | ✅ Rich | ❌ | ✅ | ✅ |
| **Column data type display** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Column nullable indicator** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Column default value** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Column comment** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **FK indicator in tree** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Index node** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Trigger node** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Constraint node** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Partition node** | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Rule/Policy node** | ❌ | ✅ (RLS) | ✅ | ❌ | ✅ | ❌ |

### 2.4 NoSQL Tree View – MongoDB Features

| Feature | Data Explorer | MongoDB Compass | Navicat for MongoDB | Studio 3T | NoSQLBooster | TablePlus |
|---|---|---|---|---|---|---|
| **Database → Collection tree** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Schema analysis** | ✅ Sampling-based | ✅ **Best** | ✅ | ✅ | ✅ | ❌ |
| **Aggregation builder** | ✅ Visual stages | ✅ | ✅ | ✅ **Best** | ✅ | ❌ |
| **JSON tree view** | ✅ Recursive | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Grid view** | ✅ Flat | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Visualize/Charts** | ✅ Basic | ✅ **Best** | ✅ | ❌ | ❌ | ❌ |
| **Query editor (MQL)** | ✅ Monaco JSON | ✅ | ✅ SQL-like | ✅ **Best** | ✅ | ❌ |
| **Index management** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Validation rules** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Explain plan** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Document insert/edit** | ❌ (query only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Collection stats** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Create collection options** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Export collection** | ❌ | ✅ JSON/CSV | ✅ | ✅ **Best** | ✅ | ❌ |
| **Import to collection** | ❌ | ✅ | ✅ | ✅ **Best** | ✅ | ❌ |

### 2.5 Search & Discovery

| Feature | Data Explorer | pgAdmin 4 | DataGrip | Navicat | DBeaver | Supabase |
|---|---|---|---|---|---|---|
| **Local tree filter** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Global search (cross-connection)** | ✅ Redis-based | ❌ | ✅ | ❌ | ✅ | ❌ |
| **AI-powered search** | ✅ Hybrid AI + Index | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Search by column name** | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Search in data** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Search history** | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Jump to definition** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

### 2.6 Connection Management

| Feature | Data Explorer | pgAdmin 4 | DataGrip | Navicat | DBeaver | Supabase |
|---|---|---|---|---|---|---|
| **Multi-DB type support** | ✅ PG/MySQL/MSSQL/CH/Mongo/Redis | ✅ PG only | ✅ **All** | ✅ **All** | ✅ **All** | ✅ PG only |
| **Connection health check** | ✅ Auto + Manual | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Connection sharing** | ✅ Team sharing | ❌ | ❌ | ❌ | ❌ | ✅ |
| **SSH tunnel** | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **SSL/TLS config** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Color-coded connections** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Connection groups/folders** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Auto-reconnect** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Read-only mode** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Safety controls** | ✅ (allowSchemaChanges, allowImportExport, allowQueryExecution) | ❌ | ✅ | ❌ | ✅ | ❌ |

---

## 3. Điểm mạnh của Data Explorer (Unique/Best-in-class)

| # | Feature | Chi tiết |
|---|---|---|
| 1 | **AI-powered global search** | Redis hybrid search kết hợp AI suggestions – không tool nào có |
| 2 | **Cross-connection search** | Tìm kiếm table/view/collection qua tất cả connections cùng lúc |
| 3 | **Connection sharing** | Share connection với team members – unique cho web-based tool |
| 4 | **Safety controls** | `readOnly`, `allowSchemaChanges`, `allowImportExport`, `allowQueryExecution` – fine-grained permissions |
| 5 | **Auto health check** | Tự động check health khi chọn connection, hiển thị latency |
| 6 | **Modern UI/UX** | Vertical guide lines, active DB badge, smooth animations, dark/light theme |
| 7 | **NoSQL schema analysis** | Sampling-based schema discovery với type probability – comparable to Compass |
| 8 | **Visual aggregation builder** | Drag-and-drop pipeline stages cho MongoDB |
| 9 | **Multi-workspace** | SQL và NoSQL workspace riêng biệt, cùng lúc |
| 10 | **Web-based** | Không cần cài đặt, truy cập từ bất cứ đâu |

---

## 4. Điểm yếu / Missing Features (so với đối thủ)

### 🔴 Critical Missing (ảnh hưởng lớn đến UX)

| # | Feature | Có trong | Mô tả |
|---|---|---|---|
| 1 | **Expand/Collapse All** | DataGrip, DBeaver, Navicat | Không thể expand/collapse toàn bộ tree cùng lúc |
| 2 | **Script with real column data** | DataGrip, Navicat, DBeaver | INSERT/UPDATE chỉ có generic template, không dùng column names thực từ metadata |
| 3 | **Column metadata in tree** | Tất cả | Không hiển thị data type, nullable, default value, comment ở column node |
| 4 | **Index/Trigger/Constraint/Partition nodes** | pgAdmin, DataGrip, DBeaver | Không có node cho database objects quan trọng |
| 5 | **Document insert/edit (NoSQL)** | Compass, Studio 3T | Không thể thêm/sửa document trực tiếp, chỉ qua query |
| 6 | **Explain plan (NoSQL)** | Compass, Studio 3T | Không có explain plan cho MongoDB queries |
| 7 | **Index management (NoSQL)** | Compass, Studio 3T, NoSQLBooster | Không thể tạo/xem/quản lý indexes |

### 🟡 Important Missing (giảm productivity)

| # | Feature | Có trong | Mô tả |
|---|---|---|---|
| 8 | **Copy CREATE statement (real DDL)** | DataGrip, DBeaver, pgAdmin | Chỉ có template, không generate DDL thực từ schema |
| 9 | **Rename table** | DataGrip, Navicat, DBeaver | Không có rename trong context menu |
| 10 | **Duplicate table** | pgAdmin, DataGrip, Navicat | Không có duplicate table structure/data |
| 11 | **Drag & drop to editor** | DataGrip, DBeaver | Không thể kéo table vào editor để generate SELECT |
| 12 | **Pin/favorite tables** | DataGrip, DBeaver, TablePlus | Không có bookmark/favorite cho tables hay dùng thường |
| 13 | **Filter by object type** | pgAdmin, DataGrip, DBeaver | Không có toggle ẩn/hiện Tables/Views/Functions |
| 14 | **Connection color coding** | DataGrip, Navicat, DBeaver | Không có màu phân biệt connection (nguyễn nhầm lẫn) |
| 15 | **Connection groups/folders** | pgAdmin, DataGrip, Navicat | Không thể group connections vào thư mục |
| 16 | **Collection stats (NoSQL)** | Compass, Studio 3T | Không hiển thị document count, avg size, indexes |
| 17 | **Export/Import (NoSQL)** | Compass, Studio 3T | Không có export JSON/CSV hay import data |

### 🟢 Nice-to-have Missing

| # | Feature | Có trong | Mô tả |
|---|---|---|---|
| 18 | **Breadcrumb navigation** | DataGrip | Không có breadcrumb cho deep hierarchy |
| 19 | **Recently used tables** | DataGrip, TablePlus | Không có section "Recent" |
| 20 | **Multi-select nodes** | DataGrip, DBeaver | Không thể chọn nhiều nodes cùng lúc |
| 21 | **Search in data** | DataGrip, Navicat, DBeaver | Không có full-text search trong data |
| 22 | **Search by column name** | DataGrip, DBeaver | Global search chỉ tìm table/view, không tìm column |
| 23 | **Compare tables** | DataGrip, Navicat, DBeaver | Không có table diff |
| 24 | **Generate test data** | DataGrip, DBeaver | Không có fake data generation |
| 25 | **Validation rules (MongoDB)** | Compass | Không quản lý collection validators |
| 26 | **Create collection options** | Compass, Studio 3T | Không có capped collection, time series options |

---

## 5. Đề xuất cải thiện (Priority Order)

### Phase 1 – Critical (2-3 weeks)

1. **Expand/Collapse All buttons** – Thêm 2 nút ở header: expand all / collapse all
2. **Real column metadata in tree** – Hiển thị data type badge, nullable indicator, PK/FK icon cho mỗi column
3. **Script with real column data** – Khi Script INSERT/UPDATE, dùng column names thực từ `TableMetadata` thay vì generic `column1, column2`
4. **Copy real CREATE DDL** – Generate DDL từ server metadata thay vì template
5. **Index/Trigger/Constraint nodes** – Thêm folder nodes cho Indexes, Triggers, Constraints dưới mỗi table

### Phase 2 – Important (3-4 weeks)

6. **Document insert/edit (NoSQL)** – Form-based document editor cho MongoDB
7. **Explain plan (NoSQL)** – Visual explain plan cho MongoDB aggregation/find
8. **Index management (NoSQL)** – Xem, tạo, xóa indexes
9. **Rename/Duplicate table** – Context menu actions
10. **Filter by object type** – Toggle buttons: Tables / Views / Functions / Procedures
11. **Connection color coding** – Màu cho mỗi connection, hiển thị ở selector và tree root
12. **Drag & drop to editor** – Kéo table → editor, tự generate SELECT

### Phase 3 – Nice-to-have (2-3 weeks)

13. **Pin/favorite tables** – Section "Favorites" ở đầu tree
14. **Recently used** – Section "Recent" với 5-10 tables gần nhất
15. **Connection groups** – Folder/group connections
16. **Collection stats (NoSQL)** – Document count, size, index count
17. **Search by column name** – Mở rộng global search
18. **Breadcrumb navigation** – Cho deep schema hierarchies

---

## 6. Kết luận

Data Explorer có **nền tảng tree view vững chắc** với lazy loading, context menu phong phú, và đặc biệt là **AI-powered global search** – tính năng độc nhất so với tất cả đối thủ. Tuy nhiên, so với các DB tool lâu năm như DataGrip hay DBeaver, vẫn còn thiếu nhiều **tính năng chi tiết** mà power users mong đợi:

- **SQL side**: Column metadata display, real DDL scripting, Index/Trigger/Constraint nodes, drag & drop
- **NoSQL side**: Document CRUD, explain plan, index management, collection stats

Ưu tiên nên tập trung vào **Phase 1** trước vì những tính năng đó ảnh hưởng trực tiếp đến daily workflow của users. Phase 2 (đặc biệt NoSQL document editing và explain plan) sẽ đưa Data Explorer lên ngang tầm MongoDB Compass. Phase 3 là competitive features so với DataGrip/DBeaver.
