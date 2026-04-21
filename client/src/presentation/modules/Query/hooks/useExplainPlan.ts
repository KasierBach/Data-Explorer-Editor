import { useState, useCallback } from 'react';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';

interface UseExplainPlanOptions {
    query: string;
}

export function useExplainPlan({ query }: UseExplainPlanOptions) {
    const { activeConnectionId, activeDatabase } = useAppStore();
    const [explainPlan, setExplainPlan] = useState<Record<string, unknown> | null>(null);
    const [isExplaining, setIsExplaining] = useState(false);

    const executeExplain = useCallback(async () => {
        if (!activeConnectionId || !query.trim()) return;
        
        setIsExplaining(true);
        try {
            const explainQuery = `EXPLAIN ANALYZE ${query}`;
            // Use ConnectionService API to execute explain query if available
            // Fallback: execute via ConnectionService if available
            const result = await connectionService.executeQuery({
                connectionId: activeConnectionId,
                sql: explainQuery,
                database: activeDatabase || undefined,
                limit: 1,
                confirmed: true,
            });
            
            setExplainPlan(result?.rows?.[0] || null);
        } catch (error) {
            console.error('Explain plan error:', error);
            setExplainPlan(null);
        } finally {
            setIsExplaining(false);
        }
    }, [activeConnectionId, activeDatabase, query]);

    const clearExplainPlan = useCallback(() => {
        setExplainPlan(null);
    }, []);

    return {
        explainPlan,
        isExplaining,
        executeExplain,
        clearExplainPlan,
    };
}
