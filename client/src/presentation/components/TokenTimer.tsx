import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';

export const TokenTimer: React.FC = () => {
    const { tokenExp, logout, isAuthenticated } = useAppStore();
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [hasWarned, setHasWarned] = useState(false);

    useEffect(() => {
        if (!isAuthenticated || !tokenExp) {
            setTimeLeft(null);
            setHasWarned(false);
            return;
        }

        const interval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = tokenExp - now;

            if (remaining <= 0) {
                clearInterval(interval);
                logout();
                window.location.href = '/login';
                return;
            }

            // Warn at exactly 5 minutes (300 seconds)
            if (remaining <= 300 && !hasWarned) {
                setHasWarned(true);
                toast.warning('Session Expiring Soon', {
                    description: 'Your login session will expire in 5 minutes. Please save your work and re-login.',
                    duration: 10000,
                });
            }

            setTimeLeft(remaining);
        }, 1000);

        // Initial check
        const now = Math.floor(Date.now() / 1000);
        setTimeLeft(tokenExp - now);

        return () => clearInterval(interval);
    }, [tokenExp, isAuthenticated, hasWarned, logout]);

    if (!isAuthenticated || timeLeft === null) return null;

    // Formatting HH:MM:SS
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;
    const isWarning = timeLeft <= 300;

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono border ${isWarning ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 'bg-muted/50 text-muted-foreground border-transparent'}`} title="Session Expiration Time">
            <Clock className={`w-3.5 h-3.5 ${isWarning ? 'animate-pulse' : ''}`} />
            <span>
                {hours > 0 && `${hours.toString().padStart(2, '0')}:`}
                {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </span>
        </div>
    );
};
