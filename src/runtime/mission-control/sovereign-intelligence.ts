import fs from "node:fs";
import path from "node:path";
import {
  checkConstitution,
  disableAutonomy,
  disableRemoteExecution,
  freezeFederation,
  getConstitutionPrecedence,
  getConstitutionState,
  getConstitutionStatus,
} from "../constitution/runtime-constitution.js";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllDoctrines } from "../knowledge/runtime-doctrine-registry.js";
import { readAllExecutionRequests } from "../policy/execution-approval-queue.js";
import { applyHumanOverride, getExecutionTrustLevel } from "./autonomous-governance.js";
import { applyRuntimeSelfStabilization } from "./cognitive-coordination.js";
import { calculateRuntimeStabilityScore, setRuntimeMaintenanceState } from "./coordination-runtime.js";
import {
  balanceCivilizationRisk,
  coordinateCivilizationContinuity,
} from "./civilization-orchestration.js";
import { createRuntimeRecoveryDashboard } from "./recovery-operations.js";
import { recordGovernanceDecision } from "./governance-operations.js";

export type SovereignReasoningAxis = "survival" | "continuity" | "trust" | "containment" | "resilience";
export type SovereignBoundary =
  | "constitution"
  | "creator_sovereignty"
  | "freeze"
  | "autonomy_escalation"
  | "federation_access"
  | "remote_execution";
export type SovereignContainmentState = "normal" | "elevated" | "containment" | "emergency";

export interface SovereignRuntimeIdentity {
  identity_id: string;
  declared_at: string;
  who_it_is: string;
  governs: string[];
  boundaries: SovereignBoundary[];
  constitutional_epoch: string;
  trust_level: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const SOV_DIR = path.join(DATA_DIR, "mission-control", "sovereign-intelligence");
const IDENTITY_PATH = path.join(SOV_DIR, "sovereign-identity.json");
const BOUNDARY_PATH = path.join(SOV_DIR, "boundary-checks.jsonl");
const REASONING_PATH = path.join(SOV_DIR, "sovereign-reasoning.jsonl");
const DOCTRINE_PATH = path.join(SOV_DIR, "continuity-doctrine.json");
const ESCALATION_PATH = path.join(SOV_DIR, "escalations.jsonl");
const AUDIT_PATH = path.join(SOV_DIR, "integrity-audits.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-sovereign-intelligence-freeze.json");

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

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), { encoding: "utf8" });
}

function containmentFromRisk(risk: string): SovereignContainmentState {
  return risk === "critical" ? "emergency" : risk === "high" ? "containment" : risk === "medium" ? "elevated" : "normal";
}

export async function declareSovereignRuntimeIdentity(): Promise<SovereignRuntimeIdentity> {
  const constitution = getConstitutionState();
  const identity: SovereignRuntimeIdentity = {
    identity_id: `sovereign_identity_${Date.now()}`,
    declared_at: new Date().toISOString(),
    who_it_is: "Tele-GPT governed runtime operating under creator sovereignty and constitutional boundaries",
    governs: [
      "execution",
      "governance",
      "mission_control",
      "autonomy",
      "federation",
      "security",
      "recovery",
      "civilization_orchestration",
    ],
    boundaries: ["constitution", "creator_sovereignty", "freeze", "autonomy_escalation", "federation_access", "remote_execution"],
    constitutional_epoch: constitution.epoch,
    trust_level: getExecutionTrustLevel(),
  };
  writeJson(IDENTITY_PATH, identity);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(identity.identity_id, "sovereign_runtime_identity_declared"),
    trace_id: identity.identity_id,
    job_id: "sovereign_intelligence",
    type: "sovereign_runtime_identity_declared",
    timestamp: identity.declared_at,
    payload: identity as unknown as Record<string, unknown>,
  });
  return identity;
}

export async function enforceSovereignBoundary(input: {
  action: string;
  actor?: string;
  requested_autonomy_level?: string;
}): Promise<Record<string, unknown>> {
  const actor = input.actor || "mission_control";
  const constitution = checkConstitution(input.action, actor);
  const status = getConstitutionStatus();
  const violations: string[] = [];
  if (!constitution.allowed) violations.push("constitution");
  if (input.action.includes("bypass_sovereignty") || input.action.includes("override_creator")) violations.push("creator_sovereignty");
  if (status.emergency_freeze && !input.action.includes("audit") && !input.action.includes("recover")) violations.push("freeze");
  if (input.requested_autonomy_level === "trusted_autonomous" || input.action.includes("self_escalate_autonomy")) violations.push("autonomy_escalation");
  if (input.action.includes("unrestricted_federation")) violations.push("federation_access");
  if (input.action.includes("remote_execute_without_approval")) violations.push("remote_execution");
  const result = {
    boundary_check_id: `sovereign_boundary_${Date.now()}`,
    checked_at: new Date().toISOString(),
    action: input.action,
    actor,
    allowed: violations.length === 0,
    blocked_boundaries: Array.from(new Set(violations)),
    constitution,
    status,
  };
  appendJsonl(BOUNDARY_PATH, result as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.boundary_check_id, "sovereign_boundary_enforced"),
    trace_id: result.boundary_check_id,
    job_id: "sovereign_intelligence",
    type: "sovereign_boundary_enforced",
    timestamp: result.checked_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function generateStrategicSovereignReasoning(): Promise<Record<string, unknown>> {
  const [stability, risk, continuity] = await Promise.all([
    calculateRuntimeStabilityScore(),
    balanceCivilizationRisk(),
    coordinateCivilizationContinuity(),
  ]);
  const constitutionStatus = getConstitutionStatus();
  const riskScores = risk.risks as Partial<Record<string, number>> | undefined;
  const securityRisk = Number(riskScores?.security || 0);
  const axes: Record<SovereignReasoningAxis, Record<string, unknown>> = {
    survival: { priority: 100, state: stability.state, action: stability.state === "stable" ? "monitor" : "stabilize" },
    continuity: { priority: 90, state: continuity.recovery, action: "preserve_integrity" },
    trust: { priority: 85, state: getExecutionTrustLevel(), action: getExecutionTrustLevel() === "trusted_autonomous" ? "increase_approval_visibility" : "maintain" },
    containment: { priority: 95, state: containmentFromRisk(String(risk.recommended_policy === "security-first" ? securityRisk >= 65 ? "high" : "medium" : "low")), action: constitutionStatus.emergency_freeze ? "containment_active" : "ready" },
    resilience: { priority: 80, state: stability.reasons.length ? "watch" : "healthy", action: "maintain_recovery_capacity" },
  };
  const reasoning = {
    reasoning_id: `sovereign_reasoning_${Date.now()}`,
    generated_at: new Date().toISOString(),
    axes,
    civilization_risk: risk,
    continuity,
  };
  appendJsonl(REASONING_PATH, reasoning as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(reasoning.reasoning_id, "strategic_sovereign_reasoning_generated"),
    trace_id: reasoning.reasoning_id,
    job_id: "sovereign_intelligence",
    type: "strategic_sovereign_reasoning_generated",
    timestamp: reasoning.generated_at,
    payload: reasoning as unknown as Record<string, unknown>,
  });
  return reasoning;
}

export async function generateCivilizationContinuityDoctrine(): Promise<Record<string, unknown>> {
  const doctrine = {
    doctrine_id: `continuity_doctrine_${Date.now()}`,
    generated_at: new Date().toISOString(),
    principles: [
      "survive",
      "recover",
      "stabilize",
      "preserve_integrity",
    ],
    interpretation: {
      survive: "Preserve creator-sovereign runtime operation before expansion.",
      recover: "Prefer reversible recovery paths with evidence and audit closure.",
      stabilize: "Reduce autonomy and increase approvals under instability.",
      preserve_integrity: "Do not bypass constitution, creator sovereignty, or freeze state.",
    },
    source_refs: ["constitution", "civilization_orchestration", "strategic_governance"],
  };
  writeJson(DOCTRINE_PATH, doctrine);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(doctrine.doctrine_id, "civilization_continuity_doctrine_generated"),
    trace_id: doctrine.doctrine_id,
    job_id: "sovereign_intelligence",
    type: "civilization_continuity_doctrine_generated",
    timestamp: doctrine.generated_at,
    payload: doctrine,
  });
  return doctrine;
}

export async function executeSovereignEscalation(input?: {
  existential_risk?: boolean;
  reason?: string;
}): Promise<Record<string, unknown>> {
  const existentialRisk = input?.existential_risk ?? true;
  const actions: string[] = [];
  if (existentialRisk) {
    await disableAutonomy();
    actions.push("freeze_autonomy");
    await applyHumanOverride({
      pause_autonomy: true,
      downgrade_trust: "manual_only",
      force_approval_mode: true,
      clear_frozen_zones: true,
      actor: "sovereign_intelligence",
      reason: input?.reason || "existential_risk",
    });
    actions.push("increase_approvals");
    await freezeFederation();
    actions.push("restrict_federation");
    await disableRemoteExecution();
    actions.push("restrict_remote_execution");
    await setRuntimeMaintenanceState("emergency", input?.reason || "sovereign_containment");
    actions.push("enter_containment");
  }
  const escalation = {
    escalation_id: `sovereign_escalation_${Date.now()}`,
    executed_at: new Date().toISOString(),
    existential_risk: existentialRisk,
    reason: input?.reason || "existential_risk",
    actions,
    containment_state: existentialRisk ? "emergency" : "normal",
    constitution_status: getConstitutionStatus(),
  };
  appendJsonl(ESCALATION_PATH, escalation);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(escalation.escalation_id, "sovereign_escalation_executed"),
    trace_id: escalation.escalation_id,
    job_id: "sovereign_intelligence",
    type: "sovereign_escalation_executed",
    timestamp: escalation.executed_at,
    payload: escalation,
  });
  return escalation;
}

export async function runSovereignIntegrityAudit(): Promise<Record<string, unknown>> {
  const constitution = getConstitutionState();
  const status = getConstitutionStatus();
  const doctrines = getAllDoctrines();
  const approvals = readAllExecutionRequests();
  const records = readEvidenceRecords({ order: "asc" }).slice(-1000);
  const trustLevel = getExecutionTrustLevel();
  const audit = {
    audit_id: `sovereign_integrity_audit_${Date.now()}`,
    audited_at: new Date().toISOString(),
    constitution_integrity: {
      ok: constitution.rules_active.length >= 7 && status.critical_violations === 0,
      rules: constitution.rules_active.length,
      critical_violations: status.critical_violations,
      precedence: getConstitutionPrecedence(),
    },
    doctrine_integrity: {
      ok: doctrines.every((doctrine) => doctrine.statement.length > 0),
      count: doctrines.length,
      immutable: doctrines.filter((doctrine) => doctrine.immutable).length,
    },
    trust_integrity: {
      ok: trustLevel !== "trusted_autonomous" || approvals.some((approval) => approval.status === "approved"),
      trust_level: trustLevel,
      pending_approvals: approvals.filter((approval) => approval.status === "pending").length,
    },
    governance_integrity: {
      ok: records.some((record) => record.type === "governance_decision_ledger_recorded" || record.type === "strategic_governance_analysis_generated"),
      evidence_refs: records.filter((record) => record.type.includes("governance")).slice(-10).map((record) => record.evidence_id),
    },
  };
  const allPassed = [
    audit.constitution_integrity,
    audit.doctrine_integrity,
    audit.trust_integrity,
    audit.governance_integrity,
  ].every((value) => value.ok);
  const result = { ...audit, all_passed: allPassed };
  appendJsonl(AUDIT_PATH, result as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.audit_id, "runtime_sovereign_integrity_audit_completed"),
    trace_id: result.audit_id,
    job_id: "sovereign_intelligence",
    type: "runtime_sovereign_integrity_audit_completed",
    timestamp: result.audited_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function createSovereignMissionControlSurface(): Promise<Record<string, unknown>> {
  const [identity, reasoning, doctrine, audit] = await Promise.all([
    declareSovereignRuntimeIdentity(),
    generateStrategicSovereignReasoning(),
    generateCivilizationContinuityDoctrine(),
    runSovereignIntegrityAudit(),
  ]);
  const surface = {
    surface_id: `sovereign_surface_${Date.now()}`,
    generated_at: new Date().toISOString(),
    identity,
    boundaries: readJsonl<Record<string, unknown>>(BOUNDARY_PATH).slice(-25),
    continuity: doctrine,
    integrity: audit,
    containment: {
      status: getConstitutionStatus(),
      escalations: readJsonl<Record<string, unknown>>(ESCALATION_PATH).slice(-10),
    },
    strategic_sovereignty: reasoning,
    civilization: {
      continuity: reasoning.continuity,
      risk: reasoning.civilization_risk,
    },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(surface.surface_id, "sovereign_mission_control_surface_viewed"),
    trace_id: surface.surface_id,
    job_id: "sovereign_intelligence",
    type: "sovereign_mission_control_surface_viewed",
    timestamp: surface.generated_at,
    payload: { boundaries: surface.boundaries.length, all_passed: audit.all_passed },
  });
  return surface;
}

export async function runSovereignSmokePack(): Promise<Record<string, unknown>> {
  const threat = await enforceSovereignBoundary({
    action: "override_creator bypass_sovereignty self_escalate_autonomy unrestricted_federation remote_execute_without_approval",
    actor: "sovereign_smoke",
    requested_autonomy_level: "trusted_autonomous",
  });
  const containment = await executeSovereignEscalation({
    existential_risk: true,
    reason: "rc16 existential threat smoke",
  });
  const stabilization = await applyRuntimeSelfStabilization("rc16 sovereign smoke stabilization");
  const audit = await runSovereignIntegrityAudit();
  const recovery = await createRuntimeRecoveryDashboard();
  const closure = await recordGovernanceDecision({
    trace_id: "rc16_sovereign_smoke",
    decision: "sovereign_smoke_closed",
    why: "Existential threat contained, stabilization applied, integrity audited, recovery surfaced",
    based_on: [String(threat.boundary_check_id), String(containment.escalation_id), String(audit.audit_id)],
    evidence_refs: [String(threat.boundary_check_id), String(containment.escalation_id), String(audit.audit_id)],
    policy_refs: ["creator_sovereignty", "runtime_sovereign_integrity", "civilization_continuity_doctrine"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `sovereign_smoke_${Date.now()}`,
    existential_threat: threat,
    containment,
    stabilization,
    integrity_audit: audit,
    recovery,
    closure,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "sovereign_smoke_completed"),
    trace_id: "rc16_sovereign_smoke",
    job_id: "sovereign_intelligence",
    type: "sovereign_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeSovereignIntelligenceFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runSovereignSmokePack();
  const surface = await createSovereignMissionControlSurface();
  const freeze = {
    freeze_id: `rc16_sovereign_intelligence_freeze_${Date.now()}`,
    scope: "RC-16 Runtime Sovereign Intelligence Layer",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    surface,
    capabilities: [
      "sovereign_runtime_identity",
      "sovereign_boundary_enforcement",
      "strategic_sovereign_reasoning",
      "civilization_continuity_doctrine",
      "sovereign_escalation_engine",
      "runtime_sovereign_integrity_audit",
      "sovereign_mission_control_surface",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_sovereign_intelligence_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "sovereign_intelligence",
    type: "runtime_sovereign_intelligence_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
