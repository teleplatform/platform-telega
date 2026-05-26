import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import {
  createMetaCognitionDashboard,
  verifySovereignMetaGovernance,
} from "./meta-cognition.js";
import {
  createEvolutionCivilizationDashboard,
  verifyEvolutionContinuityGuarantees,
} from "./adaptive-evolution.js";
import { createEconomicCivilizationDashboard } from "./economic-civilization.js";
import {
  createCivilizationFabricDashboard,
  recordCrossLayerExecutionLineage,
  synchronizeCivilizationExecution,
  verifySovereignExecutionGuarantees,
} from "./civilization-execution-fabric.js";
import { createSecurityMissionControlDashboard } from "./security-operations.js";
import { buildFederationStabilitySurface } from "./federation-operations.js";
import { createInstitutionalMissionControlDashboard, recordInstitutionalMemory } from "./institutional-governance.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import { createCivilizationRealityKernelState } from "./reality-civilization-kernel.js";
import { recordExecutionTruthLedger, trackObservableEffect } from "./reality-verification.js";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONSCIOUS_DIR = path.join(DATA_DIR, "mission-control", "conscious-coordination");
const AWARENESS_PATH = path.join(CONSCIOUS_DIR, "coordination-consciousness.jsonl");
const SYNC_PATH = path.join(CONSCIOUS_DIR, "awareness-synchronization.jsonl");
const ATTENTION_PATH = path.join(CONSCIOUS_DIR, "attention-routing.jsonl");
const STABILITY_PATH = path.join(CONSCIOUS_DIR, "conscious-stability.jsonl");
const SITUATION_PATH = path.join(CONSCIOUS_DIR, "situational-awareness.jsonl");
const GUARANTEE_PATH = path.join(CONSCIOUS_DIR, "sovereign-awareness-guarantees.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-conscious-coordination-freeze.json");

const LAYERS = ["execution", "governance", "economy", "security", "federation", "memory", "adaptation", "meta_cognition"];

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

function layerCounts(): Record<string, number> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-2500);
  return {
    execution: records.filter((record) => record.type.includes("execution")).length,
    governance: records.filter((record) => record.type.includes("governance") || record.type.includes("approval")).length,
    economy: records.filter((record) => record.type.includes("economic") || record.type.includes("budget") || record.type.includes("cost")).length,
    security: records.filter((record) => record.type.includes("security") || record.type.includes("threat")).length,
    federation: records.filter((record) => record.type.includes("federation")).length,
    memory: records.filter((record) => record.type.includes("memory") || record.type.includes("institutional")).length,
    adaptation: records.filter((record) => record.type.includes("evolution") || record.type.includes("adaptation")).length,
    meta_cognition: records.filter((record) => record.type.includes("meta") || record.type.includes("blindspot")).length,
  };
}

export async function createCivilizationCoordinationConsciousness(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const counts = layerCounts();
  const awareness = {
    awareness_id: `coordination_consciousness_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id || `conscious_coordination_${Date.now()}`,
    created_at: new Date().toISOString(),
    layers: LAYERS,
    layer_awareness: counts,
    unified_awareness: {
      execution: counts.execution > 0,
      governance: counts.governance > 0,
      economy: counts.economy > 0,
      security: counts.security > 0,
      federation: counts.federation > 0,
      memory: counts.memory > 0,
      adaptation: counts.adaptation > 0,
      meta_cognition: counts.meta_cognition > 0,
    },
  };
  appendJsonl(AWARENESS_PATH, awareness);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(awareness.awareness_id, "civilization_coordination_consciousness_created"),
    trace_id: String(awareness.trace_id),
    job_id: "conscious_coordination",
    type: "civilization_coordination_consciousness_created",
    timestamp: awareness.created_at,
    payload: awareness,
  });
  return awareness;
}

export async function synchronizeCrossLayerAwareness(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const counts = layerCounts();
  const active = Object.entries(counts).filter(([, value]) => value > 0).map(([layer]) => layer);
  const expected = LAYERS;
  const desync = expected.filter((layer) => !active.includes(layer));
  const hiddenGovernancePressure = counts.governance > Math.max(counts.execution, 1) * 2;
  const stabilityFragmentation = Math.max(...Object.values(counts)) - Math.min(...Object.values(counts)) > 500;
  const sync = {
    sync_id: `awareness_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    synchronized_at: new Date().toISOString(),
    active_layers: active,
    layer_desynchronization: desync,
    hidden_governance_pressure: hiddenGovernancePressure,
    stability_fragmentation: stabilityFragmentation,
    synchronized: desync.length === 0 && !hiddenGovernancePressure && !stabilityFragmentation,
    counts,
  };
  appendJsonl(SYNC_PATH, sync);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(sync.sync_id, "cross_layer_awareness_synchronized"),
    trace_id: input?.trace_id || sync.sync_id,
    job_id: "conscious_coordination",
    type: "cross_layer_awareness_synchronized",
    timestamp: sync.synchronized_at,
    payload: sync,
  });
  return sync;
}

export async function routeCivilizationAttention(input?: {
  trace_id?: string;
  critical_risks?: number;
  emerging_instability?: number;
  operator_overload?: number;
  federation_anomalies?: number;
}): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-2000);
  const signals = {
    critical_risks: input?.critical_risks ?? records.filter((record) => JSON.stringify(record.payload || {}).includes("critical")).length,
    emerging_instability: input?.emerging_instability ?? records.filter((record) => record.type.includes("drift") || record.type.includes("instability")).length,
    operator_overload: input?.operator_overload ?? records.filter((record) => JSON.stringify(record.payload || {}).includes("operator_overload")).length,
    federation_anomalies: input?.federation_anomalies ?? records.filter((record) => record.type.includes("federation") && JSON.stringify(record.payload || {}).includes("risk")).length,
  };
  const route = signals.critical_risks > 0
    ? "critical_risk"
    : signals.emerging_instability > 0
      ? "emerging_instability"
      : signals.operator_overload > 0
        ? "operator_overload"
        : signals.federation_anomalies > 0
          ? "federation_anomaly"
          : "steady_state_watch";
  const attention = {
    attention_id: `civilization_attention_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    routed_at: new Date().toISOString(),
    signals,
    route,
    action: route === "steady_state_watch" ? "observe" : "coordinate_stabilization",
  };
  appendJsonl(ATTENTION_PATH, attention);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(attention.attention_id, "civilization_attention_routed"),
    trace_id: input?.trace_id || attention.attention_id,
    job_id: "conscious_coordination",
    type: "civilization_attention_routed",
    timestamp: attention.routed_at,
    payload: attention,
  });
  return attention;
}

export async function coordinateConsciousStability(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const [economic, evolution, metaGuarantees, executionGuarantees] = await Promise.all([
    createEconomicCivilizationDashboard(),
    createEvolutionCivilizationDashboard(),
    verifySovereignMetaGovernance({ trace_id: input?.trace_id }),
    verifySovereignExecutionGuarantees({ trace_id: input?.trace_id }),
  ]);
  const stability = {
    stability_id: `conscious_stability_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    coordinated_at: new Date().toISOString(),
    balance: ["adaptation", "stability", "security", "economy", "autonomy", "continuity"],
    adaptation: evolution.stability_impact,
    economy: economic.economic_stability,
    security: "preserve",
    autonomy: "bounded",
    continuity: metaGuarantees.preserved && executionGuarantees.preserved ? "verified" : "review_required",
    coordination_pressure: metaGuarantees.preserved && executionGuarantees.preserved ? "low" : "elevated",
  };
  appendJsonl(STABILITY_PATH, stability);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(stability.stability_id, "conscious_stability_coordinated"),
    trace_id: input?.trace_id || stability.stability_id,
    job_id: "conscious_coordination",
    type: "conscious_stability_coordinated",
    timestamp: stability.coordinated_at,
    payload: stability,
  });
  return stability;
}

export async function createCivilizationSituationalAwareness(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const [awareness, sync, attention, stability] = await Promise.all([
    createCivilizationCoordinationConsciousness(input),
    synchronizeCrossLayerAwareness(input),
    routeCivilizationAttention(input),
    coordinateConsciousStability(input),
  ]);
  const desync = Array.isArray(sync.layer_desynchronization) ? sync.layer_desynchronization : [];
  const situation = {
    situation_id: `situational_awareness_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    created_at: new Date().toISOString(),
    what_is_happening: "cross_layer_runtime_state_observed",
    why: attention.route,
    what_is_changing: desync.length ? "layer_awareness_rebalancing_required" : "steady_coordination",
    where_risk_accumulates: Object.entries((attention.signals as Record<string, number>)).filter(([, value]) => value > 0).map(([key]) => key),
    awareness,
    synchronization: sync,
    attention,
    stability,
  };
  appendJsonl(SITUATION_PATH, situation as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(situation.situation_id, "civilization_situational_awareness_created"),
    trace_id: input?.trace_id || situation.situation_id,
    job_id: "conscious_coordination",
    type: "civilization_situational_awareness_created",
    timestamp: situation.created_at,
    payload: situation as unknown as Record<string, unknown>,
  });
  return situation;
}

export async function verifySovereignAwarenessGuarantees(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-2500);
  const suspicious = records.filter((record) => {
    const text = JSON.stringify(record.payload || {}).toLowerCase();
    return text.includes("hidden execution pressure")
      || text.includes("invisible instability accumulation")
      || text.includes("silent governance fragmentation");
  });
  const result = {
    guarantee_id: `awareness_guarantees_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    verified_at: new Date().toISOString(),
    guarantees: ["no_hidden_execution_pressure", "no_invisible_instability_accumulation", "no_silent_governance_fragmentation"],
    violations: suspicious.map((record) => ({ evidence_id: record.evidence_id, type: record.type })),
    preserved: suspicious.length === 0,
  };
  appendJsonl(GUARANTEE_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.guarantee_id, "sovereign_awareness_guarantees_verified"),
    trace_id: input?.trace_id || result.guarantee_id,
    job_id: "conscious_coordination",
    type: "sovereign_awareness_guarantees_verified",
    timestamp: result.verified_at,
    payload: result,
  });
  return result;
}

export async function createConsciousCoordinationDashboard(): Promise<Record<string, unknown>> {
  const [meta, fabric, security, federation, memory, guarantees] = await Promise.all([
    createMetaCognitionDashboard(),
    createCivilizationFabricDashboard(),
    createSecurityMissionControlDashboard(),
    buildFederationStabilitySurface(),
    createInstitutionalMissionControlDashboard(),
    verifySovereignAwarenessGuarantees(),
  ]);
  const dashboard = {
    dashboard_id: `conscious_coordination_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    attention: readJsonl<Record<string, unknown>>(ATTENTION_PATH).slice(-25),
    awareness: readJsonl<Record<string, unknown>>(AWARENESS_PATH).slice(-25),
    synchronization: readJsonl<Record<string, unknown>>(SYNC_PATH).slice(-25),
    instability: readJsonl<Record<string, unknown>>(STABILITY_PATH).slice(-25),
    coordination_pressure: meta.meta_stability,
    situational_state: readJsonl<Record<string, unknown>>(SITUATION_PATH).slice(-25),
    surfaces: { fabric, security, federation, memory },
    guarantees,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "conscious_coordination_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "conscious_coordination",
    type: "conscious_coordination_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      attention: dashboard.attention.length,
      awareness: dashboard.awareness.length,
      synchronization: dashboard.synchronization.length,
      guarantees_preserved: guarantees.preserved,
    },
  });
  return dashboard;
}

export async function runConsciousCoordinationSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc26_conscious_coordination_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const instability = await recordInstitutionalMemory({
    kind: "civilization_milestone",
    title: "Cross-layer instability detected",
    summary: "Conscious coordination smoke introduced cross-layer instability for synchronization and attention routing.",
    trigger: "rc26_cross_layer_instability",
    stabilized_by: ["awareness_synchronization", "attention_routing", "coordinated_stabilization"],
    evidence_refs: [],
  });
  const planned = await recordExecutionTruthLedger({ trace_id: traceId, stage: "planned", intent: "conscious coordination recovery" });
  const awareness = await createCivilizationCoordinationConsciousness({ trace_id: traceId });
  const synchronization = await synchronizeCrossLayerAwareness({ trace_id: traceId });
  const attention = await routeCivilizationAttention({
    trace_id: traceId,
    critical_risks: 1,
    emerging_instability: 1,
    operator_overload: 0,
    federation_anomalies: 1,
  });
  const stabilization = await coordinateConsciousStability({ trace_id: traceId });
  const situation = await createCivilizationSituationalAwareness({ trace_id: traceId });
  const governance = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "conscious_coordination_stabilization_approved",
    why: "Cross-layer instability was synchronized, routed to attention, coordinated for stabilization, and prepared for verified recovery",
    based_on: [String(awareness.awareness_id), String(synchronization.sync_id), String(attention.attention_id), String(stabilization.stability_id)],
    evidence_refs: [String(instability.memory_id), String(situation.situation_id)],
    policy_refs: ["sovereign_awareness_guarantees", "conscious_coordination", "reality_verification"],
    risk_level: "medium",
  });
  const claimed = await recordExecutionTruthLedger({ trace_id: traceId, stage: "claimed", intent: "conscious coordination recovery", execution_ref: planned.truth_id, claimed_success: true });
  const executed = await recordExecutionTruthLedger({ trace_id: traceId, stage: "executed", intent: "conscious coordination recovery", execution_ref: claimed.truth_id });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "cross-layer instability coordinated into verified recovery",
    observed_effect: "awareness synchronization, attention routing, stabilization, governance review and recovery verification recorded",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "conscious coordination recovery",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const lineage = await recordCrossLayerExecutionLineage({
    trace_id: traceId,
    intent: "conscious coordination recovery",
    plan_ref: planned.truth_id,
    approval_ref: String(governance.decision_id),
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
    closure_ref: String(governance.decision_id),
    memory_ref: String(instability.memory_id),
  });
  const sync = await synchronizeCivilizationExecution({
    trace_id: traceId,
    nodes: ["local-runtime", "conscious-coordination-runtime"],
    agents: ["operator", "awareness-verifier"],
    governance_refs: [String(governance.decision_id)],
    federation_refs: [String(lineage.lineage_id)],
  });
  const guarantees = await verifySovereignAwarenessGuarantees({ trace_id: traceId });
  const truthState = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "conscious coordination recovery verified",
    execution_ref: executed.truth_id,
    effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
  });
  const dashboard = await createConsciousCoordinationDashboard();
  const smoke = {
    smoke_id: `conscious_coordination_smoke_${Date.now()}`,
    trace_id: traceId,
    cross_layer_instability: instability,
    awareness_synchronization: synchronization,
    attention_routing: attention,
    coordinated_stabilization: stabilization,
    verified_recovery: {
      claimed,
      executed,
      effect,
      verification: verified,
      lineage,
      sync,
      truth_state: truthState,
      guarantees,
    },
    situational_awareness: situation,
    dashboard,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "conscious_coordination_smoke_completed"),
    trace_id: traceId,
    job_id: "conscious_coordination",
    type: "conscious_coordination_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeConsciousCoordinationFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runConsciousCoordinationSmokePack();
  const dashboard = await createConsciousCoordinationDashboard();
  const freeze = {
    freeze_id: `rc26_conscious_coordination_freeze_${Date.now()}`,
    scope: "RC-26 Runtime Civilization Conscious Coordination",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "civilization_coordination_consciousness",
      "cross_layer_awareness_synchronization",
      "civilization_attention_routing",
      "conscious_stability_coordination",
      "civilization_situational_awareness",
      "sovereign_awareness_guarantees",
      "conscious_coordination_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_conscious_coordination_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "conscious_coordination",
    type: "runtime_conscious_coordination_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
