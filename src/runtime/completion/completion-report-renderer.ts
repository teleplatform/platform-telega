import type { ExecutionCompletionStatus } from "./execution-completion-contract.js";
import { deriveCompletionStatus } from "./execution-completion-contract.js";
import { getEvidenceByTrace } from "../evidence/execution-evidence-store.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { getTraceSummary, getTraceTimeline, getRuntimeDecision, getFailedGates, getRetryHistory, getArtifactsForTrace } from "../evidence/trace-inspector.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export interface CompletionReport {
  trace_id: string;
  task_id?: string;
  job_id: string;
  final_status: ExecutionCompletionStatus;
  runtime_target?: string;
  duration_ms?: number;
  total_events: number;
  gates: { passed: number; failed: number; failures: Array<{ gate: string; message?: string }> };
  retries: Array<{ attempt: number; reason: string; delay_ms: number }>;
  artifacts: string[];
  verification_result?: string;
  rollback_plan?: string;
  risk_level: "low" | "medium" | "high" | "critical";
  generated_at: string;
}

export const STATUS_RISK: Record<ExecutionCompletionStatus, "low" | "medium" | "high" | "critical"> = {
  done_verified: "low",
  done_unverified: "medium",
  partial_verified: "medium",
  partial_unverified: "high",
  blocked_policy: "medium",
  blocked_approval: "low",
  failed_execution: "high",
  failed_verification: "high",
  rolled_back: "critical",
};

export function buildCompletionReport(traceId: string): CompletionReport | null {
  const summary = getTraceSummary(traceId);
  if (!summary) return null;

  const records = getEvidenceByTrace(traceId);
  const completionStatus = summary.completion_status || deriveCompletionStatus(records);
  const failures = getFailedGates(traceId);
  const retries = getRetryHistory(traceId);
  const artifacts = getArtifactsForTrace(traceId);
  const runtimeDecision = getRuntimeDecision(traceId);

  const hasVerificationPassed = records.some((r) => r.payload?.verification_result === "passed");
  const hasVerificationFailed = records.some((r) => r.payload?.verification_result === "failed");
  const hasRollbackPlan = records.some((r) => r.payload?.rollback_plan !== undefined && r.payload?.rollback_plan !== null);
  const rollbackPlan = records.find((r) => r.payload?.rollback_plan)?.payload?.rollback_plan as string | undefined;

  return {
    trace_id: traceId,
    task_id: summary.task_id,
    job_id: summary.job_id,
    final_status: completionStatus,
    runtime_target: summary.runtime_target,
    duration_ms: summary.duration_ms,
    total_events: summary.total_events,
    gates: {
      passed: summary.gates_passed,
      failed: summary.gates_failed,
      failures,
    },
    retries: retries.map((r) => ({
      attempt: r.attempt,
      reason: r.reason,
      delay_ms: r.delay_ms,
    })),
    artifacts,
    verification_result: hasVerificationPassed ? "passed" : hasVerificationFailed ? "failed" : undefined,
    rollback_plan: rollbackPlan,
    risk_level: STATUS_RISK[completionStatus],
    generated_at: new Date().toISOString(),
  };
}

export function renderCompletionReportText(report: CompletionReport): string {
  const lines: string[] = [];
  lines.push(`COMPLETION REPORT`);
  lines.push(`─`.repeat(60));
  lines.push(`trace_id:    ${report.trace_id}`);
  lines.push(`task_id:     ${report.task_id || "-"}`);
  lines.push(`job_id:      ${report.job_id}`);
  lines.push(`final:       ${report.final_status}`);
  lines.push(`runtime:     ${report.runtime_target || "-"}`);
  lines.push(`duration:    ${report.duration_ms != null ? (report.duration_ms < 1000 ? `${report.duration_ms}ms` : `${(report.duration_ms / 1000).toFixed(1)}s`) : "?"}`);
  lines.push(`risk:        ${report.risk_level}`);
  lines.push(`events:      ${report.total_events}`);
  lines.push(`gates:       ${report.gates.passed} passed, ${report.gates.failed} failed`);
  if (report.gates.failures.length > 0) {
    for (const f of report.gates.failures) {
      lines.push(`  ✗ ${f.gate}${f.message ? ` — ${f.message}` : ""}`);
    }
  }
  if (report.retries.length > 0) {
    lines.push(`retries:     ${report.retries.length}`);
    for (const r of report.retries) {
      lines.push(`  #${r.attempt} ${r.reason} (${r.delay_ms}ms)`);
    }
  }
  if (report.verification_result) {
    lines.push(`verification: ${report.verification_result}`);
  }
  if (report.rollback_plan) {
    lines.push(`rollback:    ${report.rollback_plan}`);
  }
  if (report.artifacts.length > 0) {
    lines.push(`artifacts:`);
    for (const a of report.artifacts) {
      lines.push(`  ${a}`);
    }
  }
  lines.push(`generated:   ${report.generated_at}`);
  lines.push(`─`.repeat(60));
  return lines.join("\n");
}

export async function buildAndRenderCompletionReport(
  traceId: string,
): Promise<{ report: CompletionReport | null; text: string }> {
  const report = buildCompletionReport(traceId);
  if (!report) {
    return { report: null, text: `Trace not found: ${traceId}` };
  }

  const text = renderCompletionReportText(report);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "completion_report_rendered"),
    trace_id: traceId,
    job_id: report.job_id,
    type: "completion_report_rendered",
    timestamp: new Date().toISOString(),
    payload: {
      final_status: report.final_status,
      risk_level: report.risk_level,
      duration_ms: report.duration_ms,
      artifact_count: report.artifacts.length,
    },
  });

  return { report, text };
}
