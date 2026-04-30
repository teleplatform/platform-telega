export interface LoopGuard {
  limit: number;
  iterations: number;
  lastProgressAt: number;
}

export function createLoopGuard(limit: number = 100): LoopGuard {
  return { limit, iterations: 0, lastProgressAt: 0 };
}

export function tickLoopGuard(guard: LoopGuard): { ok: boolean; reason?: string } {
  guard.iterations++;
  if (guard.iterations > guard.limit) {
    return { ok: false, reason: `iteration_limit_reached: ${guard.iterations}/${guard.limit}` };
  }
  return { ok: true };
}

export function recordProgress(guard: LoopGuard): void {
  guard.lastProgressAt = guard.iterations;
}

export function assertLoopProgress(guard: LoopGuard, maxStallIterations: number = 20): { ok: boolean; reason?: string } {
  const stall = guard.iterations - guard.lastProgressAt;
  if (stall > maxStallIterations) {
    return { ok: false, reason: `no_progress_for_${stall}_iterations` };
  }
  return { ok: true };
}
