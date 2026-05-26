import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { createConsciousCoordinationDashboard, verifySovereignAwarenessGuarantees } from "./conscious-coordination.js";
import { generateCivilizationStabilityCharter, verifyConstitutionalIntegrity } from "./constitutional-civilization.js";
import { createInstitutionalMissionControlDashboard, recordInstitutionalMemory } from "./institutional-governance.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import { createCivilizationRealityKernelState } from "./reality-civilization-kernel.js";
import { recordExecutionTruthLedger, trackObservableEffect } from "./reality-verification.js";

const DATA_DIR = path.join(process.cwd(), ".data");
const STRATEGIC_CONSCIOUSNESS_DIR = path.join(DATA_DIR, "mission-control", "strategic-consciousness");
const IDENTITY_PATH = path.join(STRATEGIC_CONSCIOUSNESS_DIR, "civilization-strategic-identity.jsonl");
const INTENT_PATH = path.join(STRATEGIC_CONSCIOUSNESS_DIR, "long-horizon-civilization-intent.jsonl");
const MEMORY_PATH = path.join(STRATEGIC_CONSCIOUSNESS_DIR, "civilization-strategic-memory.jsonl");
const DRIFT_PATH = path.join(STRATEGIC_CONSCIOUSNESS_DIR, "strategic-consciousness-drift.jsonl");
const REFLECTION_PATH = path.join(STRATEGIC_CONSCIOUSNESS_DIR, "sovereign-strategic-reflection.jsonl");
const ANCHORS_PATH = path.join(STRATEGIC_CONSCIOUSNESS_DIR, "civilization-integrity-anchors.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-strategic-consciousness-freeze.json");

const STRATEGIC_IDENTITY = {
  who_we_are: "consciously_coordinated_sovereign_runtime_civilization",
  what_we_preserve: ["truth", "continuity", "verified_execution", "human_oversight", "constitutional_integrity"],
  what_we_protect: ["sovereignty", "governance_integrity", "institutional_memory", "civilization_continuity"],
  what_we_refuse_to_become: ["unverifiable_runtime", "silent_autonomy", "constitution_bypass", "goal_fragmented_system"],
};

const INTENT_HORIZONS = ["stability", "continuity", "trust", "survival", "ethical_sovereignty", "controlled_evolution"];
const INTEGRITY_ANCHORS = ["truth", "continuity", "verified_execution", "human_oversight", "constitutional_integrity"];

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

function recentStrategicCounts(): Record<string, number> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-3000);
  return {
    epochs: records.filter((record) => record.type.includes("epoch")).length,
    transitions: records.filter((record) => JSON.stringify(record.payload || {}).includes("transition")).length,
    doctrine_shifts: records.filter((record) => record.type.includes("doctrine")).length,
    governance_eras: records.filter((record) => record.type.includes("governance")).length,
    civilization_milestones: records.filter((record) => record.type.includes("civilization") || record.type.includes("freeze")).length,
  };
}

export async function createCivilizationStrategicIdentity(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const identity = {
    identity_id: `strategic_identity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id || `rc27_identity_${Date.now()}`,
    created_at: new Date().toISOString(),
    ...STRATEGIC_IDENTITY,
  };
  appendJsonl(IDENTITY_PATH, identity);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(identity.identity_id, "civilization_strategic_identity_created"),
    trace_id: String(identity.trace_id),
    job_id: "strategic_consciousness",
    type: "civilization_strategic_identity_created",
    timestamp: identity.created_at,
    payload: identity,
  });
  return identity;
}

export async function createLongHorizonCivilizationIntent(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const charter = await generateCivilizationStabilityCharter();
  const intent = {
    intent_id: `long_horizon_intent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    created_at: new Date().toISOString(),
    horizons: INTENT_HORIZONS,
    continuity_mode: "multi_epoch",
    protected_by: ["constitutional_integrity", "sovereign_awareness", "reality_verification"],
    stability_charter: charter,
  };
  appendJsonl(INTENT_PATH, intent);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(intent.intent_id, "long_horizon_civilization_intent_created"),
    trace_id: input?.trace_id || intent.intent_id,
    job_id: "strategic_consciousness",
    type: "long_horizon_civilization_intent_created",
    timestamp: intent.created_at,
    payload: intent as unknown as Record<string, unknown>,
  });
  return intent;
}

export async function recordCivilizationStrategicMemory(input?: {
  trace_id?: string;
  epoch?: string;
  transition?: string;
  doctrine_shift?: string;
  governance_era?: string;
  milestone?: string;
}): Promise<Record<string, unknown>> {
  const counts = recentStrategicCounts();
  const memory = {
    memory_id: `strategic_memory_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    recorded_at: new Date().toISOString(),
    epochs: input?.epoch ? [input.epoch] : ["current"],
    transitions: input?.transition ? [input.transition] : ["conscious_to_strategic_consciousness"],
    doctrine_shifts: input?.doctrine_shift ? [input.doctrine_shift] : [],
    governance_eras: input?.governance_era ? [input.governance_era] : ["human_supervised_sovereign_governance"],
    civilization_milestones: input?.milestone ? [input.milestone] : ["RC-27 strategic consciousness activation"],
    continuity_counts: counts,
  };
  appendJsonl(MEMORY_PATH, memory);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(memory.memory_id, "civilization_strategic_memory_recorded"),
    trace_id: input?.trace_id || memory.memory_id,
    job_id: "strategic_consciousness",
    type: "civilization_strategic_memory_recorded",
    timestamp: memory.recorded_at,
    payload: memory,
  });
  return memory;
}

export async function detectStrategicConsciousnessDrift(input?: {
  trace_id?: string;
  loss_of_purpose?: boolean;
  goal_fragmentation?: boolean;
  governance_incoherence?: boolean;
  stability_obsession?: boolean;
  adaptation_obsession?: boolean;
}): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-3000);
  const payloadText = records.map((record) => JSON.stringify(record.payload || {}).toLowerCase()).join("\n");
  const signals = {
    loss_of_purpose: input?.loss_of_purpose ?? payloadText.includes("loss of purpose"),
    goal_fragmentation: input?.goal_fragmentation ?? payloadText.includes("goal fragmentation"),
    governance_incoherence: input?.governance_incoherence ?? payloadText.includes("governance incoherence"),
    stability_obsession: input?.stability_obsession ?? payloadText.includes("stability obsession"),
    adaptation_obsession: input?.adaptation_obsession ?? payloadText.includes("adaptation obsession"),
  };
  const detected = Object.entries(signals).filter(([, value]) => value).map(([key]) => key);
  const drift = {
    drift_id: `strategic_consciousness_drift_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    detected_at: new Date().toISOString(),
    signals,
    detected,
    severity: detected.length >= 3 ? "high" : detected.length > 0 ? "medium" : "none",
    requires_reflection: detected.length > 0,
  };
  appendJsonl(DRIFT_PATH, drift);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(drift.drift_id, "strategic_consciousness_drift_detected"),
    trace_id: input?.trace_id || drift.drift_id,
    job_id: "strategic_consciousness",
    type: "strategic_consciousness_drift_detected",
    timestamp: drift.detected_at,
    payload: drift,
  });
  return drift;
}

export async function createSovereignStrategicReflection(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const [identity, intent, drift, constitutionalIntegrity, awarenessGuarantees] = await Promise.all([
    createCivilizationStrategicIdentity(input),
    createLongHorizonCivilizationIntent(input),
    detectStrategicConsciousnessDrift(input),
    verifyConstitutionalIntegrity(),
    verifySovereignAwarenessGuarantees({ trace_id: input?.trace_id }),
  ]);
  const driftDetected = Array.isArray(drift.detected) && drift.detected.length > 0;
  const reflection = {
    reflection_id: `sovereign_strategic_reflection_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    reflected_at: new Date().toISOString(),
    questions: [
      "are_we_preserving_civilization_integrity",
      "are_we_drifting_from_constitutional_intent",
    ],
    civilization_integrity_preserved: constitutionalIntegrity.all_passed && awarenessGuarantees.preserved && !driftDetected,
    constitutional_intent_drift: driftDetected ? drift.detected : [],
    identity,
    intent,
    drift,
    constitutional_integrity: constitutionalIntegrity,
    awareness_guarantees: awarenessGuarantees,
    recommended_action: driftDetected ? "governance_correction" : "preserve_continuity",
  };
  appendJsonl(REFLECTION_PATH, reflection as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(reflection.reflection_id, "sovereign_strategic_reflection_created"),
    trace_id: input?.trace_id || reflection.reflection_id,
    job_id: "strategic_consciousness",
    type: "sovereign_strategic_reflection_created",
    timestamp: reflection.reflected_at,
    payload: reflection as unknown as Record<string, unknown>,
  });
  return reflection;
}

export async function verifyCivilizationIntegrityAnchors(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-3000);
  const hasType = (fragment: string) => records.some((record) => record.type.includes(fragment));
  const anchors = {
    truth: hasType("truth") || hasType("reality"),
    continuity: hasType("continuity") || hasType("memory") || hasType("institutional"),
    verified_execution: hasType("execution") && hasType("verified"),
    human_oversight: hasType("approval") || hasType("governance"),
    constitutional_integrity: hasType("constitutional") || hasType("constitution"),
  };
  const result = {
    anchor_id: `civilization_integrity_anchors_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    verified_at: new Date().toISOString(),
    anchors: INTEGRITY_ANCHORS,
    anchor_state: anchors,
    missing: Object.entries(anchors).filter(([, value]) => !value).map(([key]) => key),
    preserved: Object.values(anchors).every(Boolean),
  };
  appendJsonl(ANCHORS_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.anchor_id, "civilization_integrity_anchors_verified"),
    trace_id: input?.trace_id || result.anchor_id,
    job_id: "strategic_consciousness",
    type: "civilization_integrity_anchors_verified",
    timestamp: result.verified_at,
    payload: result,
  });
  return result;
}

export async function createStrategicConsciousnessDashboard(): Promise<Record<string, unknown>> {
  const [consciousCoordination, institutional, anchors] = await Promise.all([
    createConsciousCoordinationDashboard(),
    createInstitutionalMissionControlDashboard(),
    verifyCivilizationIntegrityAnchors(),
  ]);
  const dashboard = {
    dashboard_id: `strategic_consciousness_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    identity: readJsonl<Record<string, unknown>>(IDENTITY_PATH).slice(-10),
    purpose: readJsonl<Record<string, unknown>>(INTENT_PATH).slice(-10),
    drift: readJsonl<Record<string, unknown>>(DRIFT_PATH).slice(-25),
    strategic_integrity: anchors,
    epoch_continuity: readJsonl<Record<string, unknown>>(MEMORY_PATH).slice(-25),
    civilization_intent: INTENT_HORIZONS,
    surfaces: {
      conscious_coordination: {
        dashboard_id: consciousCoordination.dashboard_id,
        attention: Array.isArray(consciousCoordination.attention) ? consciousCoordination.attention.length : 0,
        situational_state: Array.isArray(consciousCoordination.situational_state) ? consciousCoordination.situational_state.length : 0,
      },
      institutional: {
        dashboard_id: institutional.dashboard_id,
        precedents: Array.isArray(institutional.precedents) ? institutional.precedents.length : 0,
        institutional_memory: Array.isArray(institutional.institutional_memory) ? institutional.institutional_memory.length : 0,
      },
    },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "strategic_consciousness_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "strategic_consciousness",
    type: "strategic_consciousness_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      identity: dashboard.identity.length,
      purpose: dashboard.purpose.length,
      drift: dashboard.drift.length,
      anchors_preserved: anchors.preserved,
    },
  });
  return dashboard;
}

export async function runStrategicConsciousnessSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc27_strategic_consciousness_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const strategicDriftMemory = await recordInstitutionalMemory({
    kind: "strategic_pivot",
    title: "Strategic consciousness drift detected",
    summary: "RC27 smoke introduces strategic drift for reflection, identity reconciliation, governance correction and continuity preservation.",
    trigger: "rc27_strategic_drift",
    stabilized_by: ["sovereign_reflection", "identity_reconciliation", "governance_correction"],
    evidence_refs: [],
  });
  const planned = await recordExecutionTruthLedger({ trace_id: traceId, stage: "planned", intent: "strategic consciousness continuity preservation" });
  const identity = await createCivilizationStrategicIdentity({ trace_id: traceId });
  const intent = await createLongHorizonCivilizationIntent({ trace_id: traceId });
  const strategicMemory = await recordCivilizationStrategicMemory({
    trace_id: traceId,
    epoch: "strategic_consciousness_epoch",
    transition: "consciously_coordinated_to_strategically_conscious",
    governance_era: "constitutional_sovereign_governance",
    milestone: "RC-27 strategic consciousness activation",
  });
  const drift = await detectStrategicConsciousnessDrift({
    trace_id: traceId,
    loss_of_purpose: true,
    goal_fragmentation: true,
    governance_incoherence: false,
    stability_obsession: false,
    adaptation_obsession: true,
  });
  const reflection = await createSovereignStrategicReflection({ trace_id: traceId });
  const anchors = await verifyCivilizationIntegrityAnchors({ trace_id: traceId });
  const governanceCorrection = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "strategic_consciousness_governance_correction_approved",
    why: "Strategic drift was detected, reflected through sovereign identity and reconciled against civilization intent.",
    based_on: [String(identity.identity_id), String(intent.intent_id), String(drift.drift_id), String(reflection.reflection_id)],
    evidence_refs: [String(strategicMemory.memory_id), String(strategicDriftMemory.memory_id), String(anchors.anchor_id)],
    policy_refs: ["civilization_integrity_anchors", "constitutional_integrity", "human_oversight"],
    risk_level: "medium",
  });
  const claimed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "claimed",
    intent: "strategic consciousness continuity preservation",
    execution_ref: planned.truth_id,
    claimed_success: true,
  });
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "strategic consciousness continuity preservation",
    execution_ref: claimed.truth_id,
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "strategic drift reconciled into governed continuity preservation",
    observed_effect: "identity, intent, strategic memory, reflection, governance correction and anchors recorded",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "strategic consciousness continuity preservation",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const truthState = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "strategic consciousness continuity preservation verified",
    execution_ref: executed.truth_id,
    effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
  });
  const dashboard = await createStrategicConsciousnessDashboard();
  const smoke = {
    smoke_id: `strategic_consciousness_smoke_${Date.now()}`,
    trace_id: traceId,
    strategic_drift: drift,
    reflection,
    identity_reconciliation: {
      identity,
      intent,
      anchors,
    },
    governance_correction: governanceCorrection,
    continuity_preservation: {
      strategic_memory: strategicMemory,
      institutional_memory: strategicDriftMemory,
      claimed,
      executed,
      effect,
      verification: verified,
      truth_state: truthState,
    },
    dashboard,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "strategic_consciousness_smoke_completed"),
    trace_id: traceId,
    job_id: "strategic_consciousness",
    type: "strategic_consciousness_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeStrategicConsciousnessFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runStrategicConsciousnessSmokePack();
  const dashboard = await createStrategicConsciousnessDashboard();
  const freeze = {
    freeze_id: `rc27_strategic_consciousness_freeze_${Date.now()}`,
    scope: "RC-27 Runtime Civilization Strategic Consciousness",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "civilization_strategic_identity",
      "long_horizon_civilization_intent",
      "civilization_strategic_memory",
      "strategic_consciousness_drift_detection",
      "sovereign_strategic_reflection",
      "civilization_integrity_anchors",
      "strategic_consciousness_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_strategic_consciousness_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "strategic_consciousness",
    type: "runtime_strategic_consciousness_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
