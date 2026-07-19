/**
 * TGP-18A — Provider Quality Runtime Contracts
 *
 * Types for quality signals, evaluation, and aggregation.
 * Independent of Health Runtime (TGP-17A) and Scoring Engine (TGP-17B).
 */

import type { ProviderId } from "./provider-resolution.js";
import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";
import { hashTraceId } from "../runtime/evidence/execution-hash.js";

// ─── Quality Signal Taxonomy ──────────────────────────────────────────────────

export type QualitySignalType =
  | "execution_success"
  | "execution_failure"
  | "retry_required"
  | "fallback_required"
  | "schema_valid"
  | "schema_invalid"
  | "tool_call_valid"
  | "tool_call_invalid"
  | "task_completed"
  | "task_incomplete"
  | "task_failed";

export const QUALITY_SIGNAL_TYPES: QualitySignalType[] = [
  "execution_success",
  "execution_failure",
  "retry_required",
  "fallback_required",
  "schema_valid",
  "schema_invalid",
  "tool_call_valid",
  "tool_call_invalid",
  "task_completed",
  "task_incomplete",
  "task_failed",
];

export type TaskType =
  | "chat"
  | "reasoning"
  | "code"
  | "vision"
  | "function_calling"
  | "structured_output"
  | "long_context"
  | "generic";

// ─── Evaluation Input ─────────────────────────────────────────────────────────

export interface ProviderQualityEvaluationInput {
  providerId: ProviderId;
  modelId?: string;
  taskType: TaskType;
  requestId: string;

  // Execution signals
  executionOk: boolean;
  failureType?: string;
  retryCount: number;
  fallbackUsed: boolean;

  // Structured output signals
  schemaValid?: boolean;
  schemaErrors?: string[];

  // Tool call signals
  toolCallsAttempted?: number;
  toolCallsValid?: number;

  // Task outcome
  taskCompleted: boolean;
  completionQuality?: "full" | "partial" | "none";

  // Metadata
  latencyMs: number;
  timestamp: number;
}

// ─── Quality Signals ──────────────────────────────────────────────────────────

export interface ProviderQualitySignal {
  signalType: QualitySignalType;
  providerId: ProviderId;
  modelId?: string;
  taskType: TaskType;
  requestId: string;
  value: number;
  weight: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export type QualitySignalDimension =
  | "taskCompletion"
  | "schemaCompliance"
  | "toolCallValidity"
  | "retryEfficiency"
  | "fallbackAvoidance"
  | "validatorScore";

export const QUALITY_DIMENSIONS: QualitySignalDimension[] = [
  "taskCompletion",
  "schemaCompliance",
  "toolCallValidity",
  "retryEfficiency",
  "fallbackAvoidance",
  "validatorScore",
];

// ─── Rolling Aggregation ──────────────────────────────────────────────────────

export interface ProviderQualityConfig {
  maxSamplesPerBucket: number;
  minimumSamplesForConfidence: number;
  dimensionWeights: Record<QualitySignalDimension, number>;
}

export const DEFAULT_QUALITY_CONFIG: ProviderQualityConfig = {
  maxSamplesPerBucket: 100,
  minimumSamplesForConfidence: 20,
  dimensionWeights: {
    taskCompletion: 0.30,
    schemaCompliance: 0.20,
    toolCallValidity: 0.20,
    retryEfficiency: 0.10,
    fallbackAvoidance: 0.10,
    validatorScore: 0.10,
  },
};

export interface RollingQualityBucket {
  providerId: ProviderId;
  modelId?: string;
  taskType: TaskType;
  signals: ProviderQualitySignal[];
  counts: Partial<Record<QualitySignalType, number>>;
  dimensionScores: Partial<Record<QualitySignalDimension, number>>;
  totalSamples: number;
  lastUpdated: number;
}

export function createEmptyBucket(
  providerId: ProviderId,
  modelId: string | undefined,
  taskType: TaskType,
): RollingQualityBucket {
  return {
    providerId,
    modelId,
    taskType,
    signals: [],
    counts: {},
    dimensionScores: {},
    totalSamples: 0,
    lastUpdated: Date.now(),
  };
}

export function addSignalToBucket(
  bucket: RollingQualityBucket,
  signal: ProviderQualitySignal,
  config: ProviderQualityConfig = DEFAULT_QUALITY_CONFIG,
): void {
  bucket.signals.push(signal);
  bucket.totalSamples++;
  bucket.lastUpdated = signal.timestamp;

  const key = signal.signalType;
  bucket.counts[key] = (bucket.counts[key] || 0) + 1;

  if (bucket.signals.length > config.maxSamplesPerBucket) {
    const evicted = bucket.signals.shift()!;
    bucket.counts[evicted.signalType] = (bucket.counts[evicted.signalType] || 1) - 1;
  }

  recalculateDimensionScores(bucket, config);
}

function recalculateDimensionScores(
  bucket: RollingQualityBucket,
  config: ProviderQualityConfig,
): void {
  const completed = bucket.counts.task_completed || 0;
  const incomplete = bucket.counts.task_incomplete || 0;
  const failed = bucket.counts.task_failed || 0;
  const totalTask = completed + incomplete + failed;
  if (totalTask > 0) {
    bucket.dimensionScores.taskCompletion = completed / totalTask;
  }

  const schemaValid = bucket.counts.schema_valid || 0;
  const schemaInvalid = bucket.counts.schema_invalid || 0;
  const totalSchema = schemaValid + schemaInvalid;
  if (totalSchema > 0) {
    bucket.dimensionScores.schemaCompliance = schemaValid / totalSchema;
  }

  const toolValid = bucket.counts.tool_call_valid || 0;
  const toolInvalid = bucket.counts.tool_call_invalid || 0;
  const totalTool = toolValid + toolInvalid;
  if (totalTool > 0) {
    bucket.dimensionScores.toolCallValidity = toolValid / totalTool;
  }

  const retries = bucket.signals
    .filter((s) => s.signalType === "retry_required")
    .reduce((sum, s) => sum + s.value, 0);
  const execSignals = bucket.signals.filter((s) =>
    ["execution_success", "execution_failure"].includes(s.signalType),
  );
  if (execSignals.length > 0) {
    bucket.dimensionScores.retryEfficiency = 1 - Math.min(retries / execSignals.length, 1);
  }

  const fallbacks = bucket.counts.fallback_required || 0;
  const totalExec = bucket.signals.filter((s) =>
    ["execution_success", "execution_failure"].includes(s.signalType),
  ).length;
  if (totalExec > 0) {
    bucket.dimensionScores.fallbackAvoidance = 1 - Math.min(fallbacks / totalExec, 1);
  }

  bucket.dimensionScores.validatorScore = 1.0;
}

// ─── Aggregated Snapshots ──────────────────────────────────────────────────────

export interface ProviderQualityBreakdown {
  taskCompletion: number;
  schemaCompliance: number;
  toolCallValidity: number;
  retryEfficiency: number;
  fallbackAvoidance: number;
  validatorScore: number;
}

export interface ProviderQualitySnapshot {
  providerId: ProviderId;
  modelId?: string;
  taskType: TaskType;
  totalSamples: number;
  dimensionScores: ProviderQualityBreakdown;
  weightedScore: number;
  confidence: number;
  lastUpdated: number;
}

export function buildQualitySnapshot(
  bucket: RollingQualityBucket,
  config: ProviderQualityConfig = DEFAULT_QUALITY_CONFIG,
): ProviderQualitySnapshot {
  const breakdown: ProviderQualityBreakdown = {
    taskCompletion: bucket.dimensionScores.taskCompletion || 0,
    schemaCompliance: bucket.dimensionScores.schemaCompliance || 0,
    toolCallValidity: bucket.dimensionScores.toolCallValidity || 0,
    retryEfficiency: bucket.dimensionScores.retryEfficiency || 0,
    fallbackAvoidance: bucket.dimensionScores.fallbackAvoidance || 0,
    validatorScore: bucket.dimensionScores.validatorScore || 0,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const dim of QUALITY_DIMENSIONS) {
    const score = breakdown[dim] || 0;
    const weight = config.dimensionWeights[dim] || 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  const confidence = Math.min(
    bucket.totalSamples / config.minimumSamplesForConfidence,
    1,
  );

  return {
    providerId: bucket.providerId,
    modelId: bucket.modelId,
    taskType: bucket.taskType,
    totalSamples: bucket.totalSamples,
    dimensionScores: breakdown,
    weightedScore,
    confidence,
    lastUpdated: bucket.lastUpdated,
  };
}

// ─── Evaluator Interface ───────────────────────────────────────────────────────

export interface ProviderQualityEvaluator {
  readonly id: string;

  evaluate(input: ProviderQualityEvaluationInput): Promise<ProviderQualitySignal[]>;
}

// ─── Quality Registry ──────────────────────────────────────────────────────────

const qualityBuckets = new Map<string, RollingQualityBucket>();

function bucketKey(providerId: ProviderId, taskType: TaskType, modelId?: string): string {
  return `${providerId}:${taskType}${modelId ? `:${modelId}` : ""}`;
}

export function recordQualitySignal(signal: ProviderQualitySignal): void {
  const key = bucketKey(signal.providerId, signal.taskType, signal.modelId);
  let bucket = qualityBuckets.get(key);
  if (!bucket) {
    bucket = createEmptyBucket(signal.providerId, signal.modelId, signal.taskType);
    qualityBuckets.set(key, bucket);
  }
  addSignalToBucket(bucket, signal);
  emitSignalRecorded(signal).catch(() => {});
}

export function recordQualitySignals(signals: ProviderQualitySignal[]): void {
  for (const s of signals) recordQualitySignal(s);
}

export function getQualitySnapshot(
  providerId: ProviderId,
  taskType: TaskType,
  modelId?: string,
): ProviderQualitySnapshot | undefined {
  const key = bucketKey(providerId, taskType, modelId);
  const bucket = qualityBuckets.get(key);
  if (!bucket) return undefined;
  return buildQualitySnapshot(bucket);
}

export function listQualitySnapshots(): ProviderQualitySnapshot[] {
  return Array.from(qualityBuckets.values()).map((b) => buildQualitySnapshot(b));
}

export function resetQualityRegistry(
  providerId?: ProviderId,
  taskType?: TaskType,
  modelId?: string,
): void {
  if (providerId && taskType) {
    const key = bucketKey(providerId, taskType, modelId);
    qualityBuckets.delete(key);
  } else if (providerId) {
    for (const key of qualityBuckets.keys()) {
      if (key.startsWith(`${providerId}:`)) qualityBuckets.delete(key);
    }
  } else {
    qualityBuckets.clear();
  }
}

export function getQualityConfig(): ProviderQualityConfig {
  return DEFAULT_QUALITY_CONFIG;
}

export function setQualityConfig(config: Partial<ProviderQualityConfig>): void {
  Object.assign(DEFAULT_QUALITY_CONFIG, config);
}

// ─── Evidence Emission (non-fatal) ────────────────────────────────────────────

async function emitSignalRecorded(signal: ProviderQualitySignal): Promise<void> {
  try {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(signal.requestId, "quality_signal_recorded"),
      trace_id: signal.requestId,
      job_id: "provider_quality",
      type: "provider.quality.signal_recorded" as any,
      timestamp: new Date(signal.timestamp).toISOString(),
      payload: {
        providerId: signal.providerId,
        modelId: signal.modelId,
        taskType: signal.taskType,
        signalType: signal.signalType,
        value: signal.value,
        weight: signal.weight,
      },
    });
  } catch {
    // non-fatal
  }
}

async function emitEvaluationFailed(evaluatorId: string, input: ProviderQualityEvaluationInput): Promise<void> {
  try {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(input.requestId, "quality_evaluation_failed"),
      trace_id: input.requestId,
      job_id: "provider_quality",
      type: "provider.quality.evaluation_failed" as any,
      timestamp: new Date().toISOString(),
      payload: {
        evaluatorId,
        providerId: input.providerId,
        modelId: input.modelId,
        taskType: input.taskType,
      },
    });
  } catch {
    // non-fatal
  }
}

// ─── Task Type Normalization ───────────────────────────────────────────────────

export function normalizeTaskType(t: string): TaskType {
  if (t === "chat" || t === "conversation" || t === "") return "chat";
  if (t.includes("reasoning") || t.includes("deep")) return "reasoning";
  if (t.includes("code") || t.includes("coding")) return "code";
  if (t.includes("vision") || t.includes("image")) return "vision";
  if (t.includes("function") || t.includes("tool")) return "function_calling";
  if (t.includes("json") || t.includes("schema") || t.includes("structured")) return "structured_output";
  if (t.includes("long") || t.includes("context")) return "long_context";
  return "generic";
}

// ─── Evaluator Chain ──────────────────────────────────────────────────────────

export function buildEvaluationChain(): ProviderQualityEvaluator[] {
  return [
    executionOutcomeEvaluator,
    structuredOutputEvaluator,
    toolCallValidityEvaluator,
    taskCompletionEvaluator,
  ];
}

const executionOutcomeEvaluator: ProviderQualityEvaluator = {
  id: "execution_outcome",
  async evaluate(input: ProviderQualityEvaluationInput) {
    const signals: ProviderQualitySignal[] = [];
    const ts = input.timestamp;
    const base = {
      providerId: input.providerId,
      modelId: input.modelId,
      taskType: input.taskType,
      requestId: input.requestId,
      weight: 1.0,
      timestamp: ts,
    };

    if (input.executionOk) {
      signals.push({ ...base, signalType: "execution_success", value: 1.0 });
    } else {
      signals.push({ ...base, signalType: "execution_failure", value: 0.0 });
    }

    if (input.retryCount > 0) {
      signals.push({ ...base, signalType: "retry_required", value: input.retryCount });
    }
    if (input.fallbackUsed) {
      signals.push({ ...base, signalType: "fallback_required", value: 1.0 });
    }

    return signals;
  },
};

const structuredOutputEvaluator: ProviderQualityEvaluator = {
  id: "structured_output",
  async evaluate(input: ProviderQualityEvaluationInput) {
    if (input.schemaValid === undefined) return [];
    const ts = input.timestamp;
    const base = {
      providerId: input.providerId,
      modelId: input.modelId,
      taskType: input.taskType,
      requestId: input.requestId,
      weight: 1.0,
      timestamp: ts,
    };
    return [{
      ...base,
      signalType: input.schemaValid ? "schema_valid" : "schema_invalid",
      value: input.schemaValid ? 1.0 : 0.0,
    }];
  },
};

const toolCallValidityEvaluator: ProviderQualityEvaluator = {
  id: "tool_call_validity",
  async evaluate(input: ProviderQualityEvaluationInput) {
    const attempted = input.toolCallsAttempted ?? 0;
    const valid = input.toolCallsValid ?? 0;
    if (attempted === 0) return [];
    const ts = input.timestamp;
    const base = {
      providerId: input.providerId,
      modelId: input.modelId,
      taskType: input.taskType,
      requestId: input.requestId,
      weight: 1.0,
      timestamp: ts,
    };
    const signals: ProviderQualitySignal[] = [];
    for (let i = 0; i < attempted; i++) {
      signals.push({
        ...base,
        signalType: i < valid ? "tool_call_valid" : "tool_call_invalid",
        value: i < valid ? 1.0 : 0.0,
      });
    }
    return signals;
  },
};

const taskCompletionEvaluator: ProviderQualityEvaluator = {
  id: "task_completion",
  async evaluate(input: ProviderQualityEvaluationInput) {
    const ts = input.timestamp;
    const base = {
      providerId: input.providerId,
      modelId: input.modelId,
      taskType: input.taskType,
      requestId: input.requestId,
      weight: 1.0,
      timestamp: ts,
    };
    if (input.taskCompleted) {
      return [{
        ...base,
        signalType: "task_completed",
        value: input.completionQuality === "full" ? 1.0 : 0.75,
      }];
    }
    return [{
      ...base,
      signalType: input.completionQuality === "none" ? "task_failed" : "task_incomplete",
      value: 0.0,
    }];
  },
};

// ─── High-Level Evaluation Function ─────────────────────────────────────────────

export async function evaluateProviderQuality(
  input: ProviderQualityEvaluationInput,
): Promise<ProviderQualitySignal[]> {
  const chain = buildEvaluationChain();
  const allSignals: ProviderQualitySignal[] = [];
  for (const evaluator of chain) {
    try {
      const signals = await evaluator.evaluate(input);
      allSignals.push(...signals);
    } catch (e) {
      await emitEvaluationFailed(evaluator.id, input).catch(() => {});
    }
  }
  recordQualitySignals(allSignals);
  return allSignals;
}

// ─── Sanitization ──────────────────────────────────────────────────────────────

export function sanitizeQualitySnapshot(snapshot: ProviderQualitySnapshot): ProviderQualitySnapshot {
  return { ...snapshot };
}