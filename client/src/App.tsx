import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/presentation/modules/Layout/AppShell'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { LandingPage } from '@/presentation/pages/LandingPage'
import { DocumentationPage } from '@/presentation/pages/DocumentationPage'
import { ERDPage } from '@/presentation/pages/ERDPage'
import { VisualizePage } from '@/presentation/pages/VisualizePage'
import { RequireAuth } from '@/presentation/components/RequireAuth'
import { ThemeProvider } from '@/presentation/components/theme-provider'
import { useAppStore } from '@/core/services/store'
import { Analytics } from '@vercel/analytics/react'

import { Toaster } from 'sonner';

export function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
    },
  }))

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
            <Route path="/docs" element={<DocumentationPage />} />
            <Route path="/app/erd" element={<RequireAuth><ERDPage /></RequireAuth>} />
            <Route path="/app/visualize" element={<RequireAuth><VisualizePage /></RequireAuth>} />

            <Route
              path="/app/*"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            />

            {/* Catch all redirect to root */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster richColors position="top-center" />
          <Analytics />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

// Helper to redirect authenticated users to app
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppStore();
  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

export default App
