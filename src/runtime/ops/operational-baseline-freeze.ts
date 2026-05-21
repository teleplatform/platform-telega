import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getOnlineProfiles } from "../capability/capability-registry.js";
import { getEvidenceCount } from "../evidence/execution-evidence-store.js";
import { readAllRequestsForSweeper } from "../evidence/replay-approval-queue.js";
import { readAllExecutionRequests, listPendingExecutionApprovals } from "../policy/execution-approval-queue.js";
import { loadReplayPolicy, getReplayPolicyHash } from "../evidence/replay-policy-loader.js";
import { loadExecutionPolicy, getExecutionPolicyHash } from "../evidence/execution-policy-gate.js";
import { listAllTraces } from "../evidence/trace-inspector.js";
import { checkRuntimeHealth } from "../health/runtime-health-aggregator.js";
import { getReplayApprovalSweeperStatus } from "../evidence/replay-approval-sweeper.js";
import { loadTelegramSenderConfig } from "../mission-control/telegram-sender.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

const FREEZE_DIR = path.join(process.cwd(), ".data", "runtime-baselines");
const FREEZE_FILE = "operational-freeze.json";
const FREEZE_PATH = path.join(FREEZE_DIR, FREEZE_FILE);

export interface OperationalFreeze {
  created_at: string;
  git_commit: string | null;
  build_status: string;
  route_inventory: string[];
  policy_hashes: {
    replay_policy: string;
    execution_policy: string;
  };
  capability_profiles: Array<{ target: string; status: string; local: boolean }>;
  approval_stats: {
    replay: { total: number; pending: number };
    execution: { total: number; pending: number };
  };
  evidence_total: number;
  trace_count: number;
  health: {
    status: string;
    checks: Record<string, string>;
  };
  runtime_config: Record<string, string>;
  sweeper: {
    running: boolean;
    interval_ms: number;
  };
  telegram: {
    enabled: boolean;
    dry_run: boolean;
  };
}

function getGitCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function getSafeRuntimeConfig(): Record<string, string> {
  const keys = [
    "RUNTIME_DRIFT_GATE_ENABLED",
    "RUNTIME_DRIFT_MAX_SEVERITY",
    "REPLAY_MAX_PER_TRACE",
    "REPLAY_MAX_PER_HOUR",
    "REPLAY_MAX_FORCE_PER_DAY",
    "EVIDENCE_RETENTION_DAYS",
    "EVIDENCE_ARCHIVE_ENABLED",
    "REPLAY_APPROVAL_SWEEPER_ENABLED",
    "REPLAY_APPROVAL_SWEEPER_INTERVAL_MS",
    "TELEGRAM_BOT_ENABLED",
    "TELEGRAM_DRY_RUN",
    "RUNTIME_SELFHEAL_ENABLED",
    "EXECUTION_BUDGET_MAX_REPLAYS_PER_DAY",
    "EXECUTION_BUDGET_MAX_EXECUTIONS_PER_DAY",
  ];
  const config: Record<string, string> = {};
  for (const key of keys) {
    const val = process.env[key];
    if (val !== undefined) config[key] = val;
  }
  return config;
}

function getRouteInventory(): string[] {
  return [
    "GET /health",
    "GET /api/runtime/health/full",
    "GET /api/runtime/traces",
    "GET /api/runtime/traces/:trace_id",
    "GET /api/runtime/traces/:trace_id/summary",
    "GET /api/runtime/traces/:trace_id/timeline",
    "GET /api/runtime/traces/:trace_id/lineage",
    "GET /api/runtime/traces/:trace_id/gates",
    "GET /api/runtime/traces/:trace_id/retries",
    "GET /api/runtime/traces/:trace_id/runtime",
    "GET /api/runtime/traces/:trace_id/replay",
    "GET /api/runtime/traces/:trace_id/replay/governance",
    "POST /api/runtime/traces/:trace_id/replay",
    "GET /api/runtime/traces/:trace_id/preflight",
    "GET /api/runtime/replay/approvals",
    "POST /api/runtime/replay/approvals/:id/approve",
    "POST /api/runtime/replay/approvals/:id/deny",
    "POST /api/runtime/replay/approvals/:id/execute",
    "POST /api/runtime/replay/approvals/:id/notify",
    "POST /api/runtime/replay/approvals/sweep",
    "GET /api/runtime/replay/approvals/sweeper/status",
    "POST /api/runtime/replay/approvals/sweeper/start",
    "POST /api/runtime/replay/approvals/sweeper/stop",
    "GET /api/runtime/replay/approvals/audit",
    "POST /api/runtime/replay/approvals/action",
    "POST /api/runtime/replay/approvals/callback",
    "GET /api/runtime/evidence/retention/status",
    "POST /api/runtime/evidence/retention/sweep",
    "POST /api/runtime/baseline/create",
    "GET /api/runtime/baseline/compare",
    "GET /api/runtime/drift/gate",
    "GET /api/runtime/execution/policy",
    "GET /api/runtime/execution/approvals",
    "POST /api/runtime/execution/approvals/:id/approve",
    "POST /api/runtime/execution/approvals/:id/deny",
    "POST /api/runtime/execution/approvals/:id/consume",
    "POST /api/runtime/execution/approvals/action",
    "POST /api/runtime/ops/freeze",
    "GET /api/runtime/ops/freeze/compare",
  ];
}

export async function createOperationalFreeze(): Promise<OperationalFreeze> {
  const gitCommit = getGitCommit();
  const profiles = getOnlineProfiles().map((p) => ({
    target: p.target,
    status: p.status,
    local: p.local || false,
  }));

  loadReplayPolicy();
  loadExecutionPolicy();

  const replayApprovals = readAllRequestsForSweeper();
  const allExecutionApprovals = readAllExecutionRequests();
  const pendingExecutionApprovals = listPendingExecutionApprovals();

  const health = await checkRuntimeHealth();
  const sweeperStatus = getReplayApprovalSweeperStatus();
  const tgConfig = loadTelegramSenderConfig();
  const traces = listAllTraces();

  const healthChecks: Record<string, string> = {};
  for (const [key, check] of Object.entries(health.checks)) {
    healthChecks[key] = check.status;
  }

  const freeze: OperationalFreeze = {
    created_at: new Date().toISOString(),
    git_commit: gitCommit,
    build_status: "pass",
    route_inventory: getRouteInventory(),
    policy_hashes: {
      replay_policy: getReplayPolicyHash(),
      execution_policy: getExecutionPolicyHash(),
    },
    capability_profiles: profiles,
    approval_stats: {
      replay: {
        total: replayApprovals.length,
        pending: replayApprovals.filter((r) => r.status === "pending").length,
      },
      execution: {
        total: allExecutionApprovals.length,
        pending: pendingExecutionApprovals.length,
      },
    },
    evidence_total: getEvidenceCount(),
    trace_count: traces.length,
    health: {
      status: health.status,
      checks: healthChecks,
    },
    runtime_config: getSafeRuntimeConfig(),
    sweeper: {
      running: sweeperStatus.running,
      interval_ms: sweeperStatus.interval_ms,
    },
    telegram: {
      enabled: tgConfig.enabled,
      dry_run: tgConfig.dry_run ?? false,
    },
  };

  if (!fs.existsSync(FREEZE_DIR)) {
    fs.mkdirSync(FREEZE_DIR, { recursive: true });
  }
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });

  await appendEvidenceRecord({
    evidence_id: hashTraceId("freeze", "operational_baseline_frozen"),
    trace_id: "freeze",
    job_id: "freeze",
    type: "operational_baseline_frozen",
    timestamp: freeze.created_at,
    payload: {
      git_commit: freeze.git_commit,
      trace_count: freeze.trace_count,
      health: freeze.health.status,
      evidence_total: freeze.evidence_total,
    },
  });

  return freeze;
}

export async function loadOperationalFreeze(): Promise<OperationalFreeze | null> {
  if (!fs.existsSync(FREEZE_PATH)) return null;
  try {
    const content = fs.readFileSync(FREEZE_PATH, { encoding: "utf8" });
    return JSON.parse(content) as OperationalFreeze;
  } catch {
    return null;
  }
}

export interface FreezeComparison {
  created_at: string;
  git_commit_changed: boolean;
  replay_policy_changed: boolean;
  execution_policy_changed: boolean;
  profile_count_changed: boolean;
  health_status_changed: boolean;
  evidence_growth: number;
  trace_growth: number;
  details: string[];
}

export async function compareOperationalFreeze(): Promise<{
  current: OperationalFreeze;
  previous: OperationalFreeze | null;
  comparison: FreezeComparison;
}> {
  const previous = await loadOperationalFreeze();
  const current = await createOperationalFreeze();

  const details: string[] = [];

  const gitCommitChanged = previous
    ? previous.git_commit !== current.git_commit
    : false;
  if (gitCommitChanged) {
    details.push(`git commit: ${previous!.git_commit} → ${current.git_commit}`);
  }

  const replayPolicyChanged = previous
    ? previous.policy_hashes.replay_policy !== current.policy_hashes.replay_policy
    : false;
  if (replayPolicyChanged) {
    details.push("replay policy hash changed");
  }

  const executionPolicyChanged = previous
    ? previous.policy_hashes.execution_policy !== current.policy_hashes.execution_policy
    : false;
  if (executionPolicyChanged) {
    details.push("execution policy hash changed");
  }

  const profileCountChanged = previous
    ? previous.capability_profiles.length !== current.capability_profiles.length
    : false;
  if (profileCountChanged) {
    details.push(
      `capability profiles: ${previous!.capability_profiles.length} → ${current.capability_profiles.length}`,
    );
  }

  const healthStatusChanged = previous
    ? previous.health.status !== current.health.status
    : false;
  if (healthStatusChanged) {
    details.push(`health: ${previous!.health.status} → ${current.health.status}`);
  }

  const evidenceGrowth = previous
    ? current.evidence_total - previous.evidence_total
    : 0;
  if (evidenceGrowth > 0) {
    details.push(`evidence: +${evidenceGrowth} records`);
  }

  const traceGrowth = previous
    ? current.trace_count - previous.trace_count
    : 0;
  if (traceGrowth > 0) {
    details.push(`traces: +${traceGrowth} new`);
  }

  const comparison: FreezeComparison = {
    created_at: current.created_at,
    git_commit_changed: gitCommitChanged,
    replay_policy_changed: replayPolicyChanged,
    execution_policy_changed: executionPolicyChanged,
    profile_count_changed: profileCountChanged,
    health_status_changed: healthStatusChanged,
    evidence_growth: evidenceGrowth,
    trace_growth: traceGrowth,
    details,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId("freeze", "operational_baseline_compared"),
    trace_id: "freeze",
    job_id: "freeze",
    type: "operational_baseline_compared",
    timestamp: current.created_at,
    payload: {
      has_previous: !!previous,
      drift_count: details.length,
      details,
    },
  });

  return { current, previous, comparison };
}
