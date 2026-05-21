import os from "node:os";
import type { RuntimeTarget } from "../capability/capability.types.js";
import { getEvidenceByTrace } from "./execution-evidence-store.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";
import { getTraceSummary, computeTraceHealth } from "./trace-inspector.js";
import { buildReplayCandidate } from "./replay-planner.js";
import { evaluateReplayGovernance } from "./replay-governance.js";
import type { ReplayGovernanceResult } from "./replay-governance.js";
import { checkReplayRateLimit } from "./replay-rate-limiter.js";
import type { ReplayRateLimitResult } from "./replay-rate-limiter.js";
import { checkRuntimeDriftGate } from "../health/runtime-drift-gate.js";
import type { DriftGateResult } from "../health/runtime-drift-gate.js";
import { loadExecutionPolicy, evaluateExecutionPolicy } from "./execution-policy-gate.js";
import type { ExecutionPolicyResult } from "./execution-policy-gate.js";

export type PreflightMode = "replay" | "execute";

export interface PreflightInput {
  trace_id: string;
  mode: PreflightMode;
  requested_by?: "manual" | "system" | "mission_control";
  force?: boolean;
  target_override?: RuntimeTarget;
  reason?: string;
  skip_checks?: string[];
}

export type PreflightCheckStatus = "passed" | "warning" | "blocked" | "skipped";

export interface PreflightCheckResult {
  check: string;
  status: PreflightCheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface PreflightResult {
  trace_id: string;
  mode: PreflightMode;
  overall: "passed" | "warning" | "blocked";
  checks: PreflightCheckResult[];
  timestamp: string;
  replay_allowed?: boolean;
  governance_decision?: string;
  approval_required?: boolean;
  rate_limit?: ReplayRateLimitResult;
  governance?: ReplayGovernanceResult;
  drift_gate?: DriftGateResult;
}

const STATUS_ORDER: Record<PreflightCheckStatus, number> = {
  passed: 0,
  skipped: 0,
  warning: 1,
  blocked: 2,
};

function worstStatus(a: PreflightCheckStatus, b: PreflightCheckStatus): PreflightCheckStatus {
  return STATUS_ORDER[a] >= STATUS_ORDER[b] ? a : b;
}

function skipped(check: string, message?: string): PreflightCheckResult {
  return { check, status: "skipped", message: message || "check skipped" };
}

function passed(check: string, message: string, details?: Record<string, unknown>): PreflightCheckResult {
  return { check, status: "passed", message, details };
}

function warning(check: string, message: string, details?: Record<string, unknown>): PreflightCheckResult {
  return { check, status: "warning", message, details };
}

function blocked(check: string, message: string, details?: Record<string, unknown>): PreflightCheckResult {
  return { check, status: "blocked", message, details };
}

export async function checkRuntimePreflight(
  input: PreflightInput,
): Promise<PreflightResult> {
  const checks: PreflightCheckResult[] = [];
  const skipSet = new Set(input.skip_checks || []);

  let governanceResult: ReplayGovernanceResult | undefined;
  let rateLimitResult: ReplayRateLimitResult | undefined;
  let driftGateResult: DriftGateResult | undefined;
  let executionPolicyResult: ExecutionPolicyResult | undefined;

  async function runCheck(
    name: string,
    fn: () => Promise<PreflightCheckResult>,
  ): Promise<void> {
    if (skipSet.has(name)) {
      checks.push(skipped(name));
      return;
    }
    try {
      const result = await fn();
      checks.push(result);
    } catch (e: any) {
      checks.push(blocked(name, `check threw: ${e.message}`));
    }
  }

  // 1. input_valid
  await runCheck("input_valid", async () => {
    if (!input.trace_id || typeof input.trace_id !== "string") {
      return blocked("input_valid", "trace_id is required");
    }
    if (input.mode !== "replay" && input.mode !== "execute") {
      return blocked("input_valid", `invalid mode: ${input.mode}`);
    }
    return passed("input_valid", "input is valid");
  });

  // 2. trace_exists
  await runCheck("trace_exists", async () => {
    const summary = getTraceSummary(input.trace_id);
    if (!summary) {
      return blocked("trace_exists", `trace not found: ${input.trace_id}`);
    }
    return passed("trace_exists", `trace found with ${summary.total_events} events`);
  });

  // 3. trace_health
  await runCheck("trace_health", async () => {
    const records = getEvidenceByTrace(input.trace_id);
    if (records.length === 0) {
      return blocked("trace_health", "no evidence records for trace");
    }
    const { health, reasons } = computeTraceHealth(records);
    if (health === "corrupt" && !input.force) {
      return blocked("trace_health", `trace is corrupt: ${reasons.join(", ")}`);
    }
    if (health === "incomplete") {
      return warning("trace_health", `trace is incomplete: ${reasons.join(", ")}`);
    }
    if (health === "failed") {
      return warning("trace_health", `trace health is failed: ${reasons.join(", ")}`);
    }
    return passed("trace_health", `trace health is ${health}`);
  });

  // 4. resources (lightweight system check)
  await runCheck("resources", async () => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    const freeMB = Math.round(os.freemem() / 1024 / 1024);
    const totalMB = Math.round(os.totalmem() / 1024 / 1024);

    if (freeMB < 100) {
      return warning("resources", `low system memory: ${freeMB}MB free of ${totalMB}MB`, {
        heap_used_mb: heapUsedMB,
        heap_total_mb: heapTotalMB,
        rss_mb: rssMB,
        free_mb: freeMB,
        total_mb: totalMB,
      });
    }
    return passed("resources", `memory OK: ${freeMB}MB free of ${totalMB}MB`, {
      heap_used_mb: heapUsedMB,
      heap_total_mb: heapTotalMB,
      rss_mb: rssMB,
      free_mb: freeMB,
      total_mb: totalMB,
    });
  });

  // 5. drift_gate
  await runCheck("drift_gate", async () => {
    driftGateResult = await checkRuntimeDriftGate();
    if (!driftGateResult.allowed) {
      return blocked("drift_gate", driftGateResult.reason || "drift gate blocked", {
        severity: driftGateResult.severity,
        details: driftGateResult.details,
      });
    }
    return passed("drift_gate", driftGateResult.reason || "drift gate passed", {
      severity: driftGateResult.severity,
    });
  });

  // 6. execution_policy (both modes)
  await runCheck("execution_policy", async () => {
    try {
      loadExecutionPolicy();
    } catch {
      return blocked("execution_policy", "execution policy file could not be loaded");
    }
    if (input.mode === "replay") {
      const records = getEvidenceByTrace(input.trace_id);
      const jobCreated = records.find((r) => r.type === "job_created");
      const taskSnapshot = jobCreated?.payload?.task_snapshot as Record<string, any> | undefined;
      const taskKind = taskSnapshot?.execution?.kind || "generic";
      const target = taskSnapshot?.execution?.target as string | undefined;
      executionPolicyResult = evaluateExecutionPolicy({
        task_kind: taskKind,
        target,
        requested_by: input.requested_by || "manual",
        is_replay: true,
        force: input.force || false,
        target_override: !!input.target_override,
      });
      if (executionPolicyResult.decision === "blocked") {
        return blocked("execution_policy", executionPolicyResult.reason);
      }
      if (executionPolicyResult.decision === "requires_approval") {
        return warning("execution_policy", executionPolicyResult.reason);
      }
      return passed("execution_policy", executionPolicyResult.reason);
    }
    return passed("execution_policy", "execution policy file loaded successfully");
  });

  // 7. replay_candidate (only in replay mode)
  if (input.mode === "replay") {
    await runCheck("replay_candidate", async () => {
      const candidate = buildReplayCandidate(input.trace_id);
      if (!candidate) {
        return blocked("replay_candidate", "cannot build replay candidate");
      }
      if (!candidate.can_replay && !input.force) {
        return blocked("replay_candidate", `not replayable: ${candidate.replay_reason}`);
      }
      return passed("replay_candidate", `replay candidate: ${candidate.replay_reason}`, {
        can_replay: candidate.can_replay,
        suggested_runtime: candidate.suggested_runtime,
      });
    });

    // 8. governance
    await runCheck("governance", async () => {
      governanceResult = evaluateReplayGovernance({
        trace_id: input.trace_id,
        requested_by: input.requested_by || "manual",
        force: input.force || false,
        replay_reason: input.reason,
        target_override: input.target_override,
      });
      if (governanceResult.decision === "denied") {
        return blocked("governance", governanceResult.reason);
      }
      if (governanceResult.decision === "requires_approval") {
        return warning("governance", governanceResult.reason);
      }
      return passed("governance", governanceResult.reason);
    });

    // 9. rate_limit
    await runCheck("rate_limit", async () => {
      rateLimitResult = await checkReplayRateLimit({
        trace_id: input.trace_id,
        force: input.force || false,
      });
      if (!rateLimitResult.allowed) {
        return blocked("rate_limit", rateLimitResult.reason || "rate limit exceeded");
      }
      return passed("rate_limit", "rate limit OK", {
        per_trace: rateLimitResult.limits.per_trace,
        per_hour: rateLimitResult.limits.per_hour,
        force_per_day: rateLimitResult.limits.force_per_day,
      });
    });
  }

  // compute overall status
  let overall: "passed" | "warning" | "blocked" = "passed";
  for (const c of checks) {
    if (c.status === "blocked") {
      overall = "blocked";
      break;
    }
    if (c.status === "warning") {
      overall = "warning";
    }
  }

  const result: PreflightResult = {
    trace_id: input.trace_id,
    mode: input.mode,
    overall,
    checks,
    timestamp: new Date().toISOString(),
    replay_allowed: overall !== "blocked" && !governanceResult?.requires_human,
    governance_decision: governanceResult?.decision,
    approval_required: governanceResult?.decision === "requires_approval",
    rate_limit: rateLimitResult,
    governance: governanceResult,
    drift_gate: driftGateResult,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id, "preflight"),
    trace_id: input.trace_id,
    job_id: input.trace_id,
    type: overall === "blocked" ? "preflight_blocked" : "preflight_checked",
    timestamp: result.timestamp,
    payload: {
      mode: input.mode,
      overall,
      check_count: checks.length,
      blocked_count: checks.filter((c) => c.status === "blocked").length,
      warning_count: checks.filter((c) => c.status === "warning").length,
      governance_decision: governanceResult?.decision,
      approval_required: governanceResult?.decision === "requires_approval",
    },
  });

  return result;
}
