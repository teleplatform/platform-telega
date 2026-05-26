export type HardeningGate =
  | 'preflight'
  | 'readiness'
  | 'baseline'
  | 'security'
  | 'chaos'
  | 'load'
  | 'timeout'
  | 'regression';

export type GateVerdict = 'pass' | 'fail' | 'warning' | 'skipped';

export interface HardeningGateResult {
  gate: HardeningGate;
  verdict: GateVerdict;
  score: number;
  details: string;
  evidence?: Record<string, unknown>;
  timestamp: number;
}

export interface MeshHardeningReport {
  reportId: string;
  generatedAt: number;
  overallVerdict: GateVerdict;
  overallScore: number;
  gates: HardeningGateResult[];
  baselineHash?: string;
  recommendations: string[];
}
