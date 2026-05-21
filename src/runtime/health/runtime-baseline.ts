import fs from "node:fs";
import path from "node:path";
import { getOnlineProfiles } from "../capability/capability-registry.js";
import { getEvidenceCount, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { readAllRequestsForSweeper } from "../evidence/replay-approval-queue.js";
import { loadReplayPolicy, getReplayPolicyHash } from "../evidence/replay-policy-loader.js";
import { loadExecutionPolicy, getExecutionPolicyHash } from "../evidence/execution-policy-gate.js";
import { listAllTraces, getTraceSummary } from "../evidence/trace-inspector.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

const BASELINE_DIR = path.join(process.cwd(), ".data", "execution-evidence");
const BASELINE_FILE = "runtime-baseline.json";
const BASELINE_PATH = path.join(BASELINE_DIR, BASELINE_FILE);

const SECRET_SUBSTRINGS = ["TOKEN", "SECRET", "KEY", "PASSWORD", "AUTH"];

export interface RuntimeBaseline {
  created_at: string;
  package_version: string;
  capability_profiles: Array<{ target: string; status: string; local: boolean }>;
  policy_hash: string;
  execution_policy_hash: string;
  evidence_stats: { total_records: number };
  approval_queue_stats: { total: number; pending: number };
  trace_count: number;
  env_summary: Record<string, string>;
  route_list: string[];
}

function getSafeEnvSummary(): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    const isSecret = SECRET_SUBSTRINGS.some((s) => key.toUpperCase().includes(s));
    summary[key] = isSecret ? "***" : value;
  }
  return summary;
}

function getRouteList(): string[] {
  const routes: string[] = [];
  const fastifyApp = (globalThis as any).__fastify_instance;
  if (fastifyApp?.printRoutes) {
    try {
      const printed = fastifyApp.printRoutes();
      return printed.split("\n").filter((l: string) => l.trim());
    } catch {
      return ["(unavailable)"];
    }
  }
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
  ];
}

export async function createRuntimeBaseline(): Promise<RuntimeBaseline> {
  const profiles = getOnlineProfiles().map((p) => ({
    target: p.target,
    status: p.status,
    local: p.local || false,
  }));

  loadReplayPolicy();
  const policyHash = getReplayPolicyHash();
  loadExecutionPolicy();
  const executionPolicyHash = getExecutionPolicyHash();

  const evidenceStats = { total_records: getEvidenceCount() };

  const allRequests = readAllRequestsForSweeper();
  const approvalQueueStats = {
    total: allRequests.length,
    pending: allRequests.filter((r) => r.status === "pending").length,
  };

  const traces = listAllTraces();

  const baseline: RuntimeBaseline = {
    created_at: new Date().toISOString(),
    package_version: "1.0.0",
    capability_profiles: profiles,
    policy_hash: policyHash,
    execution_policy_hash: executionPolicyHash,
    evidence_stats: evidenceStats,
    approval_queue_stats: approvalQueueStats,
    trace_count: traces.length,
    env_summary: getSafeEnvSummary(),
    route_list: getRouteList(),
  };

  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), { encoding: "utf8" });

  await appendEvidenceRecord({
    evidence_id: hashTraceId("baseline", "runtime_baseline_created"),
    trace_id: "baseline",
    job_id: "baseline",
    type: "runtime_baseline_created",
    timestamp: baseline.created_at,
    payload: {
      package_version: baseline.package_version,
      trace_count: baseline.trace_count,
      evidence_total: baseline.evidence_stats.total_records,
      policy_hash: baseline.policy_hash,
    },
  });

  return baseline;
}

export async function loadRuntimeBaseline(): Promise<RuntimeBaseline | null> {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    const content = fs.readFileSync(BASELINE_PATH, { encoding: "utf8" });
    return JSON.parse(content) as RuntimeBaseline;
  } catch {
    return null;
  }
}

export interface BaselineComparison {
  created_at: string;
  package_version_same: boolean;
  policy_hash_same: boolean;
  execution_policy_hash_same: boolean;
  profile_count_changed: boolean;
  evidence_growth: number;
  approval_queue_growth: number;
  trace_growth: number;
  details: string[];
}

export async function compareRuntimeBaseline(): Promise<{
  current: RuntimeBaseline;
  previous: RuntimeBaseline | null;
  comparison: BaselineComparison;
}> {
  const previous = await loadRuntimeBaseline();
  const current = await createRuntimeBaseline();

  const details: string[] = [];

  const packageVersionSame = previous
    ? previous.package_version === current.package_version
    : true;
  if (!packageVersionSame) {
    details.push(`package version: ${previous!.package_version} → ${current.package_version}`);
  }

  const policyHashSame = previous
    ? previous.policy_hash === current.policy_hash
    : true;
  if (!policyHashSame) {
    details.push(`policy hash changed: ${previous!.policy_hash} → ${current.policy_hash}`);
  }

  const executionPolicyHashSame = previous
    ? previous.execution_policy_hash === current.execution_policy_hash
    : true;
  if (!executionPolicyHashSame) {
    details.push(`execution policy hash changed: ${previous!.execution_policy_hash} → ${current.execution_policy_hash}`);
  }

  const profileCountChanged = previous
    ? previous.capability_profiles.length !== current.capability_profiles.length
    : false;
  if (profileCountChanged) {
    details.push(`profiles: ${previous!.capability_profiles.length} → ${current.capability_profiles.length}`);
  }

  const evidenceGrowth = previous
    ? current.evidence_stats.total_records - previous.evidence_stats.total_records
    : 0;
  if (evidenceGrowth > 0) {
    details.push(`evidence growth: +${evidenceGrowth} records`);
  }

  const approvalQueueGrowth = previous
    ? current.approval_queue_stats.total - previous.approval_queue_stats.total
    : 0;
  if (approvalQueueGrowth !== 0) {
    details.push(`approval queue: ${approvalQueueGrowth > 0 ? "+" : ""}${approvalQueueGrowth} requests`);
  }

  const traceGrowth = previous
    ? current.trace_count - previous.trace_count
    : 0;
  if (traceGrowth > 0) {
    details.push(`traces: +${traceGrowth} new traces`);
  }

  const comparison: BaselineComparison = {
    created_at: current.created_at,
    package_version_same: packageVersionSame,
    policy_hash_same: policyHashSame,
    execution_policy_hash_same: executionPolicyHashSame,
    profile_count_changed: profileCountChanged,
    evidence_growth: evidenceGrowth,
    approval_queue_growth: approvalQueueGrowth,
    trace_growth: traceGrowth,
    details,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId("baseline", "runtime_baseline_compared"),
    trace_id: "baseline",
    job_id: "baseline",
    type: "runtime_baseline_compared",
    timestamp: current.created_at,
    payload: {
      has_previous: !!previous,
      drift_count: details.length,
      details,
    },
  });

  return { current, previous, comparison };
}
