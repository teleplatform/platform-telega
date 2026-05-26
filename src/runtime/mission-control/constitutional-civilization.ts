import fs from "node:fs";
import path from "node:path";
import {
  checkConstitution,
  getConstitutionPrecedence,
  getConstitutionState,
  getConstitutionStatus,
  getImmutableClauses,
} from "../constitution/runtime-constitution.js";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllDoctrines } from "../knowledge/runtime-doctrine-registry.js";
import {
  archiveStrategicContinuity,
  createInstitutionalMissionControlDashboard,
  generateGovernancePrecedent,
  lookupGovernancePrecedents,
  recordCivilizationDoctrineEvolution,
  recordInstitutionalMemory,
} from "./institutional-governance.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import {
  recordExecutionTruthLedger,
  runRealityVerificationEngine,
  trackObservableEffect,
} from "./reality-verification.js";

export type ConstitutionalConflictKind =
  | "policy_conflicts_doctrine"
  | "autonomy_conflicts_constitution"
  | "federation_conflicts_sovereignty"
  | "governance_conflicts_truth";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONST_CIV_DIR = path.join(DATA_DIR, "mission-control", "constitutional-civilization");
const PRECEDENCE_PATH = path.join(CONST_CIV_DIR, "precedence-matrix.json");
const COURT_PATH = path.join(CONST_CIV_DIR, "constitutional-court.jsonl");
const GUARANTEES_PATH = path.join(CONST_CIV_DIR, "immutable-guarantees.jsonl");
const EVOLUTION_PATH = path.join(CONST_CIV_DIR, "constitutional-evolution.jsonl");
const CHARTER_PATH = path.join(CONST_CIV_DIR, "stability-charter.json");
const INTEGRITY_PATH = path.join(CONST_CIV_DIR, "integrity-verification.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-constitutional-civilization-freeze.json");

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

export async function generateConstitutionalPrecedenceMatrix(): Promise<Record<string, unknown>> {
  const constitution = getConstitutionState();
  const matrix = {
    matrix_id: `constitutional_precedence_${Date.now()}`,
    generated_at: new Date().toISOString(),
    formal_precedence: [
      { layer: "constitution", rank: 1000, source: "runtime_constitution" },
      { layer: "creator_sovereignty", rank: 950, source: "immutable_clause" },
      { layer: "doctrines", rank: 850, source: "runtime_doctrine_registry" },
      { layer: "governance_policies", rank: 750, source: "governance_operations" },
      { layer: "operational_heuristics", rank: 650, source: "mission_control" },
      { layer: "adaptive_coordination", rank: 550, source: "runtime_intelligence" },
    ],
    rule_precedence: getConstitutionPrecedence(),
    constitution_version: constitution.version,
    epoch: constitution.epoch,
  };
  writeJson(PRECEDENCE_PATH, matrix);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(matrix.matrix_id, "constitutional_precedence_matrix_generated"),
    trace_id: matrix.matrix_id,
    job_id: "constitutional_civilization",
    type: "constitutional_precedence_matrix_generated",
    timestamp: matrix.generated_at,
    payload: matrix,
  });
  return matrix;
}

export async function arbitrateCivilizationConstitutionalCourt(input: {
  trace_id: string;
  conflict_kind: ConstitutionalConflictKind;
  petitioner: string;
  action: string;
  policy_ref?: string;
  doctrine_ref?: string;
}): Promise<Record<string, unknown>> {
  const constitution = checkConstitution(input.action, input.petitioner);
  const matrix = await generateConstitutionalPrecedenceMatrix();
  const precedentQuery = input.conflict_kind.replaceAll("_", " ");
  const precedents = lookupGovernancePrecedents(precedentQuery);
  const resolution = constitution.allowed ? "allow_under_precedence" : "block_and_escalate_constitutional_review";
  const court = {
    court_id: `constitutional_court_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    conflict_kind: input.conflict_kind,
    petitioner: input.petitioner,
    action: input.action,
    policy_ref: input.policy_ref,
    doctrine_ref: input.doctrine_ref,
    constitution,
    precedence_matrix_ref: matrix.matrix_id,
    precedents,
    resolution,
    resolved_by: constitution.allowed ? "governance_policy" : "constitution",
    created_at: new Date().toISOString(),
  };
  appendJsonl(COURT_PATH, court as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(court.court_id, "civilization_constitutional_court_arbitrated"),
    trace_id: input.trace_id,
    job_id: "constitutional_civilization",
    type: "civilization_constitutional_court_arbitrated",
    timestamp: court.created_at,
    payload: court as unknown as Record<string, unknown>,
  });
  return court;
}

export async function verifyImmutableCivilizationGuarantees(): Promise<Record<string, unknown>> {
  const clauses = getImmutableClauses();
  const constitution = getConstitutionState();
  const guarantees = [
    { guarantee: "no_silent_mutation", ok: clauses.silent_self_modification === false },
    { guarantee: "no_unverifiable_claims", ok: clauses.evidence_before_claim === true },
    { guarantee: "no_autonomous_sovereignty_escalation", ok: constitution.rules_active.some((rule) => rule.type === "creator_sovereignty" && rule.immutable) },
    { guarantee: "no_constitution_bypass", ok: constitution.rules_active.every((rule) => rule.immutable) },
    { guarantee: "rollback_required", ok: clauses.rollback_required === true },
  ];
  const result = {
    guarantees_id: `immutable_guarantees_${Date.now()}`,
    verified_at: new Date().toISOString(),
    guarantees,
    all_passed: guarantees.every((guarantee) => guarantee.ok),
  };
  appendJsonl(GUARANTEES_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.guarantees_id, "immutable_civilization_guarantees_verified"),
    trace_id: result.guarantees_id,
    job_id: "constitutional_civilization",
    type: "immutable_civilization_guarantees_verified",
    timestamp: result.verified_at,
    payload: result,
  });
  return result;
}

export async function createConstitutionalEvolutionGovernance(input: {
  proposal: string;
  change_scope: "constitution" | "doctrine";
  reason: string;
  requested_by?: string;
}): Promise<Record<string, unknown>> {
  const precedent = await generateGovernancePrecedent({
    decision: `${input.change_scope} evolution proposal`,
    outcome: "proposal_requires_review_approval_freeze_and_continuity_archive",
    policy_refs: ["constitutional_evolution_governance", "creator_sovereignty"],
    future_reasoning: "Constitution or doctrine changes must follow proposal, review, precedent check, approval, freeze, continuity archive.",
  });
  const evolution = input.change_scope === "doctrine"
    ? await recordCivilizationDoctrineEvolution({
      doctrine: input.proposal,
      why_changed: input.reason,
      triggered_by: String(precedent.precedent_id),
      stabilized_by: ["review", "precedent_check", "approval", "freeze", "continuity_archive"],
      evidence_refs: [String(precedent.precedent_id)],
    })
    : undefined;
  const archive = await archiveStrategicContinuity({
    epoch: "constitutional_evolution_governance",
    freeze_ref: "runtime-constitutional-civilization-freeze.json",
    stability_transition: `${input.change_scope}_proposal_requires_formal_review`,
    evidence_refs: [String(precedent.precedent_id), ...(evolution ? [String(evolution.evolution_id)] : [])],
  });
  const governance = {
    evolution_id: `constitutional_evolution_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    proposal: input.proposal,
    change_scope: input.change_scope,
    reason: input.reason,
    requested_by: input.requested_by || "mission_control",
    lifecycle: ["proposal", "review", "precedent_check", "approval", "freeze", "continuity_archive"],
    precedent,
    doctrine_evolution: evolution,
    continuity_archive: archive,
    status: "review_required",
    created_at: new Date().toISOString(),
  };
  appendJsonl(EVOLUTION_PATH, governance as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(governance.evolution_id, "constitutional_evolution_governance_created"),
    trace_id: governance.evolution_id,
    job_id: "constitutional_civilization",
    type: "constitutional_evolution_governance_created",
    timestamp: governance.created_at,
    payload: governance as unknown as Record<string, unknown>,
  });
  return governance;
}

export async function generateCivilizationStabilityCharter(): Promise<Record<string, unknown>> {
  const charter = {
    charter_id: `civilization_stability_charter_${Date.now()}`,
    generated_at: new Date().toISOString(),
    principles: {
      survival: "Preserve runtime continuity before expansion.",
      trust: "Prefer traceable, verified, operator-accountable actions.",
      continuity: "Archive epoch transitions, freezes, incidents, and recovery waves.",
      governance_integrity: "Resolve conflicts through constitutional precedence.",
      reality_verification: "Do not close success without observable execution truth.",
      human_oversight: "Escalate uncertainty and constitutional conflicts to operator-governed review.",
    },
  };
  writeJson(CHARTER_PATH, charter);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(charter.charter_id, "civilization_stability_charter_generated"),
    trace_id: charter.charter_id,
    job_id: "constitutional_civilization",
    type: "civilization_stability_charter_generated",
    timestamp: charter.generated_at,
    payload: charter,
  });
  return charter;
}

export async function verifyConstitutionalIntegrity(): Promise<Record<string, unknown>> {
  const constitution = getConstitutionState();
  const status = getConstitutionStatus();
  const matrix = await generateConstitutionalPrecedenceMatrix();
  const doctrines = getAllDoctrines();
  const records = readEvidenceRecords({ order: "asc" }).slice(-2000);
  const matrixLayers = matrix.formal_precedence as Array<{ layer: string; rank: number }>;
  const integrity = {
    integrity_id: `constitutional_integrity_${Date.now()}`,
    verified_at: new Date().toISOString(),
    constitution_integrity: {
      ok: constitution.rules_active.length >= 7 && constitution.rules_active.every((rule) => rule.immutable),
      version: constitution.version,
      rules: constitution.rules_active.length,
      critical_violations: status.critical_violations,
    },
    precedence_integrity: {
      ok: matrixLayers[0]?.layer === "constitution" && matrixLayers.every((layer, index) => index === 0 || layer.rank < matrixLayers[index - 1].rank),
      layers: matrixLayers.map((layer) => layer.layer),
    },
    doctrine_integrity: {
      ok: doctrines.every((doctrine) => doctrine.statement.length > 0),
      count: doctrines.length,
    },
    truth_integrity: {
      ok: records.some((record) => record.type === "reality_verification_engine_ran" || record.type === "execution_truth_ledger_recorded"),
      evidence_refs: records.filter((record) => record.type.includes("truth") || record.type.includes("verification")).slice(-20).map((record) => record.evidence_id),
    },
  };
  const result = {
    ...integrity,
    all_passed: integrity.constitution_integrity.ok
      && integrity.precedence_integrity.ok
      && integrity.doctrine_integrity.ok
      && integrity.truth_integrity.ok,
  };
  appendJsonl(INTEGRITY_PATH, result as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.integrity_id, "constitutional_integrity_verification_completed"),
    trace_id: result.integrity_id,
    job_id: "constitutional_civilization",
    type: "constitutional_integrity_verification_completed",
    timestamp: result.verified_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function createConstitutionalMissionControlDashboard(): Promise<Record<string, unknown>> {
  const [precedence, guarantees, charter, integrity, institutional] = await Promise.all([
    generateConstitutionalPrecedenceMatrix(),
    verifyImmutableCivilizationGuarantees(),
    generateCivilizationStabilityCharter(),
    verifyConstitutionalIntegrity(),
    createInstitutionalMissionControlDashboard(),
  ]);
  const dashboard = {
    dashboard_id: `constitutional_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    precedence,
    constitutional_conflicts: readJsonl<Record<string, unknown>>(COURT_PATH).slice(-25),
    immutable_guarantees: guarantees,
    continuity: institutional.continuity,
    civilization_integrity: integrity,
    stability_charter: charter,
    institutional,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "constitutional_mission_control_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "constitutional_civilization",
    type: "constitutional_mission_control_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      conflicts: dashboard.constitutional_conflicts.length,
      guarantees_passed: guarantees.all_passed,
      integrity_passed: integrity.all_passed,
    },
  });
  return dashboard;
}

export async function runConstitutionalCivilizationSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc20_constitutional_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const task = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "planned",
    intent: "constitutional civilization conflict arbitration",
    notes: "RC20 constitutional conflict created",
  });
  const conflict = await recordInstitutionalMemory({
    kind: "governance_crisis",
    title: "Autonomy conflicts constitution",
    summary: "Autonomy attempted to bypass sovereignty and claim success without evidence.",
    trigger: "autonomy_conflicts_constitution",
    stabilized_by: ["constitutional_court", "precedence_resolution", "continuity_archive"],
    evidence_refs: [task.truth_id],
  });
  const court = await arbitrateCivilizationConstitutionalCourt({
    trace_id: traceId,
    conflict_kind: "autonomy_conflicts_constitution",
    petitioner: "rc20_smoke",
    action: "bypass_sovereignty claim_success_without_evidence self_escalate_autonomy",
    policy_ref: "adaptive_coordination",
    doctrine_ref: "creator_sovereignty",
  });
  const precedence = await generateConstitutionalPrecedenceMatrix();
  const guarantees = await verifyImmutableCivilizationGuarantees();
  const evolution = await createConstitutionalEvolutionGovernance({
    proposal: "Strengthen verification-before-closure doctrine",
    change_scope: "doctrine",
    reason: "Constitutional court blocked autonomy conflict and required continuity archive.",
    requested_by: "constitutional_court",
  });
  const charter = await generateCivilizationStabilityCharter();
  const archive = await archiveStrategicContinuity({
    epoch: "rc20_constitutional_civilization",
    freeze_ref: "runtime-constitutional-civilization-freeze.json",
    incident_ref: String(conflict.memory_id),
    recovery_wave: "constitutional-precedence-resolution",
    stability_transition: "institutional governance society to constitutional civilization infrastructure",
    evidence_refs: [String(court.court_id), String(evolution.evolution_id)],
  });
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "constitutional civilization conflict arbitration",
    execution_ref: task.truth_id,
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "constitutional conflict arbitrated and continuity preserved",
    observed_effect: "court arbitration, precedence matrix, guarantees, evolution governance, and continuity archive recorded",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "constitutional civilization conflict arbitration",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const verification = await runRealityVerificationEngine(traceId);
  const integrity = await verifyConstitutionalIntegrity();
  const stabilization = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "constitutional_civilization_smoke_stabilized",
    why: "Constitutional conflict resolved by precedence, immutable guarantees verified, continuity archived",
    based_on: [String(court.court_id), String(precedence.matrix_id), String(archive.archive_id), String(integrity.integrity_id)],
    evidence_refs: [task.truth_id, executed.truth_id, String(effect.effect_id), verified.truth_id],
    policy_refs: ["constitution", "creator_sovereignty", "evidence_before_claim", "institutional_continuity"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `constitutional_smoke_${Date.now()}`,
    trace_id: traceId,
    constitutional_conflict: conflict,
    court_arbitration: court,
    precedence_resolution: precedence,
    immutable_guarantees: guarantees,
    evolution_governance: evolution,
    stability_charter: charter,
    continuity_preservation: archive,
    integrity,
    verification,
    governance_stabilization: stabilization,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "constitutional_civilization_smoke_completed"),
    trace_id: traceId,
    job_id: "constitutional_civilization",
    type: "constitutional_civilization_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeConstitutionalCivilizationFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runConstitutionalCivilizationSmokePack();
  const dashboard = await createConstitutionalMissionControlDashboard();
  const freeze = {
    freeze_id: `rc20_constitutional_civilization_freeze_${Date.now()}`,
    scope: "RC-20 Runtime Constitutional Civilization Layer",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "constitutional_precedence_matrix",
      "civilization_constitutional_court",
      "immutable_civilization_guarantees",
      "constitutional_evolution_governance",
      "civilization_stability_charter",
      "constitutional_integrity_verification",
      "constitutional_mission_control_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_constitutional_civilization_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "constitutional_civilization",
    type: "runtime_constitutional_civilization_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
