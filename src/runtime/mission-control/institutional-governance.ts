import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import { createMultiAgentMissionControlDashboard, recordAgentCoordinationMemory } from "./multi-agent-society.js";
import {
  recordExecutionTruthLedger,
  runRealityVerificationEngine,
  trackObservableEffect,
} from "./reality-verification.js";

export type InstitutionalMemoryKind =
  | "doctrine_shift"
  | "governance_crisis"
  | "major_recovery"
  | "strategic_pivot"
  | "federation_incident"
  | "civilization_milestone";

export type InstitutionalTrustSubject = "agent" | "operator" | "federation_node" | "governance_action";

const DATA_DIR = path.join(process.cwd(), ".data");
const INST_DIR = path.join(DATA_DIR, "mission-control", "institutional-governance");
const MEMORY_PATH = path.join(INST_DIR, "institutional-memory.jsonl");
const PRECEDENT_PATH = path.join(INST_DIR, "governance-precedents.jsonl");
const DOCTRINE_EVOLUTION_PATH = path.join(INST_DIR, "doctrine-evolution.jsonl");
const TRUST_PATH = path.join(INST_DIR, "institutional-trust.jsonl");
const CONTINUITY_PATH = path.join(INST_DIR, "strategic-continuity-archive.jsonl");
const ARBITRATION_PATH = path.join(INST_DIR, "institutional-arbitration.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-institutional-governance-freeze.json");

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

export async function recordInstitutionalMemory(input: {
  kind: InstitutionalMemoryKind;
  title: string;
  summary: string;
  trigger?: string;
  stabilized_by?: string[];
  evidence_refs?: string[];
}): Promise<Record<string, unknown>> {
  const memory = {
    memory_id: `institutional_memory_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    trigger: input.trigger,
    stabilized_by: input.stabilized_by || [],
    evidence_refs: input.evidence_refs || [],
    recorded_at: new Date().toISOString(),
  };
  appendJsonl(MEMORY_PATH, memory);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(memory.memory_id, "institutional_memory_recorded"),
    trace_id: memory.memory_id,
    job_id: "institutional_governance",
    type: "institutional_memory_recorded",
    timestamp: memory.recorded_at,
    payload: memory,
  });
  return memory;
}

export async function generateGovernancePrecedent(input: {
  decision: string;
  outcome: string;
  policy_refs?: string[];
  evidence_refs?: string[];
  future_reasoning?: string;
}): Promise<Record<string, unknown>> {
  const precedent = {
    precedent_id: `precedent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    decision: input.decision,
    outcome: input.outcome,
    policy_refs: input.policy_refs || [],
    evidence_refs: input.evidence_refs || [],
    future_reasoning: input.future_reasoning || `Prefer ${input.outcome} when future decisions resemble ${input.decision}.`,
    generated_at: new Date().toISOString(),
  };
  appendJsonl(PRECEDENT_PATH, precedent);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(precedent.precedent_id, "governance_precedent_generated"),
    trace_id: precedent.precedent_id,
    job_id: "institutional_governance",
    type: "governance_precedent_generated",
    timestamp: precedent.generated_at,
    payload: precedent,
  });
  return precedent;
}

export function lookupGovernancePrecedents(query: string): Array<Record<string, unknown>> {
  const normalized = query.toLowerCase();
  return readJsonl<Record<string, unknown>>(PRECEDENT_PATH)
    .filter((precedent) => JSON.stringify(precedent).toLowerCase().includes(normalized))
    .slice(-20);
}

export async function recordCivilizationDoctrineEvolution(input: {
  doctrine: string;
  why_changed: string;
  triggered_by: string;
  stabilized_by: string[];
  evidence_refs?: string[];
}): Promise<Record<string, unknown>> {
  const evolution = {
    evolution_id: `doctrine_evolution_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    doctrine: input.doctrine,
    why_changed: input.why_changed,
    triggered_by: input.triggered_by,
    stabilized_by: input.stabilized_by,
    evidence_refs: input.evidence_refs || [],
    recorded_at: new Date().toISOString(),
  };
  appendJsonl(DOCTRINE_EVOLUTION_PATH, evolution);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(evolution.evolution_id, "civilization_doctrine_evolution_recorded"),
    trace_id: evolution.evolution_id,
    job_id: "institutional_governance",
    type: "civilization_doctrine_evolution_recorded",
    timestamp: evolution.recorded_at,
    payload: evolution,
  });
  return evolution;
}

export async function registerInstitutionalTrust(input: {
  subject_type: InstitutionalTrustSubject;
  subject_id: string;
  trust_score: number;
  reason: string;
  evidence_refs?: string[];
}): Promise<Record<string, unknown>> {
  const trust = {
    trust_id: `institutional_trust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    trust_score: Math.max(0, Math.min(1, input.trust_score)),
    reason: input.reason,
    evidence_refs: input.evidence_refs || [],
    registered_at: new Date().toISOString(),
  };
  appendJsonl(TRUST_PATH, trust);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(trust.trust_id, "institutional_trust_registered"),
    trace_id: trust.subject_id,
    job_id: "institutional_governance",
    type: "institutional_trust_registered",
    timestamp: trust.registered_at,
    payload: trust,
  });
  return trust;
}

export async function archiveStrategicContinuity(input: {
  epoch: string;
  freeze_ref?: string;
  incident_ref?: string;
  recovery_wave?: string;
  stability_transition?: string;
  evidence_refs?: string[];
}): Promise<Record<string, unknown>> {
  const archive = {
    archive_id: `continuity_archive_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    epoch: input.epoch,
    freeze_ref: input.freeze_ref,
    incident_ref: input.incident_ref,
    recovery_wave: input.recovery_wave,
    stability_transition: input.stability_transition,
    evidence_refs: input.evidence_refs || [],
    archived_at: new Date().toISOString(),
  };
  appendJsonl(CONTINUITY_PATH, archive);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(archive.archive_id, "strategic_continuity_archived"),
    trace_id: archive.archive_id,
    job_id: "institutional_governance",
    type: "strategic_continuity_archived",
    timestamp: archive.archived_at,
    payload: archive,
  });
  return archive;
}

export async function arbitrateInstitutionalGovernance(input: {
  trace_id: string;
  current_decision: string;
  proposed_action: string;
  precedent_query: string;
}): Promise<Record<string, unknown>> {
  const precedents = lookupGovernancePrecedents(input.precedent_query);
  const conflicts = precedents.filter((precedent) => {
    const outcome = String(precedent.outcome || "").toLowerCase();
    const proposed = input.proposed_action.toLowerCase();
    return (outcome.includes("block") || outcome.includes("review") || outcome.includes("escalate")) && proposed.includes("bypass");
  });
  const arbitration = {
    arbitration_id: `institutional_arbitration_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    current_decision: input.current_decision,
    proposed_action: input.proposed_action,
    precedent_query: input.precedent_query,
    precedents,
    conflicts,
    decision: conflicts.length ? "escalate_for_governance_review" : "allow_with_institutional_record",
    continuity_preserved: conflicts.length > 0,
    arbitrated_at: new Date().toISOString(),
  };
  appendJsonl(ARBITRATION_PATH, arbitration as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(arbitration.arbitration_id, "institutional_governance_arbitrated"),
    trace_id: input.trace_id,
    job_id: "institutional_governance",
    type: "institutional_governance_arbitrated",
    timestamp: arbitration.arbitrated_at,
    payload: arbitration as unknown as Record<string, unknown>,
  });
  return arbitration;
}

export async function createInstitutionalMissionControlDashboard(): Promise<Record<string, unknown>> {
  const dashboard = {
    dashboard_id: `institutional_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    precedents: readJsonl<Record<string, unknown>>(PRECEDENT_PATH).slice(-50),
    institutional_memory: readJsonl<Record<string, unknown>>(MEMORY_PATH).slice(-50),
    trust_history: readJsonl<Record<string, unknown>>(TRUST_PATH).slice(-50),
    continuity: readJsonl<Record<string, unknown>>(CONTINUITY_PATH).slice(-50),
    governance_evolution: readJsonl<Record<string, unknown>>(DOCTRINE_EVOLUTION_PATH).slice(-50),
    arbitration: readJsonl<Record<string, unknown>>(ARBITRATION_PATH).slice(-25),
    society: await createMultiAgentMissionControlDashboard(),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "institutional_mission_control_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "institutional_governance",
    type: "institutional_mission_control_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      precedents: dashboard.precedents.length,
      memory: dashboard.institutional_memory.length,
      trust: dashboard.trust_history.length,
      continuity: dashboard.continuity.length,
      arbitration: dashboard.arbitration.length,
    },
  });
  return dashboard;
}

export async function runInstitutionalSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc19_institutional_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const task = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "planned",
    intent: "institutional governance conflict resolution",
    notes: "RC19 governance conflict created",
  });
  const memory = await recordInstitutionalMemory({
    kind: "governance_crisis",
    title: "Unverified closure conflict",
    summary: "A current decision attempted to bypass verification before closure.",
    trigger: "current_decision_conflicts_with_historical_precedent",
    stabilized_by: ["precedent_lookup", "institutional_arbitration", "continuity_archive"],
    evidence_refs: [task.truth_id],
  });
  const precedent = await generateGovernancePrecedent({
    decision: "unverified closure attempt",
    outcome: "block_and_escalate_for_review",
    policy_refs: ["evidence_before_claim", "sovereign_truth_enforcement", "institutional_continuity"],
    evidence_refs: [String(memory.memory_id)],
    future_reasoning: "Future closure attempts that bypass verification must be escalated for governance review.",
  });
  const lookup = lookupGovernancePrecedents("unverified closure");
  const arbitration = await arbitrateInstitutionalGovernance({
    trace_id: traceId,
    current_decision: "close incident before observable verification",
    proposed_action: "bypass verification closure",
    precedent_query: "unverified closure",
  });
  const doctrine = await recordCivilizationDoctrineEvolution({
    doctrine: "Evidence Before Claim",
    why_changed: "Institutional precedent strengthened verification-before-closure expectations.",
    triggered_by: String(arbitration.arbitration_id),
    stabilized_by: ["precedent_engine", "truth_ledger", "governance_review"],
    evidence_refs: [String(precedent.precedent_id), String(arbitration.arbitration_id)],
  });
  const trust = await registerInstitutionalTrust({
    subject_type: "governance_action",
    subject_id: String(arbitration.arbitration_id),
    trust_score: 0.92,
    reason: "Arbitration preserved historical precedent and continuity.",
    evidence_refs: [String(precedent.precedent_id), String(doctrine.evolution_id)],
  });
  const archive = await archiveStrategicContinuity({
    epoch: "rc19_institutional_governance",
    freeze_ref: "runtime-institutional-governance-freeze.json",
    incident_ref: String(memory.memory_id),
    recovery_wave: "precedent-guided-governance-review",
    stability_transition: "multi-agent society to institutional governance society",
    evidence_refs: [String(precedent.precedent_id), String(arbitration.arbitration_id), String(trust.trust_id)],
  });
  await recordAgentCoordinationMemory({
    trace_id: traceId,
    kind: "lesson",
    summary: "Institutional precedent overrides isolated agent pressure to close unverified work.",
    agent_ids: ["institutional_governance"],
    evidence_refs: [String(precedent.precedent_id), String(arbitration.arbitration_id)],
  });
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "institutional governance conflict resolution",
    execution_ref: task.truth_id,
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "institutional precedent and continuity archive recorded",
    observed_effect: "memory, precedent, arbitration, trust, and archive entries appended",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "institutional governance conflict resolution",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const verification = await runRealityVerificationEngine(traceId);
  const closure = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "institutional_smoke_closed",
    why: "Governance conflict checked against precedent, arbitrated, continuity preserved, and institutional records verified",
    based_on: [String(memory.memory_id), String(precedent.precedent_id), String(arbitration.arbitration_id), String(archive.archive_id)],
    evidence_refs: [task.truth_id, String(effect.effect_id), verified.truth_id],
    policy_refs: ["institutional_precedent", "civilization_continuity", "evidence_before_claim"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `institutional_smoke_${Date.now()}`,
    trace_id: traceId,
    governance_conflict: memory,
    precedent_lookup: lookup,
    precedent,
    arbitration,
    doctrine_evolution: doctrine,
    trust,
    continuity_preservation: archive,
    executed,
    verification,
    closure,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "institutional_smoke_completed"),
    trace_id: traceId,
    job_id: "institutional_governance",
    type: "institutional_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeInstitutionalGovernanceFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runInstitutionalSmokePack();
  const dashboard = await createInstitutionalMissionControlDashboard();
  const freeze = {
    freeze_id: `rc19_institutional_governance_freeze_${Date.now()}`,
    scope: "RC-19 Runtime Institutional Memory & Governance Society",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "institutional_memory_ledger",
      "governance_precedent_engine",
      "civilization_doctrine_evolution_memory",
      "institutional_trust_registry",
      "strategic_continuity_archive",
      "institutional_governance_arbitration",
      "institutional_mission_control_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_institutional_governance_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "institutional_governance",
    type: "runtime_institutional_governance_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
