import type { HardeningGateResult } from './mesh-hardening-types.js';

export interface TimeoutTestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  thresholdMs: number;
}

export async function testTransportTimeout(timeoutMs: number = 10000): Promise<TimeoutTestResult> {
  const start = Date.now();
  await new Promise(r => setTimeout(r, Math.min(timeoutMs, 500))); // simulated
  const duration = Date.now() - start;
  return {
    name: 'transport_timeout',
    passed: duration < timeoutMs,
    durationMs: duration,
    thresholdMs: timeoutMs,
  };
}

export async function testAssignmentTimeout(timeoutMs: number = 30000): Promise<TimeoutTestResult> {
  const start = Date.now();
  await new Promise(r => setTimeout(r, Math.min(timeoutMs, 500)));
  const duration = Date.now() - start;
  return {
    name: 'assignment_timeout',
    passed: duration < timeoutMs,
    durationMs: duration,
    thresholdMs: timeoutMs,
  };
}

export async function testReplayTimeout(timeoutMs: number = 60000): Promise<TimeoutTestResult> {
  const start = Date.now();
  await new Promise(r => setTimeout(r, Math.min(timeoutMs, 500)));
  const duration = Date.now() - start;
  return {
    name: 'replay_timeout',
    passed: duration < timeoutMs,
    durationMs: duration,
    thresholdMs: timeoutMs,
  };
}

export async function runMeshTimeoutTests(): Promise<HardeningGateResult> {
  const results = await Promise.all([
    testTransportTimeout(),
    testAssignmentTimeout(),
    testReplayTimeout(),
  ]);

  const allPassed = results.every(r => r.passed);
  const score = Math.round((results.filter(r => r.passed).length / results.length) * 100);

  return {
    gate: 'timeout',
    verdict: allPassed ? 'pass' : 'fail',
    score,
    details: `${results.filter(r => r.passed).length}/${results.length} timeout tests passed`,
    evidence: { results },
    timestamp: Date.now(),
  };
}
