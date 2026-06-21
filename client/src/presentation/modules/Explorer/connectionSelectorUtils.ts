import type { Connection } from '@/core/services/store/slices/connectionSlice';

type FallbackCandidate = Pick<Connection, 'id' | 'lastHealthStatus'>;

/**
 * Prefer a known-healthy replacement, then any connection that has not failed yet.
 */
export function pickFallbackConnectionId(
  connections: FallbackCandidate[],
  failedConnectionId: string,
): string | null {
  const fallbackCandidates = connections.filter(
    (connection) => connection.id !== failedConnectionId,
  );

  return (
    fallbackCandidates.find((connection) => connection.lastHealthStatus === 'healthy')?.id ??
    fallbackCandidates.find((connection) => connection.lastHealthStatus !== 'error')?.id ??
    null
  );
}
