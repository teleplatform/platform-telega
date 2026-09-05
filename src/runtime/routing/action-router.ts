import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { IntentResult, RuntimeIntent, RuntimeRiskLevel } from "../intent/intent.types.js";
import type { ActionRoute, ActionRouteKind } from "./action-route.types.js";

export type { ActionRoute, ActionRouteKind } from "./action-route.types.js";

interface RouteRule {
  intents: RuntimeIntent[];
  route: ActionRouteKind;
  requires_approval: boolean;
  build_task_required: boolean;
  risk_override?: Partial<Record<RuntimeRiskLevel, ActionRouteKind>>;
}

const ROUTE_RULES: RouteRule[] = [
  {
    intents: ["build_project", "modify_repo"],
    route: "sigma_forge",
    requires_approval: false,
    build_task_required: true,
    risk_override: { high: "manual_review", critical: "manual_review" },
  },
  {
    intents: ["research"],
    route: "provider_bridge",
    requires_approval: false,
    build_task_required: false,
    risk_override: { critical: "manual_review" },
  },
  {
    intents: ["analyze_file"],
    route: "direct_answer",
    requires_approval: false,
    build_task_required: false,
    risk_override: { high: "manual_review", critical: "manual_review" },
  },
  {
    intents: ["generate_media"],
    route: "provider_bridge",
    requires_approval: false,
    build_task_required: false,
    risk_override: { critical: "manual_review" },
  },
  {
    intents: ["publish_content"],
    route: "sigma_forge",
    requires_approval: true,
    build_task_required: true,
  },
  {
    intents: ["control_runtime"],
    route: "mission_control",
    requires_approval: false,
    build_task_required: false,
    risk_override: { high: "manual_review", critical: "manual_review" },
  },
  {
    intents: ["answer", "unknown"],
    route: "direct_answer",
    requires_approval: false,
    build_task_required: false,
  },
];

let routerCounter = 0;

export function routeIntent(intentResult: IntentResult): ActionRoute {
  routerCounter++;

  for (const rule of ROUTE_RULES) {
    if (!rule.intents.includes(intentResult.intent)) continue;

    let route = rule.route;
    let requiresApproval = rule.requires_approval;

    if (rule.risk_override && rule.risk_override[intentResult.risk_level]) {
      route = rule.risk_override[intentResult.risk_level]!;
      requiresApproval = route === "manual_review";
    }

    const result: ActionRoute = {
      route,
      reason: `${intentResult.intent} → ${route} (risk: ${intentResult.risk_level})`,
      requires_approval: requiresApproval,
      build_task_required: rule.build_task_required,
    };

    appendEvidenceRecord({
      evidence_id: hashTraceId(`route_${routerCounter}`, "action_routed"),
      trace_id: `route_${routerCounter}`,
      job_id: "routing",
      type: "action_routed",
      timestamp: new Date().toISOString(),
      payload: {
        intent: intentResult.intent,
        risk_level: intentResult.risk_level,
        route: result.route,
        requires_approval: result.requires_approval,
        build_task_required: result.build_task_required,
      },
    });

    return result;
  }

  return {
    route: "direct_answer",
    reason: "Unmatched intent, defaulting to direct answer",
    requires_approval: false,
    build_task_required: false,
  };
}
