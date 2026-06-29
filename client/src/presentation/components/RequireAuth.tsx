import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/core/services/store';

export const RequireAuth = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
    const { isAuthenticated, isAuthBootstrapped, accessToken, user } = useAppStore();
    const location = useLocation();

    if (!isAuthBootstrapped) {
        return <div className="flex h-dvh min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading session...</div>;
    }

    if (!isAuthenticated || !accessToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user && !user.legalAcceptedAt && location.pathname !== '/legal-consent') {
        return <Navigate to="/legal-consent" replace />;
    }

    if (user && !user.isOnboarded && location.pathname !== '/onboarding') {
         return <Navigate to="/onboarding" replace />;
    }

    if (requireAdmin && user?.role !== 'admin') {
        return <Navigate to="/sql-explorer" replace />;
    }

    return <>{children}</>;
};
