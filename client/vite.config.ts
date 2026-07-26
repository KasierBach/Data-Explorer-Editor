import path from "path"
import { fileURLToPath } from "url"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const manualChunkPackages: Record<string, string[]> = {
  'vendor-core': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
  'vendor-ui': ['framer-motion', 'lucide-react', 'sonner', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
  'vendor-editor': ['@monaco-editor/react'],
  'vendor-monaco': ['monaco-editor'],
  'vendor-xlsx': ['xlsx'],
  'vendor-pdf': ['pdfjs-dist'],
  'vendor-sql-format': ['sql-formatter'],
  'vendor-diagram': ['@xyflow/react', 'dagre'],
  'vendor-markdown': ['react-markdown', 'remark-gfm'],
}

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
    // ponytail: monaco workers are already split; warn only when we exceed the current heavy-worker ceiling.
    chunkSizeWarningLimit: 7500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/')
          for (const [chunkName, packageNames] of Object.entries(manualChunkPackages)) {
            if (packageNames.some((packageName) => normalizedId.includes(`/node_modules/${packageName}/`))) {
              return chunkName
            }
          }
        },
      }
    }
  },
  // @ts-expect-error Vitest config is accepted by Vite at runtime.
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
  },
})
