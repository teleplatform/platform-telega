import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";
import {
  calculateRuntimeStabilityScore,
  generateOperationalMetrics,
  getRuntimeMaintenanceState,
  setRuntimeMaintenanceState,
  type OperationalPriority,
} from "./coordination-runtime.js";
import { buildFederationStabilitySurface, coordinateDistributedRecovery } from "./federation-operations.js";
import { createRuntimeRecoveryDashboard } from "./recovery-operations.js";

export type IncidentPredictionKind = "drift" | "budget_exhaustion" | "replay_storm" | "federation_overload";
export type RuntimeBehaviorProfile = "stable" | "aggressive" | "conservative" | "recovery-heavy" | "unstable";
export type FederationRiskKind = "fragmentation" | "cascade_failure" | "trust_collapse";

export interface PredictiveIncidentForecast {
  forecast_id: string;
  generated_at: string;
  predictions: Array<{
    kind: IncidentPredictionKind;
    probability: number;
    severity: "low" | "medium" | "high" | "critical";
    evidence: string[];
  }>;
}

export interface AdaptiveStabilityRegulation {
  regulation_id: string;
  applied_at: string;
  retry_rate: "normal" | "reduced" | "expanded";
  execution_concurrency: "normal" | "reduced" | "critical_only";
  load_shedding_threshold: number;
  reason: string;
}

export interface LearningLedgerEntry {
  lesson_id: string;
  category: "incident_pattern" | "successful_recovery" | "failed_replay" | "stability_regression";
  trace_id?: string;
  summary: string;
  recorded_at: string;
  evidence: string[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const INTEL_DIR = path.join(DATA_DIR, "mission-control", "intelligence");
const LEARNING_LEDGER_PATH = path.join(INTEL_DIR, "learning-ledger.jsonl");
const POLICY_PATH = path.join(INTEL_DIR, "adaptive-coordination-policy.json");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-intelligence-operations-freeze.json");

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

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function severity(probability: number): "low" | "medium" | "high" | "critical" {
  return probability >= 0.85 ? "critical" : probability >= 0.65 ? "high" : probability >= 0.4 ? "medium" : "low";
}

export async function generatePredictiveIncidentForecast(): Promise<PredictiveIncidentForecast> {
  const records = readEvidenceRecords({ order: "asc" });
  const recent = records.slice(-500);
  const budgets = getAllBudgets();
  const budgetPressure = budgets.reduce((max, budget) => Math.max(max, budget.limit > 0 ? budget.used / budget.limit : 0), 0);
  const driftSignals = recent.filter((record) => record.type.includes("drift")).length;
  const replaySignals = recent.filter((record) => record.type.includes("replay") && (record.type.includes("blocked") || record.type.includes("failed") || record.type.includes("storm"))).length;
  const federationSignals = recent.filter((record) => record.type.includes("federation") && (record.type.includes("overload") || record.type.includes("isolated") || record.type.includes("failure"))).length;

  const candidates: Array<{ kind: IncidentPredictionKind; probability: number; evidence: string[] }> = [
    { kind: "drift", probability: clampProbability(driftSignals / 10), evidence: [`drift_signals=${driftSignals}`] },
    { kind: "budget_exhaustion", probability: clampProbability(budgetPressure), evidence: [`max_budget_pressure=${budgetPressure.toFixed(2)}`] },
    { kind: "replay_storm", probability: clampProbability(replaySignals / 8), evidence: [`replay_risk_signals=${replaySignals}`] },
    { kind: "federation_overload", probability: clampProbability(federationSignals / 6), evidence: [`federation_risk_signals=${federationSignals}`] },
  ];

  const forecast: PredictiveIncidentForecast = {
    forecast_id: `incident_forecast_${Date.now()}`,
    generated_at: new Date().toISOString(),
    predictions: candidates
      .filter((candidate) => candidate.probability > 0)
      .map((candidate) => ({
        ...candidate,
        severity: severity(candidate.probability),
      })),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(forecast.forecast_id, "predictive_incident_forecast_generated"),
    trace_id: forecast.forecast_id,
    job_id: "intelligence",
    type: "predictive_incident_forecast_generated",
    timestamp: forecast.generated_at,
    payload: forecast as unknown as Record<string, unknown>,
  });
  return forecast;
}

export async function applyAdaptiveStabilityRegulation(): Promise<AdaptiveStabilityRegulation> {
  const stability = await calculateRuntimeStabilityScore();
  const forecast = await generatePredictiveIncidentForecast();
  const criticalPrediction = forecast.predictions.some((prediction) => prediction.severity === "critical" || prediction.severity === "high");
  const maintenance = getRuntimeMaintenanceState().state;
  const regulation: AdaptiveStabilityRegulation = {
    regulation_id: `stability_reg_${Date.now()}`,
    applied_at: new Date().toISOString(),
    retry_rate: stability.state === "stable" && !criticalPrediction ? "expanded" : stability.state === "unstable" || criticalPrediction ? "reduced" : "normal",
    execution_concurrency: stability.state === "critical" || stability.state === "unstable" ? "critical_only" : criticalPrediction || maintenance !== "normal" ? "reduced" : "normal",
    load_shedding_threshold: stability.state === "stable" ? 0.9 : stability.state === "degraded" ? 0.75 : 0.6,
    reason: `stability=${stability.state};critical_prediction=${criticalPrediction};maintenance=${maintenance}`,
  };
  if (regulation.execution_concurrency === "critical_only") {
    await setRuntimeMaintenanceState("degraded", "adaptive_stability_regulation");
  }
  await appendEvidenceRecord({
    evidence_id: hashTraceId(regulation.regulation_id, "adaptive_stability_regulation_applied"),
    trace_id: regulation.regulation_id,
    job_id: "intelligence",
    type: "adaptive_stability_regulation_applied",
    timestamp: regulation.applied_at,
    payload: regulation as unknown as Record<string, unknown>,
  });
  return regulation;
}

export async function profileRuntimeBehavior(): Promise<{ profile_id: string; generated_at: string; profile: RuntimeBehaviorProfile; features: Record<string, number> }> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-500);
  const failures = records.filter((record) => record.type.includes("failed") || record.type.includes("blocked")).length;
  const recoveries = records.filter((record) => record.type.includes("recovery")).length;
  const retries = records.filter((record) => record.type.includes("retry")).length;
  const incidents = records.filter((record) => record.type === "runtime_incident_opened").length;
  let profile: RuntimeBehaviorProfile = "stable";
  if (failures > 30 || incidents > 10) profile = "unstable";
  else if (recoveries > failures && recoveries > 5) profile = "recovery-heavy";
  else if (retries > 10 && failures < 10) profile = "aggressive";
  else if (failures > 10 || incidents > 4) profile = "conservative";
  const result = {
    profile_id: `behavior_profile_${Date.now()}`,
    generated_at: new Date().toISOString(),
    profile,
    features: { failures, recoveries, retries, incidents },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.profile_id, "runtime_behavior_profile_generated"),
    trace_id: result.profile_id,
    job_id: "intelligence",
    type: "runtime_behavior_profile_generated",
    timestamp: result.generated_at,
    payload: result,
  });
  return result;
}

export async function forecastFederationRisk(): Promise<Record<string, unknown>> {
  const surface = await buildFederationStabilitySurface();
  const nodes = surface.nodes as Array<{ node_id: string; alive: boolean; health: string; trust: string; load: number }>;
  const isolated = nodes.filter((node) => node.health === "isolated" || node.trust === "revoked").length;
  const overloaded = nodes.filter((node) => node.load >= 0.85).length;
  const unhealthy = nodes.filter((node) => !node.alive || node.health === "critical" || node.health === "degraded").length;
  const risks = [
    { kind: "fragmentation" as FederationRiskKind, probability: clampProbability(isolated / Math.max(1, nodes.length)), evidence: [`isolated=${isolated}`] },
    { kind: "cascade_failure" as FederationRiskKind, probability: clampProbability((overloaded + unhealthy) / Math.max(1, nodes.length * 2)), evidence: [`overloaded=${overloaded}`, `unhealthy=${unhealthy}`] },
    { kind: "trust_collapse" as FederationRiskKind, probability: clampProbability(nodes.filter((node) => node.trust !== "trusted").length / Math.max(1, nodes.length)), evidence: [`untrusted=${nodes.filter((node) => node.trust !== "trusted").length}`] },
  ].filter((risk) => risk.probability > 0);
  const forecast = {
    forecast_id: `federation_risk_${Date.now()}`,
    generated_at: new Date().toISOString(),
    risks: risks.map((risk) => ({ ...risk, severity: severity(risk.probability) })),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(forecast.forecast_id), "federation_risk_forecast_generated"),
    trace_id: String(forecast.forecast_id),
    job_id: "intelligence",
    type: "federation_risk_forecast_generated",
    timestamp: forecast.generated_at,
    payload: forecast as unknown as Record<string, unknown>,
  });
  return forecast;
}

export async function generateAutonomousOperationalRecommendations(): Promise<Record<string, unknown>> {
  const incidentForecast = await generatePredictiveIncidentForecast();
  const federationForecast = await forecastFederationRisk();
  const stability = await calculateRuntimeStabilityScore();
  const recommendations: Array<{ action: "maintenance" | "freeze" | "isolation" | "replay_defer" | "budget_expansion"; priority: OperationalPriority; reason: string }> = [];
  for (const prediction of incidentForecast.predictions) {
    if (prediction.kind === "budget_exhaustion" && prediction.probability >= 0.7) recommendations.push({ action: "budget_expansion", priority: "high", reason: "budget exhaustion predicted" });
    if (prediction.kind === "replay_storm" && prediction.probability >= 0.5) recommendations.push({ action: "replay_defer", priority: "high", reason: "replay storm predicted" });
    if (prediction.severity === "critical") recommendations.push({ action: "freeze", priority: "critical", reason: `${prediction.kind} critical prediction` });
  }
  for (const risk of (federationForecast.risks as Array<{ kind: FederationRiskKind; severity: string }>)) {
    if (risk.kind === "trust_collapse" || risk.kind === "fragmentation") recommendations.push({ action: "isolation", priority: "critical", reason: `${risk.kind} federation risk` });
    if (risk.kind === "cascade_failure") recommendations.push({ action: "maintenance", priority: "high", reason: "cascade failure risk" });
  }
  if (stability.state === "critical" || stability.state === "unstable") recommendations.push({ action: "maintenance", priority: "critical", reason: `runtime stability ${stability.state}` });
  const result = {
    recommendation_id: `ops_reco_${Date.now()}`,
    generated_at: new Date().toISOString(),
    recommendations,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(result.recommendation_id), "autonomous_operational_recommendations_generated"),
    trace_id: String(result.recommendation_id),
    job_id: "intelligence",
    type: "autonomous_operational_recommendations_generated",
    timestamp: result.generated_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function recordRuntimeLearningLedgerEntry(input: Omit<LearningLedgerEntry, "lesson_id" | "recorded_at">): Promise<LearningLedgerEntry> {
  const entry: LearningLedgerEntry = {
    lesson_id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recorded_at: new Date().toISOString(),
    ...input,
  };
  appendJsonl(LEARNING_LEDGER_PATH, entry as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(entry.lesson_id, "runtime_learning_ledger_entry_recorded"),
    trace_id: input.trace_id || entry.lesson_id,
    job_id: "intelligence",
    type: "runtime_learning_ledger_entry_recorded",
    timestamp: entry.recorded_at,
    payload: entry as unknown as Record<string, unknown>,
  });
  return entry;
}

export function readRuntimeLearningLedger(): LearningLedgerEntry[] {
  return readJsonl<LearningLedgerEntry>(LEARNING_LEDGER_PATH);
}

export async function tuneAdaptiveCoordinationPolicy(): Promise<Record<string, unknown>> {
  const profile = await profileRuntimeBehavior();
  const stability = await calculateRuntimeStabilityScore();
  const policy = {
    policy_id: `adaptive_policy_${Date.now()}`,
    tuned_at: new Date().toISOString(),
    priority_weights: profile.profile === "aggressive" ? { critical: 5, high: 4, normal: 2, background: 1 } : { critical: 6, high: 4, normal: 1, background: 0.5 },
    retry_limits: profile.profile === "stable" || profile.profile === "aggressive" ? { transient: 4, replay: 2 } : { transient: 2, replay: 1 },
    routing_rules: stability.state === "stable" ? { handoff_threshold: 0.9, isolate_threshold: 0.98 } : { handoff_threshold: 0.75, isolate_threshold: 0.9 },
    source_profile: profile.profile,
    stability_state: stability.state,
  };
  ensureDir(path.dirname(POLICY_PATH));
  fs.writeFileSync(POLICY_PATH, JSON.stringify(policy, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(policy.policy_id), "adaptive_coordination_policy_tuned"),
    trace_id: String(policy.policy_id),
    job_id: "intelligence",
    type: "adaptive_coordination_policy_tuned",
    timestamp: policy.tuned_at,
    payload: policy as unknown as Record<string, unknown>,
  });
  return policy;
}

export async function createRuntimeIntelligenceDashboard(): Promise<Record<string, unknown>> {
  const [prediction, regulation, profile, federationRisk, recommendations, policy, recovery] = await Promise.all([
    generatePredictiveIncidentForecast(),
    applyAdaptiveStabilityRegulation(),
    profileRuntimeBehavior(),
    forecastFederationRisk(),
    generateAutonomousOperationalRecommendations(),
    tuneAdaptiveCoordinationPolicy(),
    createRuntimeRecoveryDashboard(),
  ]);
  const dashboard = {
    dashboard_id: `intelligence_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    prediction,
    regulation,
    profile,
    federation_risk: federationRisk,
    recommendations,
    policy,
    learning: readRuntimeLearningLedger().slice(-20),
    recovery_health: recovery.health,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(dashboard.dashboard_id), "runtime_intelligence_dashboard_viewed"),
    trace_id: String(dashboard.dashboard_id),
    job_id: "intelligence",
    type: "runtime_intelligence_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: { dashboard_id: dashboard.dashboard_id, recovery_health: recovery.health },
  });
  return dashboard;
}

export async function createRuntimeIntelligenceOperationsFreeze(): Promise<Record<string, unknown>> {
  const dashboard = await createRuntimeIntelligenceDashboard();
  const learning = await recordRuntimeLearningLedgerEntry({
    category: "successful_recovery",
    trace_id: "runtime_intelligence_freeze",
    summary: "RC7 intelligence freeze captured predictive/adaptive runtime state",
    evidence: [String(dashboard.dashboard_id)],
  });
  const recovery = await coordinateDistributedRecovery("local");
  const freeze = {
    freeze_id: `rc7_intelligence_freeze_${Date.now()}`,
    scope: "RC-7 Runtime Intelligence & Adaptive Operations",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    dashboard,
    learning,
    recovery,
    capabilities: [
      "predictive_incident_engine",
      "adaptive_stability_regulation",
      "runtime_behavior_profiling",
      "federation_risk_forecasting",
      "autonomous_operational_recommendations",
      "runtime_learning_ledger",
      "adaptive_coordination_policies",
      "runtime_intelligence_dashboard",
    ],
  };
  ensureDir(path.dirname(FREEZE_PATH));
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_intelligence_operations_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "intelligence",
    type: "runtime_intelligence_operations_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}

