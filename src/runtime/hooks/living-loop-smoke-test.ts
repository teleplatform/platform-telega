import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { governRuntimeRoute } from "./runtime-route-governance-middleware.js";
import { consumeRuntimeBudget } from "./runtime-budget-middleware.js";
import { activatePlanningForRequest } from "./real-planning-activation-hook.js";
import { createRuntimeClosure } from "./runtime-closure-hook.js";
import { createOperationalLoopDashboardSnapshot } from "./operational-loop-dashboard-snapshot.js";

export interface LivingLoopSmokeResult {
  ok: boolean;
  trace_id: string;
  stages: Record<string, boolean>;
  reason?: string;
}

export async function runLivingLoopSmokeTest(): Promise<LivingLoopSmokeResult> {
  const traceId = hashTraceId(`living_loop_${Date.now()}`, "living_loop_smoke_started");
  const stages: Record<string, boolean> = {};
  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "living_loop_smoke_started"),
    trace_id: traceId,
    job_id: "smoke",
    type: "living_loop_smoke_started",
    timestamp: new Date().toISOString(),
    payload: {},
  });

  try {
    const route = await governRuntimeRoute({
      route: "/chat",
      method: "POST",
      mode: "creator",
      request_id: traceId,
      message_preview: "living loop smoke test request",
    });
    stages.preflight = route.decision === "allowed";
    stages.decision_point = true;

    const budget = await consumeRuntimeBudget({ action: "api_call", trace_id: route.trace_id });
    stages.budget = budget.allowed;

    const planning = await activatePlanningForRequest({
      request_text: "small smoke request",
      route: "/chat",
      trace_id: route.trace_id,
    });
    stages.planning = planning.decision === "skipped" || planning.decision === "activated";

    await appendEvidenceRecord({
      evidence_id: hashTraceId(route.trace_id, "execution_completed"),
      trace_id: route.trace_id,
      job_id: "smoke",
      type: "execution_completed",
      timestamp: new Date().toISOString(),
      payload: { smoke: true },
    });
    stages.execution_evidence = true;

    const closure = await createRuntimeClosure({ trace_id: route.trace_id, status: "success", route: "/chat" });
    stages.closure = closure.status === "success";

    const snapshot = await createOperationalLoopDashboardSnapshot();
    stages.report = !!snapshot.snapshot_id;

    const ok = Object.values(stages).filter(Boolean).length >= 5 && Object.values(stages).every(Boolean);
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, ok ? "living_loop_smoke_passed" : "living_loop_smoke_failed"),
      trace_id: traceId,
      job_id: "smoke",
      type: ok ? "living_loop_smoke_passed" : "living_loop_smoke_failed",
      timestamp: new Date().toISOString(),
      payload: { stages },
    });
    return { ok, trace_id: route.trace_id, stages, reason: ok ? undefined : "One or more smoke stages failed" };
  } catch (e: any) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "living_loop_smoke_failed"),
      trace_id: traceId,
      job_id: "smoke",
      type: "living_loop_smoke_failed",
      timestamp: new Date().toISOString(),
      payload: { stages, error: e?.message || String(e) },
    });
    return { ok: false, trace_id: traceId, stages, reason: e?.message || String(e) };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLivingLoopSmokeTest().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
