import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { expireOldApprovals, readAllRequestsForSweeper } from "../evidence/replay-approval-queue.js";
import { expireOldExecutionApprovals, readAllExecutionRequests } from "../policy/execution-approval-queue.js";
import { getOpenIncidents, resolveIncident } from "../incidents/runtime-incident-command.js";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";
import { generateOperationalDigest } from "./operational-runtime.js";
import {
  createRuntimeRecoveryDashboard,
  createRuntimeStateSnapshot,
  runRecoveryIntegrityAudit,
  simulateFullRuntimeRestart,
} from "./recovery-operations.js";

export type RuntimeMaintenanceState = "normal" | "maintenance" | "degraded" | "recovery" | "emergency";
export type OperationalPriority = "critical" | "high" | "normal" | "background";
export type RuntimeStability = "stable" | "degraded" | "critical" | "unstable";

export interface RuntimeSchedulerJob {
  job: "digest" | "audits" | "snapshots" | "cleanup" | "replay_retry" | "recovery_verification";
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

export interface RuntimeSchedulerCycle {
  cycle_id: string;
  ran_at: string;
  jobs: RuntimeSchedulerJob[];
}

export interface RetryPolicy {
  max_attempts: number;
  backoff_ms: number;
  escalation_severity: "high" | "critical";
}

export interface OperationalPriorityJob {
  job_id: string;
  priority: OperationalPriority;
  kind: string;
  trace_id?: string;
  payload?: Record<string, unknown>;
  status: "queued" | "acquired" | "deferred";
  created_at: string;
  acquired_at?: string;
}

export interface RuntimeOperationalMetrics {
  metrics_id: string;
  generated_at: string;
  mttr_ms: number | null;
  incident_rate: number;
  replay_success: number;
  approval_latency_ms: number | null;
  recovery_success: number;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const COORDINATION_DIR = path.join(DATA_DIR, "mission-control", "coordination");
const MAINTENANCE_PATH = path.join(COORDINATION_DIR, "maintenance-state.json");
const PRIORITY_QUEUE_PATH = path.join(COORDINATION_DIR, "priority-queue.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-coordination-freeze.json");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((value): value is T => value !== null);
}

function writeJsonl<T>(filePath: string, values: T[]): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, values.map((value) => JSON.stringify(value)).join("\n") + "\n", { encoding: "utf8" });
}

function priorityWeight(priority: OperationalPriority): number {
  return priority === "critical" ? 4 : priority === "high" ? 3 : priority === "normal" ? 2 : 1;
}

export function getRuntimeMaintenanceState(): { state: RuntimeMaintenanceState; updated_at: string; reason?: string } {
  if (!fs.existsSync(MAINTENANCE_PATH)) {
    return { state: "normal", updated_at: new Date(0).toISOString(), reason: "default" };
  }
  try {
    return JSON.parse(fs.readFileSync(MAINTENANCE_PATH, "utf8")) as { state: RuntimeMaintenanceState; updated_at: string; reason?: string };
  } catch {
    return { state: "degraded", updated_at: new Date().toISOString(), reason: "maintenance_state_unreadable" };
  }
}

export async function setRuntimeMaintenanceState(
  state: RuntimeMaintenanceState,
  reason?: string,
): Promise<{ state: RuntimeMaintenanceState; updated_at: string; reason?: string }> {
  ensureDir(COORDINATION_DIR);
  const value = { state, updated_at: new Date().toISOString(), reason };
  fs.writeFileSync(MAINTENANCE_PATH, JSON.stringify(value, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`maintenance_${value.updated_at}`, "runtime_maintenance_state_updated"),
    trace_id: "runtime_maintenance",
    job_id: "mission_control",
    type: "runtime_maintenance_state_updated",
    timestamp: value.updated_at,
    payload: value,
  });
  return value;
}

export async function enqueueOperationalPriorityJob(input: {
  priority: OperationalPriority;
  kind: string;
  trace_id?: string;
  payload?: Record<string, unknown>;
}): Promise<OperationalPriorityJob> {
  const job: OperationalPriorityJob = {
    job_id: `opq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    priority: input.priority,
    kind: input.kind,
    trace_id: input.trace_id,
    payload: input.payload,
    status: "queued",
    created_at: new Date().toISOString(),
  };
  const jobs = readJsonl<OperationalPriorityJob>(PRIORITY_QUEUE_PATH);
  jobs.push(job);
  writeJsonl(PRIORITY_QUEUE_PATH, jobs);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(job.job_id, "operational_priority_job_enqueued"),
    trace_id: input.trace_id || job.job_id,
    job_id: "mission_control",
    type: "operational_priority_job_enqueued",
    timestamp: job.created_at,
    payload: job as unknown as Record<string, unknown>,
  });
  return job;
}

export async function acquireNextOperationalPriorityJob(): Promise<OperationalPriorityJob | null> {
  const jobs = readJsonl<OperationalPriorityJob>(PRIORITY_QUEUE_PATH);
  const queued = jobs
    .filter((job) => job.status === "queued")
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const next = queued[0];
  if (!next) return null;
  next.status = "acquired";
  next.acquired_at = new Date().toISOString();
  writeJsonl(PRIORITY_QUEUE_PATH, jobs.map((job) => job.job_id === next.job_id ? next : job));
  await appendEvidenceRecord({
    evidence_id: hashTraceId(next.job_id, "operational_priority_job_acquired"),
    trace_id: next.trace_id || next.job_id,
    job_id: "mission_control",
    type: "operational_priority_job_acquired",
    timestamp: next.acquired_at,
    payload: next as unknown as Record<string, unknown>,
  });
  return next;
}

export async function checkRuntimeLoadShedding(input: {
  priority: OperationalPriority;
  queue_depth?: number;
  active_jobs?: number;
}): Promise<{ allowed: boolean; action: "allow" | "defer" | "shed"; reason: string }> {
  const queueDepth = input.queue_depth ?? readJsonl<OperationalPriorityJob>(PRIORITY_QUEUE_PATH).filter((job) => job.status === "queued").length;
  const activeJobs = input.active_jobs ?? readJsonl<OperationalPriorityJob>(PRIORITY_QUEUE_PATH).filter((job) => job.status === "acquired").length;
  const maintenance = getRuntimeMaintenanceState().state;
  const overloaded = queueDepth >= 10 || activeJobs >= 5 || maintenance === "emergency" || maintenance === "recovery";
  const critical = input.priority === "critical" || input.priority === "high";
  const action: "allow" | "defer" | "shed" = !overloaded ? "allow" : critical ? "allow" : input.priority === "normal" ? "defer" : "shed";
  const result = {
    allowed: action === "allow",
    action,
    reason: !overloaded ? "capacity_available" : critical ? "preserve_critical_loop" : "overload_low_priority",
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`load_shed_${Date.now()}`, "runtime_load_shedding_checked"),
    trace_id: "runtime_load_shedding",
    job_id: "mission_control",
    type: "runtime_load_shedding_checked",
    timestamp: new Date().toISOString(),
    payload: { ...result, priority: input.priority, queue_depth: queueDepth, active_jobs: activeJobs, maintenance },
  });
  return result;
}

export async function runAutonomousRetry(input: {
  trace_id: string;
  failure_kind: "transient" | "permanent";
  attempt: number;
  policy?: RetryPolicy;
}): Promise<{ retried: boolean; escalated: boolean; next_attempt?: number; reason: string }> {
  const policy = input.policy || { max_attempts: 3, backoff_ms: 1000, escalation_severity: "high" as const };
  const retried = input.failure_kind === "transient" && input.attempt < policy.max_attempts;
  const escalated = input.failure_kind !== "transient" || input.attempt >= policy.max_attempts;
  const result = {
    retried,
    escalated,
    next_attempt: retried ? input.attempt + 1 : undefined,
    reason: retried ? "transient_retry_scheduled" : "retry_policy_exceeded",
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${input.trace_id}_${input.attempt}`, "autonomous_retry_attempted"),
    trace_id: input.trace_id,
    job_id: "mission_control",
    type: "autonomous_retry_attempted",
    timestamp: new Date().toISOString(),
    payload: { ...result, failure_kind: input.failure_kind, policy },
  });
  if (escalated) {
    await enqueueOperationalPriorityJob({
      priority: policy.escalation_severity === "critical" ? "critical" : "high",
      kind: "retry_escalation",
      trace_id: input.trace_id,
      payload: { failure_kind: input.failure_kind, attempt: input.attempt },
    });
  }
  return result;
}

export async function runAutonomousCleanup(input?: {
  incident_max_age_ms?: number;
  snapshot_max_age_ms?: number;
}): Promise<{ expired_execution_approvals: number; expired_replay_approvals: number; resolved_incidents: number; dead_snapshots: number }> {
  const expiredExecution = expireOldExecutionApprovals();
  const expiredReplay = expireOldApprovals();
  const incidentMaxAge = input?.incident_max_age_ms ?? 24 * 60 * 60 * 1000;
  let resolvedIncidents = 0;
  for (const incident of getOpenIncidents()) {
    const age = Date.now() - new Date(incident.opened_at).getTime();
    if ((incident.severity === "info" || incident.severity === "low") && age > incidentMaxAge) {
      const resolved = await resolveIncident(incident.incident_id);
      if (resolved) resolvedIncidents++;
    }
  }

  const snapshotDir = path.join(DATA_DIR, "runtime-snapshots");
  const snapshotMaxAge = input?.snapshot_max_age_ms ?? 7 * 24 * 60 * 60 * 1000;
  let deadSnapshots = 0;
  if (fs.existsSync(snapshotDir)) {
    for (const filename of fs.readdirSync(snapshotDir)) {
      if (!filename.endsWith(".json")) continue;
      const fullPath = path.join(snapshotDir, filename);
      const age = Date.now() - fs.statSync(fullPath).mtimeMs;
      if (age > snapshotMaxAge) {
        fs.rmSync(fullPath, { force: true });
        deadSnapshots++;
      }
    }
  }

  const result = {
    expired_execution_approvals: expiredExecution,
    expired_replay_approvals: expiredReplay,
    resolved_incidents: resolvedIncidents,
    dead_snapshots: deadSnapshots,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`cleanup_${Date.now()}`, "autonomous_cleanup_completed"),
    trace_id: "runtime_cleanup",
    job_id: "mission_control",
    type: "autonomous_cleanup_completed",
    timestamp: new Date().toISOString(),
    payload: result,
  });
  return result;
}

export async function runRuntimeSchedulerCycle(jobs?: RuntimeSchedulerJob["job"][]): Promise<RuntimeSchedulerCycle> {
  const selected = jobs || ["digest", "audits", "snapshots", "cleanup", "replay_retry", "recovery_verification"];
  const cycle: RuntimeSchedulerCycle = {
    cycle_id: `scheduler_${Date.now()}`,
    ran_at: new Date().toISOString(),
    jobs: [],
  };
  for (const job of selected) {
    try {
      let result: Record<string, unknown>;
      if (job === "digest") result = await generateOperationalDigest() as unknown as Record<string, unknown>;
      else if (job === "audits") result = await runRecoveryIntegrityAudit() as unknown as Record<string, unknown>;
      else if (job === "snapshots") result = await createRuntimeStateSnapshot() as unknown as Record<string, unknown>;
      else if (job === "cleanup") result = await runAutonomousCleanup() as unknown as Record<string, unknown>;
      else if (job === "replay_retry") result = await runAutonomousRetry({ trace_id: cycle.cycle_id, failure_kind: "transient", attempt: 0 }) as unknown as Record<string, unknown>;
      else result = await createRuntimeRecoveryDashboard() as unknown as Record<string, unknown>;
      cycle.jobs.push({ job, status: "completed", result });
    } catch (e: any) {
      cycle.jobs.push({ job, status: "failed", error: e?.message || String(e) });
    }
  }
  await appendEvidenceRecord({
    evidence_id: hashTraceId(cycle.cycle_id, "runtime_scheduler_cycle_ran"),
    trace_id: cycle.cycle_id,
    job_id: "mission_control",
    type: "runtime_scheduler_cycle_ran",
    timestamp: cycle.ran_at,
    payload: cycle as unknown as Record<string, unknown>,
  });
  return cycle;
}

export async function buildRuntimeCoordinationGraph(traceId?: string): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).filter((record) => !traceId || record.trace_id === traceId || record.parent_trace_id === traceId || record.replay_of === traceId);
  const nodes = new Map<string, Record<string, unknown>>();
  const edges: Array<Record<string, unknown>> = [];
  for (const record of records) {
    const id = String(record.payload?.incident_id || record.payload?.approval_id || record.payload?.replay_trace_id || record.trace_id);
    nodes.set(id, { id, trace_id: record.trace_id, last_type: record.type });
    if (record.parent_trace_id) edges.push({ from: record.parent_trace_id, to: record.trace_id, relation: "parent" });
    if (record.replay_of) edges.push({ from: record.replay_of, to: record.trace_id, relation: "replay" });
    if (record.payload?.approval_id && record.trace_id) edges.push({ from: record.trace_id, to: record.payload.approval_id, relation: "approval" });
    if (record.payload?.incident_id && record.trace_id) edges.push({ from: record.trace_id, to: record.payload.incident_id, relation: "incident" });
  }
  const graph = {
    graph_id: `coord_graph_${Date.now()}`,
    generated_at: new Date().toISOString(),
    trace_id: traceId,
    nodes: Array.from(nodes.values()),
    edges,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(graph.graph_id), "runtime_coordination_graph_built"),
    trace_id: traceId || String(graph.graph_id),
    job_id: "mission_control",
    type: "runtime_coordination_graph_built",
    timestamp: graph.generated_at,
    payload: { node_count: graph.nodes.length, edge_count: edges.length, trace_id: traceId },
  });
  return graph;
}

export async function generateOperationalMetrics(): Promise<RuntimeOperationalMetrics> {
  const records = readEvidenceRecords({ order: "asc" });
  const opened = records.filter((record) => record.type === "runtime_incident_opened");
  const resolved = records.filter((record) => record.type === "runtime_incident_resolved");
  const mttrs = resolved.map((record) => {
    const incidentId = String(record.payload?.incident_id || record.trace_id);
    const open = opened.find((candidate) => String(candidate.payload?.incident_id || candidate.trace_id) === incidentId);
    return open ? new Date(record.timestamp).getTime() - new Date(open.timestamp).getTime() : null;
  }).filter((value): value is number => value !== null);
  const replayFinished = records.filter((record) => record.type === "replay_finished");
  const approvals = readAllExecutionRequests();
  const approvalLatencies = approvals
    .filter((approval) => approval.decided_at)
    .map((approval) => new Date(approval.decided_at!).getTime() - new Date(approval.created_at).getTime())
    .filter((value) => Number.isFinite(value));
  const restartSims = records.filter((record) => record.type === "runtime_restart_simulation_completed");
  const metrics: RuntimeOperationalMetrics = {
    metrics_id: `op_metrics_${Date.now()}`,
    generated_at: new Date().toISOString(),
    mttr_ms: mttrs.length ? mttrs.reduce((a, b) => a + b, 0) / mttrs.length : null,
    incident_rate: opened.length,
    replay_success: replayFinished.length ? replayFinished.filter((record) => record.lifecycle_state !== "failed").length / replayFinished.length : 1,
    approval_latency_ms: approvalLatencies.length ? approvalLatencies.reduce((a, b) => a + b, 0) / approvalLatencies.length : null,
    recovery_success: restartSims.length ? restartSims.filter((record) => record.payload?.closure === "recovered").length / restartSims.length : 1,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(metrics.metrics_id, "operational_metrics_generated"),
    trace_id: metrics.metrics_id,
    job_id: "mission_control",
    type: "operational_metrics_generated",
    timestamp: metrics.generated_at,
    payload: metrics as unknown as Record<string, unknown>,
  });
  return metrics;
}

export async function calculateRuntimeStabilityScore(): Promise<{ score: number; state: RuntimeStability; reasons: string[] }> {
  const metrics = await generateOperationalMetrics();
  const open = getOpenIncidents();
  const budgets = getAllBudgets();
  const reasons: string[] = [];
  let score = 100;
  const criticalIncidents = open.filter((incident) => incident.severity === "critical" || incident.severity === "civilization_risk").length;
  const highIncidents = open.filter((incident) => incident.severity === "high").length;
  score -= criticalIncidents * 30;
  score -= highIncidents * 15;
  if (metrics.replay_success < 0.8) {
    score -= 15;
    reasons.push("replay_success_below_80_percent");
  }
  if (metrics.recovery_success < 1) {
    score -= 20;
    reasons.push("recovery_success_below_100_percent");
  }
  for (const budget of budgets) {
    if (budget.limit > 0 && budget.used / budget.limit >= 0.9) {
      score -= 10;
      reasons.push(`budget_${budget.category}_pressure`);
    }
  }
  if (criticalIncidents) reasons.push("critical_incidents_open");
  if (highIncidents) reasons.push("high_incidents_open");
  score = Math.max(0, Math.min(100, score));
  const state: RuntimeStability = score >= 85 ? "stable" : score >= 60 ? "degraded" : score >= 35 ? "critical" : "unstable";
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`stability_${Date.now()}`, "runtime_stability_score_generated"),
    trace_id: "runtime_stability",
    job_id: "mission_control",
    type: "runtime_stability_score_generated",
    timestamp: new Date().toISOString(),
    payload: { score, state, reasons },
  });
  return { score, state, reasons };
}

export async function createRuntimeCoordinationFreeze(): Promise<Record<string, unknown>> {
  const [cycle, graph, metrics, stability] = await Promise.all([
    runRuntimeSchedulerCycle(["digest", "audits", "snapshots", "cleanup"]),
    buildRuntimeCoordinationGraph(),
    generateOperationalMetrics(),
    calculateRuntimeStabilityScore(),
  ]);
  const recoverySimulation = await simulateFullRuntimeRestart("runtime_coordination_freeze");
  const freeze = {
    freeze_id: `rc5_coordination_freeze_${Date.now()}`,
    scope: "RC-5 Autonomous Runtime Coordination",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    cycle,
    graph: { graph_id: graph.graph_id, nodes: (graph.nodes as unknown[]).length, edges: (graph.edges as unknown[]).length },
    metrics,
    stability,
    recovery_simulation: recoverySimulation,
    capabilities: [
      "runtime_scheduler",
      "autonomous_retry_engine",
      "runtime_maintenance_window",
      "operational_priority_queue",
      "runtime_load_shedding",
      "autonomous_cleanup_engine",
      "runtime_coordination_graph",
      "operational_metrics_engine",
      "runtime_stability_score",
    ],
  };
  ensureDir(path.dirname(FREEZE_PATH));
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_coordination_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "mission_control",
    type: "runtime_coordination_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
