import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/core/services/store';

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useAppStore();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};
