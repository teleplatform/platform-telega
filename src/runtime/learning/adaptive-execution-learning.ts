import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getTraceSummary, getFailedGates, getRetryHistory } from "../evidence/trace-inspector.js";

export interface AdaptiveLearningSignal {
  signal_id: string;
  trace_id: string;
  signal_type: "retry_success" | "node_unstable" | "policy_too_strict" | "gate_noisy";
  confidence: number;
  evidence: string[];
  detected_at: string;
}

export interface AdaptiveLearningProposal {
  proposal_id: string;
  signal_id: string;
  type: "adjust_retry_policy" | "deprioritize_node" | "relax_policy" | "tune_gate_thresholds";
  title: string;
  description: string;
  confidence: number;
  evidence_refs: string[];
  severity: "low" | "medium" | "high";
}

const SIGNAL_CACHE: Map<string, AdaptiveLearningSignal[]> = new Map();
let signalCounter = 0;

export function detectLearningSignals(traceId: string): AdaptiveLearningSignal[] {
  const summary = getTraceSummary(traceId);
  if (!summary) return [];

  const signals: AdaptiveLearningSignal[] = [];
  const now = new Date().toISOString();
  const records = getRetryHistory(traceId);
  const failedGates = getFailedGates(traceId);

  if (records.length > 2) {
    signalCounter++;
    const retries = records;
    const failureRetries = retries.filter((r) => r.reason?.includes("fail")).length;
    const hasRecoveryAfterRetry = failureRetries > 0 && retries.length > failureRetries;

    if (hasRecoveryAfterRetry || retries.length > 3) {
      signals.push({
        signal_id: `sig_${traceId.slice(0, 8)}_${signalCounter}`,
        trace_id: traceId,
        signal_type: "retry_success",
        confidence: 0.8,
        evidence: retries.map((r) => `retry:${r.attempt}:${r.reason}`),
        detected_at: now,
      });
    }
  }

  if (failedGates.length > 0) {
    const noiseThreshold = 3;
    const gateFailures = failedGates.reduce(
      (acc, fg) => {
        acc[fg.gate] = (acc[fg.gate] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (const [gate, count] of Object.entries(gateFailures)) {
      if (count > noiseThreshold) {
        signalCounter++;
        signals.push({
          signal_id: `sig_${traceId.slice(0, 8)}_${signalCounter}`,
          trace_id: traceId,
          signal_type: "gate_noisy",
          confidence: 0.7,
          evidence: [`gate:${gate}:failures:${count}`],
          detected_at: now,
        });
      }
    }
  }

  SIGNAL_CACHE.set(traceId, signals);
  return signals;
}

export function createAdaptiveProposal(
  signal: AdaptiveLearningSignal,
  options?: { nodeId?: string; policyId?: string },
): AdaptiveLearningProposal {
  const proposalId = `alp_${signal.signal_id.slice(4)}`;

  let type: AdaptiveLearningProposal["type"];
  let title: string;
  let description: string;
  let severity: AdaptiveLearningProposal["severity"];

  switch (signal.signal_type) {
    case "retry_success":
      type = "adjust_retry_policy";
      title = "Increase retry threshold for successful patterns";
      description = "Retries are succeeding after backoff. Consider increasing retry count or adjusting policy.";
      severity = "medium";
      break;
    case "node_unstable":
      type = "deprioritize_node";
      title = `Deprioritize unstable node: ${options?.nodeId || "unknown"}`;
      description = "Node shows instability patterns. Consider reducing its capability score.";
      severity = "high";
      break;
    case "policy_too_strict":
      type = "relax_policy";
      title = `Relax strict policy: ${options?.policyId || "unknown"}`;
      description = "Policy rejects valid operations. Consider adjusting rules.";
      severity = "medium";
      break;
    case "gate_noisy":
      type = "tune_gate_thresholds";
      title = "Tune noisy validation gate thresholds";
      description = "Gate failing frequently without actual errors. Thresholds may need adjustment.";
      severity = "low";
      break;
    default:
      type = "adjust_retry_policy";
      title = "Adaptive adjustment needed";
      description = "Learning signal detected requiring review.";
      severity = "low";
  }

  const proposal: AdaptiveLearningProposal = {
    proposal_id: proposalId,
    signal_id: signal.signal_id,
    type,
    title,
    description,
    confidence: signal.confidence,
    evidence_refs: signal.evidence,
    severity,
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(proposalId, "adaptive_learning_proposal_created"),
    trace_id: signal.trace_id,
    job_id: signal.trace_id,
    type: "adaptive_learning_proposal_created",
    timestamp: new Date().toISOString(),
    payload: {
      proposal_id: proposal.proposal_id,
      signal_type: signal.signal_type,
      confidence: proposal.confidence,
      severity: proposal.severity,
    },
  });

  return proposal;
}

export function getSignalsForTrace(traceId: string): AdaptiveLearningSignal[] {
  return SIGNAL_CACHE.get(traceId) || [];
}

export function getAdaptiveLearningState(): {
  signals_detected: number;
  proposals_created: number;
} {
  let signalCount = 0;
  SIGNAL_CACHE.forEach((signals) => {
    signalCount += signals.length;
  });
  return {
    signals_detected: signalCount,
    proposals_created: signalCount,
  };
}