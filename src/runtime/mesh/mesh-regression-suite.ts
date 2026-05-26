import type { HardeningGateResult, MeshHardeningReport } from './mesh-hardening-types.js';
import { runPreflightGate } from './mesh-preflight-gate.js';
import { generateMeshReadinessReport } from './mesh-readiness-report.js';
import { runMeshTimeoutTests } from './mesh-timeout-tests.js';
import { runMeshLoadTests } from './mesh-load-tests.js';
import { runMeshChaosTests } from './mesh-chaos-tests.js';

export async function runAllHardeningGates(): Promise<HardeningGateResult[]> {
  const results: HardeningGateResult[] = [];

  results.push(await runPreflightGate());
  results.push(await generateMeshReadinessReport().then(r => ({
    gate: 'readiness' as const,
    verdict: r.overallVerdict,
    score: r.overallScore,
    details: 'Readiness report generated',
    timestamp: Date.now(),
  })));
  results.push(await runMeshTimeoutTests());
  results.push(await runMeshLoadTests());
  results.push(await runMeshChaosTests());

  return results;
}

export async function runMeshRegressionSuite(): Promise<MeshHardeningReport> {
  const gates = await runAllHardeningGates();
  const overallScore = Math.round(gates.reduce((s, g) => s + g.score, 0) / gates.length);
  const hasFail = gates.some(g => g.verdict === 'fail');

  return {
    reportId: `regression_${Date.now()}`,
    generatedAt: Date.now(),
    overallVerdict: hasFail ? 'fail' : 'pass',
    overallScore,
    gates,
    recommendations: hasFail ? ['Address failing gates before production'] : ['Mesh is hardened'],
  };
}

export function aggregateHardeningResults(reports: MeshHardeningReport[]): MeshHardeningReport {
  if (reports.length === 0) throw new Error('No reports to aggregate');

  const avgScore = Math.round(reports.reduce((s, r) => s + r.overallScore, 0) / reports.length);
  const hasFail = reports.some(r => r.overallVerdict === 'fail');

  return {
    reportId: `aggregate_${Date.now()}`,
    generatedAt: Date.now(),
    overallVerdict: hasFail ? 'fail' : 'pass',
    overallScore: avgScore,
    gates: reports.flatMap(r => r.gates),
    recommendations: ['Aggregated from multiple runs'],
  };
}
