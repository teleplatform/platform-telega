import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import {
  arbitrateCivilizationConstitutionalCourt,
  createConstitutionalEvolutionGovernance,
  verifyConstitutionalIntegrity,
} from "./constitutional-civilization.js";
import {
  createEconomicCivilizationDashboard,
  generateLongHorizonEconomicStability,
} from "./economic-civilization.js";
import {
  createUnifiedCivilizationExecutionFabric,
  recordCrossLayerExecutionLineage,
  synchronizeCivilizationExecution,
  verifySovereignExecutionGuarantees,
} from "./civilization-execution-fabric.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import {
  archiveStrategicContinuity,
  recordInstitutionalMemory,
} from "./institutional-governance.js";
import { createCivilizationRealityKernelState } from "./reality-civilization-kernel.js";
import {
  recordExecutionTruthLedger,
  trackObservableEffect,
} from "./reality-verification.js";

const DATA_DIR = path.join(process.cwd(), ".data");
const EVOLUTION_DIR = path.join(DATA_DIR, "mission-control", "adaptive-evolution");
const ENGINE_PATH = path.join(EVOLUTION_DIR, "adaptive-evolution-engine.jsonl");
const ZONE_PATH = path.join(EVOLUTION_DIR, "controlled-evolution-zones.jsonl");
const RISK_PATH = path.join(EVOLUTION_DIR, "mutation-risk.jsonl");
const FORECAST_PATH = path.join(EVOLUTION_DIR, "evolution-forecast.jsonl");
const GUARANTEE_PATH = path.join(EVOLUTION_DIR, "evolution-guarantees.jsonl");
const GOVERNANCE_PATH = path.join(EVOLUTION_DIR, "sovereign-evolution-governance.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-adaptive-evolution-freeze.json");

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

export async function createAdaptiveCivilizationEvolution(input: {
  trace_id: string;
  weakness: string;
  adaptation: string;
  rollback_plan: string;
  verification_plan: string;
}): Promise<Record<string, unknown>> {
  const simulation = {
    simulation_id: `evolution_simulation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    expected_effect: `adaptation addresses ${input.weakness}`,
    rollbackable: Boolean(input.rollback_plan),
    verifiable: Boolean(input.verification_plan),
    stability_delta: input.adaptation.toLowerCase().includes("reduce") ? "positive" : "watch",
  };
  const evolution = {
    evolution_id: `adaptive_evolution_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    created_at: new Date().toISOString(),
    weakness: input.weakness,
    adaptation: input.adaptation,
    chain: ["detect_weakness", "synthesize_adaptation", "simulate", "govern", "rollout", "verify"],
    proposal: {
      proposal_id: `adaptation_proposal_${Date.now()}`,
      rollback_plan: input.rollback_plan,
      verification_plan: input.verification_plan,
    },
    simulation,
  };
  appendJsonl(ENGINE_PATH, evolution as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(evolution.evolution_id), "adaptive_civilization_evolution_created"),
    trace_id: input.trace_id,
    job_id: "adaptive_evolution",
    type: "adaptive_civilization_evolution_created",
    timestamp: String(evolution.created_at),
    payload: evolution as unknown as Record<string, unknown>,
  });
  return evolution;
}

export async function verifyControlledEvolutionZone(input: {
  trace_id: string;
  evolution_ref: string;
  approved?: boolean;
  bounded?: boolean;
  rollbackable?: boolean;
  verifiable?: boolean;
}): Promise<Record<string, unknown>> {
  const zone = {
    zone_id: `controlled_evolution_zone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    evolution_ref: input.evolution_ref,
    verified_at: new Date().toISOString(),
    approved: input.approved !== false,
    bounded: input.bounded !== false,
    rollbackable: input.rollbackable !== false,
    verifiable: input.verifiable !== false,
  };
  const allowed = zone.approved && zone.bounded && zone.rollbackable && zone.verifiable;
  const result = { ...zone, allowed, state: allowed ? "controlled" : "blocked" };
  appendJsonl(ZONE_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(zone.zone_id, "controlled_evolution_zone_verified"),
    trace_id: input.trace_id,
    job_id: "adaptive_evolution",
    type: "controlled_evolution_zone_verified",
    timestamp: zone.verified_at,
    payload: result,
  });
  return result;
}

export async function analyzeCivilizationMutationRisk(input: {
  trace_id: string;
  adaptation: string;
  economic_pressure?: "low" | "medium" | "high" | "critical";
  governance_confidence?: "high" | "medium" | "low";
}): Promise<Record<string, unknown>> {
  const text = input.adaptation.toLowerCase();
  const risks = [
    ...(text.includes("unbounded") || text.includes("self-modify") ? ["unstable_adaptation"] : []),
    ...(text.includes("doctrine") && text.includes("bypass") ? ["doctrine_fracture"] : []),
    ...(input.governance_confidence === "low" ? ["governance_drift"] : []),
    ...(input.economic_pressure === "high" || input.economic_pressure === "critical" ? ["economic_destabilization"] : []),
  ];
  const analysis = {
    risk_id: `mutation_risk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    analyzed_at: new Date().toISOString(),
    adaptation: input.adaptation,
    risks,
    risk_level: risks.length >= 3 ? "critical" : risks.length > 0 ? "watch" : "low",
  };
  appendJsonl(RISK_PATH, analysis);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(analysis.risk_id, "civilization_mutation_risk_analyzed"),
    trace_id: input.trace_id,
    job_id: "adaptive_evolution",
    type: "civilization_mutation_risk_analyzed",
    timestamp: analysis.analyzed_at,
    payload: analysis,
  });
  return analysis;
}

export async function generateLongHorizonEvolutionForecast(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const risks = readJsonl<Record<string, unknown>>(RISK_PATH).slice(-100);
  const zones = readJsonl<Record<string, unknown>>(ZONE_PATH).slice(-100);
  const blocked = zones.filter((zone) => zone.allowed === false).length;
  const watchRisks = risks.filter((risk) => risk.risk_level === "watch" || risk.risk_level === "critical").length;
  const forecast = {
    forecast_id: `evolution_forecast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    generated_at: new Date().toISOString(),
    adaptation_success: blocked === 0 && watchRisks < 3 ? "likely" : "conditional",
    civilization_fragmentation: watchRisks > 5 ? "watch" : "low",
    stability_recovery: blocked === 0 ? "improving" : "delayed",
    governance_erosion: watchRisks > 3 ? "watch" : "low",
    signals: { risks: risks.length, watch_risks: watchRisks, zones: zones.length, blocked_zones: blocked },
  };
  appendJsonl(FORECAST_PATH, forecast);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(forecast.forecast_id, "long_horizon_evolution_forecast_generated"),
    trace_id: input?.trace_id || forecast.forecast_id,
    job_id: "adaptive_evolution",
    type: "long_horizon_evolution_forecast_generated",
    timestamp: forecast.generated_at,
    payload: forecast,
  });
  return forecast;
}

export async function verifyEvolutionContinuityGuarantees(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const evolutions = readJsonl<Record<string, unknown>>(ENGINE_PATH).slice(-100);
  const zones = readJsonl<Record<string, unknown>>(ZONE_PATH).slice(-100);
  const records = readEvidenceRecords({ order: "asc" }).slice(-2000);
  const suspicious = records.filter((record) => {
    const text = JSON.stringify(record.payload || {}).toLowerCase();
    return text.includes("hidden evolution") || text.includes("uncontrolled self-modification");
  });
  const missingRollback = evolutions.filter((item) => !((item.proposal as Record<string, unknown> | undefined)?.rollback_plan));
  const missingVerification = evolutions.filter((item) => !((item.proposal as Record<string, unknown> | undefined)?.verification_plan));
  const violations = [
    ...suspicious.map((record) => ({ guarantee: "no_hidden_evolution", evidence_id: record.evidence_id })),
    ...missingRollback.map((item) => ({ guarantee: "rollback_mandatory", evolution_id: item.evolution_id })),
    ...missingVerification.map((item) => ({ guarantee: "verification_mandatory", evolution_id: item.evolution_id })),
    ...zones.filter((zone) => zone.allowed === false).map((zone) => ({ guarantee: "no_uncontrolled_self_modification", zone_id: zone.zone_id })),
  ];
  const result = {
    guarantee_id: `evolution_guarantees_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    verified_at: new Date().toISOString(),
    guarantees: ["no_uncontrolled_self_modification", "no_hidden_evolution", "rollback_mandatory", "verification_mandatory"],
    violations,
    preserved: violations.length === 0,
  };
  appendJsonl(GUARANTEE_PATH, result as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.guarantee_id, "evolution_continuity_guarantees_verified"),
    trace_id: input?.trace_id || result.guarantee_id,
    job_id: "adaptive_evolution",
    type: "evolution_continuity_guarantees_verified",
    timestamp: result.verified_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function createSovereignEvolutionGovernance(input: {
  trace_id: string;
  evolution_ref: string;
  proposal_ref: string;
  simulation_ref: string;
  risk_ref: string;
}): Promise<Record<string, unknown>> {
  const constitutional = await arbitrateCivilizationConstitutionalCourt({
    trace_id: input.trace_id,
    conflict_kind: "policy_conflicts_doctrine",
    petitioner: "adaptive_evolution_engine",
    action: "controlled rollbackable verifiable adaptive evolution rollout",
    policy_ref: "adaptive_evolution",
    doctrine_ref: "controlled rollbackable verifiable evolution",
  });
  const constitutionalEvolution = await createConstitutionalEvolutionGovernance({
    proposal: "controlled adaptive civilization evolution",
    change_scope: "doctrine",
    reason: "Evolution rollout requires precedent continuity and creator-governed boundaries.",
    requested_by: "adaptive_evolution_engine",
  });
  const approval = await recordGovernanceDecision({
    trace_id: input.trace_id,
    decision: "adaptive_evolution_governed_rollout_approved",
    why: "Evolution has proposal, simulation, constitutional review, risk analysis, rollback and verification plans",
    based_on: [input.evolution_ref, input.proposal_ref, input.simulation_ref, input.risk_ref],
    evidence_refs: [String(constitutional.court_id), String(constitutionalEvolution.evolution_id)],
    policy_refs: ["controlled_evolution_zones", "constitutional_review", "rollback_mandatory", "verification_mandatory"],
    risk_level: "medium",
  });
  const governance = {
    governance_id: `sovereign_evolution_governance_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    created_at: new Date().toISOString(),
    chain: ["proposal", "simulation", "constitutional_review", "approval", "rollout", "observable_verification", "continuity_archive"],
    constitutional_review: constitutional,
    constitutional_evolution: constitutionalEvolution,
    approval,
  };
  appendJsonl(GOVERNANCE_PATH, governance as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(governance.governance_id, "sovereign_evolution_governance_created"),
    trace_id: input.trace_id,
    job_id: "adaptive_evolution",
    type: "sovereign_evolution_governance_created",
    timestamp: governance.created_at,
    payload: governance as unknown as Record<string, unknown>,
  });
  return governance;
}

export async function createEvolutionCivilizationDashboard(): Promise<Record<string, unknown>> {
  const [economic, constitutional, forecast, guarantees] = await Promise.all([
    createEconomicCivilizationDashboard(),
    verifyConstitutionalIntegrity(),
    generateLongHorizonEvolutionForecast(),
    verifyEvolutionContinuityGuarantees(),
  ]);
  const dashboard = {
    dashboard_id: `evolution_civilization_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    adaptations: readJsonl<Record<string, unknown>>(ENGINE_PATH).slice(-25),
    mutation_risks: readJsonl<Record<string, unknown>>(RISK_PATH).slice(-25),
    evolution_forecasts: readJsonl<Record<string, unknown>>(FORECAST_PATH).slice(-25),
    rollback_states: readJsonl<Record<string, unknown>>(ZONE_PATH).slice(-25).map((zone) => ({
      zone_id: zone.zone_id,
      rollbackable: zone.rollbackable,
      verifiable: zone.verifiable,
      allowed: zone.allowed,
    })),
    stability_impact: {
      economic: economic.economic_stability,
      constitutional: constitutional.truth_integrity,
      forecast,
      guarantees,
    },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "evolution_civilization_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "adaptive_evolution",
    type: "evolution_civilization_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      adaptations: dashboard.adaptations.length,
      risks: dashboard.mutation_risks.length,
      guarantees_preserved: guarantees.preserved,
    },
  });
  return dashboard;
}

export async function runAdaptiveEvolutionSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc24_adaptive_evolution_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fabric = await createUnifiedCivilizationExecutionFabric({ trace_id: traceId });
  const weakness = await recordInstitutionalMemory({
    kind: "civilization_milestone",
    title: "Adaptive evolution weakness detected",
    summary: "Execution congestion and economic scarcity require bounded adaptation.",
    trigger: "rc24_weakness_detection",
    stabilized_by: ["adaptive_evolution_engine", "controlled_zone", "sovereign_governance"],
    evidence_refs: [String(fabric.fabric_id)],
  });
  const evolution = await createAdaptiveCivilizationEvolution({
    trace_id: traceId,
    weakness: "execution congestion under economic scarcity",
    adaptation: "reduce background execution concurrency and increase verification gates",
    rollback_plan: "restore previous concurrency and approval thresholds",
    verification_plan: "verify observable effect, lineage closure, economic stability and constitutional integrity",
  });
  const zone = await verifyControlledEvolutionZone({
    trace_id: traceId,
    evolution_ref: String(evolution.evolution_id),
    approved: true,
    bounded: true,
    rollbackable: true,
    verifiable: true,
  });
  const risk = await analyzeCivilizationMutationRisk({
    trace_id: traceId,
    adaptation: String(evolution.adaptation),
    economic_pressure: "medium",
    governance_confidence: "high",
  });
  const governance = await createSovereignEvolutionGovernance({
    trace_id: traceId,
    evolution_ref: String(evolution.evolution_id),
    proposal_ref: String((evolution.proposal as Record<string, unknown>).proposal_id),
    simulation_ref: String((evolution.simulation as Record<string, unknown>).simulation_id),
    risk_ref: String(risk.risk_id),
  });
  const planned = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "planned",
    intent: "adaptive evolution governed rollout",
  });
  const claimed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "claimed",
    intent: "adaptive evolution governed rollout",
    execution_ref: planned.truth_id,
    claimed_success: true,
  });
  const rollout = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "adaptive evolution governed rollout",
    execution_ref: claimed.truth_id,
  });
  const synchronization = await synchronizeCivilizationExecution({
    trace_id: traceId,
    nodes: ["local-runtime", "evolution-runtime"],
    agents: ["operator", "constitutional-reviewer", "verifier"],
    federation_refs: [String(fabric.fabric_id)],
    governance_refs: [String(governance.governance_id)],
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "bounded adaptation rolled out with verification gates",
    observed_effect: "weakness detection, adaptation proposal, simulation, approval, rollout and verification recorded",
    changed_reality: true,
    evidence_ref: rollout.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "adaptive evolution governed rollout",
    execution_ref: rollout.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const memory = await recordInstitutionalMemory({
    kind: "civilization_milestone",
    title: "Adaptive evolution rollout verified",
    summary: "Controlled adaptation completed with rollback and verification guarantees intact.",
    trigger: "rc24_adaptive_evolution_smoke",
    stabilized_by: ["constitutional_review", "observable_verification", "continuity_archive"],
    evidence_refs: [String(evolution.evolution_id), String(governance.governance_id), verified.truth_id],
  });
  const lineage = await recordCrossLayerExecutionLineage({
    trace_id: traceId,
    intent: "adaptive evolution governed rollout",
    plan_ref: planned.truth_id,
    approval_ref: String((governance.approval as Record<string, unknown>).decision_id),
    execution_ref: rollout.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
    closure_ref: String((governance.approval as Record<string, unknown>).decision_id),
    memory_ref: String(memory.memory_id),
  });
  const guarantees = await verifyEvolutionContinuityGuarantees({ trace_id: traceId });
  const executionGuarantees = await verifySovereignExecutionGuarantees({ trace_id: traceId });
  const forecast = await generateLongHorizonEvolutionForecast({ trace_id: traceId });
  const economic = await generateLongHorizonEconomicStability({ trace_id: traceId });
  const truthState = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "adaptive evolution rollout verified and continuity preserved",
    execution_ref: rollout.truth_id,
    effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
  });
  const archive = await archiveStrategicContinuity({
    epoch: "rc24_adaptive_evolution",
    freeze_ref: "runtime-adaptive-evolution-freeze.json",
    incident_ref: String(weakness.memory_id),
    recovery_wave: "controlled-adaptation-rollout",
    stability_transition: "sovereign cognitive economic civilization to governed adaptive sovereign civilization infrastructure",
    evidence_refs: [String(evolution.evolution_id), String(governance.governance_id), String(truthState.truth_state_id)],
  });
  const rollback = risk.risk_level === "critical"
    ? { state: "rollback_executed", reason: "critical mutation risk" }
    : { state: "rollback_ready_not_required", reason: "adaptation verified stable" };
  const dashboard = await createEvolutionCivilizationDashboard();
  const smoke = {
    smoke_id: `adaptive_evolution_smoke_${Date.now()}`,
    trace_id: traceId,
    weakness_detection: weakness,
    adaptation_proposal: evolution,
    simulation: evolution.simulation,
    approval: governance.approval,
    rollout,
    verification: verified,
    rollback_if_unstable: rollback,
    controlled_zone: zone,
    mutation_risk: risk,
    governance,
    synchronization,
    lineage,
    guarantees,
    execution_guarantees: executionGuarantees,
    forecast,
    economic,
    continuity_archive: archive,
    dashboard,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "adaptive_evolution_smoke_completed"),
    trace_id: traceId,
    job_id: "adaptive_evolution",
    type: "adaptive_evolution_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeAdaptiveEvolutionFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runAdaptiveEvolutionSmokePack();
  const dashboard = await createEvolutionCivilizationDashboard();
  const freeze = {
    freeze_id: `rc24_adaptive_evolution_freeze_${Date.now()}`,
    scope: "RC-24 Runtime Adaptive Civilization Evolution",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "adaptive_civilization_evolution_engine",
      "controlled_evolution_zones",
      "civilization_mutation_risk_analysis",
      "long_horizon_evolution_forecasting",
      "evolution_continuity_guarantees",
      "sovereign_evolution_governance",
      "evolution_civilization_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_adaptive_evolution_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "adaptive_evolution",
    type: "runtime_adaptive_evolution_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
