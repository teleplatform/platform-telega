export type CircuitState = "closed" | "open" | "half-open";

type CircuitRecord = {
  failures: number;
  last_failure_at: number;
  open_until: number;
  state: CircuitState;
};

export class CircuitBreaker {
  private circuits = new Map<string, CircuitRecord>();
  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;

  constructor(options?: {
    failureThreshold?: number;
    windowMs?: number;
    cooldownMs?: number;
  }) {
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.windowMs = options?.windowMs ?? 60000; // 60 seconds
    this.cooldownMs = options?.cooldownMs ?? 120000; // 2 minutes
  }

  private getKey(provider: string, model: string): string {
    return `${provider}:${model}`;
  }

  private getOrCreate(key: string): CircuitRecord {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        failures: 0,
        last_failure_at: 0,
        open_until: 0,
        state: "closed",
      });
    }
    return this.circuits.get(key)!;
  }

  isOpen(provider: string, model: string): boolean {
    const key = this.getKey(provider, model);
    const circuit = this.getOrCreate(key);
    const now = Date.now();

    // Check if cooldown period has expired
    if (circuit.state === "open" && now >= circuit.open_until) {
      circuit.state = "half-open";
      circuit.failures = 0;
    }

    return circuit.state === "open";
  }

  recordFailure(provider: string, model: string): void {
    const key = this.getKey(provider, model);
    const circuit = this.getOrCreate(key);
    const now = Date.now();

    // Reset if outside failure window
    if (now - circuit.last_failure_at > this.windowMs) {
      circuit.failures = 0;
    }

    circuit.failures++;
    circuit.last_failure_at = now;

    // Open circuit if threshold exceeded
    if (circuit.failures >= this.failureThreshold) {
      circuit.state = "open";
      circuit.open_until = now + this.cooldownMs;
    }
  }

  recordSuccess(provider: string, model: string): void {
    const key = this.getKey(provider, model);
    const circuit = this.getOrCreate(key);

    // Close circuit on success
    if (circuit.state === "half-open") {
      circuit.state = "closed";
      circuit.failures = 0;
    }
  }

  getState(provider: string, model: string): CircuitState {
    const key = this.getKey(provider, model);
    return this.getOrCreate(key).state;
  }

  getStats(): Record<string, { state: CircuitState; failures: number; open_until: number }> {
    const stats: Record<string, any> = {};
    for (const [key, circuit] of this.circuits.entries()) {
      stats[key] = {
        state: circuit.state,
        failures: circuit.failures,
        open_until: circuit.open_until,
      };
    }
    return stats;
  }
}
