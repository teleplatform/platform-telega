import type { SigmaForgeResult } from './sigma-forge-types.js';

let results: SigmaForgeResult[] = [];

export function pushResult(result: SigmaForgeResult): void {
  results.push(result);
}

export function getResults(): SigmaForgeResult[] {
  return [...results];
}

export function getLastResult(): SigmaForgeResult | null {
  return results.length > 0 ? results[results.length - 1] : null;
}

export function clearResults(): void {
  results = [];
}

export function getResultCounts(): { total: number; completed: number; failed: number; active: number } {
  let completed = 0;
  let failed = 0;
  let active = 0;
  for (const r of results) {
    if (r.completed) completed++;
    else if (r.errors.length > 0) failed++;
    else active++;
  }
  return { total: results.length, completed, failed, active };
}
