import { getOnlineProfiles } from "../availability/availability-registry.js";
import { getEvidenceCount } from "../evidence/execution-evidence-store.js";
import { listPendingApprovals, readAllRequestsForSweeper } from "../evidence/replay-approval-queue.js";
import { getReplayApprovalSweeperStatus } from "../evidence/replay-approval-sweeper.js";
import { loadTelegramSenderConfig } from "../mission-control/telegram-sender.js";
import { loadReplayPolicy } from "../evidence/replay-policy-loader.js";
import { listAllTraces, getTraceSummary } from "../evidence/trace-inspector.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type RuntimeHealthStatus = "healthy" | "warning" | "degraded" | "failed";

export interface HealthCheckResult {
  status: RuntimeHealthStatus;
  checks: Record<string, {
    status: RuntimeHealthStatus;
    message: string;
    value?: unknown;
  }>;
  warnings: string[];
  timestamp: string;
}

function healthy(msg: string): { status: "healthy"; message: string } {
  return { status: "healthy", message: msg };
}

function warning(msg: string): { status: "warning"; message: string } {
  return { status: "warning", message: msg };
}

function degraded(msg: string): { status: "degraded"; message: string } {
  return { status: "degraded", message: msg };
}

function failed(msg: string): { status: "failed"; message: string } {
  return { status: "failed", message: msg };
}

function worstStatus(...items: Array<{ status: RuntimeHealthStatus }>): RuntimeHealthStatus {
  const order: Record<RuntimeHealthStatus, number> = { healthy: 0, warning: 1, degraded: 2, failed: 3 };
  let worst: RuntimeHealthStatus = "healthy";
  for (const item of items) {
    if (order[item.status] > order[worst]) worst = item.status;
  }
  return worst;
}

export async function checkRuntimeHealth(): Promise<HealthCheckResult> {
  const checks: Record<string, { status: RuntimeHealthStatus; message: string; value?: unknown }> = {};
  const warnings: string[] = [];

  const profiles = getOnlineProfiles();
  checks.capability_profiles = profiles.length > 0
    ? healthy(`${profiles.length} online profiles`)
    : warning("no online capability profiles");

  const evidenceCount = getEvidenceCount();
  checks.evidence_store = evidenceCount >= 0
    ? healthy(`${evidenceCount} records`)
    : failed("evidence store unreadable");

  try {
    const approvals = readAllRequestsForSweeper();
    checks.approval_queue = healthy(`${approvals.length} total requests`);
  } catch {
    checks.approval_queue = degraded("approval queue unreadable");
  }

  const sweeperStatus = getReplayApprovalSweeperStatus();
  checks.sweeper = sweeperStatus.running
    ? healthy(`running (interval=${sweeperStatus.interval_ms}ms)`)
    : sweeperStatus.enabled
      ? warning("enabled but not running")
      : healthy("disabled");

  const tgConfig = loadTelegramSenderConfig();
  checks.telegram_sender = tgConfig.enabled
    ? healthy("enabled")
    : tgConfig.dry_run
      ? warning("dry-run mode")
      : healthy("disabled");

  try {
    loadReplayPolicy();
    checks.replay_policy = healthy("loaded");
  } catch {
    checks.replay_policy = degraded("replay policy load failed");
  }

  const traces = listAllTraces(5);
  const healthyTraces = traces.filter((t) => {
    const s = getTraceSummary(t);
    return s && s.health === "healthy";
  }).length;
  checks.trace_inspector = traces.length > 0
    ? healthy(`${traces.length} recent traces, ${healthyTraces} healthy`)
    : warning("no traces found (new system)");

  if (warnings.length > 0) {
    checks.warnings = warning(`${warnings.length} warnings`);
  }

  const allCheckResults = Object.values(checks);
  const overall = worstStatus(...allCheckResults);

  const result: HealthCheckResult = {
    status: overall,
    checks,
    warnings,
    timestamp: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId("health", "runtime_health_checked"),
    trace_id: "health",
    job_id: "health",
    type: "runtime_health_checked",
    timestamp: result.timestamp,
    payload: {
      status: overall,
      check_count: Object.keys(checks).length,
      warnings: warnings.length,
    } as unknown as Record<string, unknown>,
  });

  return result;
}
