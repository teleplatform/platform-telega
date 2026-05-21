import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type RuntimeDecisionPointKind =
  | "chat_route"
  | "shell_execution"
  | "browser_action"
  | "file_operation"
  | "model_api_call"
  | "replay"
  | "federation_action"
  | "evolution_proposal"
  | "planning_activation"
  | "budget_check"
  | "incident_escalation"
  | "closure";

export interface RuntimeDecisionPoint {
  point_id: string;
  kind: RuntimeDecisionPointKind;
  owner: string;
  description: string;
  registered_at: string;
}

const REGISTRY = new Map<string, RuntimeDecisionPoint>();

export async function registerRuntimeDecisionPoint(input: {
  kind: RuntimeDecisionPointKind;
  owner?: string;
  description?: string;
  point_id?: string;
  trace_id?: string;
}): Promise<RuntimeDecisionPoint> {
  const point: RuntimeDecisionPoint = {
    point_id: input.point_id || `rdp_${input.kind}`,
    kind: input.kind,
    owner: input.owner || "runtime",
    description: input.description || `${input.kind} decision point`,
    registered_at: new Date().toISOString(),
  };
  REGISTRY.set(point.point_id, point);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(point.point_id, "runtime_decision_point_registered"),
    trace_id: input.trace_id || point.point_id,
    job_id: "decision_registry",
    type: "runtime_decision_point_registered",
    timestamp: point.registered_at,
    payload: { ...point },
  });
  return point;
}

export async function checkRuntimeDecisionPoint(input: {
  kind: RuntimeDecisionPointKind;
  point_id?: string;
  trace_id?: string;
  actor_id?: string;
  context?: Record<string, unknown>;
}): Promise<{ allowed: boolean; point: RuntimeDecisionPoint; reason: string }> {
  const pointId = input.point_id || `rdp_${input.kind}`;
  const point = REGISTRY.get(pointId) || await registerRuntimeDecisionPoint({
    kind: input.kind,
    point_id: pointId,
    trace_id: input.trace_id,
  });

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id || pointId, "runtime_decision_point_checked"),
    trace_id: input.trace_id || pointId,
    job_id: "decision_registry",
    type: "runtime_decision_point_checked",
    timestamp: new Date().toISOString(),
    payload: {
      point_id: point.point_id,
      kind: point.kind,
      actor_id: input.actor_id,
      context: input.context,
      allowed: true,
    },
  });

  return { allowed: true, point, reason: "Decision point checked" };
}

export function listRuntimeDecisionPoints(): RuntimeDecisionPoint[] {
  return Array.from(REGISTRY.values());
}
