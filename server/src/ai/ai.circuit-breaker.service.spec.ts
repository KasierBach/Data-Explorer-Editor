import { AiCircuitBreakerService } from './ai.circuit-breaker.service';

describe('AiCircuitBreakerService', () => {
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
});
