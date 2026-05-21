import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkConstitution } from "../constitution/runtime-constitution.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { checkRuntimeBudget } from "./runtime-budget-middleware.js";

export interface ChatRoutePreflightInput {
  route: string;
  method: string;
  user_id?: string;
  session_id?: string;
  request_id?: string;
  message_preview?: string;
  requested_by?: "manual" | "system" | "mission_control" | "agent";
}

export interface ChatRoutePreflightResult {
  trace_id: string;
  request_id: string;
  decision: "allowed" | "blocked" | "requires_approval";
  reason: string;
  evidence_id: string;
}

let preflightCounter = 0;

export async function chatRoutePreflight(
  input: ChatRoutePreflightInput,
): Promise<ChatRoutePreflightResult> {
  preflightCounter++;
  const requestId = input.request_id || `req_${Date.now()}_${preflightCounter}`;
  const traceId = hashTraceId(requestId, "chat_route_preflight_started");
  const message_hash = input.message_preview ? hashTraceId(input.message_preview, "chat_message_preview") : undefined;

  const evidenceId = hashTraceId(traceId, "chat_route_preflight_started");
  await appendEvidenceRecord({
    evidence_id: evidenceId,
    trace_id: traceId,
    job_id: "preflight",
    type: "chat_route_preflight_started",
    timestamp: new Date().toISOString(),
    payload: {
      route: input.route,
      method: input.method,
      user_id: input.user_id,
      session_id: input.session_id,
      message_length: input.message_preview?.length || 0,
      message_hash,
      requested_by: input.requested_by || "system",
    },
  });

  const actor = input.user_id || input.requested_by || "system";
  const constitutionCheck = checkConstitution(`route_${input.route}`, actor);
  const doctrineCheck = await enforceDoctrines("federation");
  const budgetCheck = await checkRuntimeBudget({ action: "api_call", trace_id: traceId, actor_id: actor });

  let decision: "allowed" | "blocked" | "requires_approval" = "allowed";
  let reason = "Preflight passed";

  if (!constitutionCheck.allowed) {
    decision = "blocked";
    reason = `Constitutional violation: ${constitutionCheck.violations.map((v) => v.rule_id).join(", ")}`;
  } else if (doctrineCheck.blocked) {
    decision = "blocked";
    reason = `Doctrine precheck blocked route: ${doctrineCheck.violated_doctrines.map((d) => d.title).join(", ")}`;
  } else if (!budgetCheck.allowed) {
    decision = "blocked";
    reason = `Budget precheck blocked route: ${budgetCheck.reason || "insufficient budget"}`;
  }

  if (decision === "allowed") {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "chat_route_preflight_allowed"),
      trace_id: traceId,
      job_id: "preflight",
      type: "chat_route_preflight_allowed",
      timestamp: new Date().toISOString(),
      payload: { request_id: requestId, route: input.route, method: input.method, message_hash, runtime_context: { trace_id: traceId } },
    });
  } else {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "chat_route_preflight_blocked"),
      trace_id: traceId,
      job_id: "preflight",
      type: "chat_route_preflight_blocked",
      timestamp: new Date().toISOString(),
      payload: { request_id: requestId, route: input.route, method: input.method, reason, message_hash, runtime_context: { trace_id: traceId } },
    });
  }

  return { trace_id: traceId, request_id: requestId, decision, reason, evidence_id: evidenceId };
}
