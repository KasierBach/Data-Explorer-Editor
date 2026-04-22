import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { OnboardingPage } from '@/presentation/pages/OnboardingPage'
import { LandingPage } from '@/presentation/pages/LandingPage'
import { ForgotPasswordPage } from '@/presentation/pages/ForgotPasswordPage'
import { RequireAuth } from '@/presentation/components/RequireAuth'
import { useTheme } from '@/presentation/components/theme-provider'
import { useAppStore } from '@/core/services/store'
import { useSyncConnections } from '@/presentation/hooks/useSyncConnections'
import { useSyncSavedQueries } from '@/presentation/hooks/useSyncSavedQueries'
import { AuthService } from '@/core/services/AuthService'
import { useNotifications } from '@/presentation/hooks/useNotifications'

import { Toaster } from 'sonner';
import { DestructiveQueryDialog } from '@/presentation/components/Dialogs/DestructiveQueryDialog';

const AppShell = lazy(() => import('@/presentation/modules/Layout/AppShell').then((m) => ({ default: m.AppShell })))
const NoSqlShell = lazy(() => import('@/presentation/modules/Layout/NoSqlShell').then((m) => ({ default: m.NoSqlShell })))
const DocumentationPage = lazy(() => import('@/presentation/pages/DocumentationPage').then((m) => ({ default: m.DocumentationPage })))
const ERDPage = lazy(() => import('@/presentation/pages/ERDPage').then((m) => ({ default: m.ERDPage })))
const VisualizePage = lazy(() => import('@/presentation/pages/VisualizePage').then((m) => ({ default: m.VisualizePage })))
const AdminDashboardPage = lazy(() => import('@/presentation/pages/Admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const ChangelogPage = lazy(() => import('@/presentation/pages/ChangelogPage').then((m) => ({ default: m.ChangelogPage })))

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading...
    </div>
  )
}

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
  useSyncSavedQueries();
  useNotifications();

  const { theme: appTheme, setTheme: setAppTheme } = useTheme();
  const { user, restoreSession, setAuthBootstrapped } = useAppStore();

  // Sync profile theme with App Theme
  useEffect(() => {
    if (user?.theme && user.theme !== appTheme) {
        setAppTheme(user.theme as any);
    }
  }, [user?.theme, appTheme, setAppTheme]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = async () => {
      try {
        const data = await AuthService.refreshSession();
        if (!cancelled && data.access_token && data.user) {
          restoreSession(data.access_token, data.user, data.accessTokenExpiresAt ?? null);
        }
      } catch {
        // Anonymous sessions are allowed.
      } finally {
        if (!cancelled) {
          setAuthBootstrapped(true);
        }
      }
    };

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [restoreSession, setAuthBootstrapped]);

  return (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
              <Route path="/forgot-password" element={<RedirectIfAuth><ForgotPasswordPage /></RedirectIfAuth>} />
              <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
              <Route path="/docs" element={<DocumentationPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />

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

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster richColors position="top-center" />
          <DestructiveQueryDialog />
        </BrowserRouter>
    </QueryClientProvider>
  )
}

// Helper to redirect authenticated users to app
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthBootstrapped, accessToken } = useAppStore();
  if (!isAuthBootstrapped) {
    return <RouteFallback />;
  }
  if (isAuthenticated && accessToken) {
    return <Navigate to="/sql-explorer" replace />;
  }
  return <>{children}</>;
}

export default App
