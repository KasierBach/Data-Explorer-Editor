import path from "path"
import { fileURLToPath } from "url"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-core': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'sonner', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          'vendor-editor': ['@monaco-editor/react', 'monaco-editor'],
          'vendor-data': ['xlsx', 'sql-formatter', 'pdfjs-dist'],
          'vendor-diagram': ['@xyflow/react', 'dagre'],
          'vendor-charts': ['recharts'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'react-syntax-highlighter'],
        }
      }
    }
  },
  // @ts-ignore
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
