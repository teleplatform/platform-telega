import { RuntimeSnapshot, RootCauseResult, FailureChain, FixCandidate, RuntimeReport } from "./runtimeTypes";
import { captureRuntimeSnapshot } from "./runtimeSnapshot";
import { analyzeRootCause } from "./rootCause";
import { buildFailureChain } from "./failureChain";
import { generateFixCandidates } from "./fixCandidate";

export async function generateRuntimeReport(sessionId: string): Promise<RuntimeReport> {
  const snapshot = await captureRuntimeSnapshot(sessionId);
  const rootCause = analyzeRootCause(snapshot)!;
  const failureChain = buildFailureChain(snapshot, rootCause);
  const candidates = generateFixCandidates(snapshot);

  return {
    rootCause,
    failureChain,
    candidates,
    snapshot,
    generatedAt: Date.now(),
  };
}

export function generateReportFromSnapshot(snapshot: RuntimeSnapshot): RuntimeReport {
  const rootCause = analyzeRootCause(snapshot)!;
  const failureChain = buildFailureChain(snapshot, rootCause);
  const candidates = generateFixCandidates(snapshot);

  return {
    rootCause,
    failureChain,
    candidates,
    snapshot,
    generatedAt: Date.now(),
  };
}
