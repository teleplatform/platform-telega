import type { BrowserStep, BrowserActionResult, BrowserStepResult, BrowserPlan } from "./browser-types.js";
import { getBrowserSession } from "./browser-session.js";
import { executeBrowserNavigate, executeBrowserClick, executeBrowserType, executeBrowserScreenshot, executeBrowserExtract, executeBrowserWait } from "./browser-execution.js";
import { verifyAll } from "./browser-verifier.js";
import { createAction } from "../execution/execution-types.js";
import { checkAction } from "../governance/governance-gate.js";
import { recordOperation } from "../memory/operational-memory.js";
import { retryWithBackoff } from "./browser-deterministic-retry.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

const ACTION_MAP: Record<string, (a: ReturnType<typeof createAction>) => Promise<BrowserActionResult>> = {
  browser_navigate: async (a) => executeBrowserNavigate(a),
  browser_click: async (a) => executeBrowserClick(a),
  browser_type: async (a) => executeBrowserType(a),
  browser_screenshot: async (a) => executeBrowserScreenshot(a),
  browser_extract: async (a) => executeBrowserExtract(a),
  browser_wait: async (a) => executeBrowserWait(a),
};

export async function recoverStep(
  plan: BrowserPlan,
  step: BrowserStep,
): Promise<{ result: BrowserActionResult; error?: string }> {
  recordOperation("browser_step_recovery_started", `${plan.intent}/${step.label}`);

  const act = createAction(step.type as any, step.label, step.params);
  const decision = checkAction(act);
  if (decision.blocked) {
    return { result: {}, error: `governance_blocked: ${decision.reason}` };
  }

  const handler = ACTION_MAP[step.type];
  if (!handler) return { result: {}, error: `unknown action type: ${step.type}` };

  try {
    const result = await retryWithBackoff(
      () => handler(act),
      {
        label: step.label,
        maxRetries: step.maxRetries ?? 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
      },
    );

    await appendEvidenceRecord({
      evidence_id: hashTraceId(`recover_${plan.id}_${step.id}`, "execution_completed"),
      trace_id: `brw_recover_${plan.id}`,
      job_id: `brw_recover_${plan.id}`,
      step_id: step.id,
      type: "execution_completed",
      timestamp: new Date().toISOString(),
      payload: { label: step.label, recovered: true, url: result.url, title: result.title },
    });

    recordOperation("browser_step_recovery_completed", `${plan.intent}/${step.label}`);
    return { result };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);

    await appendEvidenceRecord({
      evidence_id: hashTraceId(`recover_${plan.id}_${step.id}`, "execution_failed"),
      trace_id: `brw_recover_${plan.id}`,
      job_id: `brw_recover_${plan.id}`,
      step_id: step.id,
      type: "execution_failed",
      timestamp: new Date().toISOString(),
      payload: { label: step.label, error: errMsg },
    });

    recordOperation("browser_step_recovery_failed", `${plan.intent}/${step.label}: ${errMsg}`);
    return { result: {}, error: errMsg };
  }
}

export async function recoverFailedSteps(
  plan: BrowserPlan,
  failedStepIds: string[],
): Promise<{ recovered: string[]; stillFailed: string[] }> {
  const recovered: string[] = [];
  const stillFailed: string[] = [];

  for (const sid of failedStepIds) {
    const step = plan.steps.find(s => s.id === sid);
    if (!step) { stillFailed.push(sid); continue; }

    const { error } = await recoverStep(plan, step);
    if (error) stillFailed.push(sid);
    else recovered.push(sid);
  }

  return { recovered, stillFailed };
}
