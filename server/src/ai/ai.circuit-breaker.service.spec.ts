import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AiCircuitBreakerService } from './ai.circuit-breaker.service';

type TestAdmission = { success(): void; failure(): void; cancel(): void };
type FencedBreaker = AiCircuitBreakerService & {
  tryAcquire(
    provider: string,
    model: string,
    scope?: string,
  ): TestAdmission | undefined;
};
function takeAdmission(
  breaker: AiCircuitBreakerService,
  model = 'model-a',
  scope?: string,
): TestAdmission {
  const admission = (breaker as FencedBreaker).tryAcquire('groq', model, scope);
  if (!admission) throw new Error('Expected a circuit admission');
  return admission;
}

describe('fenced circuit ownership', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it.each(['success', 'failure', 'cancel'] as const)(
    'ignores expired probe A %s after replacement B is admitted',
    (outcome) => {
      const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
      const breaker = new AiCircuitBreakerService();
      for (let index = 0; index < 5; index++) takeAdmission(breaker).failure();
      clock.mockReturnValue(30_000);
      const first = takeAdmission(breaker);
      clock.mockReturnValue(60_000);
      const replacement = takeAdmission(breaker);
      first[outcome]();
      expect(
        (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
      ).toBeUndefined();
      replacement.success();
      expect(
        (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
      ).toBeDefined();
    },
  );

  it.each(['success', 'failure', 'cancel'] as const)(
    'invalidates concurrent closed admission %s after failures open the circuit',
    (outcome) => {
      const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
      const breaker = new AiCircuitBreakerService();
      const admissions = Array.from({ length: 6 }, () =>
        takeAdmission(breaker),
      );
      for (let index = 0; index < 5; index++) admissions[index].failure();
      clock.mockReturnValue(25_000);
      admissions[5][outcome]();
      expect(
        (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
      ).toBeUndefined();
      clock.mockReturnValue(30_000);
      const probe = takeAdmission(breaker);
      admissions[5].cancel();
      expect(
        (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
      ).toBeUndefined();
      probe.success();
    },
  );

  it('settles each handle once and cannot release its replacement through repeated callbacks', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    const first = takeAdmission(breaker);
    first.failure();
    first.failure();
    first.success();
    first.cancel();
    for (let index = 0; index < 3; index++) takeAdmission(breaker).failure();
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
    ).toBeDefined();
    takeAdmission(breaker).failure();
    clock.mockReturnValue(30_000);
    const probe = takeAdmission(breaker);
    probe.cancel();
    const replacement = takeAdmission(breaker);
    probe.success();
    probe.failure();
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
    ).toBeUndefined();
    replacement.cancel();
  });

  it('accepts a current-owner failure after lease expiry when no replacement exists', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let index = 0; index < 5; index++) takeAdmission(breaker).failure();
    clock.mockReturnValue(30_000);
    const probe = takeAdmission(breaker);
    clock.mockReturnValue(60_000);
    probe.failure();
    clock.mockReturnValue(89_999);
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
    ).toBeUndefined();
    clock.mockReturnValue(90_000);
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
    ).toBeDefined();
  });

  it('never reuses a state incarnation after pruning and ignores stale outcomes', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    const stale = takeAdmission(breaker);
    clock.mockReturnValue(300_000);
    expect(breaker.size).toBe(0);
    for (let index = 0; index < 5; index++) takeAdmission(breaker).failure();
    stale.success();
    stale.failure();
    stale.cancel();
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
    ).toBeUndefined();
  });

  it('keeps stale probe outcomes fenced after successful replacement and a newly opened circuit', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let index = 0; index < 5; index++) takeAdmission(breaker).failure();
    clock.mockReturnValue(30_000);
    const stale = takeAdmission(breaker);
    clock.mockReturnValue(60_000);
    takeAdmission(breaker).success();
    for (let index = 0; index < 5; index++) takeAdmission(breaker).failure();
    stale.success();
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
    ).toBeUndefined();
  });

  it('bounds closed-state tracking and keeps independent scopes distinct', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let index = 0; index < 1_000; index++)
      takeAdmission(breaker, `model-${index}`).cancel();
    expect(breaker.size).toBe(1_000);
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'overflow'),
    ).toBeUndefined();
    clock.mockReturnValue(300_000);
    expect(breaker.size).toBe(0);
    for (let index = 0; index < 5; index++)
      takeAdmission(breaker, 'model-a').failure();
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a', ''),
    ).toBeDefined();
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a', 'scope'),
    ).toBeDefined();
    expect(
      (breaker as FencedBreaker).tryAcquire('groq', 'model-a'),
    ).toBeUndefined();
  });
});

describe('AiCircuitBreakerService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('stays closed under the failure threshold', () => {
    const breaker = new AiCircuitBreakerService();

    for (let i = 0; i < 4; i++) breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
  });

  it('opens after the failure threshold and fails fast', () => {
    const breaker = new AiCircuitBreakerService();

    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);
  });

  it('tracks providers independently', () => {
    const breaker = new AiCircuitBreakerService();

    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);
    expect(breaker.isOpen('openrouter', 'model-a')).toBe(false);
    expect(breaker.isOpen('groq', 'model-b')).toBe(false);
  });

  it('resets the failure count on success', () => {
    const breaker = new AiCircuitBreakerService();

    for (let i = 0; i < 4; i++) breaker.recordFailure('groq', 'model-a');
    breaker.recordSuccess('groq', 'model-a');
    breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
  });

  it('half-opens after the cool-down window and closes on success', () => {
    const breaker = new AiCircuitBreakerService();

    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);

    // Simulate the cool-down elapsing.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);

    breaker.recordSuccess('groq', 'model-a');
    jest.spyOn(Date, 'now').mockRestore();

    // Circuit fully closed: fresh failures needed before opening again.
    breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
  });

  it('re-opens when a half-open probe fails', () => {
    const breaker = new AiCircuitBreakerService();

    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'model-a');
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);

    breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('admits exactly one of 100 concurrent half-open requests in this process', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'model-a');

    clock.mockReturnValue(29_999);
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);
    clock.mockReturnValue(30_000);
    const decisions = await Promise.all(
      Array.from({ length: 100 }, () =>
        Promise.resolve().then(() => breaker.isOpen('groq', 'model-a')),
      ),
    );
    expect(decisions.filter((open) => !open)).toHaveLength(1);
    expect(decisions.filter((open) => open)).toHaveLength(99);
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);

    breaker.recordSuccess('groq', 'model-a');
    expect(breaker.size).toBe(0);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
    for (let i = 0; i < 4; i++) breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
    breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);
  });

  it('keeps failure counts and success independent for the same provider/model scopes', () => {
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 4; i++) {
      breaker.recordFailure('groq', 'model-a', 'account-a-fingerprint');
      breaker.recordFailure('groq', 'model-a', 'account-b-fingerprint');
    }
    expect(breaker.isOpen('groq', 'model-a', 'account-a-fingerprint')).toBe(
      false,
    );
    expect(breaker.isOpen('groq', 'model-a', 'account-b-fingerprint')).toBe(
      false,
    );
    breaker.recordFailure('groq', 'model-a', 'account-a-fingerprint');
    expect(breaker.isOpen('groq', 'model-a', 'account-a-fingerprint')).toBe(
      true,
    );
    expect(breaker.isOpen('groq', 'model-a', 'account-b-fingerprint')).toBe(
      false,
    );
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);

    breaker.recordSuccess('groq', 'model-a', 'account-a-fingerprint');
    breaker.recordFailure('groq', 'model-a', 'account-b-fingerprint');
    expect(breaker.isOpen('groq', 'model-a', 'account-b-fingerprint')).toBe(
      true,
    );
    expect(breaker.isOpen('groq', 'model-a', 'account-a-fingerprint')).toBe(
      false,
    );
    breaker.recordSuccess('groq', 'model-a', 'account-a-fingerprint');
    expect(breaker.isOpen('groq', 'model-a', 'account-b-fingerprint')).toBe(
      true,
    );
  });

  it('isolates endpoint/account/credential fingerprints and their probes', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    // The caller fingerprints trusted destination/identity inputs, not this service.
    const scopes = [
      ['https://destination-a.example', 'account-a', 'credential-a'],
      ['https://destination-b.example', 'account-a', 'credential-a'],
      ['https://destination-a.example', 'account-b', 'credential-a'],
      ['https://destination-a.example', 'account-a', 'credential-b'],
    ].map((destination) =>
      createHash('sha256').update(JSON.stringify(destination)).digest('hex'),
    );
    for (const scope of scopes) {
      for (let i = 0; i < 5; i++)
        breaker.recordFailure('openai', 'same-model', scope);
    }
    expect(breaker.size).toBe(4);
    clock.mockReturnValue(30_000);
    for (const scope of scopes) {
      const decisions = await Promise.all(
        Array.from({ length: 100 }, () =>
          Promise.resolve().then(() =>
            breaker.isOpen('openai', 'same-model', scope),
          ),
        ),
      );
      expect(decisions.filter((open) => !open)).toHaveLength(1);
    }

    breaker.releaseProbe('openai', 'same-model', scopes[0]);
    expect(breaker.isOpen('openai', 'same-model', scopes[0])).toBe(false);
    expect(breaker.isOpen('openai', 'same-model', scopes[1])).toBe(true);
    breaker.recordSuccess('openai', 'same-model', scopes[0]);
    breaker.recordFailure('openai', 'same-model', scopes[1]);
    expect(breaker.isOpen('openai', 'same-model', scopes[0])).toBe(false);
    expect(breaker.isOpen('openai', 'same-model', scopes[1])).toBe(true);
    expect(breaker.isOpen('openai', 'same-model', scopes[2])).toBe(true);
    expect(breaker.isOpen('openai', 'same-model', scopes[3])).toBe(true);
  });

  it('does not alias delimiter-containing provider/model/scope tuples', () => {
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++) breaker.recordFailure('provider:model', 'one');
    expect(breaker.isOpen('provider', 'model:one')).toBe(false);
    for (let i = 0; i < 5; i++)
      breaker.recordFailure('provider', 'one', 'scope');
    expect(breaker.isOpen('provider', 'one:scope')).toBe(false);
    expect(breaker.isOpen('provider:model', 'one')).toBe(true);
    expect(breaker.isOpen('provider', 'one', 'scope')).toBe(true);
  });

  it('preserves the two-argument API and distinguishes an explicit empty scope', () => {
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a', undefined)).toBe(true);
    expect(breaker.isOpen('groq', 'model-a', '')).toBe(false);
    breaker.recordSuccess('groq', 'model-a', undefined);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
    expect(breaker.size).toBe(0);
  });

  it('starts a fresh full cool-down when the probe fails', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++)
      breaker.recordFailure('groq', 'model-a', 'scope');
    clock.mockReturnValue(30_000);
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(false);
    clock.mockReturnValue(45_000);
    breaker.recordFailure('groq', 'model-a', 'scope');
    clock.mockReturnValue(74_999);
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(true);
    clock.mockReturnValue(75_000);
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(false);
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(true);
  });

  it('releases a canceled probe without counting failure or clearing its circuit', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++)
      breaker.recordFailure('groq', 'model-a', 'scope');
    clock.mockReturnValue(30_000);
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(false);
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(true);
    breaker.releaseProbe('groq', 'model-a', 'scope');
    breaker.releaseProbe('groq', 'model-a', 'scope');
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    expect(breaker.size).toBe(1);
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(false);
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(true);
    breaker.recordFailure('groq', 'model-a', 'scope');
    expect(breaker.isOpen('groq', 'model-a', 'scope')).toBe(true);
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);
  });

  it('makes release a no-op for unknown, closed, and cooling-down circuits', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    breaker.releaseProbe('groq', 'unknown');
    expect(breaker.size).toBe(0);
    for (let i = 0; i < 4; i++) breaker.recordFailure('groq', 'model-a');
    breaker.releaseProbe('groq', 'model-a');
    breaker.recordFailure('groq', 'model-a');
    breaker.releaseProbe('groq', 'model-a');
    clock.mockReturnValue(29_999);
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);
    clock.mockReturnValue(30_000);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
  });

  it('admits exactly one replacement after a dead caller probe lease expires', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'model-a');
    clock.mockReturnValue(30_000);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
    clock.mockReturnValue(59_999);
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);
    clock.mockReturnValue(60_000);
    const decisions = await Promise.all(
      Array.from({ length: 100 }, () =>
        Promise.resolve().then(() => breaker.isOpen('groq', 'model-a')),
      ),
    );
    expect(decisions.filter((open) => !open)).toHaveLength(1);
    expect(decisions.filter((open) => open)).toHaveLength(99);
    breaker.recordSuccess('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
  });

  it('reopens for a failure reported after the lease expired', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'model-a');
    clock.mockReturnValue(30_000);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
    clock.mockReturnValue(60_000);
    breaker.recordFailure('groq', 'model-a');
    clock.mockReturnValue(89_999);
    expect(breaker.isOpen('groq', 'model-a')).toBe(true);
    clock.mockReturnValue(90_000);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
  });

  it('expires idle states and starts fresh failure counts after the TTL', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 4; i++) breaker.recordFailure('groq', 'model-a');
    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'idle-open');
    clock.mockReturnValue(299_999);
    expect(breaker.size).toBe(2);
    clock.mockReturnValue(300_000);
    expect(breaker.size).toBe(0);
    expect(breaker.isOpen('groq', 'idle-open')).toBe(false);
    breaker.recordFailure('groq', 'model-a');
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
  });

  it('refreshes the idle TTL on use without extending the probe lease', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    breaker.recordFailure('groq', 'model-a');
    clock.mockReturnValue(200_000);
    expect(breaker.isOpen('groq', 'model-a')).toBe(false);
    clock.mockReturnValue(499_999);
    expect(breaker.size).toBe(1);
    clock.mockReturnValue(500_000);
    expect(breaker.size).toBe(0);
  });

  it('does not allocate state for successful or released unknown circuits', () => {
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 2_000; i++) {
      expect(breaker.isOpen('groq', `model-${i}`)).toBe(false);
      breaker.releaseProbe('groq', `model-${i}`);
      breaker.recordSuccess('groq', `model-${i}`);
    }
    expect(breaker.size).toBe(0);
  });

  it('caps tracked states and recovers saturation after success or idle expiry', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 1_500; i++) breaker.recordFailure('groq', `model-${i}`);
    expect(breaker.size).toBe(1_000);
    expect(breaker.isOpen('groq', 'model-0')).toBe(false);
    expect(breaker.isOpen('groq', 'overflow')).toBe(true);
    breaker.recordSuccess('groq', 'model-0');
    expect(breaker.isOpen('groq', 'overflow')).toBe(false);
    breaker.recordFailure('groq', 'overflow');
    expect(breaker.size).toBe(1_000);
    expect(breaker.isOpen('groq', 'overflow')).toBe(false);
    clock.mockReturnValue(300_000);
    expect(breaker.isOpen('groq', 'new-destination')).toBe(false);
    expect(breaker.size).toBe(0);
  });

  it('never evicts an in-flight probe under map-cap pressure or unrelated TTL cleanup', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
    const breaker = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++) breaker.recordFailure('groq', 'probe');
    for (let i = 0; i < 999; i++) breaker.recordFailure('groq', `other-${i}`);
    clock.mockReturnValue(299_999);
    expect(breaker.isOpen('groq', 'probe')).toBe(false);
    for (let i = 0; i < 1_500; i++)
      breaker.recordFailure('groq', `overflow-${i}`);
    expect(breaker.size).toBe(1_000);
    expect(breaker.isOpen('groq', 'probe')).toBe(true);
    clock.mockReturnValue(300_000);
    expect(breaker.size).toBe(1);
    expect(breaker.isOpen('groq', 'probe')).toBe(true);
    clock.mockReturnValue(329_999);
    expect(breaker.isOpen('groq', 'probe')).toBe(false);
    expect(breaker.isOpen('groq', 'probe')).toBe(true);
  });

  it('does not log provider/model/scope or key material', () => {
    const breaker = new AiCircuitBreakerService();
    const provider = 'provider-private-material';
    const model = 'model-private-material';
    const scope = 'account-credential-private-material';
    for (let i = 0; i < 5; i++) breaker.recordFailure(provider, model, scope);
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    const warning = (Logger.prototype.warn as jest.Mock).mock
      .calls[0][0] as string;
    expect(warning).not.toContain(provider);
    expect(warning).not.toContain(model);
    expect(warning).not.toContain(scope);
    expect(warning).not.toContain(JSON.stringify([provider, model, scope]));
  });

  it('keeps circuit state process-local rather than claiming shared coordination', () => {
    const first = new AiCircuitBreakerService();
    const second = new AiCircuitBreakerService();
    for (let i = 0; i < 5; i++) first.recordFailure('groq', 'model-a', 'scope');
    expect(first.isOpen('groq', 'model-a', 'scope')).toBe(true);
    expect(second.isOpen('groq', 'model-a', 'scope')).toBe(false);
  });
});
