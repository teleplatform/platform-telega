import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { chatRoutePreflight } from "./chat-route-evidence-preflight-hook.js";
import { checkRuntimeBudget } from "./runtime-budget-middleware.js";
import { checkRuntimeDecisionPoint } from "./runtime-decision-point-registry.js";
import { checkRuntimeMode, type RuntimeMode } from "./runtime-mode-enforcement-hook.js";

export interface RuntimeRouteGovernanceInput {
  route: string;
  method: string;
  mode?: RuntimeMode | string;
  user_id?: string;
  session_id?: string;
  request_id?: string;
  message_preview?: string;
  budget_units?: number;
  risk?: "low" | "medium" | "high" | "critical";
}

export interface RuntimeRouteGovernanceResult {
  decision: "allowed" | "blocked";
  reason: string;
  trace_id: string;
  request_id: string;
  mode: RuntimeMode;
}

export async function governRuntimeRoute(input: RuntimeRouteGovernanceInput): Promise<RuntimeRouteGovernanceResult> {
  const preflight = await chatRoutePreflight({
    route: input.route,
    method: input.method,
    user_id: input.user_id,
    session_id: input.session_id,
    request_id: input.request_id,
    message_preview: input.message_preview,
    requested_by: input.mode === "creator" ? "manual" : "system",
  });

  await checkRuntimeDecisionPoint({
    kind: "chat_route",
    trace_id: preflight.trace_id,
    actor_id: input.user_id,
    context: { route: input.route, method: input.method },
  });

  const mode = await checkRuntimeMode({
    mode: input.mode,
    action: "route",
    risk: input.risk || "low",
    trace_id: preflight.trace_id,
    actor_id: input.user_id,
    route: input.route,
  });

  const budget = await checkRuntimeBudget({
    action: input.route.includes("replay") ? "replay" : "api_call",
    units: input.budget_units || 1,
    trace_id: preflight.trace_id,
    actor_id: input.user_id,
    metadata: { route: input.route, method: input.method },
  });

  const blockedReason = preflight.decision === "blocked"
    ? preflight.reason
    : mode.decision === "blocked"
      ? mode.reason
      : !budget.allowed
        ? budget.reason
        : "";
  const decision = blockedReason ? "blocked" : "allowed";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(preflight.trace_id, "runtime_route_governance_checked"),
    trace_id: preflight.trace_id,
    job_id: "route_governance",
    type: "runtime_route_governance_checked",
    timestamp: new Date().toISOString(),
    payload: { route: input.route, method: input.method, mode: mode.mode, budget_allowed: budget.allowed, decision },
  });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(preflight.trace_id, decision === "allowed" ? "runtime_route_governance_allowed" : "runtime_route_governance_blocked"),
    trace_id: preflight.trace_id,
    job_id: "route_governance",
    type: decision === "allowed" ? "runtime_route_governance_allowed" : "runtime_route_governance_blocked",
    timestamp: new Date().toISOString(),
    payload: { route: input.route, method: input.method, reason: blockedReason || "Route governance allowed" },
  });

  return {
    decision,
    reason: blockedReason || "Route governance allowed",
    trace_id: preflight.trace_id,
    request_id: preflight.request_id,
    mode: mode.mode,
  };
}
