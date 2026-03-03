# Data Explorer 🚀

**Data Explorer** is a high-fidelity, high-performance database management and visualization IDE. It provides a unified, intelligent interface for developers and data engineers to explore, query, and visualize multi-engine databases — all supercharged by a context-aware AI.

---

## ✨ Key Features

### 🤖 AI Assistant (Gemini-powered)
- **Context-Aware SQL Generation**: Describe complex data needs in natural language; AI generates optimized SQL based on your live schema and foreign key relationships.
- **Vision Integration**: Upload screenshots of DB diagrams or whiteboards for AI-powered schema reconstruction (Gemini Vision).
- **Global Assistant Panel**: A resizable, togglable sidebar available across all modules with real-time SSE (Server-Sent Events) streaming.
- **Intelligent Multi-Model Fallback**: Reliable execution using a tiered model strategy (`Gemini 2.0 Flash` -> `Gemini 1.5 Pro`) for optimal speed and reasoning balance.
- **Chat persistence**: Unlimited sessions and history safely stored in local state.

### 🔌 Multi-Database Strategy
- **Unified Engine Architecture**: Connect seamlessly to **PostgreSQL, MySQL, SQL Server, and ClickHouse** using a flexible strategy pattern.
- **Real-time Discovery**: High-performance metadata inspection for schemas, views, and complex constraints.
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
- **Execution Analytics**: Detailed performance metrics and EXPLAIN plan visualization for query optimization.
- **Tabbed Results**: Multiple output panes for Data, Messages, and Query Plans.
- **Export Capabilities**: Clean data export to **CSV and Excel** formats.

### 🎨 Premium UI & Responsive Experience
- **Mobile-Adaptive Interface**:
  - **Overlay Navigation**: Dismissible mobile drawers for explorer and assistant modules.
  - **Compact Toolbars**: Condensing UI actions into smart "More" menus on small screens.
  - **Horizontal Tab Management**: Fluid scrolling for heavy multi-tab workflows.
- **High-Density Desktop Mode**: Optimized for productivity with minimal whitespace and high information density.
- **Glassmorphism Design**: Sleek dark-mode aesthetic with backdrop-blur effects and subtle micro-animations.
- **Framer-style Interactions**: Staggered reveals and intersection-based entry animations for a polished, premium feel.

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
| **ORM / Persistence** | **Prisma** (SQLite for local storage) |
| **AI Engine** | **Google Generative AI** (Gemini API), SSE Streaming |
| **Engines Support** | `pg`, `mysql2`, `tedious` (MSSQL), `@clickhouse/client` |
| **Security** | JWT (JSON Web Token), Passport.js |

---

## 🏗️ Project Architecture & Structure

```bash
Data Explorer/
├── client/                     # High-fidelity Frontend
│   ├── src/
│   │   ├── core/               # Domain Logic & State Management
│   │   │   ├── services/       # API Adapters & Global Store (Zustand)
│   │   │   └── types/          # Unified TypeScript Interfaces
│   │   ├── presentation/       # UI Layer
│   │   │   ├── components/     # Atomic Shadcn/UI Components
│   │   │   ├── hooks/          # useMediaQuery, useReveal (Animations)
│   │   │   ├── modules/        # Feature-driven Modules
│   │   │   │   ├── Connection/ # Multi-DB Connection Management
│   │   │   │   ├── Dashboard/  # Visualization & Metrics Grid
│   │   │   │   ├── ERD/        # Interactive Graph Schema (React Flow)
│   │   │   │   ├── Layout/     # AppShell, Navbar, Mobile Sidebars
│   │   │   │   └── Query/      # AI Chatbot, SQL Editor, Results Grid
│   │   │   └── pages/          # Entry Points (Landing, Docs, App)
│   │   └── lib/                # Tailwind Utilities (cn)
├── server/                     # Modular NestJS Backend
│   ├── src/
│   │   ├── ai/                 # Gemini Integration & SSE Logic
│   │   ├── auth/               # Secure JWT Auth Layer
│   │   ├── connections/        # Connection Lifecycle Management
│   │   ├── database-strategies/# Pattern: Strategy (Adapter) for SQL Engines
│   │   ├── metadata/           # DB Schema Discovery Engine
│   │   └── query/              # High-concurrency SQL Runner
│   └── prisma/                 # SQLite Persistence Schema
└── README.md
```

---

## 📖 Comprehensive User Guide

### 1. Connection Management
- **Universal Drivers**: Click the "+" in the Explorer sidebar to add a new connection. Select from **PostgreSQL, MySQL, SQLite, or SQL Server**.
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
- **Node.js** v20.x+
- **Google Gemini API Key** (Free tier available at [Google AI Studio](https://aistudio.google.com/))

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

### Environment Variables (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Prisma database URL (SQLite, PostgreSQL, etc.) |
| `JWT_SECRET` | ✅ | Secret key for JWT token signing |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for AI features |
| `PORT` | ❌ | Server port (default: 3000) |

---

## 🤝 Contributing & Support

- **Bug Reports**: Open an issue on our [GitHub Repo](https://github.com/KasierBach/Data-Explorer-Editor/issues).
- **Custom Adapters**: New database engine support (e.g., Clickhouse, MongoDB) can be added via the `database-strategies` module.

## 📄 License

This project is licensed under the **MIT License**. Created with ❤️ by the community.
