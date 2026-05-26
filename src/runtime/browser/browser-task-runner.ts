import type { BrowserPlan, BrowserStep, BrowserStepResult, BrowserTaskResult, BrowserActionResult } from "./browser-types.js";
import { getBrowserSession } from "./browser-session.js";
import { executeBrowserNavigate, executeBrowserClick, executeBrowserType, executeBrowserScreenshot, executeBrowserExtract, executeBrowserWait } from "./browser-execution.js";
import { createAction } from "../execution/execution-types.js";
import { checkAction } from "../governance/governance-gate.js";
import { recordBlockedAction } from "../governance/governance-evidence.js";
import { verifyAll } from "./browser-verifier.js";
import { recordBrowserEvidence } from "./browser-evidence.js";
import { recordOperation } from "../memory/operational-memory.js";

const ACTION_MAP: Record<string, (action: ReturnType<typeof createAction>) => Promise<BrowserActionResult>> = {
  browser_navigate: async (a) => executeBrowserNavigate(a),
  browser_click: async (a) => executeBrowserClick(a),
  browser_type: async (a) => executeBrowserType(a),
  browser_screenshot: async (a) => executeBrowserScreenshot(a),
  browser_extract: async (a) => executeBrowserExtract(a),
  browser_wait: async (a) => executeBrowserWait(a),
};

async function executeStep(step: BrowserStep): Promise<{ result: BrowserActionResult; error?: string }> {
  const act = createAction(step.type as any, step.label, step.params);

  const decision = checkAction(act);
  if (decision.blocked) {
    recordBlockedAction("browser_task", step.id, step.label, step.type, decision.risk, decision.reason, decision.policyMatch);
    return { result: {}, error: `governance_blocked: ${decision.reason}` };
  }

  const handler = ACTION_MAP[step.type];
  if (!handler) return { result: {}, error: `Unknown action type: ${step.type}` };

  try {
    const result = await handler(act);
    return { result };
  } catch (e: unknown) {
    return { result: {}, error: e instanceof Error ? e.message : String(e) };
  }
}

async function captureScreenshot(label: string): Promise<string | undefined> {
  try {
    const act = createAction("browser_screenshot" as any, `screenshot_${label}`, { label });
    const result = await executeBrowserScreenshot(act);
    return result.screenshotPath;
  } catch {
    return undefined;
  }
}

export async function runBrowserPlan(plan: BrowserPlan): Promise<BrowserTaskResult> {
  const session = getBrowserSession();
  const startedAt = Date.now();
  const stepResults: BrowserStepResult[] = [];
  const screenshotPaths: string[] = [];
  let allVerified = true;

  recordOperation("browser_task_started", plan.intent);

  for (const step of plan.steps) {
    let lastError: string | undefined;
    const maxAttempts = (step.onFail === "retry" ? (step.maxRetries ?? 1) : 0) + 1;
    let actionResult: BrowserActionResult = {};
    let attempts = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      const { result, error } = await executeStep(step);
      actionResult = result;
      lastError = error;

      if (!error) break;
      if (error?.startsWith("governance_blocked")) break;
    }

    if (plan.screenshotEvery) {
      const sp = await captureScreenshot(step.label);
      if (sp) screenshotPaths.push(sp);
    }

    let verificationResults: { condition: import("./browser-types.js").VerificationCondition; passed: boolean; actual: string }[] = [];
    let stepVerified = true;

    if (step.verify && step.verify.length > 0) {
      verificationResults = await verifyAll(step.verify, actionResult);
      stepVerified = verificationResults.every(v => v.passed);
      if (!stepVerified) allVerified = false;
    }

    const evidence = lastError
      ? [{ kind: "text_content" as const, content: lastError, timestamp: Date.now() }]
      : [];

    stepResults.push({
      stepId: step.id,
      label: step.label,
      actionResult,
      verified: stepVerified,
      verificationResults,
      evidence,
      error: lastError,
      attempts,
    });

    if (lastError && step.onFail === "stop") break;
  }

  if (!plan.screenshotEvery && plan.steps.length > 0) {
    const sp = await captureScreenshot("final");
    if (sp) screenshotPaths.push(sp);
  }

  const completedAt = Date.now();
  const summaryLines: string[] = [];
  summaryLines.push(`Task: ${plan.intent}`);
  summaryLines.push(`Steps: ${stepResults.length}, Verified: ${allVerified ? "yes" : "no"}`);

  for (const sr of stepResults) {
    const status = sr.error ? "❌" : sr.verified ? "✅" : "⚠️";
    const detail = sr.error ? sr.error : sr.actionResult.title || sr.actionResult.text?.slice(0, 60) || "done";
    summaryLines.push(`  ${status} ${sr.label}: ${detail}`);
  }

  if (screenshotPaths.length > 0) {
    summaryLines.push(`Screenshots: ${screenshotPaths.length}`);
  }

  recordOperation("browser_task_completed", `${plan.intent}: ${allVerified ? "all_verified" : "verification_failed"}`);

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
