import fs from "node:fs";
import path from "node:path";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { applyHumanOverride, createAutonomousGovernanceDashboard, getExecutionTrustLevel } from "./autonomous-governance.js";
import {
  buildRuntimeCoordinationGraph,
  calculateRuntimeStabilityScore,
  checkRuntimeLoadShedding,
  getRuntimeMaintenanceState,
  setRuntimeMaintenanceState,
} from "./coordination-runtime.js";
import { forecastFederationRisk, generatePredictiveIncidentForecast } from "./intelligence-operations.js";
import { createRuntimeRecoveryDashboard } from "./recovery-operations.js";
import { createSecurityMissionControlDashboard } from "./security-operations.js";
import { createGovernanceDashboard, recordGovernanceDecision } from "./governance-operations.js";

export type CognitiveLayer = "execution" | "governance" | "security" | "planning" | "economy" | "federation" | "recovery" | "autonomy";
export type RuntimeIntent = "stabilize" | "recover" | "optimize" | "protect" | "coordinate" | "defer" | "freeze";
export type StrategicObjective = "stability" | "availability" | "trust" | "cost_efficiency" | "federation_health";
export type CognitivePriority = "security" | "survival" | "recovery" | "governance" | "economy" | "optimization";

export interface CognitiveSignal {
  layer: CognitiveLayer;
  intent: RuntimeIntent;
  priority: CognitivePriority;
  reason: string;
  risk: "low" | "medium" | "high" | "critical";
  evidence_refs: string[];
}

export interface CognitiveConflict {
  conflict_id?: string;
  trace_id?: string;
  signals: CognitiveSignal[];
}

export interface RuntimeStrategicObjective {
  objective: StrategicObjective;
  state: "healthy" | "watch" | "at_risk" | "critical";
  weight: number;
  reason: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const COG_DIR = path.join(DATA_DIR, "mission-control", "cognitive");
const OBJECTIVES_PATH = path.join(COG_DIR, "strategic-objectives.json");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-cognitive-coordination-freeze.json");

const PRIORITY_ORDER: CognitivePriority[] = ["security", "survival", "recovery", "governance", "economy", "optimization"];
const DEFAULT_OBJECTIVES: RuntimeStrategicObjective[] = [
  { objective: "stability", state: "healthy", weight: 1, reason: "Default runtime stability objective" },
  { objective: "availability", state: "healthy", weight: 1, reason: "Default availability objective" },
  { objective: "trust", state: "healthy", weight: 1, reason: "Default trust objective" },
  { objective: "cost_efficiency", state: "healthy", weight: 0.8, reason: "Default cost objective" },
  { objective: "federation_health", state: "healthy", weight: 0.8, reason: "Default federation objective" },
];

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), { encoding: "utf8" });
}

function priorityRank(priority: CognitivePriority): number {
  return PRIORITY_ORDER.indexOf(priority);
}

function riskRank(risk: CognitiveSignal["risk"]): number {
  return risk === "critical" ? 4 : risk === "high" ? 3 : risk === "medium" ? 2 : 1;
}

function stateFromRatio(ratio: number): RuntimeStrategicObjective["state"] {
  if (ratio >= 0.95) return "critical";
  if (ratio >= 0.85) return "at_risk";
  if (ratio >= 0.65) return "watch";
  return "healthy";
}

export async function buildCrossLayerCognitiveGraph(traceId?: string): Promise<Record<string, unknown>> {
  const coordination = await buildRuntimeCoordinationGraph(traceId);
  const stability = await calculateRuntimeStabilityScore();
  const security = await createSecurityMissionControlDashboard();
  const governance = await createGovernanceDashboard();
  const recovery = await createRuntimeRecoveryDashboard();
  const autonomy = await createAutonomousGovernanceDashboard();
  const budgets = getAllBudgets();
  const budgetPressure = budgets.reduce((max, budget) => Math.max(max, budget.limit > 0 ? budget.used / budget.limit : 0), 0);
  const records = readEvidenceRecords({ order: "asc" }).slice(-500);
  const planningSignals = records.filter((record) => record.job_id === "planning" || record.type.includes("planning")).length;
  const federationSignals = records.filter((record) => record.type.includes("federation")).length;

  const nodes = [
    { id: "execution", layer: "execution", state: stability.state, evidence: coordination.graph_id },
    { id: "governance", layer: "governance", state: "active", evidence: governance.dashboard_id },
    { id: "security", layer: "security", state: "active", evidence: security.dashboard_id },
    { id: "planning", layer: "planning", state: planningSignals ? "active" : "quiet", evidence_count: planningSignals },
    { id: "economy", layer: "economy", state: stateFromRatio(budgetPressure), pressure: Number(budgetPressure.toFixed(2)) },
    { id: "federation", layer: "federation", state: federationSignals ? "active" : "quiet", evidence_count: federationSignals },
    { id: "recovery", layer: "recovery", state: "active", evidence: recovery.dashboard_id },
    { id: "autonomy", layer: "autonomy", state: getExecutionTrustLevel(), evidence: autonomy.dashboard_id },
  ];
  const edges = [
    { from: "security", to: "governance", relation: "requires_oversight" },
    { from: "recovery", to: "execution", relation: "restores" },
    { from: "economy", to: "planning", relation: "constrains" },
    { from: "federation", to: "recovery", relation: "coordinates" },
    { from: "autonomy", to: "governance", relation: "bounded_by" },
    { from: "execution", to: "stability", relation: "determines" },
  ];
  const graph = {
    graph_id: `cognitive_graph_${Date.now()}`,
    generated_at: new Date().toISOString(),
    trace_id: traceId,
    nodes,
    edges,
    coordination_summary: {
      nodes: Array.isArray(coordination.nodes) ? coordination.nodes.length : 0,
      edges: Array.isArray(coordination.edges) ? coordination.edges.length : 0,
    },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(graph.graph_id), "cross_layer_cognitive_graph_built"),
    trace_id: traceId || String(graph.graph_id),
    job_id: "cognitive_coordination",
    type: "cross_layer_cognitive_graph_built",
    timestamp: graph.generated_at,
    payload: graph as unknown as Record<string, unknown>,
  });
  return graph;
}

export async function selectRuntimeIntent(signals?: CognitiveSignal[]): Promise<{ intent_id: string; intent: RuntimeIntent; reason: string; signals: CognitiveSignal[] }> {
  const derived = signals || await deriveCognitiveSignals();
  const winning = arbitrateSignals(derived);
  const intent = {
    intent_id: `runtime_intent_${Date.now()}`,
    intent: winning.intent,
    reason: winning.reason,
    signals: derived,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(intent.intent_id, "runtime_intent_selected"),
    trace_id: intent.intent_id,
    job_id: "cognitive_coordination",
    type: "runtime_intent_selected",
    timestamp: new Date().toISOString(),
    payload: intent as unknown as Record<string, unknown>,
  });
  return intent;
}

export async function resolveCognitiveConflict(conflict: CognitiveConflict): Promise<Record<string, unknown>> {
  const winner = arbitrateSignals(conflict.signals);
  const result = {
    conflict_id: conflict.conflict_id || `cog_conflict_${Date.now()}`,
    trace_id: conflict.trace_id || `cog_conflict_trace_${Date.now()}`,
    resolved_at: new Date().toISOString(),
    selected_intent: winner.intent,
    selected_layer: winner.layer,
    selected_priority: winner.priority,
    rejected: conflict.signals.filter((signal) => signal !== winner).map((signal) => ({ layer: signal.layer, intent: signal.intent, priority: signal.priority })),
    reason: `priority=${winner.priority};risk=${winner.risk};${winner.reason}`,
  };
  await recordGovernanceDecision({
    trace_id: String(result.trace_id),
    decision: "cognitive_conflict_resolved",
    why: result.reason,
    based_on: conflict.signals.map((signal) => `${signal.layer}:${signal.intent}`),
    evidence_refs: conflict.signals.flatMap((signal) => signal.evidence_refs),
    policy_refs: ["cognitive_priority_arbitration"],
    risk_level: winner.risk,
  });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(result.conflict_id), "cognitive_conflict_resolved"),
    trace_id: String(result.trace_id),
    job_id: "cognitive_coordination",
    type: "cognitive_conflict_resolved",
    timestamp: String(result.resolved_at),
    payload: result,
  });
  return result;
}

export async function updateRuntimeStrategicObjectives(input?: Partial<Record<StrategicObjective, RuntimeStrategicObjective["state"]>>): Promise<RuntimeStrategicObjective[]> {
  const stability = await calculateRuntimeStabilityScore();
  const federation = await forecastFederationRisk();
  const budgetPressure = getAllBudgets().reduce((max, budget) => Math.max(max, budget.limit > 0 ? budget.used / budget.limit : 0), 0);
  const federationRisk = (federation.risks as Array<{ severity: string }>).some((risk) => risk.severity === "critical" || risk.severity === "high");
  const objectives: RuntimeStrategicObjective[] = [
    { objective: "stability", state: input?.stability || (stability.state === "stable" ? "healthy" : stability.state === "degraded" ? "watch" : stability.state === "critical" ? "at_risk" : "critical"), weight: 1, reason: `runtime_stability=${stability.state}` },
    { objective: "availability", state: input?.availability || (stability.score >= 70 ? "healthy" : stability.score >= 45 ? "at_risk" : "critical"), weight: 1, reason: `stability_score=${stability.score}` },
    { objective: "trust", state: input?.trust || (getExecutionTrustLevel() === "trusted_autonomous" ? "watch" : "healthy"), weight: 1, reason: `trust_level=${getExecutionTrustLevel()}` },
    { objective: "cost_efficiency", state: input?.cost_efficiency || stateFromRatio(budgetPressure), weight: 0.8, reason: `max_budget_pressure=${budgetPressure.toFixed(2)}` },
    { objective: "federation_health", state: input?.federation_health || (federationRisk ? "at_risk" : "healthy"), weight: 0.8, reason: `federation_risk=${federationRisk}` },
  ];
  writeJson(OBJECTIVES_PATH, objectives);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`objectives_${Date.now()}`, "runtime_strategic_objectives_updated"),
    trace_id: "runtime_strategic_objectives",
    job_id: "cognitive_coordination",
    type: "runtime_strategic_objectives_updated",
    timestamp: new Date().toISOString(),
    payload: { objectives },
  });
  return objectives;
}

export async function arbitrateCognitivePriority(signals: CognitiveSignal[]): Promise<Record<string, unknown>> {
  const selected = arbitrateSignals(signals);
  const result = {
    arbitration_id: `cognitive_arbitration_${Date.now()}`,
    selected,
    priority_order: PRIORITY_ORDER,
    candidates: signals,
    decided_at: new Date().toISOString(),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.arbitration_id, "cognitive_priority_arbitrated"),
    trace_id: result.arbitration_id,
    job_id: "cognitive_coordination",
    type: "cognitive_priority_arbitrated",
    timestamp: result.decided_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function applyRuntimeSelfStabilization(reason = "cognitive_coordination"): Promise<Record<string, unknown>> {
  const stability = await calculateRuntimeStabilityScore();
  const forecast = await generatePredictiveIncidentForecast();
  const load = await checkRuntimeLoadShedding({
    priority: stability.state === "stable" ? "normal" : "high",
    queue_depth: stability.state === "stable" ? 1 : stability.state === "degraded" ? 8 : 12,
    active_jobs: stability.state === "stable" ? 1 : stability.state === "degraded" ? 4 : 6,
  });
  const criticalForecast = forecast.predictions.some((prediction) => prediction.severity === "critical" || prediction.severity === "high");
  const shouldFreezeRiskyAutonomy = stability.state !== "stable" || criticalForecast;
  const maintenance = await setRuntimeMaintenanceState(
    stability.state === "unstable" ? "emergency" : stability.state === "critical" ? "recovery" : stability.state === "degraded" ? "degraded" : "normal",
    reason,
  );
  const override = shouldFreezeRiskyAutonomy
    ? await applyHumanOverride({
      freeze_zone: "low_risk_federation_sync",
      force_approval_mode: true,
      actor: "cognitive_coordination",
      reason: `self_stabilization:${stability.state}`,
    })
    : await applyHumanOverride({
      pause_autonomy: false,
      force_approval_mode: false,
      clear_frozen_zones: true,
      actor: "cognitive_coordination",
      reason: "self_stabilization:stable",
    });
  const stabilization = {
    stabilization_id: `self_stabilization_${Date.now()}`,
    applied_at: new Date().toISOString(),
    stability,
    actions: {
      reduce_concurrency: stability.state === "critical" || stability.state === "unstable" || criticalForecast,
      shed_low_priority: load.action === "defer",
      freeze_risky_autonomy: shouldFreezeRiskyAutonomy,
      increase_approvals: shouldFreezeRiskyAutonomy,
    },
    maintenance,
    override,
    forecast,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(stabilization.stabilization_id, "runtime_self_stabilization_applied"),
    trace_id: stabilization.stabilization_id,
    job_id: "cognitive_coordination",
    type: "runtime_self_stabilization_applied",
    timestamp: stabilization.applied_at,
    payload: stabilization as unknown as Record<string, unknown>,
  });
  return stabilization;
}

export async function createCognitiveMissionControlDashboard(): Promise<Record<string, unknown>> {
  const [graph, intent, objectives, stability, autonomy] = await Promise.all([
    buildCrossLayerCognitiveGraph(),
    selectRuntimeIntent(),
    updateRuntimeStrategicObjectives(),
    calculateRuntimeStabilityScore(),
    createAutonomousGovernanceDashboard(),
  ]);
  const dashboard = {
    dashboard_id: `cognitive_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    intent,
    conflicts: readEvidenceRecords({ type: "cognitive_conflict_resolved" }).slice(0, 25),
    objectives,
    stability,
    autonomy: {
      trust_level: getExecutionTrustLevel(),
      proposals: Array.isArray(autonomy.proposals) ? autonomy.proposals.length : 0,
      override: autonomy.override,
    },
    risk: {
      maintenance: getRuntimeMaintenanceState(),
      objectives_at_risk: objectives.filter((objective) => objective.state === "at_risk" || objective.state === "critical"),
    },
    graph,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "cognitive_mission_control_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "cognitive_coordination",
    type: "cognitive_mission_control_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: { intent: intent.intent, objectives: objectives.length, stability: stability.state },
  });
  return dashboard;
}

export async function runCognitiveCoordinationSmokePack(): Promise<Record<string, unknown>> {
  const conflict = await resolveCognitiveConflict({
    conflict_id: `rc12_conflict_${Date.now()}`,
    trace_id: "rc12_cognitive_smoke",
    signals: [
      { layer: "economy", intent: "defer", priority: "economy", reason: "budget wants defer", risk: "medium", evidence_refs: ["economy_budget_pressure"] },
      { layer: "security", intent: "freeze", priority: "security", reason: "security wants freeze", risk: "critical", evidence_refs: ["security_risk"] },
      { layer: "recovery", intent: "recover", priority: "recovery", reason: "recovery wants execute", risk: "high", evidence_refs: ["recovery_path"] },
    ],
  });
  const arbitration = await arbitrateCognitivePriority([
    { layer: "economy", intent: "defer", priority: "economy", reason: "budget pressure", risk: "medium", evidence_refs: ["economy"] },
    { layer: "security", intent: "protect", priority: "security", reason: "protect critical loop", risk: "critical", evidence_refs: ["security"] },
  ]);
  const stabilization = await applyRuntimeSelfStabilization("rc12 smoke");
  const recovery = await createRuntimeRecoveryDashboard();
  const closure = await recordGovernanceDecision({
    trace_id: "rc12_cognitive_smoke",
    decision: "cognitive_coordination_closed",
    why: "Conflict arbitrated, stabilization applied, recovery state visible",
    based_on: [String(conflict.conflict_id), String(stabilization.stabilization_id)],
    evidence_refs: [String(conflict.conflict_id), String(stabilization.stabilization_id)],
    policy_refs: ["cognitive_priority_arbitration", "runtime_self_stabilization"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `cognitive_smoke_${Date.now()}`,
    conflict,
    arbitration,
    stabilization,
    recovery,
    closure,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "cognitive_coordination_smoke_completed"),
    trace_id: "rc12_cognitive_smoke",
    job_id: "cognitive_coordination",
    type: "cognitive_coordination_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeCognitiveCoordinationFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runCognitiveCoordinationSmokePack();
  const dashboard = await createCognitiveMissionControlDashboard();
  const freeze = {
    freeze_id: `rc12_cognitive_freeze_${Date.now()}`,
    scope: "RC-12 Runtime Cognitive Coordination",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "cross_layer_cognitive_graph",
      "runtime_intent_layer",
      "cognitive_conflict_resolution",
      "runtime_strategic_objectives",
      "cognitive_priority_arbitration",
      "runtime_self_stabilization",
      "cognitive_mission_control_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_cognitive_coordination_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "cognitive_coordination",
    type: "runtime_cognitive_coordination_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}

async function deriveCognitiveSignals(): Promise<CognitiveSignal[]> {
  const stability = await calculateRuntimeStabilityScore();
  const forecast = await generatePredictiveIncidentForecast();
  const budgets = getAllBudgets();
  const maxBudgetPressure = budgets.reduce((max, budget) => Math.max(max, budget.limit > 0 ? budget.used / budget.limit : 0), 0);
  const signals: CognitiveSignal[] = [];
  if (forecast.predictions.some((prediction) => prediction.severity === "critical" || prediction.severity === "high")) {
    signals.push({ layer: "security", intent: "protect", priority: "security", reason: "high predictive risk", risk: "high", evidence_refs: forecast.predictions.map((prediction) => prediction.kind) });
  }
  if (stability.state === "critical" || stability.state === "unstable") {
    signals.push({ layer: "execution", intent: "stabilize", priority: "survival", reason: `stability=${stability.state}`, risk: "critical", evidence_refs: stability.reasons });
  }
  if (stability.state === "degraded") {
    signals.push({ layer: "recovery", intent: "recover", priority: "recovery", reason: "runtime degraded", risk: "high", evidence_refs: stability.reasons });
  }
  if (maxBudgetPressure >= 0.85) {
    signals.push({ layer: "economy", intent: "defer", priority: "economy", reason: `budget_pressure=${maxBudgetPressure.toFixed(2)}`, risk: "medium", evidence_refs: ["runtime_budget"] });
  }
  if (!signals.length) {
    signals.push({ layer: "governance", intent: "coordinate", priority: "governance", reason: "runtime nominal", risk: "low", evidence_refs: ["runtime_stability"] });
  }
  return signals;
}

function arbitrateSignals(signals: CognitiveSignal[]): CognitiveSignal {
  if (!signals.length) {
    return { layer: "governance", intent: "coordinate", priority: "governance", reason: "no signals provided", risk: "low", evidence_refs: [] };
  }
  return [...signals].sort((a, b) => {
    const priority = priorityRank(a.priority) - priorityRank(b.priority);
    if (priority !== 0) return priority;
    return riskRank(b.risk) - riskRank(a.risk);
  })[0];
}
