import { Injectable, Logger } from '@nestjs/common';

interface CircuitState {
  failures: number;
  openedAt: number | null;
  probeExpiresAt: number | null;
  probeOwner: symbol | null;
  epoch: symbol;
  lastTouchedAt: number;
}

export interface AiCircuitAdmission {
  success(): void;
  failure(): void;
  cancel(): void;
}

type CircuitOutcome = keyof AiCircuitAdmission;
const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 30_000;
const PROBE_LEASE_MS = 30_000;
const STATE_TTL_MS = 5 * 60_000;
const MAX_CIRCUITS = 1_000;

/**
 * Single-process circuit breaker for AI provider/model/destination scopes.
 *
 * Fenced admissions capture a state incarnation and epoch. Opening invalidates
 * closed admissions; replacement probes invalidate the previous probe owner.
 * Each handle settles once. Lease expiry permits replacement, not authority
 * for an old callback to change its replacement's state.
 *
 * Scope is a trusted endpoint/account/credential fingerprint hashed by the
 * caller, not raw credentials. State has a lazy idle TTL and a hard cap;
 * saturation fails closed without evicting probes. This is process-local
 * authority, not distributed coordination or a guarantee of no provider overlap.
 * Key-only legacy APIs are retained for compatibility, not concurrent ownership.
 * Runtime callers must use admission handles exclusively, never mix both APIs.
 */
@Injectable()
export class AiCircuitBreakerService {
  private readonly logger = new Logger(AiCircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitState>();

  private key(provider: string, model: string, scope?: string): string {
    return JSON.stringify([provider, model, scope ?? null]);
  }

  private createState(now: number): CircuitState {
    return {
      failures: 0,
      openedAt: null,
      probeExpiresAt: null,
      probeOwner: null,
      epoch: Symbol(),
      lastTouchedAt: now,
    };
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

  /** Reserves a closed admission or the single available half-open probe. */
  tryAcquire(
    provider: string,
    model: string,
    scope?: string,
  ): AiCircuitAdmission | undefined {
    const now = Date.now();
    this.pruneExpired(now);
    const key = this.key(provider, model, scope);
    let state = this.circuits.get(key);
    if (!state) {
      if (this.circuits.size >= MAX_CIRCUITS) return undefined;
      state = this.createState(now);
      this.circuits.set(key, state);
    }
    state.lastTouchedAt = now;
    let owner: symbol | null = null;
    if (state.openedAt !== null) {
      if (
        now - state.openedAt < OPEN_DURATION_MS ||
        (state.probeExpiresAt !== null && now < state.probeExpiresAt)
      ) {
        return undefined;
      }
      owner = Symbol();
      state.probeOwner = owner;
      state.probeExpiresAt = now + PROBE_LEASE_MS;
    }
    const incarnation = state;
    const epoch = state.epoch;
    let settled = false;
    const settle = (outcome: CircuitOutcome) => {
      if (settled) return;
      settled = true;
      this.settleAdmission(key, incarnation, epoch, owner, outcome);
    };
    return Object.freeze({
      success: () => settle('success'),
      failure: () => settle('failure'),
      cancel: () => settle('cancel'),
    });
  }

  private settleAdmission(
    key: string,
    state: CircuitState,
    epoch: symbol,
    owner: symbol | null,
    outcome: CircuitOutcome,
  ): void {
    const now = Date.now();
    this.pruneExpired(now);
    if (this.circuits.get(key) !== state || state.epoch !== epoch) return;
    if (owner !== null ? state.probeOwner !== owner : state.openedAt !== null)
      return;
    if (outcome === 'failure') {
      this.incrementFailure(state, now);
    } else if (outcome === 'success') {
      if (owner !== null) this.circuits.delete(key);
      else {
        state.failures = 0;
        state.lastTouchedAt = now;
      }
    } else {
      if (owner !== null) {
        state.probeOwner = null;
        state.probeExpiresAt = null;
      }
      state.lastTouchedAt = now;
    }
  }

  private incrementFailure(state: CircuitState, now: number): void {
    state.failures = Math.min(FAILURE_THRESHOLD, state.failures + 1);
    state.lastTouchedAt = now;
    if (state.failures >= FAILURE_THRESHOLD) {
      const newlyOpened =
        state.openedAt === null || state.probeExpiresAt !== null;
      state.epoch = Symbol();
      state.openedAt = now;
      state.probeOwner = null;
      state.probeExpiresAt = null;
      if (newlyOpened) {
        // Do not log the key, scope, endpoint, account, or credential material.
        this.logger.warn(
          `Circuit OPEN after ${state.failures} consecutive failures; failing fast for ${OPEN_DURATION_MS / 1000}s`,
        );
      }
    }
  }

  /** Legacy key-only admission; runtime code uses tryAcquire instead. */
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
    state.probeOwner = Symbol();
    state.probeExpiresAt = now + PROBE_LEASE_MS;
    return false;
  }

  /** Legacy key-only outcome, not an ownership-fenced completion. */
  recordSuccess(provider: string, model: string, scope?: string): void {
    this.circuits.delete(this.key(provider, model, scope));
  }

  /** Legacy key-only outcome; invalidates any captured fenced epoch. */
  recordFailure(provider: string, model: string, scope?: string): void {
    const now = Date.now();
    this.pruneExpired(now);
    const key = this.key(provider, model, scope);
    let state = this.circuits.get(key);
    if (!state) {
      if (this.circuits.size >= MAX_CIRCUITS) return;
      state = this.createState(now);
    }
    state.epoch = Symbol();
    this.incrementFailure(state, now);
    this.circuits.set(key, state);
  }

  /** Legacy key-only release; never use it to settle a fenced handle. */
  releaseProbe(provider: string, model: string, scope?: string): void {
    const now = Date.now();
    this.pruneExpired(now);
    const state = this.circuits.get(this.key(provider, model, scope));
    if (state && state.probeExpiresAt !== null) {
      state.probeOwner = null;
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
