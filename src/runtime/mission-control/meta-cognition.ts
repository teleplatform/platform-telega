import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import {
  analyzeCivilizationMutationRisk,
  createAdaptiveCivilizationEvolution,
  createEvolutionCivilizationDashboard,
  verifyControlledEvolutionZone,
  verifyEvolutionContinuityGuarantees,
} from "./adaptive-evolution.js";
import {
  arbitrateCivilizationConstitutionalCourt,
  verifyConstitutionalIntegrity,
} from "./constitutional-civilization.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import { recordInstitutionalMemory } from "./institutional-governance.js";
import { createCivilizationRealityKernelState } from "./reality-civilization-kernel.js";
import {
  recordExecutionTruthLedger,
  trackObservableEffect,
} from "./reality-verification.js";

const DATA_DIR = path.join(process.cwd(), ".data");
const META_DIR = path.join(DATA_DIR, "mission-control", "meta-cognition");
const ENGINE_PATH = path.join(META_DIR, "meta-cognition-engine.jsonl");
const REFLECTION_PATH = path.join(META_DIR, "governance-self-reflection.jsonl");
const BLINDSPOT_PATH = path.join(META_DIR, "cognitive-blindspots.jsonl");
const CORRECTION_PATH = path.join(META_DIR, "self-correction-plans.jsonl");
const FORECAST_PATH = path.join(META_DIR, "meta-stability-forecast.jsonl");
const GUARANTEE_PATH = path.join(META_DIR, "sovereign-meta-governance.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-meta-cognition-freeze.json");

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

export async function createCivilizationMetaCognition(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-2500);
  const counts = {
    reasoning: records.filter((record) => record.type.includes("cognitive") || record.type.includes("intelligence")).length,
    governance: records.filter((record) => record.type.includes("governance") || record.type.includes("approval")).length,
    evolution: records.filter((record) => record.type.includes("evolution") || record.type.includes("mutation")).length,
    stabilization: records.filter((record) => record.type.includes("stability") || record.type.includes("recovery") || record.type.includes("closure")).length,
  };
  const engine = {
    meta_id: `civilization_meta_cognition_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id || `meta_cognition_${Date.now()}`,
    created_at: new Date().toISOString(),
    reasoning_about: ["how_it_reasons", "how_it_governs", "how_it_evolves", "how_it_stabilizes"],
    observed_behavior: counts,
    conclusion: counts.governance > counts.evolution * 4 && counts.evolution > 0 ? "governance_heavy" : "balanced_watch",
  };
  appendJsonl(ENGINE_PATH, engine);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(engine.meta_id, "civilization_meta_cognition_created"),
    trace_id: String(engine.trace_id),
    job_id: "meta_cognition",
    type: "civilization_meta_cognition_created",
    timestamp: engine.created_at,
    payload: engine,
  });
  return engine;
}

export async function reflectGovernanceBehavior(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-2500);
  const approvals = records.filter((record) => record.type.includes("approval")).length;
  const decisions = records.filter((record) => record.type.includes("governance") || record.type.includes("decision")).length;
  const evolutions = records.filter((record) => record.type.includes("evolution")).length;
  const closures = records.filter((record) => record.type.includes("closure")).length;
  const reflection = {
    reflection_id: `governance_reflection_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    reflected_at: new Date().toISOString(),
    over_governance: decisions > Math.max(evolutions, 1) * 8,
    under_governance: decisions < Math.max(closures, 1) / 3,
    approval_pressure: approvals > 50 ? "high" : approvals > 10 ? "medium" : "low",
    stability_rigidity: evolutions === 0 && closures > 20 ? "watch" : "low",
    adaptation_inertia: evolutions < 2 && decisions > 20 ? "watch" : "low",
    signals: { approvals, decisions, evolutions, closures },
  };
  appendJsonl(REFLECTION_PATH, reflection);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(reflection.reflection_id, "governance_self_reflection_completed"),
    trace_id: input?.trace_id || reflection.reflection_id,
    job_id: "meta_cognition",
    type: "governance_self_reflection_completed",
    timestamp: reflection.reflected_at,
    payload: reflection,
  });
  return reflection;
}

export async function detectCognitiveBlindspots(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-2500);
  const missingEvidence = records.filter((record) => JSON.stringify(record.payload || {}).includes("\"missing\"")).length;
  const weakTruth = records.filter((record) => {
    const text = JSON.stringify(record.payload || {});
    return text.includes("\"confidence\":\"weak\"") || text.includes("\"confidence\":\"unverified\"");
  }).length;
  const failedAssumptions = records.filter((record) => {
    const text = JSON.stringify(record.payload || {}).toLowerCase();
    return text.includes("failed assumption") || text.includes("false_success") || text.includes("drift");
  }).length;
  const verificationGaps = records.filter((record) => {
    const text = JSON.stringify(record.payload || {}).toLowerCase();
    return text.includes("verification") && text.includes("missing");
  }).length;
  const blindspots = [
    ...(missingEvidence > 20 ? ["missing_evidence"] : []),
    ...(weakTruth > 10 ? ["systemic_bias_toward_weak_truth"] : []),
    ...(failedAssumptions > 5 ? ["repeated_failed_assumptions"] : []),
    ...(verificationGaps > 10 ? ["verification_gaps"] : []),
  ];
  const result = {
    blindspot_id: `cognitive_blindspot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    detected_at: new Date().toISOString(),
    blindspots,
    signals: { missing_evidence: missingEvidence, weak_truth: weakTruth, failed_assumptions: failedAssumptions, verification_gaps: verificationGaps },
  };
  appendJsonl(BLINDSPOT_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.blindspot_id, "cognitive_blindspot_detected"),
    trace_id: input?.trace_id || result.blindspot_id,
    job_id: "meta_cognition",
    type: "cognitive_blindspot_detected",
    timestamp: result.detected_at,
    payload: result,
  });
  return result;
}

export async function planCivilizationSelfCorrection(input: {
  trace_id: string;
  weakness: string;
  correction: string;
}): Promise<Record<string, unknown>> {
  const evolution = await createAdaptiveCivilizationEvolution({
    trace_id: input.trace_id,
    weakness: input.weakness,
    adaptation: input.correction,
    rollback_plan: "rollback meta-correction to previous governance thresholds",
    verification_plan: "verify governance pressure reduction and evidence completeness",
  });
  const simulation = evolution.simulation as Record<string, unknown>;
  const review = await arbitrateCivilizationConstitutionalCourt({
    trace_id: input.trace_id,
    conflict_kind: "governance_conflicts_truth",
    petitioner: "meta_cognition_engine",
    action: "bounded governance self-correction planning",
    policy_ref: "meta_governance",
    doctrine_ref: "creator_sovereignty",
  });
  const plan = {
    plan_id: `self_correction_plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    planned_at: new Date().toISOString(),
    weakness: input.weakness,
    correction: input.correction,
    simulation,
    review_request: review,
    lifecycle: ["detect_governance_weakness", "synthesize_correction", "simulate", "request_review"],
  };
  appendJsonl(CORRECTION_PATH, plan as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(plan.plan_id, "civilization_self_correction_planned"),
    trace_id: input.trace_id,
    job_id: "meta_cognition",
    type: "civilization_self_correction_planned",
    timestamp: plan.planned_at,
    payload: plan as unknown as Record<string, unknown>,
  });
  return plan;
}

export async function generateMetaStabilityForecast(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const reflections = readJsonl<Record<string, unknown>>(REFLECTION_PATH).slice(-50);
  const blindspots = readJsonl<Record<string, unknown>>(BLINDSPOT_PATH).slice(-50);
  const corrections = readJsonl<Record<string, unknown>>(CORRECTION_PATH).slice(-50);
  const highApproval = reflections.filter((item) => item.approval_pressure === "high").length;
  const blindspotCount = blindspots.reduce((sum, item) => sum + ((item.blindspots as unknown[] | undefined)?.length || 0), 0);
  const forecast = {
    forecast_id: `meta_stability_forecast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    generated_at: new Date().toISOString(),
    cognitive_stagnation: corrections.length === 0 && blindspotCount > 0 ? "watch" : "low",
    governance_overload: highApproval > 2 ? "elevated" : highApproval > 0 ? "watch" : "low",
    institutional_rigidity: reflections.some((item) => item.stability_rigidity === "watch") ? "watch" : "low",
    evolution_paralysis: reflections.some((item) => item.adaptation_inertia === "watch") ? "watch" : "low",
    signals: { reflections: reflections.length, blindspot_count: blindspotCount, corrections: corrections.length, high_approval_reflections: highApproval },
  };
  appendJsonl(FORECAST_PATH, forecast);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(forecast.forecast_id, "meta_stability_forecast_generated"),
    trace_id: input?.trace_id || forecast.forecast_id,
    job_id: "meta_cognition",
    type: "meta_stability_forecast_generated",
    timestamp: forecast.generated_at,
    payload: forecast,
  });
  return forecast;
}

export async function verifySovereignMetaGovernance(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-2500);
  const suspicious = records.filter((record) => record.job_id !== "meta_cognition").filter((record) => {
    const text = JSON.stringify(record.payload || {}).toLowerCase();
    return text.includes("self-redefinition") || text.includes("hidden governance mutation") || text.includes("autonomous constitutional rewrite");
  });
  const result = {
    guarantee_id: `meta_governance_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    verified_at: new Date().toISOString(),
    guarantees: ["no_self_redefinition", "no_hidden_governance_mutation", "no_autonomous_constitutional_rewrite"],
    violations: suspicious.map((record) => ({ evidence_id: record.evidence_id, type: record.type })),
    preserved: suspicious.length === 0,
  };
  appendJsonl(GUARANTEE_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.guarantee_id, "sovereign_meta_governance_verified"),
    trace_id: input?.trace_id || result.guarantee_id,
    job_id: "meta_cognition",
    type: "sovereign_meta_governance_verified",
    timestamp: result.verified_at,
    payload: result,
  });
  return result;
}

export async function createMetaCognitionDashboard(): Promise<Record<string, unknown>> {
  const [evolution, constitutional, forecast, guarantees] = await Promise.all([
    createEvolutionCivilizationDashboard(),
    verifyConstitutionalIntegrity(),
    generateMetaStabilityForecast(),
    verifySovereignMetaGovernance(),
  ]);
  const dashboard = {
    dashboard_id: `meta_cognition_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    blindspots: readJsonl<Record<string, unknown>>(BLINDSPOT_PATH).slice(-25),
    governance_pressure: readJsonl<Record<string, unknown>>(REFLECTION_PATH).slice(-25),
    cognitive_rigidity: {
      constitutional: constitutional.truth_integrity,
      evolution_forecasts: evolution.evolution_forecasts,
    },
    self_correction_proposals: readJsonl<Record<string, unknown>>(CORRECTION_PATH).slice(-25),
    meta_stability: forecast,
    guarantees,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "meta_cognition_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "meta_cognition",
    type: "meta_cognition_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      blindspots: dashboard.blindspots.length,
      reflections: dashboard.governance_pressure.length,
      corrections: dashboard.self_correction_proposals.length,
      guarantees_preserved: guarantees.preserved,
    },
  });
  return dashboard;
}

export async function runMetaCognitionSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc25_meta_cognition_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const blindspotSeed = await recordInstitutionalMemory({
    kind: "civilization_milestone",
    title: "Meta-cognition blindspot seeded",
    summary: "Governance pressure and verification gaps require self-reflection.",
    trigger: "rc25_blindspot",
    stabilized_by: ["self_reflection", "correction_proposal", "governance_review"],
    evidence_refs: [],
  });
  const meta = await createCivilizationMetaCognition({ trace_id: traceId });
  const blindspot = await detectCognitiveBlindspots({ trace_id: traceId });
  const reflection = await reflectGovernanceBehavior({ trace_id: traceId });
  const correction = await planCivilizationSelfCorrection({
    trace_id: traceId,
    weakness: "verification gaps and approval pressure",
    correction: "increase evidence completeness checks while reducing redundant approval gates",
  });
  const zone = await verifyControlledEvolutionZone({
    trace_id: traceId,
    evolution_ref: String((correction.review_request as Record<string, unknown>).court_id || correction.plan_id),
    approved: true,
    bounded: true,
    rollbackable: true,
    verifiable: true,
  });
  const mutationRisk = await analyzeCivilizationMutationRisk({
    trace_id: traceId,
    adaptation: String(correction.correction),
    economic_pressure: "low",
    governance_confidence: "high",
  });
  const review = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "meta_cognition_self_correction_reviewed",
    why: "Blindspot and self-reflection produced bounded correction proposal requiring governance review",
    based_on: [String(blindspot.blindspot_id), String(reflection.reflection_id), String(correction.plan_id)],
    evidence_refs: [String(blindspotSeed.memory_id), String(zone.zone_id), String(mutationRisk.risk_id)],
    policy_refs: ["meta_governance", "constitutional_review", "evidence_completeness"],
    risk_level: "medium",
  });
  const planned = await recordExecutionTruthLedger({ trace_id: traceId, stage: "planned", intent: "meta-cognition stabilization" });
  const claimed = await recordExecutionTruthLedger({ trace_id: traceId, stage: "claimed", intent: "meta-cognition stabilization", execution_ref: planned.truth_id, claimed_success: true });
  const executed = await recordExecutionTruthLedger({ trace_id: traceId, stage: "executed", intent: "meta-cognition stabilization", execution_ref: claimed.truth_id });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "blindspot reflected into governed self-correction",
    observed_effect: "blindspot, self-reflection, correction proposal, governance review and stabilization recorded",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "meta-cognition stabilization",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const truthState = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "meta-cognition stabilization verified",
    execution_ref: executed.truth_id,
    effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
  });
  const guarantees = await verifySovereignMetaGovernance({ trace_id: traceId });
  const evolutionGuarantees = await verifyEvolutionContinuityGuarantees({ trace_id: traceId });
  const forecast = await generateMetaStabilityForecast({ trace_id: traceId });
  const dashboard = await createMetaCognitionDashboard();
  const smoke = {
    smoke_id: `meta_cognition_smoke_${Date.now()}`,
    trace_id: traceId,
    blindspot,
    self_reflection: reflection,
    correction_proposal: correction,
    governance_review: review,
    stabilization: {
      meta,
      zone,
      mutation_risk: mutationRisk,
      effect,
      verification: verified,
      truth_state: truthState,
      guarantees,
      evolution_guarantees: evolutionGuarantees,
    },
    forecast,
    dashboard,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "meta_cognition_smoke_completed"),
    trace_id: traceId,
    job_id: "meta_cognition",
    type: "meta_cognition_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeMetaCognitionFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runMetaCognitionSmokePack();
  const dashboard = await createMetaCognitionDashboard();
  const freeze = {
    freeze_id: `rc25_meta_cognition_freeze_${Date.now()}`,
    scope: "RC-25 Runtime Civilization Meta-Cognition",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "civilization_meta_cognition_engine",
      "governance_self_reflection",
      "cognitive_blindspot_detection",
      "civilization_self_correction_planning",
      "meta_stability_forecasting",
      "sovereign_meta_governance",
      "meta_cognition_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_meta_cognition_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "meta_cognition",
    type: "runtime_meta_cognition_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
