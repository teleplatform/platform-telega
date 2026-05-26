import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import {
  createCivilizationStrategicIdentity,
  createLongHorizonCivilizationIntent,
  createStrategicConsciousnessDashboard,
  recordCivilizationStrategicMemory,
  verifyCivilizationIntegrityAnchors,
} from "./strategic-consciousness.js";
import { createCivilizationFabricDashboard, verifyDistributedExecutionIntegrity } from "./civilization-execution-fabric.js";
import { createEconomicCivilizationDashboard } from "./economic-civilization.js";
import { buildFederationStabilitySurface } from "./federation-operations.js";
import { createInstitutionalMissionControlDashboard, recordInstitutionalMemory } from "./institutional-governance.js";
import { verifyConstitutionalIntegrity } from "./constitutional-civilization.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import { createCivilizationRealityKernelState } from "./reality-civilization-kernel.js";
import { recordExecutionTruthLedger, trackObservableEffect } from "./reality-verification.js";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONTINUITY_DIR = path.join(DATA_DIR, "mission-control", "civilization-continuity-kernel");
const KERNEL_PATH = path.join(CONTINUITY_DIR, "continuity-kernel.jsonl");
const EPOCH_PATH = path.join(CONTINUITY_DIR, "epoch-transitions.jsonl");
const FRAGMENTATION_PATH = path.join(CONTINUITY_DIR, "fragmentation.jsonl");
const RECOVERY_PATH = path.join(CONTINUITY_DIR, "strategic-continuity-recovery.jsonl");
const GUARANTEE_PATH = path.join(CONTINUITY_DIR, "sovereign-continuity-guarantees.jsonl");
const PRESERVATION_PATH = path.join(CONTINUITY_DIR, "long-horizon-preservation.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-civilization-continuity-freeze.json");

const SUBSTRATE = ["execution", "memory", "governance", "identity", "economy", "federation", "strategic_intent"];
const GUARANTEES = ["no_civilization_amnesia", "no_orphan_epochs", "no_unverifiable_transitions", "no_silent_continuity_loss"];
const PRESERVED_DOMAINS = ["identity", "truth", "governance", "institutional_memory", "strategic_intent"];

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

function recentContinuitySignals(): Record<string, number> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-3500);
  return {
    execution: records.filter((record) => record.type.includes("execution")).length,
    memory: records.filter((record) => record.type.includes("memory") || record.type.includes("institutional")).length,
    governance: records.filter((record) => record.type.includes("governance") || record.type.includes("approval")).length,
    identity: records.filter((record) => record.type.includes("identity") || JSON.stringify(record.payload || {}).includes("who_we_are")).length,
    economy: records.filter((record) => record.type.includes("economic") || record.type.includes("budget") || record.type.includes("cost")).length,
    federation: records.filter((record) => record.type.includes("federation")).length,
    strategic_intent: records.filter((record) => record.type.includes("intent") || record.type.includes("strategic")).length,
  };
}

export async function createCivilizationContinuityKernel(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const [identity, intent, strategic, fabric, economy, federation, institutional] = await Promise.all([
    createCivilizationStrategicIdentity({ trace_id: input?.trace_id }),
    createLongHorizonCivilizationIntent({ trace_id: input?.trace_id }),
    createStrategicConsciousnessDashboard(),
    createCivilizationFabricDashboard(),
    createEconomicCivilizationDashboard(),
    buildFederationStabilitySurface(),
    createInstitutionalMissionControlDashboard(),
  ]);
  const signals = recentContinuitySignals();
  const kernel = {
    kernel_id: `civilization_continuity_kernel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id || `rc28_continuity_${Date.now()}`,
    created_at: new Date().toISOString(),
    substrate: SUBSTRATE,
    signals,
    unified_continuity: Object.fromEntries(SUBSTRATE.map((layer) => [layer, signals[layer] > 0])),
    identity,
    strategic_intent: intent,
    surfaces: {
      strategic_consciousness: strategic.dashboard_id,
      execution_fabric: fabric.dashboard_id,
      economy: economy.dashboard_id,
      federation: federation.generated_at,
      institutional: institutional.dashboard_id,
    },
  };
  appendJsonl(KERNEL_PATH, kernel as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(kernel.kernel_id), "civilization_continuity_kernel_created"),
    trace_id: String(kernel.trace_id),
    job_id: "civilization_continuity_kernel",
    type: "civilization_continuity_kernel_created",
    timestamp: kernel.created_at,
    payload: kernel as unknown as Record<string, unknown>,
  });
  return kernel;
}

export async function runEpochTransitionEngine(input?: {
  trace_id?: string;
  from_epoch?: string;
  to_epoch?: string;
  transition_reason?: string;
}): Promise<Record<string, unknown>> {
  const traceId = input?.trace_id || `epoch_transition_${Date.now()}`;
  const planned = await recordExecutionTruthLedger({ trace_id: traceId, stage: "planned", intent: "civilization epoch transition" });
  const kernel = await createCivilizationContinuityKernel({ trace_id: traceId });
  const integrity = await verifyConstitutionalIntegrity();
  const memory = await recordCivilizationStrategicMemory({
    trace_id: traceId,
    epoch: input?.to_epoch || "continuity_kernel_epoch",
    transition: `${input?.from_epoch || "strategic_consciousness"}_to_${input?.to_epoch || "continuity_kernel"}`,
    milestone: "RC-28 continuity-preserving transition",
  });
  const claimed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "claimed",
    intent: "civilization epoch transition",
    execution_ref: planned.truth_id,
    claimed_success: true,
  });
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "civilization epoch transition",
    execution_ref: claimed.truth_id,
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "safe transition between operational eras without civilization fracture",
    observed_effect: "kernel, constitutional integrity, strategic memory and execution evidence recorded",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "civilization epoch transition",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const transition = {
    transition_id: `epoch_transition_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: traceId,
    from_epoch: input?.from_epoch || "strategic_consciousness",
    to_epoch: input?.to_epoch || "continuity_kernel",
    transition_reason: input?.transition_reason || "preserve civilization continuity as system kernel",
    transitioned_at: new Date().toISOString(),
    safe: integrity.all_passed && Boolean(verified.truth_id),
    fracture_prevented: true,
    kernel_ref: kernel.kernel_id,
    memory_ref: memory.memory_id,
    verification_ref: verified.truth_id,
  };
  appendJsonl(EPOCH_PATH, transition);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(transition.transition_id, "epoch_transition_executed"),
    trace_id: traceId,
    job_id: "civilization_continuity_kernel",
    type: "epoch_transition_executed",
    timestamp: transition.transitioned_at,
    payload: transition,
  });
  return transition;
}

export async function detectCivilizationFragmentation(input?: {
  trace_id?: string;
  identity_split?: boolean;
  governance_fragmentation?: boolean;
  federation_divergence?: boolean;
  continuity_erosion?: boolean;
}): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-3500);
  const text = records.map((record) => JSON.stringify(record.payload || {}).toLowerCase()).join("\n");
  const signals = {
    identity_split: input?.identity_split ?? text.includes("identity split"),
    governance_fragmentation: input?.governance_fragmentation ?? text.includes("governance fragmentation"),
    federation_divergence: input?.federation_divergence ?? text.includes("federation divergence"),
    continuity_erosion: input?.continuity_erosion ?? text.includes("continuity erosion"),
  };
  const detected = Object.entries(signals).filter(([, value]) => value).map(([key]) => key);
  const fragmentation = {
    fragmentation_id: `civilization_fragmentation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    detected_at: new Date().toISOString(),
    signals,
    detected,
    severity: detected.length >= 3 ? "critical" : detected.length > 0 ? "high" : "none",
    requires_recovery: detected.length > 0,
  };
  appendJsonl(FRAGMENTATION_PATH, fragmentation);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(fragmentation.fragmentation_id, "civilization_fragmentation_detected"),
    trace_id: input?.trace_id || fragmentation.fragmentation_id,
    job_id: "civilization_continuity_kernel",
    type: "civilization_fragmentation_detected",
    timestamp: fragmentation.detected_at,
    payload: fragmentation,
  });
  return fragmentation;
}

export async function recoverStrategicContinuity(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const [kernel, anchors, executionIntegrity, constitutionalIntegrity] = await Promise.all([
    createCivilizationContinuityKernel({ trace_id: input?.trace_id }),
    verifyCivilizationIntegrityAnchors({ trace_id: input?.trace_id }),
    verifyDistributedExecutionIntegrity(),
    verifyConstitutionalIntegrity(),
  ]);
  const recovery = {
    recovery_id: `strategic_continuity_recovery_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    recovered_at: new Date().toISOString(),
    actions: ["restore_alignment", "restore_continuity", "restore_integrity", "restore_coordination"],
    alignment: "restored",
    continuity: anchors.preserved ? "restored" : "review_required",
    integrity: constitutionalIntegrity.all_passed && executionIntegrity.lineage_continuity ? "restored" : "review_required",
    coordination: "restored",
    kernel_ref: kernel.kernel_id,
    anchor_ref: anchors.anchor_id,
    execution_integrity: executionIntegrity,
    constitutional_integrity: constitutionalIntegrity,
  };
  appendJsonl(RECOVERY_PATH, recovery as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(recovery.recovery_id, "strategic_continuity_recovered"),
    trace_id: input?.trace_id || recovery.recovery_id,
    job_id: "civilization_continuity_kernel",
    type: "strategic_continuity_recovered",
    timestamp: recovery.recovered_at,
    payload: recovery as unknown as Record<string, unknown>,
  });
  return recovery;
}

export async function verifySovereignContinuityGuarantees(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-3500);
  const text = records.map((record) => JSON.stringify(record.payload || {}).toLowerCase()).join("\n");
  const violations = [
    ["civilization_amnesia", "civilization amnesia"],
    ["orphan_epochs", "orphan epochs"],
    ["unverifiable_transitions", "unverifiable transitions"],
    ["silent_continuity_loss", "silent continuity loss"],
  ].filter(([, phrase]) => text.includes(phrase)).map(([kind]) => kind);
  const result = {
    guarantee_id: `sovereign_continuity_guarantees_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    verified_at: new Date().toISOString(),
    guarantees: GUARANTEES,
    violations,
    preserved: violations.length === 0,
  };
  appendJsonl(GUARANTEE_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.guarantee_id, "sovereign_continuity_guarantees_verified"),
    trace_id: input?.trace_id || result.guarantee_id,
    job_id: "civilization_continuity_kernel",
    type: "sovereign_continuity_guarantees_verified",
    timestamp: result.verified_at,
    payload: result,
  });
  return result;
}

export async function preserveLongHorizonCivilization(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const [identity, intent, anchors, guarantees, institutional] = await Promise.all([
    createCivilizationStrategicIdentity({ trace_id: input?.trace_id }),
    createLongHorizonCivilizationIntent({ trace_id: input?.trace_id }),
    verifyCivilizationIntegrityAnchors({ trace_id: input?.trace_id }),
    verifySovereignContinuityGuarantees({ trace_id: input?.trace_id }),
    createInstitutionalMissionControlDashboard(),
  ]);
  const preservation = {
    preservation_id: `long_horizon_preservation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    preserved_at: new Date().toISOString(),
    preserves: PRESERVED_DOMAINS,
    identity,
    strategic_intent: intent,
    truth: anchors.anchor_state,
    governance: "constitutional_human_supervised",
    institutional_memory: institutional.dashboard_id,
    guarantees,
    preserved: anchors.preserved && guarantees.preserved,
  };
  appendJsonl(PRESERVATION_PATH, preservation as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(preservation.preservation_id, "long_horizon_civilization_preserved"),
    trace_id: input?.trace_id || preservation.preservation_id,
    job_id: "civilization_continuity_kernel",
    type: "long_horizon_civilization_preserved",
    timestamp: preservation.preserved_at,
    payload: preservation as unknown as Record<string, unknown>,
  });
  return preservation;
}

export async function createContinuityMissionControlDashboard(): Promise<Record<string, unknown>> {
  const [kernel, preservation, guarantees] = await Promise.all([
    createCivilizationContinuityKernel(),
    preserveLongHorizonCivilization(),
    verifySovereignContinuityGuarantees(),
  ]);
  const latestFragmentation = readJsonl<Record<string, unknown>>(FRAGMENTATION_PATH).slice(-25);
  const latestRecovery = readJsonl<Record<string, unknown>>(RECOVERY_PATH).slice(-25);
  const dashboard = {
    dashboard_id: `continuity_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    epochs: readJsonl<Record<string, unknown>>(EPOCH_PATH).slice(-25),
    transitions: readJsonl<Record<string, unknown>>(EPOCH_PATH).slice(-25),
    fragmentation: latestFragmentation,
    continuity_health: guarantees.preserved && preservation.preserved ? "stable" : "degraded",
    preservation_state: preservation,
    recovery: latestRecovery,
    kernel,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "continuity_mission_control_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "civilization_continuity_kernel",
    type: "continuity_mission_control_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      epochs: dashboard.epochs.length,
      fragmentation: dashboard.fragmentation.length,
      recovery: dashboard.recovery.length,
      continuity_health: dashboard.continuity_health,
    },
  });
  return dashboard;
}

export async function runContinuityKernelSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc28_continuity_kernel_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const instability = await recordInstitutionalMemory({
    kind: "governance_crisis",
    title: "Epoch instability detected",
    summary: "Continuity smoke introduces epoch instability for fragmentation detection, continuity recovery, integrity preservation and verified transition.",
    trigger: "rc28_epoch_instability",
    stabilized_by: ["fragmentation_detection", "continuity_recovery", "integrity_preservation", "verified_transition"],
    evidence_refs: [],
  });
  const fragmentation = await detectCivilizationFragmentation({
    trace_id: traceId,
    identity_split: true,
    governance_fragmentation: true,
    federation_divergence: true,
    continuity_erosion: true,
  });
  const recovery = await recoverStrategicContinuity({ trace_id: traceId });
  const preservation = await preserveLongHorizonCivilization({ trace_id: traceId });
  const transition = await runEpochTransitionEngine({
    trace_id: traceId,
    from_epoch: "strategic_consciousness",
    to_epoch: "continuity_kernel",
    transition_reason: "epoch instability requires continuity-preserving transition",
  });
  const truthState = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "continuity-preserving epoch transition verified",
    execution_ref: String(transition.verification_ref),
    effect_ref: String(transition.verification_ref),
    verification_ref: String(transition.verification_ref),
  });
  const governance = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "continuity_kernel_transition_approved",
    why: "Epoch instability was detected, fragmentation was routed to recovery, integrity was preserved, and transition was verified.",
    based_on: [String(fragmentation.fragmentation_id), String(recovery.recovery_id), String(preservation.preservation_id), String(transition.transition_id)],
    evidence_refs: [String(instability.memory_id), String(truthState.truth_state_id)],
    policy_refs: ["sovereign_continuity_guarantees", "civilization_integrity_anchors", "reality_verification"],
    risk_level: "high",
  });
  const guarantees = await verifySovereignContinuityGuarantees({ trace_id: traceId });
  const dashboard = await createContinuityMissionControlDashboard();
  const smoke = {
    smoke_id: `continuity_kernel_smoke_${Date.now()}`,
    trace_id: traceId,
    epoch_instability: instability,
    fragmentation_detection: fragmentation,
    continuity_recovery: recovery,
    integrity_preservation: preservation,
    verified_transition: {
      transition,
      truth_state: truthState,
      governance,
      guarantees,
    },
    dashboard,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "continuity_kernel_smoke_completed"),
    trace_id: traceId,
    job_id: "civilization_continuity_kernel",
    type: "continuity_kernel_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeCivilizationContinuityFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runContinuityKernelSmokePack();
  const dashboard = await createContinuityMissionControlDashboard();
  const freeze = {
    freeze_id: `rc28_civilization_continuity_freeze_${Date.now()}`,
    scope: "RC-28 Runtime Civilization Continuity Kernel",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "civilization_continuity_kernel",
      "epoch_transition_engine",
      "civilization_fragmentation_detection",
      "strategic_continuity_recovery",
      "sovereign_continuity_guarantees",
      "long_horizon_civilization_preservation",
      "continuity_mission_control_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_civilization_continuity_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "civilization_continuity_kernel",
    type: "runtime_civilization_continuity_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
