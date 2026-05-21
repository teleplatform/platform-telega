import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { consumeRuntimeBudget } from "./runtime-budget-middleware.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";
import { checkRuntimeMode } from "./runtime-mode-enforcement-hook.js";

export interface ModelApiCallGovernanceInput {
  provider: string;
  model?: string;
  operation?: "chat" | "completion" | "embedding" | "models" | "external_api";
  prompt_preview?: string;
  trace_id?: string;
  requested_by?: "manual" | "system" | "mission_control" | "agent";
  actor_id?: string;
  mode?: "public" | "creator";
  estimated_tokens?: number;
}

export interface ModelApiCallGovernanceResult {
  decision: "allowed" | "blocked";
  reason: string;
  trace_id: string;
  checks: Record<string, "passed" | "blocked" | "warning">;
}

const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 60;
const calls: number[] = [];

function checkRateLimit(): boolean {
  const now = Date.now();
  while (calls.length && calls[0] < now - WINDOW_MS) calls.shift();
  if (calls.length >= MAX_CALLS_PER_WINDOW) return false;
  calls.push(now);
  return true;
}

export async function checkModelApiCallGovernance(
  input: ModelApiCallGovernanceInput,
): Promise<ModelApiCallGovernanceResult> {
  const traceId = input.trace_id || hashTraceId(`model_api_${Date.now()}`, "model_api_call_checked");
  const checks: Record<string, "passed" | "blocked" | "warning"> = {};

  const dp = await checkRuntimeDecisionPoint({
    kind: "model_api_call",
    trace_id: traceId,
    actor_id: input.actor_id || input.requested_by,
    context: { provider: input.provider, model: input.model, operation: input.operation || "chat" },
  });
  checks.decision_point = dp.allowed ? "passed" : "blocked";

  const mode = await checkRuntimeMode({
    mode: input.mode,
    action: "model_api",
    risk: "medium",
    trace_id: traceId,
    actor_id: input.actor_id,
  });
  checks.mode = mode.decision === "allowed" ? "passed" : "blocked";

  const budget = await consumeRuntimeBudget({
    action: "model_call",
    units: Math.max(1, Math.ceil((input.estimated_tokens || 1000) / 1000)),
    trace_id: traceId,
    actor_id: input.actor_id,
    metadata: { provider: input.provider, model: input.model },
  });
  checks.budget = budget.allowed ? "passed" : "blocked";

  const doctrine = await enforceDoctrines("federation");
  checks.epistemic = doctrine.blocked ? "blocked" : "passed";
  checks.rate_limit = checkRateLimit() ? "passed" : "blocked";

  const blocked = Object.values(checks).includes("blocked");
  const reason = blocked
    ? `Model/API call blocked: ${Object.entries(checks).filter(([, v]) => v === "blocked").map(([k]) => k).join(", ")}`
    : "Model/API call allowed";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "model_api_call_checked"),
    trace_id: traceId,
    job_id: "model_api",
    type: "model_api_call_checked",
    timestamp: new Date().toISOString(),
    payload: {
      provider: input.provider,
      model: input.model,
      operation: input.operation || "chat",
      prompt_hash: input.prompt_preview ? hashTraceId(input.prompt_preview, "model_prompt_preview") : undefined,
      checks,
      decision: blocked ? "blocked" : "allowed",
    },
  });

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, blocked ? "model_api_call_blocked" : "model_api_call_allowed"),
    trace_id: traceId,
    job_id: "model_api",
    type: blocked ? "model_api_call_blocked" : "model_api_call_allowed",
    timestamp: new Date().toISOString(),
    payload: { provider: input.provider, model: input.model, reason },
  });

  return { decision: blocked ? "blocked" : "allowed", reason, trace_id: traceId, checks };
}

export async function recordModelApiCallCompleted(input: {
  trace_id: string;
  provider: string;
  model?: string;
  ok: boolean;
  latency_ms?: number;
  tokens_total?: number;
  error?: string;
}): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id, "model_api_call_completed"),
    trace_id: input.trace_id,
    job_id: "model_api",
    type: "model_api_call_completed",
    timestamp: new Date().toISOString(),
    payload: { ...input },
  });
}
