import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { Incident } from "../incidents/runtime-incident-command.js";
import { getOpenIncidents } from "../incidents/runtime-incident-command.js";
import { readAllExecutionRequests } from "../policy/execution-approval-queue.js";
import { readAllRequestsForSweeper } from "../evidence/replay-approval-queue.js";
import { getRuntimeMaintenanceState, calculateRuntimeStabilityScore } from "./coordination-runtime.js";
import { createRuntimeRecoveryDashboard, simulateFullRuntimeRestart } from "./recovery-operations.js";

export type FederationNodeHealth = "healthy" | "degraded" | "critical" | "isolated";
export type FederationNodeTrust = "trusted" | "limited" | "revoked";
export type DistributedLoadDecision = "local" | "defer" | "handoff" | "reroute";

export interface RuntimeNodeHeartbeat {
  node_id: string;
  alive: boolean;
  last_seen: string;
  health: FederationNodeHealth;
  load: number;
  stability: string;
  maintenance_state: string;
  trust: FederationNodeTrust;
}

export interface ReplayLock {
  lock_id: string;
  trace_id: string;
  node_id: string;
  acquired_at: string;
  expires_at: string;
  status: "active" | "released" | "expired";
}

const DATA_DIR = path.join(process.cwd(), ".data");
const FED_DIR = path.join(DATA_DIR, "mission-control", "federation");
const NODES_PATH = path.join(FED_DIR, "nodes.json");
const BROADCAST_PATH = path.join(FED_DIR, "broadcasts.jsonl");
const SYNC_PATH = path.join(FED_DIR, "sync.jsonl");
const LOCKS_PATH = path.join(FED_DIR, "replay-locks.jsonl");
const ISOLATION_PATH = path.join(FED_DIR, "isolation.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-federation-operations-freeze.json");

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

function appendJsonl(filePath: string, value: Record<string, unknown>): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, { encoding: "utf8" });
}

function readNodes(): Record<string, RuntimeNodeHeartbeat> {
  if (!fs.existsSync(NODES_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(NODES_PATH, "utf8")) as Record<string, RuntimeNodeHeartbeat>;
  } catch {
    return {};
  }
}

function writeNodes(nodes: Record<string, RuntimeNodeHeartbeat>): void {
  ensureDir(path.dirname(NODES_PATH));
  fs.writeFileSync(NODES_PATH, JSON.stringify(nodes, null, 2), { encoding: "utf8" });
}

export async function recordRuntimeNodeHeartbeat(input: {
  node_id: string;
  alive?: boolean;
  health?: FederationNodeHealth;
  load?: number;
  stability?: string;
  maintenance_state?: string;
}): Promise<RuntimeNodeHeartbeat> {
  const nodes = readNodes();
  const previous = nodes[input.node_id];
  const heartbeat: RuntimeNodeHeartbeat = {
    node_id: input.node_id,
    alive: input.alive !== false,
    last_seen: new Date().toISOString(),
    health: input.health || previous?.health || "healthy",
    load: input.load ?? previous?.load ?? 0,
    stability: input.stability || previous?.stability || "stable",
    maintenance_state: input.maintenance_state || previous?.maintenance_state || getRuntimeMaintenanceState().state,
    trust: previous?.trust || "trusted",
  };
  nodes[input.node_id] = heartbeat;
  writeNodes(nodes);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${input.node_id}_${heartbeat.last_seen}`, "runtime_node_heartbeat_recorded"),
    trace_id: input.node_id,
    job_id: "federation",
    type: "runtime_node_heartbeat_recorded",
    timestamp: heartbeat.last_seen,
    payload: heartbeat as unknown as Record<string, unknown>,
  });
  return heartbeat;
}

export function listRuntimeNodes(): RuntimeNodeHeartbeat[] {
  return Object.values(readNodes());
}

export async function broadcastCriticalIncidentToFederation(input: {
  incident: Incident;
  source_node_id: string;
}): Promise<Record<string, unknown>> {
  const peers = listRuntimeNodes().filter((node) => node.node_id !== input.source_node_id && node.trust !== "revoked");
  const broadcast = {
    broadcast_id: `fed_broadcast_${Date.now()}`,
    source_node_id: input.source_node_id,
    incident_id: input.incident.incident_id,
    severity: input.incident.severity,
    peer_node_ids: peers.map((node) => node.node_id),
    broadcast_at: new Date().toISOString(),
  };
  appendJsonl(BROADCAST_PATH, broadcast);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(broadcast.broadcast_id), "cross_node_incident_broadcast"),
    trace_id: input.incident.incident_id,
    job_id: "federation",
    type: "cross_node_incident_broadcast",
    timestamp: String(broadcast.broadcast_at),
    payload: broadcast,
  });
  return broadcast;
}

export async function syncFederationOperationalState(sourceNodeId: string): Promise<Record<string, unknown>> {
  const stability = await calculateRuntimeStabilityScore();
  const sync = {
    sync_id: `fed_sync_${Date.now()}`,
    source_node_id: sourceNodeId,
    synced_at: new Date().toISOString(),
    approvals: {
      execution: readAllExecutionRequests().length,
      replay: readAllRequestsForSweeper().length,
    },
    incidents: getOpenIncidents().map((incident) => ({ incident_id: incident.incident_id, severity: incident.severity, status: incident.status })),
    freezes: readEvidenceRecords({ type: "runtime_coordination_freeze_created" }).length + readEvidenceRecords({ type: "runtime_recovery_freeze_created" }).length,
    doctrine_drift: readEvidenceRecords({ type: "doctrine_drift_detected" }).length,
    stability,
  };
  appendJsonl(SYNC_PATH, sync as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(sync.sync_id), "federation_operational_sync_completed"),
    trace_id: sourceNodeId,
    job_id: "federation",
    type: "federation_operational_sync_completed",
    timestamp: sync.synced_at,
    payload: sync as unknown as Record<string, unknown>,
  });
  return sync;
}

function latestLocks(): ReplayLock[] {
  const latest = new Map<string, ReplayLock>();
  for (const lock of readJsonl<ReplayLock>(LOCKS_PATH)) {
    latest.set(lock.lock_id, lock);
  }
  const now = Date.now();
  return Array.from(latest.values()).map((lock) => {
    if (lock.status === "active" && new Date(lock.expires_at).getTime() < now) {
      return { ...lock, status: "expired" as const };
    }
    return lock;
  });
}

export async function acquireCrossNodeReplayLock(input: {
  trace_id: string;
  node_id: string;
  ttl_ms?: number;
}): Promise<{ acquired: boolean; lock?: ReplayLock; holder?: ReplayLock; reason?: string }> {
  const active = latestLocks().find((lock) => lock.trace_id === input.trace_id && lock.status === "active");
  if (active && active.node_id !== input.node_id) {
    return { acquired: false, holder: active, reason: "replay_lock_held_by_peer" };
  }
  const now = Date.now();
  const lock: ReplayLock = {
    lock_id: `replay_lock_${input.trace_id}_${input.node_id}`,
    trace_id: input.trace_id,
    node_id: input.node_id,
    acquired_at: new Date(now).toISOString(),
    expires_at: new Date(now + (input.ttl_ms || 15 * 60_000)).toISOString(),
    status: "active",
  };
  appendJsonl(LOCKS_PATH, lock as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(lock.lock_id, "cross_node_replay_lock_acquired"),
    trace_id: input.trace_id,
    job_id: "federation",
    type: "cross_node_replay_lock_acquired",
    timestamp: lock.acquired_at,
    payload: lock as unknown as Record<string, unknown>,
  });
  return { acquired: true, lock };
}

export async function releaseCrossNodeReplayLock(traceId: string, nodeId: string): Promise<ReplayLock | null> {
  const active = latestLocks().find((lock) => lock.trace_id === traceId && lock.node_id === nodeId && lock.status === "active");
  if (!active) return null;
  const released: ReplayLock = { ...active, status: "released" };
  appendJsonl(LOCKS_PATH, released as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(released.lock_id, "cross_node_replay_lock_released"),
    trace_id: traceId,
    job_id: "federation",
    type: "cross_node_replay_lock_released",
    timestamp: new Date().toISOString(),
    payload: released as unknown as Record<string, unknown>,
  });
  return released;
}

export async function coordinateDistributedLoad(input: {
  node_id: string;
  priority: "critical" | "high" | "normal" | "background";
  load: number;
}): Promise<{ decision: DistributedLoadDecision; target_node_id?: string; reason: string }> {
  const nodes = listRuntimeNodes().filter((node) => node.alive && node.trust === "trusted" && node.health !== "isolated");
  const overloaded = input.load >= 0.85;
  const candidate = nodes
    .filter((node) => node.node_id !== input.node_id && node.load < 0.7)
    .sort((a, b) => a.load - b.load)[0];
  const decision: DistributedLoadDecision = !overloaded
    ? "local"
    : candidate && (input.priority === "critical" || input.priority === "high")
      ? "handoff"
      : candidate
        ? "reroute"
        : "defer";
  const result = {
    decision,
    target_node_id: decision === "handoff" || decision === "reroute" ? candidate?.node_id : undefined,
    reason: !overloaded ? "local_capacity_available" : candidate ? "peer_capacity_available" : "no_peer_capacity",
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${input.node_id}_${Date.now()}`, "distributed_load_coordination_completed"),
    trace_id: input.node_id,
    job_id: "federation",
    type: "distributed_load_coordination_completed",
    timestamp: new Date().toISOString(),
    payload: { ...result, priority: input.priority, load: input.load },
  });
  return result;
}

export async function buildFederationStabilitySurface(): Promise<Record<string, unknown>> {
  const nodes = listRuntimeNodes();
  const incidents = getOpenIncidents();
  const isolated = nodes.filter((node) => node.health === "isolated" || node.trust === "revoked").length;
  const critical = nodes.filter((node) => node.health === "critical").length + incidents.filter((incident) => incident.severity === "critical" || incident.severity === "civilization_risk").length;
  const risk = critical > 0 || isolated > 0 ? "critical" : nodes.some((node) => node.health === "degraded" || node.load >= 0.85) ? "degraded" : "stable";
  const surface = {
    surface_id: `fed_surface_${Date.now()}`,
    generated_at: new Date().toISOString(),
    nodes,
    incidents: incidents.map((incident) => ({ incident_id: incident.incident_id, severity: incident.severity, status: incident.status })),
    maintenance: getRuntimeMaintenanceState(),
    risk,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(surface.surface_id), "federation_stability_surface_generated"),
    trace_id: String(surface.surface_id),
    job_id: "federation",
    type: "federation_stability_surface_generated",
    timestamp: surface.generated_at,
    payload: { node_count: nodes.length, incident_count: incidents.length, risk },
  });
  return surface;
}

export async function isolateRuntimeNode(nodeId: string, reason: string): Promise<RuntimeNodeHeartbeat> {
  const nodes = readNodes();
  const previous = nodes[nodeId] || await recordRuntimeNodeHeartbeat({ node_id: nodeId, health: "critical", alive: true });
  const isolated: RuntimeNodeHeartbeat = {
    ...previous,
    health: "isolated",
    trust: "revoked",
    maintenance_state: "emergency",
    last_seen: new Date().toISOString(),
  };
  nodes[nodeId] = isolated;
  writeNodes(nodes);
  appendJsonl(ISOLATION_PATH, { node_id: nodeId, reason, isolated_at: isolated.last_seen });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(nodeId, "runtime_node_isolated"),
    trace_id: nodeId,
    job_id: "federation",
    type: "runtime_node_isolated",
    timestamp: isolated.last_seen,
    payload: { ...isolated, reason },
  });
  return isolated;
}

export async function rejoinRuntimeNode(nodeId: string, reason = "operator_rejoin"): Promise<RuntimeNodeHeartbeat> {
  const nodes = readNodes();
  const previous = nodes[nodeId] || await recordRuntimeNodeHeartbeat({ node_id: nodeId });
  const rejoined: RuntimeNodeHeartbeat = {
    ...previous,
    alive: true,
    health: "healthy",
    trust: "trusted",
    maintenance_state: "normal",
    last_seen: new Date().toISOString(),
  };
  nodes[nodeId] = rejoined;
  writeNodes(nodes);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(nodeId, "runtime_node_rejoined"),
    trace_id: nodeId,
    job_id: "federation",
    type: "runtime_node_rejoined",
    timestamp: rejoined.last_seen,
    payload: { ...rejoined, reason },
  });
  return rejoined;
}

export async function coordinateDistributedRecovery(sourceNodeId: string): Promise<Record<string, unknown>> {
  const dashboard = await createRuntimeRecoveryDashboard();
  const nodes = listRuntimeNodes();
  const participants = nodes.filter((node) => node.alive && node.trust === "trusted").map((node) => node.node_id);
  const recovery = {
    recovery_id: `fed_recovery_${Date.now()}`,
    source_node_id: sourceNodeId,
    coordinated_at: new Date().toISOString(),
    participants,
    dashboard_health: dashboard.health,
    actions: participants.map((node_id) => ({ node_id, action: node_id === sourceNodeId ? "lead_recovery" : "standby_peer" })),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(recovery.recovery_id), "distributed_recovery_coordinated"),
    trace_id: sourceNodeId,
    job_id: "federation",
    type: "distributed_recovery_coordinated",
    timestamp: recovery.coordinated_at,
    payload: recovery as unknown as Record<string, unknown>,
  });
  return recovery;
}

export async function createFederationOperationsFreeze(): Promise<Record<string, unknown>> {
  const surface = await buildFederationStabilitySurface();
  const sync = await syncFederationOperationalState("local");
  const recovery = await coordinateDistributedRecovery("local");
  const simulation = await simulateFullRuntimeRestart("runtime_federation_operations_freeze");
  const freeze = {
    freeze_id: `rc6_federation_ops_freeze_${Date.now()}`,
    scope: "RC-6 Runtime Federation Operations",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    surface,
    sync,
    recovery,
    simulation,
    capabilities: [
      "runtime_node_heartbeat",
      "cross_node_incident_broadcast",
      "federation_operational_sync",
      "cross_node_replay_coordination",
      "distributed_load_coordination",
      "federation_stability_surface",
      "runtime_isolation_mode",
      "distributed_recovery_coordination",
    ],
  };
  ensureDir(path.dirname(FREEZE_PATH));
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "federation_operations_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "federation",
    type: "federation_operations_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}

