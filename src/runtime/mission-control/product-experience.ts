import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { createMissionControlDashboardSnapshot } from "./mission-control-dashboard.js";
import { generateOperationalDigest, readMissionControlPersistenceFeed } from "./operational-runtime.js";
import { createRuntimeRecoveryDashboard } from "./recovery-operations.js";
import { calculateRuntimeStabilityScore } from "./coordination-runtime.js";
import { createSecurityMissionControlDashboard } from "./security-operations.js";
import { createGovernanceDashboard, buildOperatorAuditTimeline } from "./governance-operations.js";
import { getOpenIncidents } from "../incidents/runtime-incident-command.js";
import { listPendingExecutionApprovals, handleExecutionApprovalAction } from "../policy/execution-approval-queue.js";
import { sendTelegramMissionControlMessage, loadTelegramSenderConfig } from "./telegram-sender.js";

export type OperatorSessionState = "active" | "viewing" | "approving" | "escalated" | "emergency";
export type RuntimeOperatorMode = "viewer" | "operator" | "governance" | "creator" | "emergency";
export type DigestDeliveryChannel = "telegram" | "email" | "webhook";

export interface OperatorSession {
  session_id: string;
  operator_id: string;
  state: OperatorSessionState;
  mode: RuntimeOperatorMode;
  started_at: string;
  updated_at: string;
  current_trace_id?: string;
}

export interface NotificationPreferences {
  operator_id: string;
  critical_only: boolean;
  incidents: boolean;
  approvals: boolean;
  recovery: boolean;
  federation_alerts: boolean;
  updated_at: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const PRODUCT_DIR = path.join(DATA_DIR, "mission-control", "product");
const SESSIONS_PATH = path.join(PRODUCT_DIR, "operator-sessions.json");
const PREFS_PATH = path.join(PRODUCT_DIR, "notification-preferences.json");
const EXPORT_DIR = path.join(DATA_DIR, "mission-control", "exports");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-product-experience-freeze.json");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), { encoding: "utf8" });
}

export async function createUnifiedMissionControlUiContract(): Promise<Record<string, unknown>> {
  const [dashboard, digest, recovery, stability, security, governance] = await Promise.all([
    createMissionControlDashboardSnapshot({ feed_limit: 25 }),
    generateOperationalDigest(),
    createRuntimeRecoveryDashboard(),
    calculateRuntimeStabilityScore(),
    createSecurityMissionControlDashboard(),
    createGovernanceDashboard(),
  ]);
  const contract = {
    contract_id: `mc_ui_contract_${Date.now()}`,
    generated_at: new Date().toISOString(),
    dashboard,
    feed: readMissionControlPersistenceFeed(50),
    incidents: getOpenIncidents(),
    approvals: {
      execution: listPendingExecutionApprovals(),
    },
    stability,
    security,
    governance,
    digest,
    recovery,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(contract.contract_id), "mission_control_ui_contract_generated"),
    trace_id: String(contract.contract_id),
    job_id: "product",
    type: "mission_control_ui_contract_generated",
    timestamp: contract.generated_at,
    payload: { contract_id: contract.contract_id },
  });
  return contract;
}

export async function startOperatorSession(input: {
  operator_id: string;
  mode?: RuntimeOperatorMode;
  state?: OperatorSessionState;
  current_trace_id?: string;
}): Promise<OperatorSession> {
  const sessions = readJson<Record<string, OperatorSession>>(SESSIONS_PATH, {});
  const now = new Date().toISOString();
  const session: OperatorSession = {
    session_id: `op_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    operator_id: input.operator_id,
    state: input.state || "active",
    mode: input.mode || "operator",
    current_trace_id: input.current_trace_id,
    started_at: now,
    updated_at: now,
  };
  sessions[session.session_id] = session;
  writeJson(SESSIONS_PATH, sessions);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(session.session_id, "operator_session_started"),
    trace_id: session.current_trace_id || session.session_id,
    job_id: "product",
    type: "operator_session_started",
    timestamp: now,
    payload: session as unknown as Record<string, unknown>,
  });
  return session;
}

export async function updateOperatorSession(sessionId: string, updates: Partial<Pick<OperatorSession, "state" | "mode" | "current_trace_id">>): Promise<OperatorSession | null> {
  const sessions = readJson<Record<string, OperatorSession>>(SESSIONS_PATH, {});
  const session = sessions[sessionId];
  if (!session) return null;
  const updated: OperatorSession = { ...session, ...updates, updated_at: new Date().toISOString() };
  sessions[sessionId] = updated;
  writeJson(SESSIONS_PATH, sessions);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(sessionId, "operator_session_updated"),
    trace_id: updated.current_trace_id || sessionId,
    job_id: "product",
    type: "operator_session_updated",
    timestamp: updated.updated_at,
    payload: updated as unknown as Record<string, unknown>,
  });
  return updated;
}

export async function setRuntimeOperatorMode(sessionId: string, mode: RuntimeOperatorMode): Promise<OperatorSession | null> {
  const updated = await updateOperatorSession(sessionId, { mode });
  if (updated) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(`${sessionId}_${mode}`, "runtime_operator_mode_updated"),
      trace_id: updated.current_trace_id || sessionId,
      job_id: "product",
      type: "runtime_operator_mode_updated",
      timestamp: new Date().toISOString(),
      payload: { session_id: sessionId, mode },
    });
  }
  return updated;
}

export async function updateNotificationPreferences(input: Partial<NotificationPreferences> & { operator_id: string }): Promise<NotificationPreferences> {
  const prefs = readJson<Record<string, NotificationPreferences>>(PREFS_PATH, {});
  const next: NotificationPreferences = {
    operator_id: input.operator_id,
    critical_only: input.critical_only ?? prefs[input.operator_id]?.critical_only ?? false,
    incidents: input.incidents ?? prefs[input.operator_id]?.incidents ?? true,
    approvals: input.approvals ?? prefs[input.operator_id]?.approvals ?? true,
    recovery: input.recovery ?? prefs[input.operator_id]?.recovery ?? true,
    federation_alerts: input.federation_alerts ?? prefs[input.operator_id]?.federation_alerts ?? true,
    updated_at: new Date().toISOString(),
  };
  prefs[input.operator_id] = next;
  writeJson(PREFS_PATH, prefs);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.operator_id, "notification_preferences_updated"),
    trace_id: input.operator_id,
    job_id: "product",
    type: "notification_preferences_updated",
    timestamp: next.updated_at,
    payload: next as unknown as Record<string, unknown>,
  });
  return next;
}

export async function deliverRuntimeDigest(input: {
  channel: DigestDeliveryChannel;
  target?: string;
  operator_id?: string;
}): Promise<Record<string, unknown>> {
  const digest = await generateOperationalDigest();
  let delivery: Record<string, unknown> = { ok: true, dry_run: true };
  if (input.channel === "telegram") {
    const cfg = loadTelegramSenderConfig();
    delivery = await sendTelegramMissionControlMessage(
      {
        chat_id: input.target || cfg.default_chat_id || "0",
        text: [
          "Runtime Operational Digest",
          `digest_id: ${digest.digest_id}`,
          `incidents_open: ${digest.incidents.open}`,
          `failures: ${digest.failures}`,
          `pending_execution_approvals: ${digest.approvals.pending_execution}`,
        ].join("\n"),
      },
      { ...cfg, enabled: cfg.enabled || !!cfg.dry_run, dry_run: cfg.dry_run !== false },
    ) as unknown as Record<string, unknown>;
  } else {
    delivery = { ok: true, dry_run: true, channel: input.channel, target: input.target || "-" };
  }
  const result = {
    delivery_id: `digest_delivery_${Date.now()}`,
    delivered_at: new Date().toISOString(),
    channel: input.channel,
    operator_id: input.operator_id,
    digest,
    delivery,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.delivery_id, "runtime_digest_delivered"),
    trace_id: result.delivery_id,
    job_id: "product",
    type: "runtime_digest_delivered",
    timestamp: result.delivered_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function openRuntimeExplainabilityViewer(traceId: string): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ trace_id: traceId, order: "asc" });
  const view = {
    viewer_id: `explain_view_${Date.now()}`,
    trace_id: traceId,
    opened_at: new Date().toISOString(),
    decision: records.filter((record) => record.type.includes("decision") || record.type.includes("governance")),
    evidence: records,
    policy: records.filter((record) => record.type.includes("policy") || record.type.includes("doctrine")),
    execution: records.filter((record) => record.type.includes("execution") || record.type.includes("replay")),
    closure: records.filter((record) => record.type.includes("closure")),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(view.viewer_id, "runtime_explainability_viewer_opened"),
    trace_id: traceId,
    job_id: "product",
    type: "runtime_explainability_viewer_opened",
    timestamp: view.opened_at,
    payload: { trace_id: traceId, records: records.length },
  });
  return view;
}

export async function searchOperationalSurface(query: {
  trace_id?: string;
  incident_id?: string;
  approval_id?: string;
  operator?: string;
  policy?: string;
  risk?: string;
}): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" });
  const results = records.filter((record) => {
    const payload = JSON.stringify(record.payload || {});
    if (query.trace_id && record.trace_id !== query.trace_id && record.parent_trace_id !== query.trace_id) return false;
    if (query.incident_id && !payload.includes(query.incident_id)) return false;
    if (query.approval_id && !payload.includes(query.approval_id) && record.job_id !== query.approval_id) return false;
    if (query.operator && !payload.includes(query.operator)) return false;
    if (query.policy && !payload.includes(query.policy) && !record.type.includes(query.policy)) return false;
    if (query.risk && !payload.includes(query.risk)) return false;
    return true;
  });
  const search = {
    search_id: `op_search_${Date.now()}`,
    searched_at: new Date().toISOString(),
    query,
    results,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(search.search_id, "operational_search_performed"),
    trace_id: query.trace_id || search.search_id,
    job_id: "product",
    type: "operational_search_performed",
    timestamp: search.searched_at,
    payload: { query, result_count: results.length },
  });
  return search;
}

export async function createMissionControlExportPack(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  ensureDir(EXPORT_DIR);
  const [digest, governance, stability, timeline] = await Promise.all([
    generateOperationalDigest(),
    createGovernanceDashboard(),
    calculateRuntimeStabilityScore(),
    buildOperatorAuditTimeline(input?.trace_id),
  ]);
  const pack = {
    export_id: `mc_export_${Date.now()}`,
    created_at: new Date().toISOString(),
    trace_id: input?.trace_id,
    incident_report: getOpenIncidents(),
    governance_audit: governance,
    stability_report: stability,
    operational_digest: digest,
    operator_timeline: timeline,
  };
  const exportPath = path.join(EXPORT_DIR, `${pack.export_id}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(pack, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(pack.export_id, "mission_control_export_pack_created"),
    trace_id: input?.trace_id || pack.export_id,
    job_id: "product",
    type: "mission_control_export_pack_created",
    timestamp: pack.created_at,
    payload: { export_id: pack.export_id, path: exportPath },
  });
  return { ...pack, path: exportPath };
}

export async function runProductExperienceSmokePack(): Promise<Record<string, unknown>> {
  const session = await startOperatorSession({ operator_id: "rc10_operator", mode: "operator", state: "active", current_trace_id: "rc10_product_smoke" });
  await setRuntimeOperatorMode(session.session_id, "governance");
  await updateNotificationPreferences({ operator_id: "rc10_operator", critical_only: false, incidents: true, approvals: true, recovery: true, federation_alerts: true });
  const approval = listPendingExecutionApprovals()[0];
  if (approval) {
    await updateOperatorSession(session.session_id, { state: "approving", current_trace_id: approval.trace_id || approval.approval_id });
    await handleExecutionApprovalAction({ approval_id: approval.approval_id, action: "view", actor: "rc10_operator" });
  }
  const incident = getOpenIncidents()[0];
  const search = await searchOperationalSurface({
    trace_id: approval?.trace_id,
    incident_id: incident?.incident_id,
    operator: "rc10_operator",
  });
  const exportPack = await createMissionControlExportPack({ trace_id: approval?.trace_id || "rc10_product_smoke" });
  const digest = await deliverRuntimeDigest({ channel: "telegram", operator_id: "rc10_operator" });
  const viewer = await openRuntimeExplainabilityViewer(approval?.trace_id || "rc10_product_smoke");
  return {
    smoke_id: `product_smoke_${Date.now()}`,
    session,
    approval_id: approval?.approval_id,
    incident_id: incident?.incident_id,
    search,
    exportPack,
    digest,
    viewer,
  };
}

export async function createRuntimeProductExperienceFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runProductExperienceSmokePack();
  const contract = await createUnifiedMissionControlUiContract();
  const freeze = {
    freeze_id: `rc10_product_freeze_${Date.now()}`,
    scope: "RC-10 Runtime Product & Operator Experience",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    contract,
    capabilities: [
      "unified_mission_control_ui_contract",
      "operator_session_layer",
      "notification_preferences",
      "runtime_digest_delivery",
      "runtime_explainability_viewer",
      "operational_search_surface",
      "mission_control_export_pack",
      "runtime_operator_modes",
    ],
  };
  ensureDir(path.dirname(FREEZE_PATH));
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_product_experience_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "product",
    type: "runtime_product_experience_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}

