import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readAllRequestsForSweeper } from "../evidence/replay-approval-queue.js";
import { readAllExecutionRequests } from "../policy/execution-approval-queue.js";
import { getPendingApprovals as getPendingIncidentApprovals, restoreIncidentApprovalsFromEvidence } from "../incidents/incident-approval-gate.js";
import { getOpenIncidents, restoreIncidentsFromEvidence } from "../incidents/runtime-incident-command.js";
import {
  createOperationalRuntimeFreeze,
  generateOperationalDigest,
  getRuntimeOperatorPresence,
  readMissionControlPersistenceFeed,
} from "./operational-runtime.js";
export {
  readReplayRecoveryCheckpoints,
  resumeInterruptedReplay,
  saveReplayRecoveryCheckpoint,
  type ReplayRecoveryCheckpoint,
  type ReplayRecoveryStatus,
} from "./replay-recovery-checkpoints.js";
import {
  readReplayRecoveryCheckpoints,
  resumeInterruptedReplay,
} from "./replay-recovery-checkpoints.js";

export interface RuntimeStateSnapshot {
  snapshot_id: string;
  created_at: string;
  operator: ReturnType<typeof getRuntimeOperatorPresence>;
  approvals: {
    execution_total: number;
    execution_pending: number;
    replay_total: number;
    replay_pending: number;
    incident_pending: number;
  };
  incidents: {
    open: number;
  };
  feed: {
    last_event_id?: string;
    events: number;
  };
  queues: {
    attention_pending: number;
    replay_checkpoints_open: number;
  };
}

export interface RuntimeRecoveryBootResult {
  boot_id: string;
  started_at: string;
  completed_at: string;
  restored: {
    approvals: number;
    incidents: number;
    incident_approvals: number;
    feed_events: number;
    attention_queue: number;
    replay_checkpoints: number;
  };
  snapshot: RuntimeStateSnapshot;
}

export interface RecoveryIntegrityAudit {
  audit_id: string;
  generated_at: string;
  missing_approvals: string[];
  orphan_incidents: string[];
  broken_traces: string[];
  invalid_closures: string[];
  ok: boolean;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const SNAPSHOT_DIR = path.join(DATA_DIR, "runtime-snapshots");
const MISSION_CONTROL_DIR = path.join(DATA_DIR, "mission-control");
const ATTENTION_QUEUE_PATH = path.join(MISSION_CONTROL_DIR, "attention-queue.jsonl");
const RECOVERY_FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-recovery-freeze.json");

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

export function countAttentionQueue(): number {
  return readJsonl<Record<string, unknown>>(ATTENTION_QUEUE_PATH).length;
}

export async function createRuntimeStateSnapshot(): Promise<RuntimeStateSnapshot> {
  ensureDir(SNAPSHOT_DIR);
  const executionApprovals = readAllExecutionRequests();
  const replayApprovals = readAllRequestsForSweeper();
  const feed = readMissionControlPersistenceFeed(500);
  const checkpoints = readReplayRecoveryCheckpoints();
  const snapshot: RuntimeStateSnapshot = {
    snapshot_id: `runtime_snapshot_${Date.now()}`,
    created_at: new Date().toISOString(),
    operator: getRuntimeOperatorPresence(),
    approvals: {
      execution_total: executionApprovals.length,
      execution_pending: executionApprovals.filter((approval) => approval.status === "pending").length,
      replay_total: replayApprovals.length,
      replay_pending: replayApprovals.filter((approval) => approval.status === "pending").length,
      incident_pending: getPendingIncidentApprovals().length,
    },
    incidents: {
      open: getOpenIncidents().length,
    },
    feed: {
      last_event_id: feed[0]?.event_id,
      events: feed.length,
    },
    queues: {
      attention_pending: countAttentionQueue(),
      replay_checkpoints_open: checkpoints.filter((checkpoint) => checkpoint.status !== "finished" && checkpoint.status !== "resumed").length,
    },
  };
  const snapshotPath = path.join(SNAPSHOT_DIR, `${snapshot.snapshot_id}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(snapshot.snapshot_id, "runtime_state_snapshot_created"),
    trace_id: snapshot.snapshot_id,
    job_id: "mission_control",
    type: "runtime_state_snapshot_created",
    timestamp: snapshot.created_at,
    payload: { path: snapshotPath, ...snapshot } as unknown as Record<string, unknown>,
  });
  return snapshot;
}

export async function recoverMissionControlBoot(): Promise<RuntimeRecoveryBootResult> {
  const bootId = `recovery_boot_${Date.now()}`;
  const startedAt = new Date().toISOString();
  await appendEvidenceRecord({
    evidence_id: hashTraceId(bootId, "runtime_recovery_boot_started"),
    trace_id: bootId,
    job_id: "mission_control",
    type: "runtime_recovery_boot_started",
    timestamp: startedAt,
    payload: { boot_id: bootId },
  });

  const incidents = await restoreIncidentsFromEvidence();
  const incidentApprovals = await restoreIncidentApprovalsFromEvidence();
  const replayApprovals = readAllRequestsForSweeper();
  const executionApprovals = readAllExecutionRequests();
  const feed = readMissionControlPersistenceFeed(500);
  const checkpoints = readReplayRecoveryCheckpoints();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(bootId, "queue_persistence_restored"),
    trace_id: bootId,
    job_id: "mission_control",
    type: "queue_persistence_restored",
    timestamp: new Date().toISOString(),
    payload: {
      execution_approvals: executionApprovals.length,
      replay_approvals: replayApprovals.length,
      incident_approvals: incidentApprovals.length,
      attention_queue: countAttentionQueue(),
      replay_checkpoints: checkpoints.length,
    },
  });

  const snapshot = await createRuntimeStateSnapshot();
  const completedAt = new Date().toISOString();
  const result: RuntimeRecoveryBootResult = {
    boot_id: bootId,
    started_at: startedAt,
    completed_at: completedAt,
    restored: {
      approvals: executionApprovals.length + replayApprovals.length,
      incidents: incidents.length,
      incident_approvals: incidentApprovals.length,
      feed_events: feed.length,
      attention_queue: countAttentionQueue(),
      replay_checkpoints: checkpoints.length,
    },
    snapshot,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(bootId, "runtime_recovery_boot_completed"),
    trace_id: bootId,
    job_id: "mission_control",
    type: "runtime_recovery_boot_completed",
    timestamp: completedAt,
    payload: result as unknown as Record<string, unknown>,
  });

  return result;
}

export async function reconstructOperationalTimeline(traceId?: string): Promise<Array<Record<string, unknown>>> {
  const evidence = readEvidenceRecords({ order: "asc" })
    .filter((record) => !traceId || record.trace_id === traceId || record.parent_trace_id === traceId || record.replay_of === traceId)
    .map((record) => ({
      source: "evidence",
      timestamp: record.timestamp,
      trace_id: record.trace_id,
      type: record.type,
      payload: record.payload || {},
    }));
  const feed = readMissionControlPersistenceFeed(1000)
    .filter((event) => !traceId || event.trace_id === traceId)
    .map((event) => ({
      source: "feed",
      timestamp: event.created_at,
      trace_id: event.trace_id,
      type: event.kind,
      payload: event.payload || {},
    }));
  const timeline = [...evidence, ...feed]
    .sort((a, b) => new Date(String(a.timestamp)).getTime() - new Date(String(b.timestamp)).getTime());

  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId || `timeline_${Date.now()}`, "operational_timeline_reconstructed"),
    trace_id: traceId || "mission_control_timeline",
    job_id: "mission_control",
    type: "operational_timeline_reconstructed",
    timestamp: new Date().toISOString(),
    payload: { trace_id: traceId, events: timeline.length },
  });

  return timeline;
}

export async function runRecoveryIntegrityAudit(): Promise<RecoveryIntegrityAudit> {
  const records = readEvidenceRecords({ order: "asc" });
  const requestedApprovalIds = new Set<string>();
  const closedApprovalIds = new Set<string>();
  const openedIncidentIds = new Set<string>();
  const resolvedIncidentIds = new Set<string>();
  const closureStarted = new Set<string>();
  const closureCompleted = new Set<string>();
  const brokenTraces: string[] = [];

  for (const record of records) {
    if (!record.trace_id || !record.evidence_id || !record.timestamp) brokenTraces.push(record.evidence_id || "missing_evidence_id");
    if (record.type === "execution_approval_requested" || record.type === "replay_approval_requested" || record.type === "incident_approval_required") {
      requestedApprovalIds.add(String(record.payload?.approval_id || record.job_id));
    }
    if (record.type === "approval_lifecycle_closed" || record.type === "execution_approval_consumed" || record.type === "replay_approval_consumed" || record.type === "incident_approval_granted" || record.type === "incident_approval_denied") {
      closedApprovalIds.add(String(record.payload?.approval_id || record.job_id));
    }
    if (record.type === "runtime_incident_opened") openedIncidentIds.add(String(record.payload?.incident_id || record.trace_id));
    if (record.type === "runtime_incident_resolved") resolvedIncidentIds.add(String(record.payload?.incident_id || record.trace_id));
    if (record.type === "runtime_closure_started") closureStarted.add(String(record.payload?.closure_id || record.evidence_id));
    if (record.type === "runtime_closure_completed") closureCompleted.add(String(record.payload?.closure_id || record.evidence_id));
  }

  const missingApprovals = Array.from(requestedApprovalIds).filter((id) => !closedApprovalIds.has(id));
  const orphanIncidents = Array.from(openedIncidentIds).filter((id) => !resolvedIncidentIds.has(id) && !getOpenIncidents().some((incident) => incident.incident_id === id));
  const invalidClosures = Array.from(closureCompleted).filter((id) => !closureStarted.has(id));
  const audit: RecoveryIntegrityAudit = {
    audit_id: `recovery_audit_${Date.now()}`,
    generated_at: new Date().toISOString(),
    missing_approvals: missingApprovals,
    orphan_incidents: orphanIncidents,
    broken_traces: brokenTraces,
    invalid_closures: invalidClosures,
    ok: missingApprovals.length === 0 && orphanIncidents.length === 0 && brokenTraces.length === 0 && invalidClosures.length === 0,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(audit.audit_id, "recovery_integrity_audit_completed"),
    trace_id: audit.audit_id,
    job_id: "mission_control",
    type: "recovery_integrity_audit_completed",
    timestamp: audit.generated_at,
    payload: audit as unknown as Record<string, unknown>,
  });
  return audit;
}

export async function createRuntimeRecoveryDashboard(): Promise<Record<string, unknown>> {
  const [digest, snapshot, audit] = await Promise.all([
    generateOperationalDigest(),
    createRuntimeStateSnapshot(),
    runRecoveryIntegrityAudit(),
  ]);
  const dashboard = {
    dashboard_id: `recovery_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    snapshot,
    digest,
    audit,
    health: audit.ok ? "healthy" : "degraded",
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(dashboard.dashboard_id), "runtime_recovery_dashboard_viewed"),
    trace_id: String(dashboard.dashboard_id),
    job_id: "mission_control",
    type: "runtime_recovery_dashboard_viewed",
    timestamp: String(dashboard.generated_at),
    payload: dashboard as Record<string, unknown>,
  });
  return dashboard;
}

export async function simulateFullRuntimeRestart(traceId: string): Promise<Record<string, unknown>> {
  const boot = await recoverMissionControlBoot();
  const resumed = await resumeInterruptedReplay(traceId);
  const timeline = await reconstructOperationalTimeline(traceId);
  const dashboard = await createRuntimeRecoveryDashboard();
  const result = {
    simulation_id: `restart_sim_${Date.now()}`,
    trace_id: traceId,
    completed_at: new Date().toISOString(),
    boot,
    replay_resumed: !!resumed,
    timeline_events: timeline.length,
    dashboard_health: dashboard.health,
    closure: "recovered",
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(result.simulation_id), "runtime_restart_simulation_completed"),
    trace_id: traceId,
    job_id: "mission_control",
    type: "runtime_restart_simulation_completed",
    timestamp: result.completed_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function createRuntimeRecoveryFreeze(): Promise<Record<string, unknown>> {
  const operationalFreeze = await createOperationalRuntimeFreeze();
  const dashboard = await createRuntimeRecoveryDashboard();
  const freeze = {
    freeze_id: `rc4_recovery_freeze_${Date.now()}`,
    scope: "RC-4 Runtime Persistence & Recovery Operations",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: RECOVERY_FREEZE_PATH,
    operational_freeze_id: operationalFreeze.freeze_id,
    dashboard,
    capabilities: [
      "mission_control_recovery_boot",
      "operational_state_snapshotter",
      "replay_recovery_resume",
      "incident_recovery_continuation",
      "queue_persistence",
      "operational_timeline_reconstruction",
      "recovery_integrity_audit",
      "runtime_recovery_dashboard",
      "full_restart_simulation",
    ],
  };
  ensureDir(path.dirname(RECOVERY_FREEZE_PATH));
  fs.writeFileSync(RECOVERY_FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_recovery_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "mission_control",
    type: "runtime_recovery_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
