# Data Explorer 🚀

**Data Explorer** is a modern, high-performance database management and visualization tool designed for developers and data teams. It provides a unified interface to explore, query, and visualize your data across multiple database engines including PostgreSQL, MySQL, SQL Server, and ClickHouse.

## ✨ Key Features

### 🔌 Multi-Database Support
- **Universal Connectivity**: Seamlessly connect to PostgreSQL, MySQL, SQL Server, and ClickHouse.
- **Unified Interface**: Manage all your connections in one sidebar.
- **Metadata Inspection**: View table schemas, column types, and constraints at a glance.

### 📊 Interactive ERD Visualization
- **Auto-Layout**: Automatically generates Entity Relationship Diagrams (ERD) for your schema.
- **Drag-and-Drop Relationships**: Create Foreign Key constraints intuitively by dragging connections between columns.
- **Visual Feedback**: Distinct indicators for Primary Keys (🔑) and Foreign Keys (🗝️).
- **Live Updates**: Changes to the schema are instantly reflected in the diagram.

### 📝 Advanced SQL Editor
- **Monaco Editor**: Powered by the same engine as VS Code for a familiar coding experience.
- **IntelliSense**: Syntax highlighting, auto-completion, and error detection.
- **Multi-Tab Workspace**: Work on multiple queries, generic tasks, and visualizations simultaneously.
- **Result Visualization**: Instantly turn query results into charts (Bar, Line, Pie) without exporting data.

### 🛡️ Secure & Local-First
- **Local Processing**: Your data never leaves your network. All processing happens on your local machine / server.
- **Direct Connections**: Uses direct TCP connections for maximum speed and security.

### 🎨 Modern UI/UX
- **Dark Mode**: Sleek, dark-themed interface designed for long coding sessions.
- **Responsive Design**: Built with Tailwind CSS and Shadcn UI for a polished look and feel.
- **Command Palette**: Quick access to actions and navigation.

---

## 🛠️ Tech Stack

### Frontend (Client)
- **Framework**: React 18 (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Shadcn UI (Radix Primitives)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Visualization**: React Flow (ERD), Recharts
- **Editor**: Monaco Editor

### Backend (Server)
- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: Prisma / Raw SQL support
- **Database Drivers**: `pg`, `mysql2`, `mssql`, `clickhouse`

---

## 🚀 Getting Started

To run Data Explorer locally, you'll need to start both the backend server and the frontend client.

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### 1. Start the Backend Server
The server handles database connections and query execution.

```bash
cd server
npm install
npm run start:dev
```
*Server runs on `http://localhost:3000`*

### 2. Start the Frontend Client
The client provides the web-based user interface.

```bash
# Open a new terminal
cd client
npm install
npm run dev
```
*Client runs on `http://localhost:5173`*

### 3. Access the Application
Open your browser and navigate to **[http://localhost:5173](http://localhost:5173)**.

---

## ⚙️ Configuration

### Environment Variables
Create a `.env` file in the `server` directory to configure global settings if needed (though the app allows UI-based connection management).

```env
# Example server/.env
PORT=3000
```

### Database Connections
Connections are managed within the application. You can add, edit, and remove connections directly from the sidebar.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
