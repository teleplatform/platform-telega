import type { RuntimeTarget } from "../capability/capability.types.js";
import { getTraceSummary, getFailedGates } from "./trace-inspector.js";
import { getEvidenceByTrace } from "./execution-evidence-store.js";

export type ReplayReason =
  | "validation_failed"
  | "runtime_failed"
  | "partial_result"
  | "manual_request"
  | "not_replayable";

export interface ReplayCandidate {
  trace_id: string;
  job_id: string;
  task_id?: string;
  can_replay: boolean;
  replay_reason: ReplayReason;
  original_input_hash?: string;
  last_output_hash?: string;
  suggested_runtime?: RuntimeTarget;
  failed_gates?: string[];
  missing_artifacts?: string[];
}

export interface ReplayPlan {
  trace_id: string;
  candidate: ReplayCandidate;
  preserve_input: boolean;
  suggested_target: string;
  max_attempts: number;
  skip_validation: boolean;
  skip_capability_negotiation: boolean;
  reason: string;
}

const NON_REPLAYABLE_TERMINAL = new Set(["completed", "blocked"]);

export function buildReplayCandidate(traceId: string): ReplayCandidate | null {
  const summary = getTraceSummary(traceId);
  if (!summary) return null;

  const records = getEvidenceByTrace(traceId);

  const jobCreated = records.find((r) => r.type === "job_created");
  const executionFinished = records.find((r) => r.type === "execution_finished");
  const lastOutputHash = records.filter((r) => r.output_hash).pop()?.output_hash;
  const failedGates = getFailedGates(traceId);

  const reason = determineReplayReason(summary.status, summary.health, failedGates);
  const canReplay = reason !== "not_replayable";
  const suggestedRuntime = suggestRuntime(records, summary);

  const missingArtifacts = canReplay ? detectMissingArtifacts(records, summary) : [];

  return {
    trace_id: traceId,
    job_id: summary.job_id,
    task_id: summary.task_id,
    can_replay: canReplay,
    replay_reason: reason,
    original_input_hash: summary.input_hash,
    last_output_hash: lastOutputHash,
    suggested_runtime: suggestedRuntime,
    failed_gates: failedGates.map((g) => g.gate),
    missing_artifacts: missingArtifacts,
  };
}

export function planReplay(traceId: string): ReplayPlan | null {
  const candidate = buildReplayCandidate(traceId);
  if (!candidate || !candidate.can_replay) return null;

  const preserveInput = candidate.original_input_hash !== undefined;
  const skipValidation = candidate.replay_reason === "validation_failed";
  const skipNegotiation = candidate.suggested_runtime !== undefined;

  const reasonMap: Record<ReplayReason, string> = {
    validation_failed: "Previous execution failed validation gates",
    runtime_failed: "Runtime reported failure, retry with same or fallback target",
    partial_result: "Previous run produced partial result, resume to complete",
    manual_request: "User-requested replay",
    not_replayable: "Execution completed or blocked — not replayable",
  };

  return {
    trace_id: traceId,
    candidate,
    preserve_input: preserveInput,
    suggested_target: candidate.suggested_runtime || "kilo_mcp",
    max_attempts: 2,
    skip_validation: skipValidation,
    skip_capability_negotiation: skipNegotiation,
    reason: reasonMap[candidate.replay_reason],
  };
}

function determineReplayReason(
  status: string,
  health: string,
  failedGates: Array<{ gate: string }>,
): ReplayReason {
  if (status === "completed" || status === "blocked") {
    return "not_replayable";
  }

  if (failedGates.length > 0) {
    return "validation_failed";
  }

  if (status === "partial") {
    return "partial_result";
  }

  if (status === "failed" || health === "failed" || health === "corrupt") {
    return "runtime_failed";
  }

  return "not_replayable";
}

function suggestRuntime(
  records: Array<{ type: string; runtime_target?: string; payload?: Record<string, unknown> }>,
  summary: { fallback_used: boolean; runtime_target?: string },
): RuntimeTarget | undefined {
  const fallbacks = records.filter((r) => r.type === "fallback_selected");
  const lastRuntime = records
    .filter((r) => r.type === "execution_started")
    .pop()?.runtime_target;

  if (summary.fallback_used && lastRuntime === "forge_remote") {
    return "kilo_mcp";
  }

  if (lastRuntime === "kilo_mcp") {
    return "forge_remote";
  }

  return (lastRuntime || "kilo_mcp") as RuntimeTarget;
}

function detectMissingArtifacts(
  records: Array<{ type: string; artifact_ids?: string[] }>,
  summary: { artifact_count: number },
): string[] {
  return [];
}
