import { useEffect, useRef, useState } from 'react';
import { PresenceService, type PresenceEntry } from '@/core/services/PresenceService';
import type { CollaborationResourceType } from '@/core/services/CollaborationService';

export function useResourcePresence(
    scope:
        | {
              organizationId?: string | null;
              teamspaceId?: string | null;
              resourceType?: CollaborationResourceType;
              resourceId?: string | null;
          }
        | null
        | undefined,
    options?: {
        enabled?: boolean;
        intervalMs?: number;
    },
) {
    const [entries, setEntries] = useState<PresenceEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(false);

    const enabled = options?.enabled ?? true;
    const intervalMs = options?.intervalMs ?? 15_000;
    const organizationId = scope?.organizationId ?? null;
    const teamspaceId = scope && 'teamspaceId' in scope ? scope.teamspaceId ?? null : null;
    const resourceType = scope && 'resourceType' in scope ? scope.resourceType : null;
    const resourceId = scope && 'resourceId' in scope ? scope.resourceId ?? null : null;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!enabled || !organizationId || (!teamspaceId && !(resourceType && resourceId))) {
            setEntries([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const sync = async () => {
            setIsLoading(true);
            try {
                const nextEntries = teamspaceId
                    ? await PresenceService.heartbeatTeamspace(organizationId, teamspaceId)
                    : await PresenceService.heartbeatResource(organizationId, resourceType!, resourceId!);

                if (!cancelled && mountedRef.current) {
                    setEntries(nextEntries);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled && mountedRef.current) {
                    setEntries([]);
                    setError(err instanceof Error ? err : new Error('Failed to load presence'));
                }
            } finally {
                if (!cancelled && mountedRef.current) {
                    setIsLoading(false);
                }
            }
        };

        void sync();
        const timer = window.setInterval(() => {
            void sync();
        }, intervalMs);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            if (organizationId) {
                if (teamspaceId) {
                    void PresenceService.leaveTeamspace(organizationId, teamspaceId).catch(() => undefined);
                } else if (resourceType && resourceId) {
                    void PresenceService.leaveResource(organizationId, resourceType, resourceId).catch(() => undefined);
                }
            }
        };
    }, [enabled, organizationId, teamspaceId, resourceType, resourceId, intervalMs]);

    return {
        entries,
        isLoading,
        error,
        hasPresence: entries.length > 0,
    };
}
