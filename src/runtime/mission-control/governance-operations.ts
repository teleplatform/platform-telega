import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { createExecutionApprovalRequest, handleExecutionApprovalAction, type ExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import { emitMissionControlLiveEvent } from "../hooks/mission-control-live-feed-hook.js";
import { enforceDoctrines } from "../knowledge/doctrine-enforcement-layer.js";
import { generateAutonomousOperationalRecommendations } from "./intelligence-operations.js";
import { createSecurityMissionControlDashboard } from "./security-operations.js";

export type GovernanceRiskLevel = "low" | "medium" | "high" | "critical";
export type RuntimeConfidence = "high" | "medium" | "low" | "unsafe";

export interface GovernanceDecisionLedgerEntry {
  decision_id: string;
  trace_id: string;
  decision: string;
  why: string;
  based_on: string[];
  evidence_refs: string[];
  policy_refs: string[];
  risk_level: GovernanceRiskLevel;
  created_at: string;
}

export interface ExplainableApprovalSurface {
  surface_id: string;
  approval_id: string;
  decision: string;
  risk: GovernanceRiskLevel;
  affected_systems: string[];
  recommended_action: string;
  rollback_path: string[];
  rendered_at: string;
}

export interface OperatorAuditEvent {
  timestamp: string;
  actor?: string;
  action: string;
  trace_id: string;
  target?: string;
  evidence_id?: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const GOVERNANCE_DIR = path.join(DATA_DIR, "mission-control", "governance");
const LEDGER_PATH = path.join(GOVERNANCE_DIR, "decision-ledger.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-governance-operations-freeze.json");

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

export async function recordGovernanceDecision(input: {
  trace_id: string;
  decision: string;
  why: string;
  based_on?: string[];
  evidence_refs?: string[];
  policy_refs?: string[];
  risk_level?: GovernanceRiskLevel;
}): Promise<GovernanceDecisionLedgerEntry> {
  const entry: GovernanceDecisionLedgerEntry = {
    decision_id: `gov_decision_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    decision: input.decision,
    why: input.why,
    based_on: input.based_on || [],
    evidence_refs: input.evidence_refs || [],
    policy_refs: input.policy_refs || [],
    risk_level: input.risk_level || "medium",
    created_at: new Date().toISOString(),
  };
  appendJsonl(LEDGER_PATH, entry as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(entry.decision_id, "governance_decision_ledger_recorded"),
    trace_id: entry.trace_id,
    job_id: "governance",
    type: "governance_decision_ledger_recorded",
    timestamp: entry.created_at,
    payload: entry as unknown as Record<string, unknown>,
  });
  return entry;
}

export function readGovernanceDecisionLedger(): GovernanceDecisionLedgerEntry[] {
  return readJsonl<GovernanceDecisionLedgerEntry>(LEDGER_PATH);
}

export async function renderExplainableApprovalSurface(input: {
  approval: ExecutionApprovalRequest;
  decision?: string;
  risk?: GovernanceRiskLevel;
  affected_systems?: string[];
  recommended_action?: string;
  rollback_path?: string[];
}): Promise<ExplainableApprovalSurface> {
  const surface: ExplainableApprovalSurface = {
    surface_id: `approval_surface_${Date.now()}`,
    approval_id: input.approval.approval_id,
    decision: input.decision || input.approval.status,
    risk: input.risk || "medium",
    affected_systems: input.affected_systems || [input.approval.task_kind],
    recommended_action: input.recommended_action || "Operator should approve only if expected impact is acceptable.",
    rollback_path: input.rollback_path || ["stop execution", "restore prior state", "record incident if rollback fails"],
    rendered_at: new Date().toISOString(),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(surface.surface_id, "explainable_approval_surface_rendered"),
    trace_id: input.approval.trace_id || surface.approval_id,
    job_id: "governance",
    type: "explainable_approval_surface_rendered",
    timestamp: surface.rendered_at,
    payload: surface as unknown as Record<string, unknown>,
  });
  return surface;
}

export async function evaluateRuntimeConfidence(input: {
  trace_id: string;
  evidence_refs?: string[];
  contradiction_count?: number;
  policy_blocks?: number;
  risk_level?: GovernanceRiskLevel;
}): Promise<{ confidence: RuntimeConfidence; score: number; reasons: string[] }> {
  let score = 100;
  const reasons: string[] = [];
  const evidenceCount = input.evidence_refs?.length || readEvidenceRecords({ trace_id: input.trace_id }).length;
  if (evidenceCount === 0) {
    score -= 30;
    reasons.push("missing_evidence");
  }
  if ((input.contradiction_count || 0) > 0) {
    score -= Math.min(40, (input.contradiction_count || 0) * 20);
    reasons.push("evidence_contradictions");
  }
  if ((input.policy_blocks || 0) > 0) {
    score -= Math.min(30, (input.policy_blocks || 0) * 15);
    reasons.push("policy_blocks");
  }
  if (input.risk_level === "critical") score -= 30;
  else if (input.risk_level === "high") score -= 15;
  const confidence: RuntimeConfidence = score >= 80 ? "high" : score >= 55 ? "medium" : score >= 30 ? "low" : "unsafe";
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${input.trace_id}_${Date.now()}`, "runtime_confidence_governance_evaluated"),
    trace_id: input.trace_id,
    job_id: "governance",
    type: "runtime_confidence_governance_evaluated",
    timestamp: new Date().toISOString(),
    payload: { confidence, score, reasons, risk_level: input.risk_level },
  });
  return { confidence, score, reasons };
}

export async function escalateHumanOversightIfNeeded(input: {
  trace_id: string;
  summary: string;
  confidence: RuntimeConfidence;
  risk_level: GovernanceRiskLevel;
}): Promise<{ escalated: boolean; approval?: ExecutionApprovalRequest; reason: string }> {
  const shouldEscalate = input.confidence === "low" || input.confidence === "unsafe" || input.risk_level === "critical";
  if (!shouldEscalate) return { escalated: false, reason: "confidence_above_escalation_threshold" };
  const approval = await createExecutionApprovalRequest({
    trace_id: input.trace_id,
    task_kind: "human_oversight_confirmation",
    requested_by: "mission_control",
    reason: `Human oversight required: ${input.summary}; confidence=${input.confidence}; risk=${input.risk_level}`,
  });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(approval.approval_id, "human_oversight_escalated"),
    trace_id: input.trace_id,
    job_id: "governance",
    type: "human_oversight_escalated",
    timestamp: new Date().toISOString(),
    payload: { approval_id: approval.approval_id, confidence: input.confidence, risk_level: input.risk_level, summary: input.summary },
  });
  await emitMissionControlLiveEvent({
    kind: "approval_required",
    severity: input.risk_level === "critical" ? "critical" : "high",
    title: "Human oversight required",
    trace_id: input.trace_id,
    payload: { approval_id: approval.approval_id, confidence: input.confidence },
  });
  return { escalated: true, approval, reason: "operator_confirmation_required" };
}

export async function createGovernanceDriftAlerts(): Promise<Array<Record<string, unknown>>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-500);
  const doctrineBlocks = records.filter((record) => record.type.includes("doctrine") && record.type.includes("blocked")).length;
  const policyBlocks = records.filter((record) => record.type.includes("policy") && record.type.includes("blocked")).length;
  const approvalDenials = records.filter((record) => record.type.includes("approval_denied")).length;
  const doctrine = await enforceDoctrines("autonomy_escalation");
  const alerts: Array<Record<string, unknown>> = [];
  if (doctrineBlocks + policyBlocks + approvalDenials >= 3 || doctrine.blocked) {
    const alert = {
      alert_id: `gov_drift_${Date.now()}`,
      created_at: new Date().toISOString(),
      severity: doctrine.blocked ? "critical" : "high",
      reason: "runtime decisions drifting from doctrine/policy expectations",
      signals: { doctrine_blocks: doctrineBlocks, policy_blocks: policyBlocks, approval_denials: approvalDenials, doctrine_blocked: doctrine.blocked },
    };
    alerts.push(alert);
    await appendEvidenceRecord({
      evidence_id: hashTraceId(String(alert.alert_id), "governance_drift_alert_created"),
      trace_id: String(alert.alert_id),
      job_id: "governance",
      type: "governance_drift_alert_created",
      timestamp: String(alert.created_at),
      payload: alert,
    });
  }
  return alerts;
}

export async function buildOperatorAuditTimeline(traceId?: string): Promise<{ timeline_id: string; generated_at: string; events: OperatorAuditEvent[] }> {
  const operatorTypes = new Set([
    "execution_approval_approved",
    "execution_approval_denied",
    "execution_approval_consumed",
    "approval_lifecycle_executed",
    "replay_started",
    "replay_finished",
    "runtime_incident_auto_escalated",
    "human_oversight_escalated",
  ]);
  const events = readEvidenceRecords({ order: "asc" })
    .filter((record) => (!traceId || record.trace_id === traceId || record.parent_trace_id === traceId) && (operatorTypes.has(record.type) || record.type.includes("approval")))
    .map((record): OperatorAuditEvent => ({
      timestamp: record.timestamp,
      actor: record.payload?.decided_by ? String(record.payload.decided_by) : record.payload?.actor ? String(record.payload.actor) : undefined,
      action: record.type,
      trace_id: record.trace_id,
      target: record.payload?.approval_id ? String(record.payload.approval_id) : record.payload?.incident_id ? String(record.payload.incident_id) : undefined,
      evidence_id: record.evidence_id,
    }));
  const timeline = {
    timeline_id: `operator_timeline_${Date.now()}`,
    generated_at: new Date().toISOString(),
    events,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(timeline.timeline_id, "operator_audit_timeline_built"),
    trace_id: traceId || timeline.timeline_id,
    job_id: "governance",
    type: "operator_audit_timeline_built",
    timestamp: timeline.generated_at,
    payload: { timeline_id: timeline.timeline_id, events: events.length, trace_id: traceId },
  });
  return timeline;
}

export async function createGovernanceDashboard(): Promise<Record<string, unknown>> {
  const [recommendations, security, driftAlerts, timeline] = await Promise.all([
    generateAutonomousOperationalRecommendations(),
    createSecurityMissionControlDashboard(),
    createGovernanceDriftAlerts(),
    buildOperatorAuditTimeline(),
  ]);
  const ledger = readGovernanceDecisionLedger().slice(-50);
  const confidenceRecords = readEvidenceRecords({ type: "runtime_confidence_governance_evaluated" }).slice(0, 50);
  const dashboard = {
    dashboard_id: `governance_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    decisions: ledger,
    confidence: confidenceRecords,
    drifts: driftAlerts,
    escalations: readEvidenceRecords({ type: "human_oversight_escalated" }).slice(0, 25),
    operator_actions: timeline.events,
    recommendations,
    security_summary: { threats: (security.threats as unknown[]).length, secrets: (security.secrets as unknown[]).length },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(dashboard.dashboard_id), "governance_dashboard_viewed"),
    trace_id: String(dashboard.dashboard_id),
    job_id: "governance",
    type: "governance_dashboard_viewed",
    timestamp: String(dashboard.generated_at),
    payload: { decisions: ledger.length, drifts: driftAlerts.length, escalations: dashboard.escalations.length },
  });
  return dashboard;
}

export async function runGovernanceSmokePack(): Promise<Record<string, unknown>> {
  const traceId = "rc9_governance_smoke";
  const decision = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "uncertain_runtime_execution",
    why: "Smoke test exercises low-confidence human oversight path",
    based_on: ["security_dashboard", "operator_policy"],
    evidence_refs: [],
    policy_refs: ["human_oversight_required"],
    risk_level: "critical",
  });
  const confidence = await evaluateRuntimeConfidence({
    trace_id: traceId,
    evidence_refs: [],
    contradiction_count: 1,
    policy_blocks: 1,
    risk_level: "critical",
  });
  const escalation = await escalateHumanOversightIfNeeded({
    trace_id: traceId,
    summary: "RC9 uncertain decision smoke",
    confidence: confidence.confidence,
    risk_level: "critical",
  });
  let approvalResult: Awaited<ReturnType<typeof handleExecutionApprovalAction>> | undefined;
  let executionResult: Awaited<ReturnType<typeof handleExecutionApprovalAction>> | undefined;
  if (escalation.approval) {
    await renderExplainableApprovalSurface({
      approval: escalation.approval,
      decision: "operator_confirmation_required",
      risk: "critical",
      affected_systems: ["governance", "execution"],
      recommended_action: "Approve only for smoke-controlled execution.",
      rollback_path: ["deny action", "close approval", "record governance drift if repeated"],
    });
    approvalResult = await handleExecutionApprovalAction({ approval_id: escalation.approval.approval_id, action: "approve", actor: "rc9_smoke" });
    executionResult = await handleExecutionApprovalAction({ approval_id: escalation.approval.approval_id, action: "consume", actor: "rc9_smoke" });
  }
  const timeline = await buildOperatorAuditTimeline(traceId);
  return {
    smoke_id: `governance_smoke_${Date.now()}`,
    decision,
    confidence,
    escalation,
    approvalResult,
    executionResult,
    timeline,
  };
}

export async function createRuntimeGovernanceOperationsFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runGovernanceSmokePack();
  const dashboard = await createGovernanceDashboard();
  const freeze = {
    freeze_id: `rc9_governance_freeze_${Date.now()}`,
    scope: "RC-9 Runtime Governance & Human Oversight",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "governance_decision_ledger",
      "explainable_approval_surface",
      "human_oversight_escalation",
      "runtime_confidence_governance",
      "governance_drift_alerts",
      "operator_audit_timeline",
      "governance_dashboard",
    ],
  };
  ensureDir(path.dirname(FREEZE_PATH));
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "governance_operations_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "governance",
    type: "governance_operations_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
