import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/core/services/store';

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, accessToken } = useAppStore();
    const location = useLocation();

    if (!isAuthenticated || !accessToken) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};
