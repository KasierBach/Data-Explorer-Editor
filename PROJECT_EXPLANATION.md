# HƯỚNG DẪN "SỐNG SÓT" VÀ LÀM CHỦ DỰ ÁN DATA EXPLORER
> [!IMPORTANT]
> Đây là tài liệu tóm tắt nhanh để bạn có thể trả lời Team Lead và nắm bắt dự án trong 15 phút.

## 1. TỔNG QUAN DỰ ÁN (MỤC TIÊU)
- **Tên dự án:** Data Explorer (v3.5.0)
- **Mục tiêu:** Một công cụ quản trị Database hiện đại, cho phép người dùng kỹ thuật và không kỹ thuật (non-tech) có thể tương tác với SQL/NoSQL thông qua AI.
- **Giá trị cốt lõi:**
    - Chat với Database (AI Assistant).
    - Tự động vẽ biểu đồ (Visualization).
    - Hỗ trợ đa nền tảng (MySQL, PostgreSQL, MongoDB).
    - Làm việc nhóm thời gian thực (Collaboration/Presence).

## 2. KIẾN TRÚC CÔNG NGHỆ (TECH STACK)
Hãy thuộc lòng các thành phần này:
- **Frontend:** React 19 + Vite (Nhanh nhất hiện nay).
- **Styling:** Tailwind CSS (Vite Plugin).
- **State Management:** Zustand (Thay thế cho Redux, nhẹ và nhanh hơn).
- **Data Fetching:** TanStack Query v5 (Quản lý cache và loading cực tốt).
- **Backend:** NestJS (Framework Node.js mạnh mẽ nhất, dùng kiến trúc Module-based).
- **ORM (Database Layer):** Prisma (Giúp code tương tác với DB như đang dùng Object).
- **Deployment:** Docker & Docker Compose.

## 3. CÁCH HỆ THỐNG VẬN HÀNH (LUỒNG DỮ LIỆU)
Khi sếp hỏi "Dữ liệu đi từ đâu đến đâu?", hãy trả lời như sau:
1. **User Request:** Người dùng nhập câu hỏi vào AI Assistant (`AiAssistant.tsx`).
2. **Logic Layer:** Hook `useAiChat.ts` xử lý dữ liệu, đính kèm thông tin Schema của DB.
3. **Service Layer:** Gọi xuống Backend qua `apiService.ts`.
4. **Backend Processing:** NestJS nhận yêu cầu, gọi lên mô hình AI (Gemini/OpenRouter), nhận về câu lệnh SQL.
5. **Database Execution:** Backend chạy câu lệnh SQL đó vào DB thực tế của người dùng, lấy kết quả trả về.
6. **Visualization:** Dòng dữ liệu trả về được đưa vào `useVisualizeLogic.ts` để tự động chọn loại biểu đồ phù hợp (Bar, Line, Pie) qua thư viện Recharts.

## 4. CÁC TỪ KHÓA BẠN CẦN "CHÉM" KHI BỊ HỎI VỀ CODE
- **"Separation of Concerns":** "Em tách biệt hoàn toàn giữa giao diện (Presentation) và nghiệp vụ (Core) để dễ bảo trì."
- **"Streaming AI":** "Em dùng SSE (Server-Sent Events) thay vì WebSocket để tối ưu băng thông cho việc hiển thị tin nhắn AI dần dần."
- **"Dependency Injection":** (Nói về Backend) "Em dùng thế mạnh của NestJS để quản lý các Service, giúp hệ thống dễ mở rộng và viết Test."
- **"Optimistic Updates":** "Em dùng React Query để hiển thị ngay kết quả lên UI trước khi Server phản hồi, tạo cảm giác cực nhanh cho người dùng."

## 5. BẢN ĐỒ THƯ MỤC THẦN THÁNH (DÀNH CHO BẠN)
- `client/src/core/services/api.service.ts`: Cổng gọi API.
- `client/src/core/services/store/`: Nơi lưu trữ "biến dùng chung" của cả app.
- `client/src/presentation/modules/Query/AiAssistant.tsx`: Giao diện Chat AI.
- `client/src/presentation/modules/Visualization/`: Nơi xử lý vẽ biểu đồ (Visualization).
- `server/src/`: Toàn bộ logic Backend (Auth, Chat, Connection).

---
*Tài liệu này được biên soạn để giúp bạn không bị "lạc" trong quá trình Vibe Coding.*
