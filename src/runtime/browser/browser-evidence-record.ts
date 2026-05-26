import type { BrowserTaskResult, BrowserStepResult } from "./browser-types.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId, hashOutput } from "../evidence/execution-hash.js";
import type { ExecutionEvidenceRecord } from "../evidence/execution-evidence.types.js";

function browserEvidenceType(status: string, allVerified: boolean): any {
  if (status === "failed") return "execution_failed";
  if (allVerified) return "execution_completed";
  return "execution_finished";
}

export async function recordBrowserTaskEvidence(result: BrowserTaskResult): Promise<string> {
  const traceId = `brw_trace_${result.planId}`;
  const jobId = `brw_job_${result.planId}`;
  const now = new Date().toISOString();

  const record: ExecutionEvidenceRecord = {
    evidence_id: hashTraceId(traceId, browserEvidenceType("done", result.allVerified)),
    trace_id: traceId,
    job_id: jobId,
    type: browserEvidenceType("done", result.allVerified),
    timestamp: now,
    output_hash: hashOutput({
      intent: result.intent,
      steps: result.stepResults.length,
      allVerified: result.allVerified,
      screenshotCount: result.screenshotPaths.length,
    }),
    artifact_ids: result.screenshotPaths.length > 0 ? result.screenshotPaths : undefined,
    payload: {
      intent: result.intent,
      planId: result.planId,
      allVerified: result.allVerified,
      stepCount: result.stepResults.length,
      screenshotCount: result.screenshotPaths.length,
      durationMs: result.completedAt - result.startedAt,
      summary: result.summary,
      failedSteps: result.stepResults.filter(s => s.error).map(s => ({ label: s.label, error: s.error })),
      unverifiedSteps: result.stepResults.filter(s => !s.verified && !s.error).map(s => s.label),
    },
  };

  await appendEvidenceRecord(record);

  for (const sr of result.stepResults) {
    await recordStepEvidence(traceId, jobId, sr, now);
  }

  return traceId;
}

async function recordStepEvidence(traceId: string, jobId: string, step: BrowserStepResult, parentTs: string): Promise<void> {
  const stepType = step.error ? "execution_failed" : step.verified ? "validation_gate_passed" : "validation_gate_failed";

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${traceId}_${step.stepId}`, stepType),
    trace_id: traceId,
    job_id: jobId,
    step_id: step.stepId,
    type: stepType,
    timestamp: parentTs,
    attempt: step.attempts,
    output_hash: hashOutput({
      label: step.label,
      url: step.actionResult.url,
      title: step.actionResult.title,
      found: step.actionResult.elementFound,
      textLength: step.actionResult.text?.length,
    }),
    payload: {
      label: step.label,
      error: step.error,
      verified: step.verified,
      attempts: step.attempts,
      url: step.actionResult.url,
      title: step.actionResult.title,
      elementFound: step.actionResult.elementFound,
      textLength: step.actionResult.text?.length,
      verificationResults: step.verificationResults.map(v => ({
        kind: v.condition.kind,
        target: v.condition.target,
        passed: v.passed,
      })),
      screenshotPath: step.actionResult.screenshotPath,
    },
  });
}
