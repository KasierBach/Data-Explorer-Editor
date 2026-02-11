# Data Explorer

A modern, web-based database exploration tool built with React (Vite) and NestJS.

## 🚀 How to Run the Project

This project consists of two parts: the **Client** (Frontend) and the **Server** (Backend). You need to run both for the application to work correctly.

### 1. Start the Backend (Server)

The backend runs on port `3000`.

1.  Open a terminal.
2.  Navigate to the `server` directory:
    ```bash
    cd server
    ```
3.  Install dependencies (if you haven't already):
    ```bash
    npm install
    ```
4.  Start the server in development mode:
    ```bash
    npm run start:dev
    ```

### 2. Start the Frontend (Client)

The frontend runs on port `5173`.

1.  Open a **new** terminal window (keep the server running).
2.  Navigate to the `client` directory:
    ```bash
    cd client
    ```
3.  Install dependencies (if you haven't already):
    ```bash
    npm install
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```

### 3. Access the Application

Open your browser and go to: http://localhost:5173

## 🛠️ Configuration

-   **Database**: The backend connects to a database. Configure your credentials in `server/.env`.
-   **Default Local Connection**:
    -   **Host**: `localhost`
    -   **Port**: `5432`
    -   **User**: `postgres`
    -   **Password**: `123`
    -   **Database**: `Data_Explorer_DB`

## ✨ Features

-   **Virtualization**: Efficiently render large datasets.
-   **Filtering**: Global search and column-based filtering.
-   **Multi-DB Support**: Connect to PostgreSQL and MySQL (via API).
