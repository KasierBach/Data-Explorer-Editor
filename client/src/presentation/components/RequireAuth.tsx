import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/core/services/store';

export const RequireAuth = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
    const { isAuthenticated, accessToken, user } = useAppStore();
    const location = useLocation();

    if (!isAuthenticated || !accessToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Force onboarding if not completed (unless they are already on the onboarding page)
    if (user && !user.isOnboarded && location.pathname !== '/onboarding') {
         return <Navigate to="/onboarding" replace />;
    }

    if (requireAdmin && user?.role !== 'admin') {
        return <Navigate to="/app" replace />;
    }

    return <>{children}</>;
};
