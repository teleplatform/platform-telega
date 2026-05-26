import type { BrowserTaskResult, BrowserPlan, BrowserStep, BrowserStepResult } from "./browser-types.js";
import { planFromIntent } from "./browser-task-planner.js";
import { runBrowserPlan } from "./browser-task-runner.js";
import { getEvidenceByTrace } from "../evidence/execution-evidence-store.js";
import type { ExecutionEvidenceRecord } from "../evidence/execution-evidence.types.js";
import { recordBrowserTaskEvidence } from "./browser-evidence-record.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export function reconstructPlanFromTrace(records: ExecutionEvidenceRecord[]): BrowserPlan | null {
  const taskRecord = records.find(r => r.type === "execution_completed" || r.type === "execution_finished" || r.type === "execution_failed");
  if (!taskRecord?.payload) return null;

  const intent = String(taskRecord.payload.intent ?? "");
  const planId = String(taskRecord.payload.planId ?? `replay_${Date.now()}`);
  if (!intent) return null;

  const stepPayloads = records.filter(r => r.step_id).sort((a, b) => (a.payload?.seq as number || 0) - (b.payload?.seq as number || 0));

  const url = stepPayloads.find(s => s.payload?.url)?.payload?.url as string | undefined;

  const plan = planFromIntent(intent, url || "https://example.com");

  const stepLabels = stepPayloads.filter(s => s.payload?.label).map(s => String(s.payload!.label));
  for (let i = 0; i < plan.steps.length && i < stepLabels.length; i++) {
    plan.steps[i].label = stepLabels[i];
    const stepRecord = stepPayloads[i];
    if (stepRecord?.payload?.selector) plan.steps[i].params.selector = stepRecord.payload.selector as string;
    if (stepRecord?.payload?.url) plan.steps[i].params.url = stepRecord.payload.url as string;
    if (stepRecord?.payload?.text) plan.steps[i].params.text = stepRecord.payload.text as string;
  }

  return plan;
}

export async function replayBrowserTrace(traceId: string): Promise<BrowserTaskResult> {
  const records = getEvidenceByTrace(traceId);
  if (records.length === 0) throw new Error(`No evidence found for trace: ${traceId}`);

  const plan = reconstructPlanFromTrace(records);
  if (!plan) throw new Error(`Cannot reconstruct plan from trace: ${traceId}`);

  plan.id = `${plan.id}_replay`;

  const result = await runBrowserPlan(plan);

  const replayTraceId = await recordBrowserTaskEvidence(result);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "replay_started"),
    trace_id: replayTraceId,
    job_id: `brw_replay_${plan.id}`,
    parent_trace_id: traceId,
    relation: "replay_of",
    type: "replay_started",
    timestamp: new Date().toISOString(),
    payload: { originalTraceId: traceId, intent: plan.intent, steps: plan.steps.length, allVerified: result.allVerified },
  });

  return result;
}
