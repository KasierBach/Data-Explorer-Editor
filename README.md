# Data Explorer 🚀

**Data Explorer** is a high-fidelity, high-performance database management and visualization IDE. It provides a unified, intelligent interface for developers and data engineers to explore, query, and visualize multi-engine databases — all supercharged by a context-aware AI.

---

## ✨ Key Features

### 🤖 AI Assistant (Gemini-powered)
- **Context-Aware SQL Generation**: Describe complex data needs in natural language; AI generates optimized SQL based on your live schema and foreign key relationships.
- **Vision Integration**: Upload screenshots of DB diagrams or whiteboards for AI-powered schema reconstruction (Gemini Vision).
- **Global Assistant Panel**: A resizable, togglable sidebar available across all modules with real-time SSE (Server-Sent Events) streaming.
- **Intelligent Multi-Model Fallback**: Reliable execution using a tiered model strategy (`Gemini 3.1 Flash` -> `Gemini 3 Pro`) for optimal speed and reasoning balance.
- **Surgical Precision Autocomplete**: Inline AI suggestions that prioritize exact SQL syntax completion without hallucinating unnecessary explanations or repeating existing code.
- **Chain Tabbing (Continuous Autocomplete)**: Seamlessly accept multi-line AI suggestions one token/line at a time using the `Tab` key, allowing for rapid, uninterrupted coding momentum.
- **Chat persistence**: Unlimited sessions and history safely stored in local state.

### 🔌 Multi-Database Strategy
- **Unified Engine Architecture**: Connect seamlessly to multiple database engines using a flexible strategy pattern:
    - **PostgreSQL** (Neon, Supabase, RDS, Local)
    - **MySQL** (PlanetScale, Local, TiDB)
    - **SQL Server** (Azure SQL, Local MSSQL)
- **Enterprise-Grade Security**: All saved database connection credentials and passwords are encrypted in the central database using **AES-256-GCM**, guaranteeing prevention of plain-text exposure even in local persistence.
- **Centralized Persistence**: Migrated from ephemeral local storage to a persistent **PostgreSQL (Supabase)** infrastructure to natively support cloud deployment and team collaboration without data loss across redeployments.
- **Real-time Discovery**: High-performance metadata inspection for schemas, views, and complex constraints protected against SQL Injection interpolation attacks.
- **Cross-DB Browsing**: Effortlessly jump between multiple databases and schemas within a single connection.

### 📊 Entity Relationship Diagrams (ERD)
- **Intelligent Auto-Layout**: Dynamic graph generation using React Flow with automatic node positioning.
- **Direct Schema Mutation**: Create or modify Foreign Key constraints intuitively by dragging lines between table nodes.
- **Visual Intelligence**: Highlighted 🔑 Primary Keys and 🗝️ Foreign Keys for instant architectural clarity.

### 📈 Analytics & Insights
- **Heuristic Dashboard**: Real-time stats for connection health, storage distribution, and table usage.
- **Visual Intelligence**: Interactive charts (Bar, Line, Pie) powered by Recharts for data-driven decision making.
- **Table Distribution**: Heatmaps and row-count analytics to identify potential bottlenecks.

### 📝 Pro SQL Workspace
- **Monaco Engine**: VS Code-grade editing experience with advanced syntax highlighting and multi-cursor support.
- **Schema-Aware IntelliSense**: Deep autocompletion that understands your tables, columns, and custom types.
- **Smart Safeguards & Optimization**: Automatic default `LIMIT 10000` wrappers and 30-second server execution timeouts (`statement_timeout`) to protect the server from out-of-memory crashes on expensive queries.
- **Keyboard Shortcuts**: Fluent developer workflow using `Ctrl+Enter` to run, `Ctrl+S` to save, and `Ctrl+H` to access history.
- **Execution Analytics**: Detailed performance metrics and EXPLAIN plan visualization for query optimization.
- **Tabbed Results**: Multiple output panes for Data, Messages, and Query Plans.
- **Export Capabilities**: Clean data export to **CSV and Excel** formats.

### 🎨 Premium UI & Responsive Experience
- **Fully Responsive Architecture**: Flawless cross-device experience from 320px mobile screens to 4K desktop displays.
- **Mobile-Adaptive Interface**:
  - **Animated Hamburger Menu**: Smooth transition to mobile navigation drawers with backdrop-blur effects.
  - **Touch-Friendly Controls**: Optimized hit areas and `touch-action` support for interactive elements like connection selectors and query buttons.
  - **Overlay Navigation**: Dismissible mobile drawers for explorer and assistant modules.
  - **Horizontal Tab Management**: Fluid scrolling for heavy multi-tab workflows with native iOS momentum scrolling support.
- **High-Density Desktop Mode**: Optimized for productivity with minimal whitespace and high information density.
- **Glassmorphism Design**: Sleek dark-mode aesthetic with backdrop-blur effects and subtle micro-animations.
- **Framer-style Interactions**: Staggered reveals and intersection-based entry animations for a polished, premium feel.
- **Standardized API Communication**: Unified response format `{ success, data, message }` across the entire ecosystem for predictable and robust frontend data handling.
- **Uptime Monitoring Ready**: Built-in `/api/health` endpoint for external monitoring (Better Uptime/UptimeRobot) to keep free-tier instances (like Render) active 24/7.

---

## 🛠️ Tech Stack & Ecosystem

### Frontend (Client-Side)
| Layer | Technologies |
|---|---|
| **Core Framework** | React 18, Vite, TypeScript |
| **State Management** | **Zustand** (Local Persistence), TanStack Query v5 |
| **UI Components** | **Radix UI**, **Shadcn UI**, Tailwind CSS |
| **Visualizations** | **React Flow** (ERD), **Recharts** (Insights), Lucide Icons |
| **Editor** | **Monaco Editor** (VS Code Engine) |
| **Animations** | Framer Motion, CSS Keyframes, Intersection Observer |

### Backend (Server-Side)
| Layer | Technologies |
|---|---|
| **Architecture** | **NestJS** (Modular API) |
| **ORM / Persistence** | **Prisma** (PostgreSQL/Supabase natively supported) |
| **AI Engine** | **Google Generative AI** (Gemini API), SSE Streaming |
| **Engines Support** | `pg`, `mysql2`, `tedious` (MSSQL), `@clickhouse/client` |
| **Security** | JWT (JSON Web Token), Passport.js, **AES-256-GCM Encryption** |

---

## 🏗️ Project Architecture & Structure

```bash
Data Explorer/
├── client/                      # High-fidelity Frontend
│   ├── src/
│   │   ├── core/                # Domain Logic & State Management
│   │   │   ├── config/          # Environment Variables Loader
│   │   │   ├── services/        # Store (Zustand), API Adapters
│   │   │   └── types/           # Unified TypeScript Interfaces
│   │   ├── presentation/        # UI Layer
│   │   │   ├── components/      # Atomic Shadcn/UI Components
│   │   │   ├── hooks/           # useSyncConnections, useMediaQuery
│   │   │   ├── modules/         # Feature-driven Modules
│   │   │   │   ├── Connection/  # Multi-DB Connection Management
│   │   │   │   ├── Dashboard/   # Visualization & Metrics Grid
│   │   │   │   ├── ERD/         # Interactive Graph Schema (React Flow)
│   │   │   │   ├── Layout/      # AppShell, Navbar, Mobile Sidebars
│   │   │   │   └── Query/       # AI Chatbot, SQL Editor, Results Grid
│   │   │   └── pages/           # Entry Points (Landing, Docs, Admin, App)
│   │   └── lib/                 # Tailwind Utilities (cn)
├── server/                      # Modular NestJS Backend
│   ├── src/
│   │   ├── ai/                  # Gemini Integration & SSE Logic
│   │   ├── auth/                # Secure JWT Auth Layer, Guards
│   │   ├── connections/         # Connection Lifecycle Management
│   │   ├── database-strategies/ # Adapter Pattern for SQL Engines
│   │   ├── metadata/            # DB Schema Discovery Engine
│   │   ├── query/               # High-concurrency SQL Runner
│   │   ├── users/               # RBAC Identities & User Management
│   │   └── utils/               # Crypto (AES-256) & Application Hooks
│   └── prisma/                  # PostgreSQL Persistent Schema
└── README.md
```

---

## 📖 Comprehensive User Guide

### 1. Connection Management
- **Universal Drivers**: Click the "+" in the Explorer sidebar to add a new connection. Select from **PostgreSQL, MySQL, SQL Server, or ClickHouse**.
- **Metadata Sync**: Once connected, the app will automatically crawl your schema (tables, views, indexes) and populate the tree view.
- **Switching Context**: Hover over any table to see row counts and column types instantly.

### 2. Pro SQL Workspace
- **Multi-Tab Editing**: Open multiple SQL tabs for different tasks. Use **Ctrl/Cmd + Enter** to execute.
- **Smart Intellisense**: Typing `SELECT * FROM ` will trigger schema-aware suggestions for your tables.
- **Explain & Analyze**: Switch the result tab to "Query Plan" to see how the database is executing your query.

### 3. Using the AI Assistant
- **Contextual Knowledge**: Click the AI Sidebar. The assistant already knows about your active connection and schema.
- **Vision Features**: Drag and drop a screenshot of a whiteboard diagram or a table into the chat; the AI will attempt to generate the SQL schema for you.
- **Prompt Engineering**: Ask: *"Summarize the relationship between orders and customers"* or *"Find the top 5 customers with high churn risk based on transaction volume."*

### 4. Interactive Visualizations
- **ERD Exploration**: Navigate to the ERD module to see your database geography. Drag columns to create relationships (visual only) or explore complex joins.
- **Insights Dashboard**: View table size distributions, connection latency, and row-count heatmaps to monitor database health.

---

## 🚀 Installation & Local Development

### Requirements
- **Google Gemini API Key** (Free tier available at [Google AI Studio](https://aistudio.google.com/))
- **Docker & Docker Compose** (Optional, for One-Click setup)

---

## 🐳 One-Click Docker Deployment (Recommended)

This is the fastest way to get **Data Explorer** running locally. It automatically sets up a PostgreSQL database, the backend API, and a production-grade Nginx frontend.

1.  **Environment Setup**:
    - Copy `.env.example` to create your own `.env` file in the root directory.
    - Add your `GEMINI_API_KEY` to the `.env` file.

2.  **Launch**:
    ```bash
    docker-compose up --build -d
    ```

### 🛰️ Access Points
- **Web Interface**: [http://localhost](http://localhost) (Port 80)
- **Backend API**: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- **Primary Database**: `localhost:5435` (Credentials in `.env.example`)

---

### Initial Setup
1. **Clone & Install**:
   ```bash
   git clone https://github.com/KasierBach/Data-Explorer-Editor.git
   cd Data-Explorer-Editor
   ```

2. **Backend Configuration**:
   ```bash
   cd server
   npm install
   cp .env.example .env # Update with your GEMINI_API_KEY and JWT_SECRET
   npx prisma generate
   npx prisma db push
   npm run start:dev
   ```

3. **Frontend Configuration**:
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

4. **Launch**:
   Visit **[http://localhost:5173](http://localhost:5173)** to start exploring.

---

## ⚙️ Configuration

### Environment Variables

Bạn có thể cấu hình dự án thông qua file `.env` (đã có sẵn file mẫu `.env.example`).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | URL kết nối cơ sở dữ liệu (Postgres). Mặc định trong Docker là `postgresql://postgres:postgres@db:5432/data_explorer`. |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key để kích hoạt các tính năng AI. |
| `JWT_SECRET` | ✅ | Khóa bí mật để ký Token đăng nhập. |
| `ENCRYPTION_KEY` | ✅ | Khóa Hex 32 ký tự dùng để mã hóa mật khẩu các kết nối Database được lưu lại. |
| `PORT` | ❌ | Cổng chạy Server (Mặc định: 3001). |
| `VITE_API_URL` | ❌ | (Frontend) URL dẫn tới Backend API. Mặc định: `http://localhost:3001/api`. |

---

## 🤝 Contributing & Support

- **Bug Reports**: Open an issue on our [GitHub Repo](https://github.com/KasierBach/Data-Explorer-Editor/issues).
- **Custom Adapters**: New database engine support (e.g., Clickhouse, MongoDB) can be added via the `database-strategies` module.

## 📄 License

This project is licensed under the **MIT License**. Created with ❤️ by the community.
