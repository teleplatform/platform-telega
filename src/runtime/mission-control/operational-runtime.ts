import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { MissionControlLiveEvent } from "../hooks/mission-control-live-feed-hook.js";
import type { RuntimeIncidentSignalKind } from "../hooks/runtime-incident-auto-escalation-hook.js";
import type { Incident } from "../incidents/runtime-incident-command.js";
import { getOpenIncidents } from "../incidents/runtime-incident-command.js";
import { getPlaybook, type Playbook, type PlaybookType } from "../incidents/incident-playbooks.js";
import { getPendingApprovals as getPendingIncidentApprovals } from "../incidents/incident-approval-gate.js";
import {
  listPendingExecutionApprovals,
  readAllExecutionRequests,
  type ExecutionApprovalRequest,
} from "../policy/execution-approval-queue.js";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";

export type RuntimeOperatorState = "online" | "idle" | "offline" | "emergency_only";
export type RuntimeAttentionDecision = "execute" | "queue" | "escalate";

export interface RuntimeOperatorPresence {
  state: RuntimeOperatorState;
  updated_at: string;
  actor: string;
  reason?: string;
}

export interface RuntimeIncidentRouting {
  incident_id: string;
  kind: RuntimeIncidentSignalKind;
  severity: Incident["severity"];
  playbook: Playbook;
  notify: boolean;
  escalation_path: string[];
  routed_at: string;
}

export interface RuntimeAttentionRoute {
  decision: RuntimeAttentionDecision;
  reason: string;
  operator: RuntimeOperatorPresence;
  queued: boolean;
  escalated: boolean;
}

export interface OperationalDigest {
  digest_id: string;
  generated_at: string;
  window_minutes: number;
  incidents: {
    open: number;
    critical: number;
    high: number;
  };
  failures: number;
  approvals: {
    pending_execution: number;
    pending_incident: number;
    closed_execution: number;
  };
  budget_anomalies: string[];
  drifts: number;
}

export interface OperationalReplayConsole {
  trace_id: string;
  generated_at: string;
  decisions: Array<{
    type: string;
    timestamp: string;
    summary: Record<string, unknown>;
  }>;
}

const MISSION_CONTROL_DIR = path.join(process.cwd(), ".data", "mission-control");
const LIVE_FEED_PATH = path.join(MISSION_CONTROL_DIR, "live-feed.jsonl");
const PRESENCE_PATH = path.join(MISSION_CONTROL_DIR, "operator-presence.json");
const ATTENTION_QUEUE_PATH = path.join(MISSION_CONTROL_DIR, "attention-queue.jsonl");
const FREEZE_PATH = path.join(process.cwd(), ".data", "civilization", "operational-runtime-freeze.json");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendJsonl(filePath: string, value: Record<string, unknown>): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, { encoding: "utf8" });
}

export function appendMissionControlPersistenceFeed(event: MissionControlLiveEvent): void {
  appendJsonl(LIVE_FEED_PATH, event as unknown as Record<string, unknown>);
  void appendEvidenceRecord({
    evidence_id: hashTraceId(event.event_id, "mission_control_persistence_feed_appended"),
    trace_id: event.trace_id || event.event_id,
    job_id: "mission_control",
    type: "mission_control_persistence_feed_appended",
    timestamp: new Date().toISOString(),
    payload: {
      event_id: event.event_id,
      path: LIVE_FEED_PATH,
    },
  });
}

export function readMissionControlPersistenceFeed(limit = 50): MissionControlLiveEvent[] {
  if (!fs.existsSync(LIVE_FEED_PATH)) return [];
  return fs.readFileSync(LIVE_FEED_PATH, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as MissionControlLiveEvent;
      } catch {
        return null;
      }
    })
    .filter((event): event is MissionControlLiveEvent => event !== null)
    .slice(-limit)
    .reverse();
}

export function mapIncidentSignalToPlaybook(kind: RuntimeIncidentSignalKind): PlaybookType {
  if (kind === "budget_exhausted") return "budget_exhaustion";
  if (kind === "drift_escalated" || kind === "governance_blocked") return "policy_drift";
  if (kind === "unauthorized_callback") return "unauthorized_callback";
  if (kind === "replay_storm") return "replay_storm";
  if (kind === "federation_failure") return "federation_collapse";
  return "failed_recovery";
}

export async function routeRuntimeIncident(input: {
  incident: Incident;
  kind: RuntimeIncidentSignalKind;
  trace_id?: string;
}): Promise<RuntimeIncidentRouting> {
  const playbook = getPlaybook(mapIncidentSignalToPlaybook(input.kind));
  const severity = input.incident.severity;
  const notify = ["high", "critical", "civilization_risk"].includes(severity);
  const escalationPath = severity === "civilization_risk"
    ? ["mission_control", "operator", "emergency_only"]
    : severity === "critical"
      ? ["mission_control", "operator"]
      : notify
        ? ["mission_control"]
        : ["feed"];

  const routing: RuntimeIncidentRouting = {
    incident_id: input.incident.incident_id,
    kind: input.kind,
    severity,
    playbook,
    notify,
    escalation_path: escalationPath,
    routed_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.incident.incident_id, "runtime_incident_routed"),
    trace_id: input.trace_id || input.incident.incident_id,
    job_id: "incidents",
    type: "runtime_incident_routed",
    timestamp: routing.routed_at,
    payload: {
      incident_id: routing.incident_id,
      kind: routing.kind,
      playbook_id: routing.playbook.playbook_id,
      notify: routing.notify,
      escalation_path: routing.escalation_path,
    },
  });

  return routing;
}

export function getRuntimeOperatorPresence(): RuntimeOperatorPresence {
  if (!fs.existsSync(PRESENCE_PATH)) {
    return {
      state: "offline",
      updated_at: new Date(0).toISOString(),
      actor: "system",
      reason: "presence_not_declared",
    };
  }
  try {
    return JSON.parse(fs.readFileSync(PRESENCE_PATH, "utf8")) as RuntimeOperatorPresence;
  } catch {
    return {
      state: "offline",
      updated_at: new Date().toISOString(),
      actor: "system",
      reason: "presence_file_unreadable",
    };
  }
}

export async function updateRuntimeOperatorPresence(input: {
  state: RuntimeOperatorState;
  actor?: string;
  reason?: string;
}): Promise<RuntimeOperatorPresence> {
  ensureDir(MISSION_CONTROL_DIR);
  const presence: RuntimeOperatorPresence = {
    state: input.state,
    actor: input.actor || "operator",
    reason: input.reason,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(PRESENCE_PATH, JSON.stringify(presence, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`presence_${presence.updated_at}`, "runtime_operator_presence_updated"),
    trace_id: "runtime_operator_presence",
    job_id: "mission_control",
    type: "runtime_operator_presence_updated",
    timestamp: presence.updated_at,
    payload: presence as unknown as Record<string, unknown>,
  });
  return presence;
}

export async function routeRuntimeAttention(input: {
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  trace_id?: string;
  payload?: Record<string, unknown>;
}): Promise<RuntimeAttentionRoute> {
  const operator = getRuntimeOperatorPresence();
  const isCritical = input.severity === "critical" || input.severity === "high";
  const decision: RuntimeAttentionDecision =
    operator.state === "online" || operator.state === "idle"
      ? "execute"
      : isCritical
        ? "escalate"
        : "queue";
  const now = new Date().toISOString();
  if (decision === "queue") {
    appendJsonl(ATTENTION_QUEUE_PATH, { ...input, queued_at: now });
  }
  const route: RuntimeAttentionRoute = {
    decision,
    reason: decision === "execute" ? "operator_available" : decision === "escalate" ? "operator_unavailable_critical" : "operator_unavailable_noncritical",
    operator,
    queued: decision === "queue",
    escalated: decision === "escalate",
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id || `${input.title}_${now}`, "runtime_attention_routed"),
    trace_id: input.trace_id || "runtime_attention",
    job_id: "mission_control",
    type: "runtime_attention_routed",
    timestamp: now,
    payload: { ...route, title: input.title, severity: input.severity, payload: input.payload } as unknown as Record<string, unknown>,
  });
  return route;
}

export async function markApprovalLifecycleViewed(
  approval: ExecutionApprovalRequest,
  actor = "operator",
): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(approval.approval_id, "approval_lifecycle_viewed"),
    trace_id: approval.trace_id || approval.approval_id,
    job_id: approval.approval_id,
    type: "approval_lifecycle_viewed",
    timestamp: new Date().toISOString(),
    payload: { approval_id: approval.approval_id, actor, lifecycle_state: "viewed" },
  });
}

export async function markApprovalLifecycleClosed(
  approval: ExecutionApprovalRequest,
  actor = "runtime",
): Promise<void> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(approval.approval_id, "approval_lifecycle_closed"),
    trace_id: approval.trace_id || approval.approval_id,
    job_id: approval.approval_id,
    type: "approval_lifecycle_closed",
    timestamp: new Date().toISOString(),
    payload: { approval_id: approval.approval_id, actor, lifecycle_state: "closed", status: approval.status },
  });
}

export async function generateOperationalDigest(windowMinutes = 60): Promise<OperationalDigest> {
  const now = Date.now();
  const windowMs = windowMinutes * 60_000;
  const records = readEvidenceRecords({ order: "asc" }).filter((record) => {
    const ts = new Date(record.timestamp).getTime();
    return Number.isFinite(ts) && ts >= now - windowMs;
  });
  const open = getOpenIncidents();
  const budgets = getAllBudgets();
  const digest: OperationalDigest = {
    digest_id: `op_digest_${Date.now()}`,
    generated_at: new Date().toISOString(),
    window_minutes: windowMinutes,
    incidents: {
      open: open.length,
      critical: open.filter((i) => i.severity === "critical" || i.severity === "civilization_risk").length,
      high: open.filter((i) => i.severity === "high").length,
    },
    failures: records.filter((r) => r.type.includes("failed") || r.type.includes("blocked")).length,
    approvals: {
      pending_execution: listPendingExecutionApprovals().length,
      pending_incident: getPendingIncidentApprovals().length,
      closed_execution: readAllExecutionRequests().filter((r) => r.status === "consumed").length,
    },
    budget_anomalies: budgets
      .filter((budget) => budget.limit > 0 && budget.used / budget.limit >= 0.9)
      .map((budget) => `${budget.category}:${budget.used}/${budget.limit}`),
    drifts: records.filter((r) => r.type.includes("drift")).length,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(digest.digest_id, "operational_digest_generated"),
    trace_id: digest.digest_id,
    job_id: "mission_control",
    type: "operational_digest_generated",
    timestamp: digest.generated_at,
    payload: digest as unknown as Record<string, unknown>,
  });
  return digest;
}

export async function buildOperationalReplayConsole(traceId: string): Promise<OperationalReplayConsole> {
  const decisions = readEvidenceRecords({ trace_id: traceId, order: "asc" })
    .filter((record) => {
      return record.type.includes("approval")
        || record.type.includes("incident")
        || record.type.includes("governance")
        || record.type.includes("policy")
        || record.type.includes("attention")
        || record.type.includes("replay");
    })
    .map((record) => ({
      type: record.type,
      timestamp: record.timestamp,
      summary: record.payload || {},
    }));

  const consoleView: OperationalReplayConsole = {
    trace_id: traceId,
    generated_at: new Date().toISOString(),
    decisions,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "operational_replay_console_viewed"),
    trace_id: traceId,
    job_id: "mission_control",
    type: "operational_replay_console_viewed",
    timestamp: consoleView.generated_at,
    payload: { decisions: decisions.length },
  });
  return consoleView;
}

export async function renderTelegramCommandSurface(command: string): Promise<string> {
  const normalized = command.trim().split(/\s+/)[0];
  const now = new Date().toISOString();
  let response: string;
  if (normalized === "/status" || normalized === "/runtime") {
    const presence = getRuntimeOperatorPresence();
    response = [
      "Runtime status",
      `operator: ${presence.state}`,
      `incidents_open: ${getOpenIncidents().length}`,
      `pending_execution_approvals: ${listPendingExecutionApprovals().length}`,
    ].join("\n");
  } else if (normalized === "/incidents") {
    response = getOpenIncidents().map((i) => `${i.incident_id} ${i.severity} ${i.status} ${i.title}`).join("\n") || "No open incidents";
  } else if (normalized === "/approvals") {
    response = listPendingExecutionApprovals().map((a) => `${a.approval_id} ${a.task_kind} ${a.status}`).join("\n") || "No pending execution approvals";
  } else if (normalized === "/freeze") {
    const freeze = await createOperationalRuntimeFreeze();
    response = `Operational runtime frozen: ${freeze.freeze_id}`;
  } else {
    response = "Supported commands: /status /incidents /approvals /runtime /freeze";
  }
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${normalized}_${now}`, "telegram_command_surface_invoked"),
    trace_id: "telegram_command_surface",
    job_id: "mission_control",
    type: "telegram_command_surface_invoked",
    timestamp: now,
    payload: { command: normalized, response },
  });
  return response;
}

export async function createOperationalRuntimeFreeze(): Promise<Record<string, unknown>> {
  const freeze = {
    freeze_id: `rc3_freeze_${Date.now()}`,
    scope: "RC-3 Autonomous Operational Runtime",
    status: "frozen",
    created_at: new Date().toISOString(),
    artifacts: {
      live_feed: LIVE_FEED_PATH,
      operator_presence: PRESENCE_PATH,
      attention_queue: ATTENTION_QUEUE_PATH,
    },
    capabilities: [
      "auto_incident_routing",
      "approval_resolution_tracking",
      "mission_control_persistence_feed",
      "runtime_operator_presence",
      "runtime_attention_routing",
      "operational_digest_generator",
      "telegram_command_surface",
      "operational_replay_console",
    ],
  };
  ensureDir(path.dirname(FREEZE_PATH));
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "operational_runtime_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "mission_control",
    type: "operational_runtime_freeze_created",
    timestamp: String(freeze.created_at),
    payload: { path: FREEZE_PATH, ...freeze },
  });
  return freeze;
}

