import type { ExecutionEvidenceRecord, EvidenceRecordType } from "./execution-evidence.types.js";
import { getEvidenceByTrace, readEvidenceRecords } from "./execution-evidence-store.js";
import type { ExecutionCompletionStatus } from "../completion/execution-completion-contract.js";
import { deriveCompletionStatus } from "../completion/execution-completion-contract.js";

export type TraceHealth = "healthy" | "warning" | "failed" | "incomplete" | "corrupt";

export interface TraceSummary {
  trace_id: string;
  job_id: string;
  task_id?: string;
  health: TraceHealth;
  health_reasons: string[];
  status: string;
  total_events: number;
  runtime_target?: string;
  attempt: number;
  duration_ms?: number;
  input_hash?: string;
  output_hash?: string;
  artifact_count: number;
  gates_passed: number;
  gates_failed: number;
  retry_count: number;
  fallback_used: boolean;
  mission_report_sent: boolean;
  completion_status?: ExecutionCompletionStatus;
}

export interface TimelineEvent {
  timestamp: string;
  type: EvidenceRecordType;
  lifecycle_state?: string;
  runtime_target?: string;
  attempt?: number;
  payload?: Record<string, unknown>;
}

export function computeTraceHealth(records: ExecutionEvidenceRecord[]): { health: TraceHealth; reasons: string[] } {
  const reasons: string[] = [];

  if (records.length === 0) {
    return { health: "corrupt", reasons: ["no evidence records found"] };
  }

  const hasJobCreated = records.some((r) => r.type === "job_created");
  if (!hasJobCreated) {
    reasons.push("missing job_created");
  }

  const hasRuntimeSelected = records.some((r) => r.type === "runtime_selected");
  if (!hasRuntimeSelected) {
    reasons.push("missing runtime_selected");
  }

  const hasExecutionStarted = records.some((r) => r.type === "execution_started");
  const hasExecutionFinished = records.some((r) => r.type === "execution_finished");

  if (!hasExecutionStarted) {
    reasons.push("missing execution_started");
  }

  const hasTerminal = records.some((r) =>
    r.type === "execution_finished" &&
    ["completed", "partial", "failed", "blocked"].includes(r.lifecycle_state || ""),
  );

  const hasMissionReport = records.some((r) => r.type === "mission_report_sent");

  const hasFailedValidation = records.some((r) => r.type === "validation_gate_failed");
  const hasRetry = records.some((r) => r.type === "retry_scheduled");
  const hasFallback = records.some((r) => r.type === "fallback_selected");

  if (!hasJobCreated || !hasRuntimeSelected || !hasExecutionStarted) {
    return { health: "corrupt", reasons: [...reasons, "incomplete critical path"] };
  }

  if (!hasTerminal && !hasMissionReport) {
    return { health: "incomplete", reasons: [...reasons, "no terminal state or mission report"] };
  }

  if (hasFailedValidation || hasRetry || hasFallback) {
    const details: string[] = [];
    if (hasFailedValidation) details.push("validation failures");
    if (hasRetry) details.push("retries occurred");
    if (hasFallback) details.push("fallback used");
    return { health: "warning", reasons: [...reasons, ...details] };
  }

  if (hasTerminal || hasMissionReport) {
    return { health: "healthy", reasons: reasons.length ? reasons : ["all checks passed"] };
  }

  return { health: "failed", reasons: reasons.length ? reasons : ["unknown failure state"] };
}

export function getTraceSummary(traceId: string): TraceSummary | null {
  const records = getEvidenceByTrace(traceId);
  if (records.length === 0) return null;

  const { health, reasons } = computeTraceHealth(records);

  const jobCreated = records.find((r) => r.type === "job_created");
  const executionFinished = records.find((r) => r.type === "execution_finished");
  const runtimeSelected = records.find((r) => r.type === "runtime_selected");
  const retries = records.filter((r) => r.type === "retry_scheduled");
  const fallbacks = records.filter((r) => r.type === "fallback_selected");
  const gatesPassed = records.filter((r) => r.type === "validation_gate_passed");
  const gatesFailed = records.filter((r) => r.type === "validation_gate_failed");
  const artifacts = records.filter((r) => r.type === "artifact_emitted");
  const missionReports = records.filter((r) => r.type === "mission_report_sent");

  const attempts = records
    .filter((r) => r.attempt !== undefined)
    .map((r) => r.attempt as number);

  const completionStatus = deriveCompletionStatus(records);

  return {
    trace_id: traceId,
    job_id: jobCreated?.job_id || records[0]?.job_id || "unknown",
    task_id: jobCreated?.task_id,
    health,
    health_reasons: reasons,
    status: executionFinished?.lifecycle_state || "unknown",
    total_events: records.length,
    runtime_target: runtimeSelected?.runtime_target,
    attempt: attempts.length > 0 ? Math.max(...attempts) : 1,
    duration_ms: executionFinished?.payload?.duration_ms as number | undefined,
    input_hash: records.find((r) => r.input_hash)?.input_hash,
    output_hash: records.find((r) => r.output_hash)?.output_hash,
    artifact_count: artifacts.length,
    gates_passed: gatesPassed.length,
    gates_failed: gatesFailed.length,
    retry_count: retries.length,
    fallback_used: fallbacks.length > 0,
    mission_report_sent: missionReports.length > 0,
    completion_status: completionStatus,
  };
}

export function getJobTimeline(jobId: string): TimelineEvent[] {
  const records = readEvidenceRecords({ job_id: jobId, order: "asc" });
  return records.map((r) => ({
    timestamp: r.timestamp,
    type: r.type,
    lifecycle_state: r.lifecycle_state,
    runtime_target: r.runtime_target,
    attempt: r.attempt,
    payload: r.payload,
  }));
}

export function getTraceTimeline(traceId: string): TimelineEvent[] {
  const records = getEvidenceByTrace(traceId).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return records.map((r) => ({
    timestamp: r.timestamp,
    type: r.type,
    lifecycle_state: r.lifecycle_state,
    runtime_target: r.runtime_target,
    attempt: r.attempt,
    payload: r.payload,
  }));
}

export function getFailedGates(traceId: string): Array<{ gate: string; message?: string }> {
  const records = getEvidenceByTrace(traceId);
  return records
    .filter((r) => r.type === "validation_gate_failed")
    .map((r) => ({
      gate: (r.payload?.gate as string) || "unknown",
      message: r.payload?.message as string | undefined,
    }));
}

export function getRetryHistory(traceId: string): Array<{
  attempt: number;
  reason: string;
  delay_ms: number;
  target: string;
  timestamp: string;
}> {
  const records = getEvidenceByTrace(traceId);
  return records
    .filter((r) => r.type === "retry_scheduled")
    .map((r) => ({
      attempt: r.attempt || 0,
      reason: (r.payload?.reason as string) || "unknown",
      delay_ms: (r.payload?.delay_ms as number) || 0,
      target: r.runtime_target || "unknown",
      timestamp: r.timestamp,
    }));
}

export function getRuntimeDecision(traceId: string): {
  selected?: string;
  score?: number;
  reasons?: string[];
  fallback_chain?: string[];
  required_caps?: string[];
} {
  const records = getEvidenceByTrace(traceId);
  const negotiated = records.find((r) => r.type === "capability_negotiated");
  const selected = records.find((r) => r.type === "runtime_selected");
  return {
    selected: selected?.runtime_target || negotiated?.runtime_target,
    score: selected?.payload?.score as number | undefined,
    reasons: selected?.payload?.reasons as string[] | undefined,
    fallback_chain: negotiated?.payload?.fallback_chain as string[] | undefined,
    required_caps: negotiated?.payload?.required as string[] | undefined,
  };
}

export function getArtifactsForTrace(traceId: string): string[] {
  return getEvidenceByTrace(traceId)
    .filter((r) => r.artifact_ids && r.artifact_ids.length > 0)
    .flatMap((r) => r.artifact_ids || []);
}

export function listAllTraces(limit = 50, offset = 0): string[] {
  const records = readEvidenceRecords({ limit, offset, order: "desc" });
  const seen = new Set<string>();
  const traces: string[] = [];
  for (const r of records) {
    if (!seen.has(r.trace_id)) {
      seen.add(r.trace_id);
      traces.push(r.trace_id);
    }
    if (traces.length >= limit) break;
  }
  return traces;
}
