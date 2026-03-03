# Data Explorer 🚀

**Data Explorer** is a modern, high-performance database management and visualization tool designed for developers and data teams. It provides a unified interface to explore, query, and visualize your data across multiple database engines — all powered by an intelligent AI assistant.

---

## ✨ Key Features

### 🤖 AI Assistant (Gemini-powered)
- **General-Purpose Chat**: Ask anything — SQL, coding, math, general knowledge, or just have a conversation.
- **Smart SQL Generation**: Describe what you need in natural language; AI generates SQL from your actual database schema.
- **Multi-Session Chat**: Create unlimited chat sessions, each with its own history — persisted across page reloads.
- **Context Attachments**: Attach context to your messages:
  - 📷 **Image Upload** — Send screenshots or diagrams for AI analysis (Gemini Vision)
  - 📋 **SQL from Editor** — Attach the SQL query currently open in your editor
  - 📊 **Database Context** — Include current connection and database info
- **Global Panel**: Access AI from anywhere — resizable right sidebar that works on every page.
- **Model Fallback**: Automatically falls back through multiple Gemini models (`gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-3-flash`) for maximum reliability.

### 🔌 Multi-Database Support
- **Universal Connectivity**: Connect to PostgreSQL, MySQL, SQL Server, and ClickHouse.
- **Connection Manager**: Add, edit, and remove connections from the sidebar with UUID-based synchronization.
- **Metadata Inspection**: View schemas, tables, columns, types, constraints, and foreign keys at a glance.
- **Multi-Database Browsing**: Switch between databases within a single connection.

### 📊 Interactive ERD Visualization
- **Auto-Layout**: Automatically generates Entity Relationship Diagrams for your schema.
- **Drag-and-Drop**: Create Foreign Key constraints intuitively by dragging between columns.
- **Visual Indicators**: Primary Keys (🔑) and Foreign Keys (🗝️) are clearly marked.
- **Live Updates**: Schema changes are instantly reflected in the diagram.

### 📝 Advanced SQL Editor
- **Monaco Editor**: Same engine as VS Code — syntax highlighting, auto-completion, error detection.
- **Schema-Aware IntelliSense**: Autocomplete for table names, column names, and SQL keywords from your actual schema.
- **Multi-Tab Workspace**: Work on multiple queries and tasks simultaneously.
- **Execute & Explain**: Run queries and view EXPLAIN ANALYZE plans in structured format.
- **Query History**: Track all executed queries with status, duration, and error details.
- **Saved Queries**: Save, name, and reopen frequently used queries.
- **SQL Formatting**: Auto-format SQL with proper indentation and keyword casing.

### 📈 Insights Dashboard
- **Database Overview**: Connection stats, table counts, row counts, and database size.
- **Schema Analytics**: Identify largest tables, column distributions, and indexing opportunities.
- **Visual Charts**: Bar, line, and pie charts powered by Recharts.

### 🔐 Authentication & Security
- **JWT Authentication**: Secure login/logout with token-based authentication.
- **User Profiles**: Manage user name and email from the profile dialog.
- **Local-First**: Your data never leaves your network — all processing happens locally.

### 🎨 Modern UI & Responsive UX
- **Mobile-First Design**: Optimized for devices of all sizes.
  - **Overlay Sidebars**: Seamless mobile navigation with responsive overlays and dismissible backdrops for Explorer and AI Assistant.
  - **Horizontal Tab Scrolling**: Manage unlimited query tabs effortlessly on small screens.
- **High-Density Desktop Layout**: Minimal whitespace and optimized spacing for professional large-monitor usage.
- **Premium Landing Page**: Professional landing page with transparent pricing, integrated documentation entry points, and smooth section transitions.
- **Dark Mode & Glassmorphism**: Sleek, dark-themed interface with glass-panel effects and premium animations.
- **Resizable Panels**: Fully resizable sidebar, AI assistant, and editor/result panes.
- **Smooth Animations**: Staggered reveals, glow effects, and micro-interactions powered by CSS and Intersection Observers.

---

## 🛠️ Tech Stack

### Frontend (Client)
| Technology | Purpose |
|---|---|
| React 18 (Vite) | UI Framework |
| TypeScript | Language |
| Tailwind CSS | Styling |
| Shadcn UI (Radix) | Component Library |
| Zustand | State Management (with localStorage persistence) |
| TanStack Query | Data Fetching & Caching |
| Monaco Editor | SQL Code Editor |
| React Flow | ERD Visualization |
| Recharts | Charts & Data Visualization |

### Backend (Server)
| Technology | Purpose |
|---|---|
| NestJS | API Framework |
| TypeScript | Language |
| Prisma | ORM & Database Management |
| Google Generative AI | AI Assistant (Gemini API) |
| `pg`, `mysql2`, `mssql`, `clickhouse` | Database Drivers |
| JWT (Passport) | Authentication |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm or pnpm
- A Google Gemini API key (for AI features)

### 1. Start the Backend Server

```bash
cd server
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

Configure `server/.env`:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-jwt-secret"
GEMINI_API_KEY="your-gemini-api-key"
```

```bash
npx prisma generate
npx prisma db push
npm run start:dev
```
*Server runs on `http://localhost:3000`*

### 2. Start the Frontend Client

```bash
cd client
npm install
npm run dev
```
*Client runs on `http://localhost:5173`*

### 3. Access the Application
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 📁 Project Structure

```
Data Explorer/
├── client/                    # Frontend (React + Vite)
│   ├── src/
│   │   ├── core/              # Business logic, adapters, services, store
│   │   ├── presentation/      # UI components and modules
│   │   │   ├── components/    # Reusable UI components (Shadcn)
│   │   │   ├── modules/       # Feature modules
│   │   │   │   ├── Connection/    # Connection dialog
│   │   │   │   ├── Dashboard/     # Insights dashboard
│   │   │   │   ├── DataGrid/      # Table data grid
│   │   │   │   ├── Explorer/      # Sidebar tree explorer
│   │   │   │   ├── Layout/        # AppShell, Navbar, Tabs
│   │   │   │   ├── Query/         # SQL Editor, AI Assistant, Results
│   │   │   │   └── Visualization/ # ERD, Charts
│   │   │   └── pages/         # Top-level pages
│   │   └── lib/               # Utilities
│   └── public/
├── server/                    # Backend (NestJS)
│   ├── src/
│   │   ├── ai/                # AI module (controller, service, DTO)
│   │   ├── auth/              # Authentication (JWT)
│   │   ├── connections/       # Connection management
│   │   ├── database-strategies/  # Multi-DB strategy pattern
│   │   ├── metadata/          # Schema metadata APIs
│   │   ├── prisma/            # Prisma ORM service
│   │   └── query/             # Query execution
│   └── prisma/                # Database schema & migrations
└── README.md
```

---

## ⚙️ Configuration

### Environment Variables (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Prisma database URL (SQLite, PostgreSQL, etc.) |
| `JWT_SECRET` | ✅ | Secret key for JWT token signing |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for AI features |
| `PORT` | ❌ | Server port (default: 3000) |

### Getting a Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **Get API Key**
3. Create a key for a new or existing project
4. Copy the key to your `server/.env` file

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
