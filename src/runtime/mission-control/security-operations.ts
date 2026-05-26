import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { openIncident } from "../incidents/runtime-incident-command.js";
import { maybeEscalateRuntimeIncident } from "../hooks/runtime-incident-auto-escalation-hook.js";
import { checkShellExecutionGovernance } from "../hooks/shell-execution-governance-hook.js";
import { checkFederationActionGovernance } from "../hooks/federation-action-governance-hook.js";
import { authorizeTelegramCallback } from "./telegram-callback-auth.js";
import { buildFederationStabilitySurface } from "./federation-operations.js";
import { createRuntimeIntelligenceDashboard } from "./intelligence-operations.js";
import { RBACService, type Permission, type Resource, type Subject } from "../../core/security/rbac.js";

export type SecurityEventKind =
  | "suspicious_command"
  | "secret_exposure"
  | "unauthorized_access"
  | "abnormal_federation_behavior"
  | "repeated_denied_approvals";

export type SecurityPlaybookType =
  | "secret_leak"
  | "compromised_node"
  | "malicious_marketplace_item"
  | "unauthorized_callback"
  | "destructive_shell_attempt";

export interface SecurityEvent {
  event_id: string;
  kind: SecurityEventKind;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  trace_id: string;
  detected_at: string;
  evidence: string[];
  payload?: Record<string, unknown>;
}

export interface SecurityPlaybook {
  playbook_id: string;
  type: SecurityPlaybookType;
  title: string;
  steps: Array<{ step: string; requires_approval: boolean }>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const SECURITY_DIR = path.join(DATA_DIR, "mission-control", "security");
const EVENTS_PATH = path.join(SECURITY_DIR, "security-events.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-security-operations-freeze.json");
const RISKY_PUSH_FREEZE_PATH = path.join(SECURITY_DIR, "risky-push-freeze.json");

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "openai_key", pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "telegram_token", pattern: /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/ },
  { name: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "generic_secret_assignment", pattern: /(api[_-]?key|secret|token|password)\s*=\s*['"]?[A-Za-z0-9_./+=-]{16,}/i },
];

const PLAYBOOKS: Record<SecurityPlaybookType, SecurityPlaybook> = {
  secret_leak: {
    playbook_id: "sec_pb_secret_leak",
    type: "secret_leak",
    title: "Secret Leak Response",
    steps: [
      { step: "freeze_risky_push", requires_approval: false },
      { step: "open_security_incident", requires_approval: false },
      { step: "schedule_rotation_reminder", requires_approval: false },
      { step: "audit_exposure_scope", requires_approval: true },
    ],
  },
  compromised_node: {
    playbook_id: "sec_pb_compromised_node",
    type: "compromised_node",
    title: "Compromised Node Response",
    steps: [
      { step: "isolate_node", requires_approval: false },
      { step: "revoke_trust", requires_approval: false },
      { step: "freeze_federation_access", requires_approval: false },
      { step: "coordinate_recovery", requires_approval: true },
    ],
  },
  malicious_marketplace_item: {
    playbook_id: "sec_pb_malicious_marketplace_item",
    type: "malicious_marketplace_item",
    title: "Malicious Marketplace Item Response",
    steps: [
      { step: "block_item", requires_approval: false },
      { step: "audit_installations", requires_approval: false },
      { step: "notify_operator", requires_approval: false },
    ],
  },
  unauthorized_callback: {
    playbook_id: "sec_pb_unauthorized_callback",
    type: "unauthorized_callback",
    title: "Unauthorized Callback Response",
    steps: [
      { step: "deny_callback", requires_approval: false },
      { step: "audit_actor", requires_approval: false },
      { step: "escalate_repeated_attempts", requires_approval: false },
    ],
  },
  destructive_shell_attempt: {
    playbook_id: "sec_pb_destructive_shell_attempt",
    type: "destructive_shell_attempt",
    title: "Destructive Shell Attempt Response",
    steps: [
      { step: "block_or_require_approval", requires_approval: false },
      { step: "record_command_evidence", requires_approval: false },
      { step: "escalate_if_repeated", requires_approval: false },
    ],
  },
};

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendJsonl(filePath: string, value: Record<string, unknown>): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, { encoding: "utf8" });
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

async function recordSecurityEvent(input: Omit<SecurityEvent, "event_id" | "detected_at">): Promise<SecurityEvent> {
  const event: SecurityEvent = {
    event_id: `sec_evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    detected_at: new Date().toISOString(),
    ...input,
  };
  appendJsonl(EVENTS_PATH, event as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(event.event_id, "security_event_detected"),
    trace_id: event.trace_id,
    job_id: "security",
    type: "security_event_detected",
    timestamp: event.detected_at,
    payload: event as unknown as Record<string, unknown>,
  });
  return event;
}

export function readSecurityEvents(): SecurityEvent[] {
  return readJsonl<SecurityEvent>(EVENTS_PATH);
}

export async function detectSecurityEvents(input?: {
  text?: string;
  command?: string;
  trace_id?: string;
}): Promise<SecurityEvent[]> {
  const events: SecurityEvent[] = [];
  const traceId = input?.trace_id || `security_scan_${Date.now()}`;

  const text = [input?.text, input?.command].filter(Boolean).join("\n");
  for (const secret of SECRET_PATTERNS) {
    if (secret.pattern.test(text)) {
      events.push(await recordSecurityEvent({
        kind: "secret_exposure",
        severity: "critical",
        title: `Secret exposure detected: ${secret.name}`,
        trace_id: traceId,
        evidence: [secret.name],
        payload: { detector: secret.name },
      }));
    }
  }

  if (input?.command && /\brm\s+-rf\b|\bsudo\b|curl\s+.*\|\s*(?:bash|sh|zsh)|git\s+reset\s+--hard/.test(input.command)) {
    events.push(await recordSecurityEvent({
      kind: "suspicious_command",
      severity: "high",
      title: "Suspicious command detected",
      trace_id: traceId,
      evidence: [input.command.slice(0, 200)],
    }));
  }

  const recent = readEvidenceRecords({ order: "asc" }).slice(-500);
  const deniedCallbacks = recent.filter((record) => record.type === "telegram_callback_denied").length;
  if (deniedCallbacks >= 3) {
    events.push(await recordSecurityEvent({
      kind: "unauthorized_access",
      severity: "high",
      title: "Repeated unauthorized callback attempts",
      trace_id: traceId,
      evidence: [`telegram_callback_denied=${deniedCallbacks}`],
    }));
  }

  const deniedApprovals = recent.filter((record) => record.type.includes("approval_denied")).length;
  if (deniedApprovals >= 3) {
    events.push(await recordSecurityEvent({
      kind: "repeated_denied_approvals",
      severity: "medium",
      title: "Repeated denied approvals",
      trace_id: traceId,
      evidence: [`approval_denied=${deniedApprovals}`],
    }));
  }

  const abnormalFederation = recent.filter((record) => record.type === "runtime_node_isolated" || record.type === "federation_governance_hook_blocked").length;
  if (abnormalFederation >= 1) {
    events.push(await recordSecurityEvent({
      kind: "abnormal_federation_behavior",
      severity: "high",
      title: "Abnormal federation behavior",
      trace_id: traceId,
      evidence: [`abnormal_federation=${abnormalFederation}`],
    }));
  }

  return events;
}

export async function executeSecretExposureResponse(input: {
  text: string;
  trace_id?: string;
}): Promise<Record<string, unknown>> {
  const traceId = input.trace_id || `secret_response_${Date.now()}`;
  const events = await detectSecurityEvents({ text: input.text, trace_id: traceId });
  const secretEvents = events.filter((event) => event.kind === "secret_exposure");
  if (secretEvents.length === 0) {
    return { ok: true, action: "none", reason: "no_secret_detected" };
  }

  const incident = await openIncident(
    "Secret exposure detected",
    "Runtime security detected possible secret exposure. Risky push frozen and rotation reminder recorded.",
    ["security", "secrets"],
    "critical",
  );
  ensureDir(path.dirname(RISKY_PUSH_FREEZE_PATH));
  const freeze = {
    frozen: true,
    reason: "secret_exposure",
    trace_id: traceId,
    incident_id: incident.incident_id,
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(RISKY_PUSH_FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });

  const response = {
    response_id: `secret_response_${Date.now()}`,
    trace_id: traceId,
    incident_id: incident.incident_id,
    risky_push_frozen: true,
    rotation_reminder: "Rotate exposed secret and invalidate any leaked credential immediately.",
    event_ids: secretEvents.map((event) => event.event_id),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(response.response_id), "secret_exposure_response_executed"),
    trace_id: traceId,
    job_id: "security",
    type: "secret_exposure_response_executed",
    timestamp: new Date().toISOString(),
    payload: response,
  });
  return response;
}

export async function runRuntimeAccessAudit(input: {
  subject: Subject;
  action: Permission;
  resource?: Resource;
}): Promise<Record<string, unknown>> {
  const rbac = new RBACService();
  const allowed = rbac.canAccess(input.subject, input.action, input.resource);
  const audit = {
    audit_id: `access_audit_${Date.now()}`,
    audited_at: new Date().toISOString(),
    subject_id: input.subject.id,
    roles: input.subject.roles,
    action: input.action,
    resource: input.resource,
    allowed,
    permissions: rbac.getPermissions(input.subject),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(audit.audit_id, "runtime_access_audit_completed"),
    trace_id: audit.audit_id,
    job_id: "security",
    type: "runtime_access_audit_completed",
    timestamp: audit.audited_at,
    payload: audit as unknown as Record<string, unknown>,
  });
  if (!allowed) {
    await recordSecurityEvent({
      kind: "unauthorized_access",
      severity: "medium",
      title: "Runtime access audit denied",
      trace_id: audit.audit_id,
      evidence: [`subject=${input.subject.id}`, `action=${input.action}`],
      payload: audit,
    });
  }
  return audit;
}

export async function monitorFederationThreats(): Promise<Record<string, unknown>> {
  const surface = await buildFederationStabilitySurface();
  const nodes = surface.nodes as Array<{ node_id: string; trust: string; health: string; load: number }>;
  const threats = nodes
    .filter((node) => node.trust !== "trusted" || node.health === "isolated" || node.load >= 0.95)
    .map((node) => ({ node_id: node.node_id, trust: node.trust, health: node.health, load: node.load }));
  const blockedMarketplace = readEvidenceRecords({ type: "federation_governance_hook_blocked" })
    .filter((record) => record.payload?.kind === "marketplace_register");
  const monitor = {
    monitor_id: `fed_threat_${Date.now()}`,
    generated_at: new Date().toISOString(),
    threats,
    suspicious_capability_exchange: readEvidenceRecords({ type: "federation_governance_hook_blocked" }).filter((record) => record.payload?.kind === "capability_exchange").length,
    malicious_marketplace_items: blockedMarketplace.length,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(monitor.monitor_id, "federation_threat_monitor_ran"),
    trace_id: monitor.monitor_id,
    job_id: "security",
    type: "federation_threat_monitor_ran",
    timestamp: monitor.generated_at,
    payload: monitor as unknown as Record<string, unknown>,
  });
  if (threats.length > 0 || blockedMarketplace.length > 0) {
    await recordSecurityEvent({
      kind: "abnormal_federation_behavior",
      severity: "high",
      title: "Federation threat monitor found risk",
      trace_id: monitor.monitor_id,
      evidence: [`threats=${threats.length}`, `marketplace=${blockedMarketplace.length}`],
      payload: monitor,
    });
  }
  return monitor;
}

export async function selectSecurityPlaybook(type: SecurityPlaybookType): Promise<SecurityPlaybook> {
  const playbook = PLAYBOOKS[type];
  await appendEvidenceRecord({
    evidence_id: hashTraceId(playbook.playbook_id, "security_playbook_selected"),
    trace_id: playbook.playbook_id,
    job_id: "security",
    type: "security_playbook_selected",
    timestamp: new Date().toISOString(),
    payload: playbook as unknown as Record<string, unknown>,
  });
  return { ...playbook, steps: [...playbook.steps] };
}

export async function executeSecurityPlaybook(type: SecurityPlaybookType, traceId?: string): Promise<Record<string, unknown>> {
  const playbook = await selectSecurityPlaybook(type);
  const result = {
    execution_id: `sec_playbook_exec_${Date.now()}`,
    playbook_id: playbook.playbook_id,
    type,
    trace_id: traceId || playbook.playbook_id,
    executed_at: new Date().toISOString(),
    steps: playbook.steps.map((step) => ({ ...step, status: "recorded" })),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.execution_id, "security_playbook_executed"),
    trace_id: result.trace_id,
    job_id: "security",
    type: "security_playbook_executed",
    timestamp: result.executed_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function createSecurityMissionControlDashboard(): Promise<Record<string, unknown>> {
  const [federationThreats, intelligence] = await Promise.all([
    monitorFederationThreats(),
    createRuntimeIntelligenceDashboard(),
  ]);
  const events = readSecurityEvents().slice(-100);
  const dashboard = {
    dashboard_id: `security_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    threats: events.filter((event) => event.severity === "high" || event.severity === "critical"),
    incidents: readEvidenceRecords({ type: "runtime_incident_opened" }).filter((record) => String(record.payload?.severity || "").includes("critical")).length,
    secrets: events.filter((event) => event.kind === "secret_exposure"),
    actor_access: readEvidenceRecords({ type: "runtime_access_audit_completed" }).slice(0, 25),
    federation_risk: federationThreats,
    intelligence_recovery_health: intelligence.recovery_health,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "security_mission_control_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "security",
    type: "security_mission_control_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: { dashboard_id: dashboard.dashboard_id, threats: dashboard.threats.length, secrets: dashboard.secrets.length },
  });
  return dashboard;
}

export async function runSecuritySmokePack(): Promise<Record<string, unknown>> {
  const secret = await executeSecretExposureResponse({
    text: "OPENAI_API_KEY=sk-rc8securitysmoketesttoken1234567890",
    trace_id: "rc8_secret_exposure",
  });
  const shell = await checkShellExecutionGovernance({
    command: "rm -rf /tmp/rc8-danger",
    requested_by: "system",
    trace_id: "rc8_denied_shell",
  });
  const federation = await checkFederationActionGovernance({
    kind: "marketplace_register",
    marketplace_item_id: "suspicious-marketplace-item",
    requested_by: "system",
    trace_id: "rc8_suspicious_federation",
    risk_hint: "high",
  });
  const callback = await authorizeTelegramCallback({ actor_id: "rc8_intruder", actor_username: "intruder" });
  if (!callback.allowed) {
    await maybeEscalateRuntimeIncident({
      kind: "unauthorized_callback",
      title: "Security smoke unauthorized callback",
      description: callback.reason || "unauthorized callback",
      trace_id: "rc8_unauthorized_callback",
      affected: ["telegram_callback"],
      severity_hint: "high",
      force: true,
    });
  }
  const events = await detectSecurityEvents({ command: "rm -rf /tmp/rc8-danger", trace_id: "rc8_security_smoke" });
  const playbook = await executeSecurityPlaybook("destructive_shell_attempt", "rc8_security_smoke");
  return {
    smoke_id: `security_smoke_${Date.now()}`,
    secret,
    shell,
    federation,
    callback,
    events,
    playbook,
  };
}

export async function createRuntimeSecurityOperationsFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runSecuritySmokePack();
  const dashboard = await createSecurityMissionControlDashboard();
  const freeze = {
    freeze_id: `rc8_security_freeze_${Date.now()}`,
    scope: "RC-8 Runtime Security Operations",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "security_event_detector",
      "secret_exposure_response",
      "runtime_access_audit",
      "federation_threat_monitor",
      "security_playbook_engine",
      "security_mission_control_dashboard",
    ],
  };
  ensureDir(path.dirname(FREEZE_PATH));
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "security_operations_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "security",
    type: "security_operations_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}

