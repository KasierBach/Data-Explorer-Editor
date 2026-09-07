import { Injectable, Logger } from '@nestjs/common';

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 30_000;
const HALF_OPEN_PROBES = 1;

/**
 * Per-provider circuit breaker for AI requests.
 *
 * After a provider fails FAILURE_THRESHOLD consecutive times, its circuit
 * opens for OPEN_DURATION_MS; requests during that window fail fast instead
 * of waiting for the provider to time out and retry. After the cool-down the
 * circuit half-opens and lets a single probe through; success closes the
 * circuit, failure re-opens it.
 */
@Injectable()
export class AiCircuitBreakerService {
  private readonly logger = new Logger(AiCircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitState>();

  private key(provider: string, model: string): string {
    return `${provider}:${model}`;
  }

  /** True when the circuit is open and the request should fail fast. */
  isOpen(provider: string, model: string): boolean {
    const state = this.circuits.get(this.key(provider, model));
    if (!state || state.openedAt === null) return false;

    if (Date.now() - state.openedAt >= OPEN_DURATION_MS) {
      // Half-open: allow a probe request through.
      state.openedAt = null;
      state.failures = FAILURE_THRESHOLD - HALF_OPEN_PROBES;
      return false;
    }
    return true;
  }

  recordSuccess(provider: string, model: string): void {
    this.circuits.delete(this.key(provider, model));
  }

  recordFailure(provider: string, model: string): void {
    const key = this.key(provider, model);
    const state = this.circuits.get(key) ?? { failures: 0, openedAt: null };
    state.failures += 1;
    if (state.failures >= FAILURE_THRESHOLD && state.openedAt === null) {
      state.openedAt = Date.now();
      this.logger.warn(
        `Circuit OPEN for ${key} after ${state.failures} consecutive failures; failing fast for ${OPEN_DURATION_MS / 1000}s`,
      );
    }
    this.circuits.set(key, state);
  }

  /** Number of tracked circuits (for diagnostics/tests). */
  get size(): number {
    return this.circuits.size;
  }
}
