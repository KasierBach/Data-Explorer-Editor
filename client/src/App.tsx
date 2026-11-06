import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { LoginPage } from '@/presentation/pages/LoginPage'
import { OnboardingPage } from '@/presentation/pages/OnboardingPage'
import { PublicRoutePage } from '@/presentation/public/PublicRoutePage'
import { listPublicRoutes } from '@/core/seo/publicRoutes'
import { ForgotPasswordPage } from '@/presentation/pages/ForgotPasswordPage'
import { RequireAuth } from '@/presentation/components/RequireAuth'
import { useTheme } from '@/presentation/components/theme-provider'
import { useAppStore } from '@/core/services/store'
import { useSyncConnections } from '@/presentation/hooks/useSyncConnections'
import { useSyncSavedQueries } from '@/presentation/hooks/useSyncSavedQueries'
import { AuthService } from '@/core/services/AuthService'
import { useNotifications } from '@/presentation/hooks/useNotifications'
import { getWorkspaceText } from '@/core/utils/workspaceText'

import { NotFoundPage } from '@/presentation/pages/NotFoundPage';
import { Toaster } from 'sonner';
import { DestructiveQueryDialog } from '@/presentation/components/Dialogs/DestructiveQueryDialog';
import { CommandPalette } from '@/presentation/components/shared/CommandPalette';
import { LoadingState } from '@/presentation/components/shared/LoadingState';
import { ErrorBoundary } from '@/presentation/components/shared/ErrorBoundary';

type AppTheme = 'dark' | 'light' | 'system';

const isAppTheme = (value: unknown): value is AppTheme => (
  value === 'dark' || value === 'light' || value === 'system'
);

const AppShell = lazy(() => import('@/presentation/modules/Layout/AppShell').then((m) => ({ default: m.AppShell })))
const NoSqlShell = lazy(() => import('@/presentation/modules/Layout/NoSqlShell').then((m) => ({ default: m.NoSqlShell })))
const ERDPage = lazy(() => import('@/presentation/pages/ERDPage').then((m) => ({ default: m.ERDPage })))
const VisualizePage = lazy(() => import('@/presentation/pages/VisualizePage').then((m) => ({ default: m.VisualizePage })))
const AdminDashboardPage = lazy(() => import('@/presentation/pages/Admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const TeamPage = lazy(() => import('@/presentation/pages/TeamPage').then((m) => ({ default: m.TeamPage })))
const BillingReturnPage = lazy(() => import('@/presentation/pages/BillingReturnPage').then((m) => ({ default: m.BillingReturnPage })))
const LegalConsentPage = lazy(() => import('@/presentation/pages/LegalPages').then((m) => ({ default: m.LegalConsentPage })))

const publicRoutes = listPublicRoutes();

function RouteFallback() {
  const { lang } = useAppStore()
  const text = getWorkspaceText(lang).app
  return <LoadingState label={text.routeLoading} variant="route" />
}

export function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
      },
    },
  }))

  useSyncConnections();
  useSyncSavedQueries();
  useNotifications();

  const { theme: appTheme, setTheme: setAppTheme } = useTheme();
  const { user, restoreSession, setAuthBootstrapped, lang } = useAppStore();

  // Keep <html lang> in sync with the active app language.
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'vi';
  }, [lang]);

  useEffect(() => {
    if (isAppTheme(user?.theme) && user.theme !== appTheme) {
      setAppTheme(user.theme);
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
      } catch (error) {
        void error;
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
        <Helmet>
          <title>Data Explorer</title>
          <meta name="description" content="SQL and NoSQL data workspace." />
          <meta name="robots" content="noindex, nofollow" />
          <meta name="googlebot" content="noindex, nofollow" />
        </Helmet>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring">
          Skip to content
        </a>
        <ErrorBoundary>
          <div id="main-content" tabIndex={-1}>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {publicRoutes.map(route => <Route key={route.path} path={route.path} element={<PublicRoutePage route={route} />} />)}
                <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
                <Route path="/forgot-password" element={<RedirectIfAuth><ForgotPasswordPage /></RedirectIfAuth>} />
                <Route path="/legal-consent" element={<RequireAuth><LegalConsentPage /></RequireAuth>} />
                <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
                <Route path="/teams" element={<RequireAuth><TeamPage /></RequireAuth>} />
                <Route path="/billing/return" element={<RequireAuth><BillingReturnPage /></RequireAuth>} />

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
                <Route path="/nosql-explorer/visualize" element={<RequireAuth><VisualizePage /></RequireAuth>} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </div>
        </ErrorBoundary>
        <Toaster richColors position="top-center" />
        <DestructiveQueryDialog />
        <CommandPalette />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

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
