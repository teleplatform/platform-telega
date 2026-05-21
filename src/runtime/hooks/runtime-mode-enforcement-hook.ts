import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type RuntimeMode = "public" | "creator";
export type RuntimeModeActionKind =
  | "route"
  | "shell"
  | "file"
  | "federation"
  | "evolution"
  | "planning"
  | "budget"
  | "model_api";

export interface RuntimeModeEnforcementInput {
  mode?: RuntimeMode | string;
  action: RuntimeModeActionKind;
  risk?: "low" | "medium" | "high" | "critical";
  destructive?: boolean;
  mutation?: boolean;
  trace_id?: string;
  actor_id?: string;
  route?: string;
}

export interface RuntimeModeEnforcementResult {
  decision: "allowed" | "blocked";
  mode: RuntimeMode;
  reason: string;
}

function normalizeMode(mode?: string): RuntimeMode {
  return mode === "creator" ? "creator" : "public";
}

export async function checkRuntimeMode(
  input: RuntimeModeEnforcementInput,
): Promise<RuntimeModeEnforcementResult> {
  const mode = normalizeMode(input.mode);
  const highRisk = input.risk === "high" || input.risk === "critical";
  let blocked = false;
  let reason = "Runtime mode allowed";

  if (mode === "public") {
    if (input.action === "shell") {
      blocked = true; reason = "Public mode blocks shell execution";
    } else if (input.action === "file" && (input.destructive || highRisk)) {
      blocked = true; reason = "Public mode blocks destructive/high-risk file operations";
    } else if (input.action === "federation" && (input.mutation || highRisk)) {
      blocked = true; reason = "Public mode blocks federation mutation";
    } else if (input.action === "evolution" && (input.mutation || highRisk)) {
      blocked = true; reason = "Public mode blocks evolution apply/change";
    } else if (input.action === "planning" && highRisk) {
      blocked = true; reason = "Public mode blocks high-risk planning";
    } else if (input.action === "budget" && highRisk) {
      blocked = true; reason = "Public mode blocks high-risk budget consumption";
    }
  }

  const decision = blocked ? "blocked" : "allowed";
  const evidenceType = blocked ? "runtime_mode_blocked" : "runtime_mode_allowed";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id || `${input.action}_${Date.now()}`, evidenceType),
    trace_id: input.trace_id || "runtime_mode",
    job_id: "mode",
    type: evidenceType,
    timestamp: new Date().toISOString(),
    payload: {
      mode,
      action: input.action,
      risk: input.risk,
      destructive: input.destructive,
      mutation: input.mutation,
      route: input.route,
      actor_id: input.actor_id,
      decision,
      reason,
    },
  });

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id || `${input.action}_${Date.now()}`, "runtime_mode_checked"),
    trace_id: input.trace_id || "runtime_mode",
    job_id: "mode",
    type: "runtime_mode_checked",
    timestamp: new Date().toISOString(),
    payload: { mode, action: input.action, decision, reason },
  });

  return { decision, mode, reason };
}
