import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/core/services/store';

export const RequireAuth = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
    const { isAuthenticated, isAuthBootstrapped, accessToken, user } = useAppStore();
    const location = useLocation();

    if (!isAuthBootstrapped) {
        return <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading session...</div>;
    }

    if (!isAuthenticated || !accessToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Force onboarding if not completed (unless they are already on the onboarding page)
    if (user && !user.isOnboarded && location.pathname !== '/onboarding') {
         return <Navigate to="/onboarding" replace />;
    }

    if (requireAdmin && user?.role !== 'admin') {
        return <Navigate to="/sql-explorer" replace />;
    }

    return <>{children}</>;
};
