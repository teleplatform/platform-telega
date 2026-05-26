import type { HardeningGateResult, GateVerdict } from './mesh-hardening-types.js';

export interface PreflightCheck {
  name: string;
  check: () => boolean | Promise<boolean>;
  required: boolean;
}

const preflightChecks: PreflightCheck[] = [];

export function registerPreflightCheck(check: PreflightCheck): void {
  preflightChecks.push(check);
}

export async function runPreflightGate(): Promise<HardeningGateResult> {
  const results: { name: string; passed: boolean }[] = [];

  for (const check of preflightChecks) {
    try {
      const passed = await check.check();
      results.push({ name: check.name, passed });
    } catch {
      results.push({ name: check.name, passed: false });
    }
  }

  const failedRequired = results.filter(r => {
    const check = preflightChecks.find(c => c.name === r.name);
    return check?.required && !r.passed;
  });

  const verdict: GateVerdict = failedRequired.length > 0 ? 'fail' : 'pass';
  const score = Math.round((results.filter(r => r.passed).length / Math.max(1, results.length)) * 100);

  return {
    gate: 'preflight',
    verdict,
    score,
    details: `${results.length - failedRequired.length}/${results.length} checks passed`,
    timestamp: Date.now(),
  };
}
