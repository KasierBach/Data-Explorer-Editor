# HƯỚNG DẪN NẮM DỰ ÁN DATA EXPLORER TRONG 15 PHÚT

> [!IMPORTANT]
> Đây là bản tóm tắt thực dụng để bạn nắm nhanh dự án, giải thích được với lead, và không bị lạc khi vào codebase.

## 1. Dự án này là gì?

- **Tên dự án:** Data Explorer
- **Phiên bản đang được tài liệu hóa:** `v3.6.2`
- **Mục tiêu:** Xây một IDE quản trị dữ liệu hiện đại cho cả SQL lẫn NoSQL, có AI hỗ trợ thật sự chứ không chỉ là chat cho vui.
- **Người dùng chính:** developer, data engineer, analyst, team nội bộ cần quản lý kết nối, truy vấn, trực quan dữ liệu, và cộng tác.

## 2. Giá trị cốt lõi của sản phẩm

- **Một nơi cho nhiều hệ DB:** PostgreSQL, MySQL, SQL Server, ClickHouse, MongoDB, MongoDB Atlas (SRV).
- **AI gắn với context thật:** AI biết connection hiện tại, schema, route người dùng đang đứng, và có thể hỗ trợ SQL, phân tích schema, vision, cùng các tác vụ hỏi đáp khác.
- **Có guardrail thật:** read-only, execution policy, timeout AI, secret validation, OAuth flow an toàn hơn, mã hóa mật khẩu connection.
- **Cộng tác và vận hành:** có teams, presence, notifications, activity, billing, docs trong app, cùng Redis để chống “app chạy được nhưng không vận hành được”.

## 3. Tech stack cần nhớ

- **Frontend:** React 19, Vite, TypeScript, Zustand, TanStack Query, Tailwind CSS, Radix UI
- **Backend:** NestJS, Prisma, Redis, BullMQ
- **AI layer:** Gemini + các lane OpenAI-compatible như OpenRouter, Groq, Cerebras, Beeknoee
- **Visualization:** React Flow, Recharts, Monaco Editor
- **Hạ tầng local/dev:** PostgreSQL cho metadata app, Redis cho cache/queue/presence/search index

## 4. Luồng hệ thống chạy như thế nào?

Khi có một request “nhờ AI viết SQL” hoặc “phân tích dữ liệu”, luồng thường là:

1. **Người dùng thao tác ở frontend**
   - Ví dụ trong SQL editor, NoSQL workspace, hoặc AI Assistant panel.
2. **Frontend gom context**
   - Connection hiện tại, schema metadata, tab đang mở, loại nhiệm vụ, attachment nếu có.
3. **Frontend gọi backend**
   - Qua lớp API service, không gọi provider AI trực tiếp từ client.
4. **Backend định tuyến và chuẩn hóa task**
   - Xác định đây là chat thường, SQL generation, vision, current-info request, hay tác vụ có explicit provider/model.
5. **AI provider được chọn**
   - Có thể là Gemini, OpenRouter, Groq, Cerebras, Beeknoee.
6. **Backend trả kết quả hoặc chạy tiếp workflow**
   - Với SQL: có thể sinh query, validate, rồi đưa sang query execution path.
   - Với NoSQL: có thể hỗ trợ MQL, aggregation, schema reasoning, hoặc insight từ result set.
7. **Frontend render kết quả**
   - Text stream qua SSE, bảng dữ liệu, insight card, chart, schema panel, hoặc ERD.

## 5. Redis quan trọng ở đâu?

Redis trong dự án này không phải “có thì tốt”.

Nó đang gánh các việc như:

- cache metadata và kết quả đọc lặp
- notifications / SSE coordination
- rate limiting xuyên nhiều instance
- background jobs / queue
- presence của workspace/team
- search index để tìm bảng, collection, metadata nhanh

Nói ngắn gọn: nếu PostgreSQL là nơi giữ dữ liệu cấu hình chính, thì Redis là lớp runtime coordination.

## 6. Những điểm dễ bị hiểu sai

- **Không phải chỉ có Gemini**
  - Hệ AI hiện có nhiều lane; Gemini là premium lane, còn một số provider khác phục vụ fallback, tốc độ, chi phí, hoặc explicit selection.
- **Không phải cứ có AI là có web search**
  - Khả năng “search/current info” phụ thuộc wiring thực tế của provider lane, không phải cứ model nói chuyện giống có internet là thật sự có internet.
- **Không phải root `npm install` là đủ**
  - Repo này không dùng workspaces đầy đủ, nên `server` và `client` vẫn cần cài dependency riêng nếu chạy local ngoài Docker.
- **Không phải Redis là một workspace độc lập cho user**
  - Redis hiện là hạ tầng backend/runtime, chưa phải Redis Explorer hoàn chỉnh cho người dùng cuối.

## 7. Các thư mục nên nhớ

- `client/src/presentation/modules/Query`
  - SQL editor, AI assistant, history, results
- `client/src/presentation/modules/NoSqlExplorer`
  - Không gian NoSQL, tree JSON, schema analysis, aggregation builder
- `client/src/presentation/modules/Visualization`
  - ERD và trực quan dữ liệu
- `client/src/presentation/components/docs`
  - Hệ thống docs song ngữ trong app
- `server/src/ai`
  - AI routing, prompt building, provider execution, streaming
- `server/src/query`
  - Query execution, guardrails, results
- `server/src/nosql`
  - API cho NoSQL workspace
- `server/src/redis`, `server/src/notifications`, `server/src/presence`, `server/src/search`
  - Runtime infrastructure dựa trên Redis

## 8. Cách nói ngắn gọn với lead

Nếu cần tóm một câu:

> Data Explorer là một IDE dữ liệu đa hệ quản trị, có SQL + NoSQL + AI + collaboration, với backend NestJS/Prisma/Redis và frontend React/Vite, đang được đẩy mạnh theo hướng vừa vận hành được thật vừa có trải nghiệm dùng tốt.

## 9. Nếu mới vào codebase thì nên đọc gì trước?

1. `README.md`
2. `client/src/presentation/pages/DocumentationPage.tsx` và các section docs
3. `server/.env.example`
4. `server/src/ai`
5. `client/src/presentation/modules/Query` và `NoSqlExplorer`

## 10. Một câu chốt

Đừng nhìn dự án này như “một trang query có thêm chat AI”. Thực tế nó đang là một nền quản trị dữ liệu nhiều lớp: connection management, execution safety, AI orchestration, NoSQL tooling, collaboration, billing, và runtime infrastructure.
