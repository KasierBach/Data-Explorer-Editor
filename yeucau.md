# Data Explorer

---

## 1. Yêu cầu Hệ thống

Hệ thống cần mô phỏng trải nghiệm của các công cụ desktop như DataGrip hay Navicat, tập trung vào 3 yếu tố cốt lõi:

1. **Tính bảo mật:** Phân quyền sâu (RBAC) để người dùng chỉ thấy các Connection/Database được phép.
2. **Tính phản hồi (Responsiveness):** Thao tác mượt mà khi chuyển đổi giữa các bảng và schema.
3. **Khả năng mở rộng:** Dễ dàng thêm các loại Database mới (PostgreSQL, MySQL, ClickHouse...) mà không làm thay đổi cấu trúc Frontend.

---

## 2. Phân rã Chức năng

### A. Module Xác thực & Phân quyền (Auth & RBAC)

- **Đăng nhập/Đăng xuất:** Tích hợp SSO hoặc JWT.
- **Lấy danh sách quyền:** Gọi API để xác định người dùng có quyền truy cập vào những Connection ID nào.
- **Middleware bảo vệ:** Chặn truy cập trái phép vào các route hoặc connection cụ thể.

### B. Module Điều hướng (Explorer Sidebar)

Đây là "trái tim" của các công cụ DB, thường được tổ chức theo cấu trúc cây (Tree View):

- **Connection List:** Hiển thị các kết nối (Production, Staging, Dev).
- **Database/Schema Tree:**
    - Cấp 1: Database.
    - Cấp 2: Schemas (nếu có, ví dụ PostgreSQL).
- **Bộ lọc nhanh:** Ô tìm kiếm để lọc tên bảng hoặc database ngay trong sidebar.

### C. Module Duyệt dữ liệu (Data Browser)

- **Data Grid:** Hiển thị dữ liệu dưới dạng bảng (sử dụng ảo hóa - Virtualized List để handle hàng nghìn row).
- **Tính năng Table:**
    - **Pagination:** Phân trang từ phía Server.
    - **Sorting & Filtering:** Sắp xếp và lọc dữ liệu theo cột.
    - **Metadata View:** Xem cấu trúc bảng (cột, kiểu dữ liệu, index, khóa ngoại).
- **Tabs Management:** Cho phép mở nhiều bảng cùng lúc dưới dạng các tab (giống DataGrip).

---

## 3. Kiến trúc Công nghệ (Technical Stack Mapping)

Sử dụng bộ công cụ bạn đã chọn để giải quyết các bài toán cụ thể:

| **Thành phần** | **Công nghệ** | **Vai trò cụ thể** |
| --- | --- | --- |
| **Framework** | **React + Vite** | Khởi tạo dự án nhanh, HMR (Hot Module Replacement) cực tốc độ khi phát triển. |
| **State Management** | **Zustand** | Quản lý trạng thái UI: `activeConnectionId`, `activeDatabase`, `openTabs`, trạng thái đóng/mở sidebar. |
| **Server State** | **React Query** | Quản lý việc fetch danh sách DB, Tables và dữ liệu bảng. Tự động cache kết quả để không phải load lại khi chuyển tab. |
| **UI Components** | **Ant Design / Shadcn/ui** | Sử dụng các component Tree, Table, Tabs và Splitter (để resize sidebar). |
| **Data Grid** | **TanStack Table** | Kết hợp với React Query để xử lý logic sorting/filtering/pagination cực mạnh. |

---

## 4. Mô hình Luồng dữ liệu (Data Flow)

1. **Giai đoạn Khởi tạo:** * `React Query` gọi API lấy danh sách Resource.
    - `Zustand` lưu trữ Connection được chọn mặc định.
2. **Giai đoạn Điều hướng:** * Người dùng click vào 1 Database -> `React Query` fetch danh sách Tables của DB đó và cache lại.
3. **Giai đoạn Hiển thị:** * Click vào Table -> Mở một Tab mới trong `Zustand` -> `React Query` fetch 50 dòng đầu tiên của Table đó để hiển thị lên Grid.

---