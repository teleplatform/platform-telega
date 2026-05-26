import type { HardeningGateResult, GateVerdict, MeshHardeningReport } from './mesh-hardening-types.js';
import { runPreflightGate } from './mesh-preflight-gate.js';

export async function generateMeshReadinessReport(): Promise<MeshHardeningReport> {
  const preflight = await runPreflightGate();

  const gates: HardeningGateResult[] = [preflight];

  const overallScore = Math.round(gates.reduce((sum, g) => sum + g.score, 0) / gates.length);
  const hasFail = gates.some(g => g.verdict === 'fail');

  return {
    reportId: `readiness_${Date.now()}`,
    generatedAt: Date.now(),
    overallVerdict: hasFail ? 'fail' : 'pass',
    overallScore,
    gates,
    recommendations: hasFail ? ['Fix failing preflight checks'] : [],
  };
}
