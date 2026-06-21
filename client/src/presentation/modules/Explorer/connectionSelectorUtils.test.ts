import { describe, expect, it } from 'vitest';
import { pickFallbackConnectionId } from './connectionSelectorUtils';

describe('pickFallbackConnectionId', () => {
  it('prefers another healthy connection when the active one fails', () => {
    expect(
      pickFallbackConnectionId(
        [
          { id: 'conn-error', lastHealthStatus: 'error' },
          { id: 'conn-unknown' },
          { id: 'conn-healthy', lastHealthStatus: 'healthy' },
        ],
        'conn-error',
      ),
    ).toBe('conn-healthy');
  });

  it('falls back to an unchecked connection when no healthy option exists', () => {
    expect(
      pickFallbackConnectionId(
        [
          { id: 'conn-error', lastHealthStatus: 'error' },
          { id: 'conn-unknown' },
          { id: 'conn-other-error', lastHealthStatus: 'error' },
        ],
        'conn-error',
      ),
    ).toBe('conn-unknown');
  });

  it('returns null when every other visible connection is already failing', () => {
    expect(
      pickFallbackConnectionId(
        [
          { id: 'conn-error', lastHealthStatus: 'error' },
          { id: 'conn-other-error', lastHealthStatus: 'error' },
        ],
        'conn-error',
      ),
    ).toBeNull();
  });
});
