import type { BrowserPlan, BrowserStep, BrowserStepResult, BrowserTaskResult } from "./browser-types.js";
import { getBrowserSession } from "./browser-session.js";
import { recoverStep } from "./browser-step-recovery.js";
import { saveSessionCheckpoint } from "./browser-session-checkpoint.js";
import { retryWithBackoff } from "./browser-deterministic-retry.js";
import { verifyAll } from "./browser-verifier.js";
import { recordOperation } from "../memory/operational-memory.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

async function verifyStep(step: BrowserStep, previousResult?: import("./browser-types.js").BrowserActionResult): Promise<boolean> {
  if (!step.verify || step.verify.length === 0) return true;
  const results = await verifyAll(step.verify, previousResult);
  return results.every(v => v.passed);
}

export async function resumePlanFromStep(
  plan: BrowserPlan,
  resumeStepIndex: number,
): Promise<BrowserTaskResult> {
  const session = getBrowserSession();
  const stepResults: BrowserStepResult[] = [];
  const screenshotPaths: string[] = [];
  const startedAt = Date.now();

  recordOperation("browser_plan_resumed", `${plan.intent} from step ${resumeStepIndex}`);

  if (resumeStepIndex > 0) {
    const cp = await saveSessionCheckpoint(plan.id, `resume_from_${resumeStepIndex}`);
    screenshotPaths.push(`checkpoint:${cp.id}`);
  }

  let allVerified = true;

  for (let i = resumeStepIndex; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const { result, error } = await recoverStep(plan, step);

    let stepVerified = true;
    let verificationResults: any[] = [];

    if (!error && step.verify && step.verify.length > 0) {
      verificationResults = await verifyAll(step.verify, result);
      stepVerified = verificationResults.every(v => v.passed);
      if (!stepVerified) allVerified = false;
    }

    stepResults.push({
      stepId: step.id,
      label: step.label,
      actionResult: result,
      verified: stepVerified,
      verificationResults,
      evidence: error ? [{ kind: "text_content" as const, content: error, timestamp: Date.now() }] : [],
      error,
      attempts: 1,
    });

    if (error && step.onFail === "stop") break;
  }

  const completedAt = Date.now();

  const summaryLines = [
    `Resumed: ${plan.intent} from step ${resumeStepIndex}`,
    `Steps completed: ${stepResults.length}`,
    `All verified: ${allVerified ? "yes" : "no"}`,
  ];
  for (const sr of stepResults) {
    const status = sr.error ? "❌" : sr.verified ? "✅" : "⚠️";
    summaryLines.push(`  ${status} ${sr.label}: ${sr.error || sr.actionResult.title || "done"}`);
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`resume_${plan.id}`, "execution_started"),
    trace_id: `brw_resume_${plan.id}`,
    job_id: `brw_resume_${plan.id}`,
    type: "execution_started",
    timestamp: new Date().toISOString(),
    payload: { intent: plan.intent, resumeFrom: resumeStepIndex, totalSteps: plan.steps.length },
  });

  recordOperation("browser_plan_resume_completed", `${plan.intent}: ${stepResults.length} steps`);

  return {
    planId: plan.id,
    intent: plan.intent,
    startedAt,
    completedAt,
    allVerified,
    stepResults,
    summary: summaryLines.join("\n"),
    screenshotPaths,
  };
}
