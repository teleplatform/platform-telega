import { VerificationCheck, VerificationRun } from "./verificationTypes";
import { VerificationRegistry } from "./verificationRegistry";
import { ExecutionRegistry, completeExecution, failExecution } from "../execution-runner/index.js";

export function runVerification(
  executionRunId: string,
  checks: VerificationCheck[]
): VerificationRun {
  const run = ExecutionRegistry.get(executionRunId);
  const taskId = run?.taskId || "unknown";
  const graphId = run?.graphId || "unknown";

  const verification = VerificationRegistry.create(executionRunId, taskId, graphId, checks);

  // Auto-resolve: pass or fail based on verdict
  if (verification.verdict === "passed") {
    completeExecution(executionRunId, "All verification checks passed");
  } else if (verification.verdict === "failed") {
    failExecution(executionRunId, verification.summary);
  }
  // needs_review: leave both running and verification pending human review

  return verification;
}

export function createChecks(
  resultAvailable: boolean,
  hasErrors: boolean,
  evidenceProduced: boolean,
  outputNonEmpty: boolean
): VerificationCheck[] {
  return [
    { name: "result_available", passed: resultAvailable, details: resultAvailable ? "Result was produced" : "No result returned" },
    { name: "no_errors", passed: !hasErrors, details: hasErrors ? "Errors were reported" : "No errors" },
    { name: "evidence_produced", passed: evidenceProduced, details: evidenceProduced ? "Evidence was recorded" : "No evidence" },
    { name: "output_non_empty", passed: outputNonEmpty, details: outputNonEmpty ? "Output is non-empty" : "Output is empty" },
  ];
}
