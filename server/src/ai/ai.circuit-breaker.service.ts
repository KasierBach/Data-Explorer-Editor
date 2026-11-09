import { Injectable, Logger } from '@nestjs/common';

interface CircuitState {
  failures: number;
  openedAt: number | null;
  probeExpiresAt: number | null;
  lastTouchedAt: number;
}

const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 30_000;
const PROBE_LEASE_MS = 30_000;
const STATE_TTL_MS = 5 * 60_000;
const MAX_CIRCUITS = 1_000;

/**
 * Single-process circuit breaker for AI provider/model/destination scopes.
 *
 * After FAILURE_THRESHOLD consecutive failures, the circuit opens for
 * OPEN_DURATION_MS. The cool-down admits one probe synchronously; success
 * closes it, failure restarts the cool-down, and cancellation releases it.
 * A finite probe lease recovers callers that never report an outcome.
 *
 * Scope is a trusted endpoint/account/credential fingerprint hashed by the
 * caller, not raw credentials. State has a lazy idle TTL and a hard cap;
 * saturation fails closed for untracked circuits rather than evicting probes.
 * This is not a distributed atomic guarantee: multi-instance coordination
 * belongs to the operational lease service. Lease expiry is not fencing;
 * callers must report exactly one outcome and release promptly on cancellation.
 */
@Injectable()
export class AiCircuitBreakerService {
  private readonly logger = new Logger(AiCircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitState>();

  private key(provider: string, model: string, scope?: string): string {
    return JSON.stringify([provider, model, scope ?? null]);
  }

  private pruneExpired(now: number): void {
    for (const [key, state] of this.circuits) {
      if (
        now - state.lastTouchedAt >= STATE_TTL_MS &&
        (state.probeExpiresAt === null || now >= state.probeExpiresAt)
      ) {
        this.circuits.delete(key);
      }
    }
  }

  /** True means fail fast; false reserves any available half-open probe. */
  isOpen(provider: string, model: string, scope?: string): boolean {
    const now = Date.now();
    this.pruneExpired(now);
    const state = this.circuits.get(this.key(provider, model, scope));
    if (!state) return this.circuits.size >= MAX_CIRCUITS;
    state.lastTouchedAt = now;
    if (state.openedAt === null) return false;

    if (now - state.openedAt < OPEN_DURATION_MS) return true;
    if (state.probeExpiresAt !== null && now < state.probeExpiresAt)
      return true;

    // Keep the circuit open while this process's single probe is in flight.
    state.probeExpiresAt = now + PROBE_LEASE_MS;
    return false;
  }

  recordSuccess(provider: string, model: string, scope?: string): void {
    this.circuits.delete(this.key(provider, model, scope));
  }

  recordFailure(provider: string, model: string, scope?: string): void {
    const now = Date.now();
    this.pruneExpired(now);
    const key = this.key(provider, model, scope);
    let state = this.circuits.get(key);
    if (!state) {
      if (this.circuits.size >= MAX_CIRCUITS) return;
      state = {
        failures: 0,
        openedAt: null,
        probeExpiresAt: null,
        lastTouchedAt: now,
      };
    }
    state.failures = Math.min(FAILURE_THRESHOLD, state.failures + 1);
    state.lastTouchedAt = now;
    if (state.failures >= FAILURE_THRESHOLD) {
      const newlyOpened =
        state.openedAt === null || state.probeExpiresAt !== null;
      state.openedAt = now;
      state.probeExpiresAt = null;
      if (newlyOpened) {
        // Do not log the key, scope, endpoint, account, or credential material.
        this.logger.warn(
          `Circuit OPEN after ${state.failures} consecutive failures; failing fast for ${OPEN_DURATION_MS / 1000}s`,
        );
      }
    }
    this.circuits.set(key, state);
  }

  /** Cancel the admitted probe without clearing failures or restarting cool-down. */
  releaseProbe(provider: string, model: string, scope?: string): void {
    const now = Date.now();
    this.pruneExpired(now);
    const state = this.circuits.get(this.key(provider, model, scope));
    if (state && state.probeExpiresAt !== null) {
      state.probeExpiresAt = null;
      state.lastTouchedAt = now;
    }
  }

  /** Number of non-expired tracked circuits (for diagnostics/tests). */
  get size(): number {
    this.pruneExpired(Date.now());
    return this.circuits.size;
  }
}
