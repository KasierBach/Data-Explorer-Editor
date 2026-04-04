import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/presentation/modules/Layout/AppShell'
import { NoSqlShell } from '@/presentation/modules/Layout/NoSqlShell'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { OnboardingPage } from '@/presentation/pages/OnboardingPage'
import { LandingPage } from '@/presentation/pages/LandingPage'
import { ForgotPasswordPage } from '@/presentation/pages/ForgotPasswordPage'
import { DocumentationPage } from '@/presentation/pages/DocumentationPage'
import { ERDPage } from '@/presentation/pages/ERDPage'
import { VisualizePage } from '@/presentation/pages/VisualizePage'
import { AdminDashboardPage } from '@/presentation/pages/Admin/AdminDashboardPage'
import { RequireAuth } from '@/presentation/components/RequireAuth'
import { useTheme } from '@/presentation/components/theme-provider'
import { useAppStore } from '@/core/services/store'
import { useSyncConnections } from '@/presentation/hooks/useSyncConnections'

import { Toaster } from 'sonner';

export function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
    },
  }))

  // Auto-fetch connections from backend whenever user is authenticated
  useSyncConnections();

  const { theme: appTheme, setTheme: setAppTheme } = useTheme();
  const { user } = useAppStore();

  // Sync profile theme with App Theme
  useEffect(() => {
    if (user?.theme && user.theme !== appTheme) {
        setAppTheme(user.theme as any);
    }
  }, [user?.theme, appTheme, setAppTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
            <Route path="/forgot-password" element={<RedirectIfAuth><ForgotPasswordPage /></RedirectIfAuth>} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/docs" element={<DocumentationPage />} />

            <Route path="/admin" element={<RequireAuth requireAdmin={true}><AdminDashboardPage /></RequireAuth>} />

            <Route path="/sql-explorer/erd" element={<RequireAuth><ERDPage /></RequireAuth>} />
            <Route path="/sql-explorer/visualize" element={<RequireAuth><VisualizePage /></RequireAuth>} />

            <Route
              path="/sql-explorer/*"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            />

            <Route
              path="/nosql-explorer/*"
              element={
                <RequireAuth>
                  <NoSqlShell />
                </RequireAuth>
              }
            />
            <Route path="/nosql-explorer/erd" element={<RequireAuth><ERDPage /></RequireAuth>} />

            {/* Catch all redirect to root */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster richColors position="top-center" />
        </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  )
}

// Helper to redirect authenticated users to app
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppStore();
  if (isAuthenticated) {
    return <Navigate to="/sql-explorer" replace />;
  }
  return <>{children}</>;
}

export default App
