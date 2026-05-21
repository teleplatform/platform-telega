import type { BuildTask, BuildResult } from "../../types/telecore.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId, hashInput, hashOutput } from "./execution-hash.js";
import type {
  ExecutionEvidenceRecord,
  EvidenceRecordType,
} from "./execution-evidence.types.js";
import type { JobLifecycleState } from "../jobs/job-lifecycle.types.js";
import type { RetryReason } from "../jobs/job-lifecycle.types.js";

function createEvidence(params: {
  jobId: string;
  traceId: string;
  type: EvidenceRecordType;
  taskId?: string;
  lifecycleState?: string;
  runtimeTarget?: string;
  attempt?: number;
  inputHash?: string;
  outputHash?: string;
  artifactIds?: string[];
  payload?: Record<string, unknown>;
}): ExecutionEvidenceRecord {
  return {
    evidence_id: hashTraceId(params.jobId, params.type),
    trace_id: params.traceId,
    job_id: params.jobId,
    task_id: params.taskId,
    type: params.type,
    timestamp: new Date().toISOString(),
    runtime_target: params.runtimeTarget,
    lifecycle_state: params.lifecycleState,
    attempt: params.attempt,
    input_hash: params.inputHash,
    output_hash: params.outputHash,
    artifact_ids: params.artifactIds,
    payload: params.payload,
  };
}

export async function onJobCreated(
  jobId: string,
  traceId: string,
  task: BuildTask,
  parentTraceId?: string,
): Promise<void> {
  const record = createEvidence({
    jobId,
    traceId,
    type: "job_created",
    taskId: task.task_id,
    lifecycleState: "queued",
    inputHash: hashInput(task),
    payload: {
      title: task.goal.title,
      description: task.goal.description,
      kind: task.execution?.kind,
      target: task.execution?.target,
      task_snapshot: task,
    },
  });
  if (parentTraceId) {
    record.parent_trace_id = parentTraceId;
    record.replay_of = parentTraceId;
  }
  await appendEvidenceRecord(record);
}

export async function onLifecycleTransition(
  jobId: string,
  traceId: string,
  fromState: string,
  toState: string,
  taskId?: string,
  attempt?: number,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "lifecycle_transition",
    taskId,
    lifecycleState: toState,
    attempt,
    payload: { from: fromState, to: toState },
  }));
}

export async function onRuntimeSelected(
  jobId: string,
  traceId: string,
  target: string,
  taskId?: string,
  score?: number,
  reasons?: string[],
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "runtime_selected",
    taskId,
    runtimeTarget: target,
    payload: { score, reasons },
  }));
}

export async function onCapabilityNegotiated(
  jobId: string,
  traceId: string,
  required: string[],
  selected: string | null,
  fallbackChain: string[],
  taskId?: string,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "capability_negotiated",
    taskId,
    runtimeTarget: selected || undefined,
    payload: { required, selected, fallback_chain: fallbackChain },
  }));
}

export async function onDispatchStarted(
  jobId: string,
  traceId: string,
  target: string,
  task: BuildTask,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "dispatch_started",
    taskId: task.task_id,
    runtimeTarget: target,
    lifecycleState: "dispatched",
    inputHash: hashInput(task),
    payload: {
      kind: task.execution?.kind,
      path: task.execution?.path,
    },
  }));
}

export async function onExecutionStarted(
  jobId: string,
  traceId: string,
  target: string,
  taskId?: string,
  attempt?: number,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "execution_started",
    taskId,
    runtimeTarget: target,
    lifecycleState: "running",
    attempt,
  }));
}

export async function onExecutionFinished(
  jobId: string,
  traceId: string,
  target: string,
  result: BuildResult,
  attempt?: number,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "execution_finished",
    taskId: result.task_id,
    runtimeTarget: target,
    lifecycleState: result.summary.status,
    attempt,
    outputHash: hashOutput(result),
    artifactIds: result.artifacts?.map((a) => a.name || a.kind),
    payload: {
      status: result.summary.status,
      duration_ms: result.execution?.duration_ms,
      executor: result.execution?.executor,
    },
  }));
}

export async function onValidationGate(
  jobId: string,
  traceId: string,
  gate: string,
  passed: boolean,
  taskId?: string,
  message?: string,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: passed ? "validation_gate_passed" : "validation_gate_failed",
    taskId,
    lifecycleState: "validating",
    payload: { gate, passed, message },
  }));
}

export async function onRetryScheduled(
  jobId: string,
  traceId: string,
  reason: RetryReason,
  attempt: number,
  delayMs: number,
  target: string,
  taskId?: string,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "retry_scheduled",
    taskId,
    runtimeTarget: target,
    attempt,
    payload: { reason, delay_ms: delayMs, next_attempt: attempt + 1 },
  }));
}

export async function onFallbackSelected(
  jobId: string,
  traceId: string,
  fromTarget: string,
  toTarget: string,
  reason: string,
  taskId?: string,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "fallback_selected",
    taskId,
    runtimeTarget: toTarget,
    payload: { from: fromTarget, to: toTarget, reason },
  }));
}

export async function onMissionReportSent(
  jobId: string,
  traceId: string,
  reportLevel: string,
  reportStatus: string,
  taskId?: string,
): Promise<void> {
  await appendEvidenceRecord(createEvidence({
    jobId,
    traceId,
    type: "mission_report_sent",
    taskId,
    lifecycleState: reportStatus,
    payload: { level: reportLevel },
  }));
}
