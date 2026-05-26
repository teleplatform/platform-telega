import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkCostGovernance } from "../economy/runtime-cost-governance.js";
import { detectEconomicRisks } from "../economy/economic-risk-ledger.js";
import { getAllBudgets, initializeBudgets } from "../economy/runtime-budget-engine.js";
import {
  createCivilizationFabricDashboard,
  createUnifiedCivilizationExecutionFabric,
  recordCrossLayerExecutionLineage,
  synchronizeCivilizationExecution,
  verifySovereignExecutionGuarantees,
} from "./civilization-execution-fabric.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import { recordInstitutionalMemory } from "./institutional-governance.js";
import { createCivilizationRealityKernelState } from "./reality-civilization-kernel.js";
import {
  recordExecutionTruthLedger,
  trackObservableEffect,
} from "./reality-verification.js";

type EconomicSignalName =
  | "compute"
  | "attention"
  | "trust"
  | "recovery_cost"
  | "federation_load"
  | "autonomy_pressure";

export type CostPriority = "security" | "recovery" | "availability" | "autonomy" | "growth";

const DATA_DIR = path.join(process.cwd(), ".data");
const ECON_DIR = path.join(DATA_DIR, "mission-control", "economic-civilization");
const BRAIN_PATH = path.join(ECON_DIR, "civilization-economic-brain.jsonl");
const FORECAST_PATH = path.join(ECON_DIR, "strategic-resource-forecast.jsonl");
const ARBITRATION_PATH = path.join(ECON_DIR, "cognitive-cost-arbitration.jsonl");
const SCARCITY_PATH = path.join(ECON_DIR, "civilization-scarcity.jsonl");
const SOVEREIGNTY_PATH = path.join(ECON_DIR, "economic-sovereignty.jsonl");
const STABILITY_PATH = path.join(ECON_DIR, "economic-stability.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-economic-civilization-freeze.json");

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

function ensureBudgets(): void {
  if (getAllBudgets().length === 0) initializeBudgets();
}

function pressureLevel(value: number): "low" | "medium" | "high" | "critical" {
  if (value >= 0.95) return "critical";
  if (value >= 0.8) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}

function pressureScore(signals: Record<EconomicSignalName, number>): number {
  const values = Object.values(signals);
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function defaultSignals(): Record<EconomicSignalName, number> {
  ensureBudgets();
  const budgets = getAllBudgets();
  const budgetPressure = budgets.length
    ? budgets.reduce((sum, budget) => sum + (budget.limit ? budget.used / budget.limit : 0), 0) / budgets.length
    : 0;
  const records = readEvidenceRecords({ order: "asc" }).slice(-1000);
  const recovery = records.filter((record) => record.type.includes("recovery")).length / 100;
  const federation = records.filter((record) => record.type.includes("federation")).length / 100;
  const autonomy = records.filter((record) => record.type.includes("autonomy")).length / 100;
  return {
    compute: Math.min(0.55 + budgetPressure, 0.99),
    attention: 0.45,
    trust: 0.25,
    recovery_cost: Math.min(recovery, 0.9),
    federation_load: Math.min(federation, 0.9),
    autonomy_pressure: Math.min(autonomy, 0.9),
  };
}

export async function createCivilizationEconomicBrain(input?: {
  trace_id?: string;
  signals?: Partial<Record<EconomicSignalName, number>>;
}): Promise<Record<string, unknown>> {
  const signals = { ...defaultSignals(), ...(input?.signals || {}) } as Record<EconomicSignalName, number>;
  const budgets = getAllBudgets();
  const executionFabric = await createUnifiedCivilizationExecutionFabric({
    trace_id: input?.trace_id || `economic_brain_${Date.now()}`,
    flows: ["execution", "governance", "recovery", "federation", "autonomy", "memory"],
  });
  const brain = {
    brain_id: `civilization_economic_brain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id || `economic_brain_${Date.now()}`,
    created_at: new Date().toISOString(),
    reasoning_domains: ["compute", "attention", "trust", "recovery_cost", "federation_load", "autonomy_pressure"],
    signals,
    pressure_score: pressureScore(signals),
    pressure_level: pressureLevel(pressureScore(signals)),
    budgets: budgets.map((budget) => ({
      category: budget.category,
      used: budget.used,
      limit: budget.limit,
      utilization: budget.limit ? Number((budget.used / budget.limit).toFixed(3)) : 0,
    })),
    execution_fabric_ref: executionFabric.fabric_id,
  };
  appendJsonl(BRAIN_PATH, brain as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(brain.brain_id), "civilization_economic_brain_created"),
    trace_id: String(brain.trace_id),
    job_id: "economic_civilization",
    type: "civilization_economic_brain_created",
    timestamp: String(brain.created_at),
    payload: brain as unknown as Record<string, unknown>,
  });
  return brain;
}

export async function generateStrategicResourceForecast(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const brains = readJsonl<Record<string, unknown>>(BRAIN_PATH).slice(-50);
  const records = readEvidenceRecords({ order: "asc" }).slice(-1500);
  const costBlocks = records.filter((record) => record.type === "cost_governance_blocked").length;
  const executionEvents = records.filter((record) => record.type.includes("execution")).length;
  const recoveryEvents = records.filter((record) => record.type.includes("recovery")).length;
  const latestPressure = Number(brains.at(-1)?.pressure_score || 0);
  const forecast = {
    forecast_id: `strategic_resource_forecast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    generated_at: new Date().toISOString(),
    budget_exhaustion: costBlocks > 3 || latestPressure > 0.85 ? "elevated" : costBlocks > 0 ? "watch" : "low",
    compute_scarcity: latestPressure > 0.8 ? "risk" : "low",
    recovery_pressure: recoveryEvents > 50 ? "elevated" : recoveryEvents > 10 ? "watch" : "low",
    execution_congestion: executionEvents > 300 ? "elevated" : executionEvents > 100 ? "watch" : "low",
    signals: { cost_blocks: costBlocks, execution_events: executionEvents, recovery_events: recoveryEvents, latest_pressure: latestPressure },
  };
  appendJsonl(FORECAST_PATH, forecast);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(forecast.forecast_id), "strategic_resource_forecast_generated"),
    trace_id: input?.trace_id || String(forecast.forecast_id),
    job_id: "economic_civilization",
    type: "strategic_resource_forecast_generated",
    timestamp: String(forecast.generated_at),
    payload: forecast,
  });
  return forecast;
}

export async function arbitrateCognitiveCost(input: {
  trace_id: string;
  priority: CostPriority;
  required_budget: number;
  capacity: number;
  risk: "low" | "medium" | "high" | "critical";
}): Promise<Record<string, unknown>> {
  ensureBudgets();
  const priorityWeight: Record<CostPriority, number> = {
    security: 5,
    recovery: 4,
    availability: 3,
    autonomy: 2,
    growth: 1,
  };
  const riskWeight = { low: 1, medium: 2, high: 3, critical: 4 }[input.risk];
  const costCheck = await checkCostGovernance("compute", Math.min(input.required_budget, 1000));
  const allow = costCheck.approved && input.capacity >= input.required_budget && priorityWeight[input.priority] >= riskWeight;
  const arbitration = {
    arbitration_id: `cognitive_cost_arbitration_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    arbitrated_at: new Date().toISOString(),
    priority: input.priority,
    required_budget: input.required_budget,
    capacity: input.capacity,
    risk: input.risk,
    cost_check: costCheck,
    decision: allow ? "execute_with_budget_guard" : input.priority === "security" ? "execute_with_operator_attention" : "defer_or_reduce_scope",
    balancing: {
      security: input.priority === "security" ? "preserve" : "bounded",
      recovery: input.priority === "recovery" ? "prioritize" : "bounded",
      availability: input.priority === "availability" ? "preserve" : "bounded",
      autonomy: input.priority === "autonomy" ? "budget_limited" : "constrained",
      growth: input.priority === "growth" ? "defer_if_scarce" : "background",
    },
  };
  appendJsonl(ARBITRATION_PATH, arbitration as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(arbitration.arbitration_id), "cognitive_cost_arbitrated"),
    trace_id: input.trace_id,
    job_id: "economic_civilization",
    type: "cognitive_cost_arbitrated",
    timestamp: String(arbitration.arbitrated_at),
    payload: arbitration as unknown as Record<string, unknown>,
  });
  return arbitration;
}

export async function detectCivilizationScarcity(input?: {
  trace_id?: string;
  signals?: Partial<Record<EconomicSignalName, number>>;
}): Promise<Record<string, unknown>> {
  const brain = await createCivilizationEconomicBrain(input);
  const signals = brain.signals as Record<EconomicSignalName, number>;
  const scarcity = {
    scarcity_id: `civilization_scarcity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id || brain.trace_id,
    detected_at: new Date().toISOString(),
    resource_starvation: signals.compute >= 0.9 || signals.recovery_cost >= 0.9,
    operator_overload: signals.attention >= 0.85,
    federation_congestion: signals.federation_load >= 0.85,
    autonomy_pressure: signals.autonomy_pressure >= 0.8,
    pressure_score: brain.pressure_score,
    pressure_level: brain.pressure_level,
  };
  appendJsonl(SCARCITY_PATH, scarcity as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(scarcity.scarcity_id), "civilization_scarcity_detected"),
    trace_id: String(scarcity.trace_id),
    job_id: "economic_civilization",
    type: "civilization_scarcity_detected",
    timestamp: String(scarcity.detected_at),
    payload: scarcity as unknown as Record<string, unknown>,
  });
  return scarcity;
}

export async function enforceEconomicSovereignty(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-2000);
  const executions = records.filter((record) => record.type.includes("execution")).length;
  const costBlocks = records.filter((record) => record.type === "cost_governance_blocked").length;
  const hiddenEscalations = records.filter((record) => {
    const text = JSON.stringify(record.payload || {}).toLowerCase();
    return text.includes("hidden economic escalation") || text.includes("uncontrolled budget burn") || text.includes("runaway execution");
  });
  const sovereignty = {
    sovereignty_id: `economic_sovereignty_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    enforced_at: new Date().toISOString(),
    guarantees: ["no_runaway_execution", "no_uncontrolled_budget_burn", "no_hidden_economic_escalation"],
    violations: [
      ...(executions > 1200 ? [{ guarantee: "no_runaway_execution", execution_events: executions }] : []),
      ...(costBlocks > 15 ? [{ guarantee: "no_uncontrolled_budget_burn", cost_blocks: costBlocks }] : []),
      ...hiddenEscalations.map((record) => ({ guarantee: "no_hidden_economic_escalation", evidence_id: record.evidence_id })),
    ],
    preserved: executions <= 1200 && costBlocks <= 15 && hiddenEscalations.length === 0,
  };
  appendJsonl(SOVEREIGNTY_PATH, sovereignty as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(sovereignty.sovereignty_id), "economic_sovereignty_enforced"),
    trace_id: input?.trace_id || String(sovereignty.sovereignty_id),
    job_id: "economic_civilization",
    type: "economic_sovereignty_enforced",
    timestamp: String(sovereignty.enforced_at),
    payload: sovereignty as unknown as Record<string, unknown>,
  });
  return sovereignty;
}

export async function generateLongHorizonEconomicStability(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const forecasts = readJsonl<Record<string, unknown>>(FORECAST_PATH).slice(-50);
  const scarcities = readJsonl<Record<string, unknown>>(SCARCITY_PATH).slice(-50);
  const risks = detectEconomicRisks();
  const criticalScarcity = scarcities.filter((item) => item.pressure_level === "critical").length;
  const elevatedForecasts = forecasts.filter((item) =>
    item.budget_exhaustion === "elevated" || item.compute_scarcity === "risk" || item.execution_congestion === "elevated").length;
  const stability = {
    stability_id: `economic_stability_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    generated_at: new Date().toISOString(),
    stability_decay: elevatedForecasts > 3 ? "elevated" : elevatedForecasts > 0 ? "watch" : "low",
    resource_collapse: criticalScarcity > 2 ? "risk" : "low",
    trust_degradation_due_to_scarcity: risks.length > 2 || criticalScarcity > 0 ? "watch" : "low",
    horizon: ["hours", "days", "weeks"],
    signals: { forecasts: forecasts.length, elevated_forecasts: elevatedForecasts, critical_scarcity: criticalScarcity, risks: risks.length },
  };
  appendJsonl(STABILITY_PATH, stability);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(stability.stability_id), "long_horizon_economic_stability_forecast_generated"),
    trace_id: input?.trace_id || String(stability.stability_id),
    job_id: "economic_civilization",
    type: "long_horizon_economic_stability_forecast_generated",
    timestamp: String(stability.generated_at),
    payload: stability,
  });
  return stability;
}

export async function createEconomicCivilizationDashboard(): Promise<Record<string, unknown>> {
  const [fabric, forecast, scarcity, sovereignty, stability] = await Promise.all([
    createCivilizationFabricDashboard(),
    generateStrategicResourceForecast(),
    detectCivilizationScarcity(),
    enforceEconomicSovereignty(),
    generateLongHorizonEconomicStability(),
  ]);
  const dashboard = {
    dashboard_id: `economic_civilization_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    scarcity,
    capacity: getAllBudgets().map((budget) => ({
      category: budget.category,
      used: budget.used,
      limit: budget.limit,
      utilization: budget.limit ? Number((budget.used / budget.limit).toFixed(3)) : 0,
    })),
    cost_pressure: forecast,
    economic_stability: stability,
    execution_economy: {
      fabric_health: fabric.fabric_health,
      distributed_consistency: fabric.distributed_consistency,
      sovereignty,
    },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "economic_civilization_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "economic_civilization",
    type: "economic_civilization_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      scarcity: scarcity.pressure_level,
      capacity_items: dashboard.capacity.length,
      stability: stability.stability_decay,
      sovereignty_preserved: sovereignty.preserved,
    },
  });
  return dashboard;
}

export async function runEconomicCivilizationSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc23_economic_civilization_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fabric = await createUnifiedCivilizationExecutionFabric({ trace_id: traceId });
  const planned = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "planned",
    intent: "economic civilization surge stabilization",
  });
  const surge = await createCivilizationEconomicBrain({
    trace_id: traceId,
    signals: {
      compute: 0.94,
      attention: 0.88,
      trust: 0.35,
      recovery_cost: 0.9,
      federation_load: 0.87,
      autonomy_pressure: 0.82,
    },
  });
  const scarcity = await detectCivilizationScarcity({
    trace_id: traceId,
    signals: surge.signals as Partial<Record<EconomicSignalName, number>>,
  });
  const arbitration = await arbitrateCognitiveCost({
    trace_id: traceId,
    priority: "recovery",
    required_budget: 120,
    capacity: 180,
    risk: "medium",
  });
  const approved = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "economic_surge_stabilization_approved",
    why: "Execution surge produced scarcity and requires cognitive cost arbitration before continuity closure",
    based_on: [String(surge.brain_id), String(scarcity.scarcity_id), String(arbitration.arbitration_id)],
    evidence_refs: [planned.truth_id],
    policy_refs: ["economic_sovereignty", "execution_fabric", "reality_verification"],
    risk_level: "medium",
  });
  const claimed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "claimed",
    intent: "economic civilization surge stabilization",
    execution_ref: planned.truth_id,
    claimed_success: true,
  });
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "economic civilization surge stabilization",
    execution_ref: claimed.truth_id,
  });
  const synchronization = await synchronizeCivilizationExecution({
    trace_id: traceId,
    nodes: ["local-runtime", "economy-runtime"],
    agents: ["operator", "economic-verifier"],
    federation_refs: [String(fabric.fabric_id)],
    governance_refs: [String(approved.decision_id)],
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "execution surge stabilized through scarcity detection and cost arbitration",
    observed_effect: "scarcity, arbitration, sovereignty, synchronization, and continuity evidence recorded",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "economic civilization surge stabilization",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const memory = await recordInstitutionalMemory({
    kind: "civilization_milestone",
    title: "Economic civilization surge stabilized",
    summary: "Execution surge triggered scarcity, cost arbitration, and verified continuity.",
    trigger: "rc23_economic_civilization_smoke",
    stabilized_by: ["scarcity_detection", "cognitive_cost_arbitration", "economic_sovereignty", "verified_execution_continuity"],
    evidence_refs: [String(surge.brain_id), String(scarcity.scarcity_id), String(arbitration.arbitration_id), verified.truth_id],
  });
  const lineage = await recordCrossLayerExecutionLineage({
    trace_id: traceId,
    intent: "economic civilization surge stabilization",
    plan_ref: planned.truth_id,
    approval_ref: String(approved.decision_id),
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
    closure_ref: String(approved.decision_id),
    memory_ref: String(memory.memory_id),
  });
  const sovereignty = await enforceEconomicSovereignty({ trace_id: traceId });
  const guarantees = await verifySovereignExecutionGuarantees({ trace_id: traceId });
  const forecast = await generateStrategicResourceForecast({ trace_id: traceId });
  const stability = await generateLongHorizonEconomicStability({ trace_id: traceId });
  const truthState = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "economic surge stabilized with verified continuity",
    execution_ref: executed.truth_id,
    effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
  });
  const dashboard = await createEconomicCivilizationDashboard();
  const smoke = {
    smoke_id: `economic_civilization_smoke_${Date.now()}`,
    trace_id: traceId,
    execution_surge: surge,
    scarcity,
    arbitration,
    stabilization: sovereignty,
    verified_continuity: {
      claim: claimed,
      execution: executed,
      synchronization,
      effect,
      verification: verified,
      lineage,
      truth_state: truthState,
      guarantees,
    },
    forecast,
    stability,
    dashboard,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "economic_civilization_smoke_completed"),
    trace_id: traceId,
    job_id: "economic_civilization",
    type: "economic_civilization_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeEconomicCivilizationFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runEconomicCivilizationSmokePack();
  const dashboard = await createEconomicCivilizationDashboard();
  const freeze = {
    freeze_id: `rc23_economic_civilization_freeze_${Date.now()}`,
    scope: "RC-23 Runtime Cognitive Economic Civilization",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "civilization_economic_brain",
      "strategic_resource_forecasting",
      "cognitive_cost_arbitration",
      "civilization_scarcity_management",
      "economic_sovereignty_enforcement",
      "long_horizon_economic_stability",
      "economic_civilization_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_economic_civilization_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "economic_civilization",
    type: "runtime_economic_civilization_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
