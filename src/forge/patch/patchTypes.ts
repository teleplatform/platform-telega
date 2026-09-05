export type PatchRisk = "low" | "medium" | "high" | "critical";

export interface PatchChunk {
  file: string;
  line: number;
  original: string;
  patched: string;
  description: string;
}

export interface HashSnapshot {
  file: string;
  hash: string;
  content: string;
  timestamp: number;
}

export interface PatchProposal {
  id: string;
  symbol: string;
  rootCause: string;
  risk: PatchRisk;
  riskReason: string;
  chunks: PatchChunk[];
  estimatedImpact: string[];
  generatedAt: number;
}

export interface PatchVerification {
  proposalId: string;
  typecheck: "passed" | "failed" | "skipped";
  lint: "passed" | "failed" | "skipped";
  tests: "passed" | "failed" | "skipped";
  verified: boolean;
  output: string;
}

export interface PatchApplyResult {
  proposalId: string;
  applied: boolean;
  filesChanged: number;
  chunksApplied: number;
  error: string | null;
  hashBefore: HashSnapshot[];
  hashAfter: HashSnapshot[];
}

export interface PatchReport {
  proposal: PatchProposal;
  verification: PatchVerification;
  applyResult: PatchApplyResult | null;
  completedAt: number;
}
