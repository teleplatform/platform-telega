import fs from "node:fs";
import path from "node:path";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { checkResourceAvailability } from "../planning/planning-resource-governor.js";
import { createStrategicPlan } from "../planning/strategic-planning-engine.js";
import { getExecutionTrustLevel } from "./autonomous-governance.js";
import { applyRuntimeSelfStabilization, arbitrateCognitivePriority, type CognitiveSignal } from "./cognitive-coordination.js";
import { calculateRuntimeStabilityScore } from "./coordination-runtime.js";
import { createCognitiveMemoryDashboard } from "./cognitive-memory.js";
import { buildFederationStabilitySurface } from "./federation-operations.js";
import { createRuntimeRecoveryDashboard } from "./recovery-operations.js";
import { createSecurityMissionControlDashboard } from "./security-operations.js";
import {
  runStrategicGovernanceEngine,
} from "./strategic-governance.js";
import { recordGovernanceDecision } from "./governance-operations.js";

export type CivilizationObjective =
  | "survival"
  | "stability"
  | "trust"
  | "continuity"
  | "resilience"
  | "governance_integrity"
  | "federation_health";
export type EpochHorizon = "current" | "next" | "future" | "recovery" | "expansion";
export type CivilizationRiskDomain = "security" | "autonomy" | "economy" | "federation" | "recovery" | "growth";
export type StrategicResource = "compute" | "budget" | "attention" | "federation_capacity" | "recovery_capacity";
export type CivilizationPolicy = "survival-first" | "trust-first" | "availability-first" | "security-first" | "controlled-growth";

export interface CivilizationObjectiveState {
  objective: CivilizationObjective;
  state: "healthy" | "watch" | "at_risk" | "critical";
  priority: number;
  reason: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const CIV_DIR = path.join(DATA_DIR, "mission-control", "civilization-orchestration");
const OBJECTIVES_PATH = path.join(CIV_DIR, "objectives.json");
const EPOCH_PLANS_PATH = path.join(CIV_DIR, "epoch-plans.jsonl");
const RISK_BALANCE_PATH = path.join(CIV_DIR, "risk-balance.jsonl");
const RESOURCE_ARBITRATION_PATH = path.join(CIV_DIR, "resource-arbitration.jsonl");
const POLICIES_PATH = path.join(CIV_DIR, "policies.jsonl");
const CONTINUITY_PATH = path.join(CIV_DIR, "continuity.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-civilization-orchestration-freeze.json");

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

function stateFromRisk(risk: number): CivilizationObjectiveState["state"] {
  return risk >= 80 ? "critical" : risk >= 55 ? "at_risk" : risk >= 30 ? "watch" : "healthy";
}

function budgetPressure(): number {
  return getAllBudgets().reduce((max, budget) => Math.max(max, budget.limit > 0 ? budget.used / budget.limit : 0), 0);
}

export async function generateCivilizationObjectives(): Promise<CivilizationObjectiveState[]> {
  const [stability, governance, federation, security, memory] = await Promise.all([
    calculateRuntimeStabilityScore(),
    runStrategicGovernanceEngine(),
    buildFederationStabilitySurface(),
    createSecurityMissionControlDashboard(),
    createCognitiveMemoryDashboard(),
  ]);
  const strategicRisk = String(governance.strategic_risk);
  const federationNodes = Array.isArray(federation.nodes) ? federation.nodes as Array<{ health?: string; trust?: string }> : [];
  const compromisedFederation = federationNodes.filter((node) => node.health === "isolated" || node.trust === "revoked").length;
  const securityPatterns = Array.isArray(memory.patterns) ? (memory.patterns as Array<{ kind: string }>).filter((pattern) => pattern.kind === "security_regression").length : 0;
  const trustLevel = getExecutionTrustLevel();
  const objectives: CivilizationObjectiveState[] = [
    { objective: "survival", state: stability.state === "unstable" ? "critical" : stability.state === "critical" ? "at_risk" : "healthy", priority: 100, reason: `runtime_stability=${stability.state}` },
    { objective: "stability", state: stateFromRisk(100 - stability.score), priority: 90, reason: `stability_score=${stability.score}` },
    { objective: "trust", state: trustLevel === "trusted_autonomous" || strategicRisk === "high" || strategicRisk === "critical" ? "watch" : "healthy", priority: 85, reason: `trust_level=${trustLevel};strategic_risk=${strategicRisk}` },
    { objective: "continuity", state: Array.isArray(memory.anchors) && memory.anchors.length ? "healthy" : "watch", priority: 80, reason: `memory_anchors=${Array.isArray(memory.anchors) ? memory.anchors.length : 0}` },
    { objective: "resilience", state: stability.reasons.length ? "watch" : "healthy", priority: 75, reason: `stability_reasons=${stability.reasons.length}` },
    { objective: "governance_integrity", state: securityPatterns ? "watch" : "healthy", priority: 95, reason: `security_patterns=${securityPatterns};security_dashboard=${security.dashboard_id}` },
    { objective: "federation_health", state: compromisedFederation ? "at_risk" : "healthy", priority: 70, reason: `compromised_nodes=${compromisedFederation}` },
  ];
  writeJson(OBJECTIVES_PATH, objectives);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`civilization_objectives_${Date.now()}`, "civilization_objectives_generated"),
    trace_id: "civilization_objectives",
    job_id: "civilization_orchestration",
    type: "civilization_objectives_generated",
    timestamp: new Date().toISOString(),
    payload: { objectives },
  });
  return objectives;
}

export async function createMultiEpochRuntimePlan(): Promise<Record<string, unknown>> {
  const objectives = await generateCivilizationObjectives();
  const strategicPlan = await createStrategicPlan(
    "RC15 Civilization Orchestration Runtime Plan",
    "Coordinate runtime continuity across current, next, future, recovery, and expansion horizons.",
    ["current stabilization", "next governance alignment", "future resilience", "recovery readiness", "controlled expansion"],
    "critical",
  );
  const plan = {
    epoch_plan_id: `epoch_plan_${Date.now()}`,
    generated_at: new Date().toISOString(),
    strategic_plan_id: strategicPlan.plan_id,
    horizons: (["current", "next", "future", "recovery", "expansion"] as EpochHorizon[]).map((horizon) => ({
      horizon,
      objectives: objectives.filter((objective) => horizon === "expansion" ? objective.state === "healthy" : true).map((objective) => objective.objective),
      stance: horizon === "current" ? "stabilize" : horizon === "next" ? "govern" : horizon === "future" ? "forecast" : horizon === "recovery" ? "preserve_continuity" : "controlled_growth",
    })),
  };
  appendJsonl(EPOCH_PLANS_PATH, plan as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(plan.epoch_plan_id), "multi_epoch_runtime_plan_created"),
    trace_id: String(plan.epoch_plan_id),
    job_id: "civilization_orchestration",
    type: "multi_epoch_runtime_plan_created",
    timestamp: plan.generated_at,
    payload: plan as unknown as Record<string, unknown>,
  });
  return plan;
}

export async function balanceCivilizationRisk(): Promise<Record<string, unknown>> {
  const [stability, federation, governance] = await Promise.all([
    calculateRuntimeStabilityScore(),
    buildFederationStabilitySurface(),
    runStrategicGovernanceEngine(),
  ]);
  const trustLevel = getExecutionTrustLevel();
  const federationNodes = Array.isArray(federation.nodes) ? federation.nodes as Array<{ alive?: boolean; health?: string; load?: number }> : [];
  const overloaded = federationNodes.filter((node) => Number(node.load || 0) >= 0.85 || node.health === "critical").length;
  const risks: Record<CivilizationRiskDomain, number> = {
    security: String(governance.strategic_risk) === "critical" ? 90 : String(governance.strategic_risk) === "high" ? 65 : 30,
    autonomy: trustLevel === "trusted_autonomous" ? 65 : trustLevel === "semi_autonomous" ? 40 : 20,
    economy: Math.round(budgetPressure() * 100),
    federation: Math.min(100, overloaded * 30),
    recovery: stability.state === "unstable" ? 90 : stability.state === "critical" ? 70 : stability.state === "degraded" ? 45 : 15,
    growth: stability.state === "stable" ? 25 : 60,
  };
  const highest = Object.entries(risks).sort((a, b) => b[1] - a[1])[0] as [CivilizationRiskDomain, number];
  const result = {
    balance_id: `civilization_risk_${Date.now()}`,
    generated_at: new Date().toISOString(),
    risks,
    dominant_risk: highest[0],
    recommended_policy: highest[0] === "security" ? "security-first" : highest[0] === "recovery" ? "survival-first" : highest[0] === "autonomy" ? "trust-first" : highest[0] === "growth" ? "controlled-growth" : "availability-first",
  };
  appendJsonl(RISK_BALANCE_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.balance_id, "civilization_risk_balanced"),
    trace_id: result.balance_id,
    job_id: "civilization_orchestration",
    type: "civilization_risk_balanced",
    timestamp: result.generated_at,
    payload: result,
  });
  return result;
}

export async function arbitrateStrategicResources(): Promise<Record<string, unknown>> {
  const resource = await checkResourceAvailability({
    compute: 30,
    memory: 30,
    operator_attention: 2,
    federation_pressure: 25,
    economy: Math.round(budgetPressure() * 100),
  });
  const stability = await calculateRuntimeStabilityScore();
  const allocations: Record<StrategicResource, { priority: number; decision: "grant" | "limit" | "defer" }> = {
    compute: { priority: stability.state === "stable" ? 60 : 85, decision: resource.blocked ? "limit" : "grant" },
    budget: { priority: budgetPressure() >= 0.85 ? 90 : 50, decision: budgetPressure() >= 0.95 ? "defer" : "grant" },
    attention: { priority: resource.checks.some((check) => check.resource === "operator_attention" && check.pressure) ? 95 : 55, decision: "grant" },
    federation_capacity: { priority: resource.checks.some((check) => check.resource === "federation_pressure" && check.pressure) ? 80 : 45, decision: resource.blocked ? "limit" : "grant" },
    recovery_capacity: { priority: stability.state === "critical" || stability.state === "unstable" ? 100 : 70, decision: "grant" },
  };
  const result = {
    arbitration_id: `resource_arbitration_${Date.now()}`,
    generated_at: new Date().toISOString(),
    resource,
    allocations,
  };
  appendJsonl(RESOURCE_ARBITRATION_PATH, result as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.arbitration_id, "strategic_resource_arbitrated"),
    trace_id: result.arbitration_id,
    job_id: "civilization_orchestration",
    type: "strategic_resource_arbitrated",
    timestamp: result.generated_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function selectRuntimeCivilizationPolicy(): Promise<Record<string, unknown>> {
  const risk = await balanceCivilizationRisk();
  const objectives = await generateCivilizationObjectives();
  const criticalObjective = objectives.find((objective) => objective.state === "critical" || objective.objective === "survival" && objective.state === "at_risk");
  const policy = (criticalObjective ? "survival-first" : risk.recommended_policy) as CivilizationPolicy;
  const result = {
    policy_id: `civilization_policy_${Date.now()}`,
    selected_at: new Date().toISOString(),
    policy,
    reason: criticalObjective ? `critical_objective=${criticalObjective.objective}` : `dominant_risk=${risk.dominant_risk}`,
    meta_policies: ["survival-first", "trust-first", "availability-first", "security-first", "controlled-growth"] as CivilizationPolicy[],
  };
  appendJsonl(POLICIES_PATH, result);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.policy_id, "runtime_civilization_policy_selected"),
    trace_id: result.policy_id,
    job_id: "civilization_orchestration",
    type: "runtime_civilization_policy_selected",
    timestamp: result.selected_at,
    payload: result,
  });
  return result;
}

export async function coordinateCivilizationContinuity(): Promise<Record<string, unknown>> {
  const [memory, recovery, governance, federation, security, epochPlan, policy] = await Promise.all([
    createCognitiveMemoryDashboard(),
    createRuntimeRecoveryDashboard(),
    runStrategicGovernanceEngine(),
    buildFederationStabilitySurface(),
    createSecurityMissionControlDashboard(),
    createMultiEpochRuntimePlan(),
    selectRuntimeCivilizationPolicy(),
  ]);
  const continuity = {
    continuity_id: `civilization_continuity_${Date.now()}`,
    coordinated_at: new Date().toISOString(),
    memory: { patterns: Array.isArray(memory.patterns) ? memory.patterns.length : 0, anchors: Array.isArray(memory.anchors) ? memory.anchors.length : 0 },
    recovery: { health: recovery.health, dashboard_id: recovery.dashboard_id },
    governance: { strategic_risk: governance.strategic_risk, analysis_id: governance.analysis_id },
    federation: { nodes: Array.isArray(federation.nodes) ? federation.nodes.length : 0 },
    security: { dashboard_id: security.dashboard_id },
    planning: { epoch_plan_id: epochPlan.epoch_plan_id },
    autonomy: { trust_level: getExecutionTrustLevel() },
    policy,
  };
  appendJsonl(CONTINUITY_PATH, continuity as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(continuity.continuity_id, "civilization_continuity_coordinated"),
    trace_id: continuity.continuity_id,
    job_id: "civilization_orchestration",
    type: "civilization_continuity_coordinated",
    timestamp: continuity.coordinated_at,
    payload: continuity as unknown as Record<string, unknown>,
  });
  return continuity;
}

export async function createCivilizationOrchestrationDashboard(): Promise<Record<string, unknown>> {
  const [objectives, epochPlan, riskBalance, resources, continuity, stability] = await Promise.all([
    generateCivilizationObjectives(),
    createMultiEpochRuntimePlan(),
    balanceCivilizationRisk(),
    arbitrateStrategicResources(),
    coordinateCivilizationContinuity(),
    calculateRuntimeStabilityScore(),
  ]);
  const dashboard = {
    dashboard_id: `civilization_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    objectives,
    epoch_plans: [epochPlan, ...readJsonl<Record<string, unknown>>(EPOCH_PLANS_PATH).slice(-4)],
    risk_balance: riskBalance,
    resource_arbitration: resources,
    continuity,
    strategic_stability: {
      runtime: stability,
      governance_risk: (continuity.governance as Record<string, unknown>).strategic_risk,
    },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "civilization_orchestration_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "civilization_orchestration",
    type: "civilization_orchestration_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: { objectives: objectives.length, risk: riskBalance.dominant_risk, stability: stability.state },
  });
  return dashboard;
}

export async function runCivilizationOrchestrationSmokePack(): Promise<Record<string, unknown>> {
  const riskSignals: CognitiveSignal[] = [
    { layer: "security", intent: "protect", priority: "security", reason: "civilization risk conflict security pressure", risk: "high", evidence_refs: ["civilization_security"] },
    { layer: "execution", intent: "optimize", priority: "optimization", reason: "growth wants expansion", risk: "medium", evidence_refs: ["civilization_growth"] },
    { layer: "recovery", intent: "recover", priority: "recovery", reason: "continuity requires recovery capacity", risk: "high", evidence_refs: ["civilization_recovery"] },
  ];
  const arbitration = await arbitrateCognitivePriority(riskSignals);
  const risk = await balanceCivilizationRisk();
  const resources = await arbitrateStrategicResources();
  const continuity = await coordinateCivilizationContinuity();
  const stabilization = await applyRuntimeSelfStabilization("rc15 civilization orchestration smoke");
  const closure = await recordGovernanceDecision({
    trace_id: "rc15_civilization_smoke",
    decision: "civilization_orchestration_closed",
    why: "Risk conflict arbitrated, resources allocated, continuity coordinated, stabilization applied",
    based_on: [String((arbitration.selected as CognitiveSignal).priority), String(risk.dominant_risk), String(continuity.continuity_id)],
    evidence_refs: [String(risk.balance_id), String(resources.arbitration_id), String(continuity.continuity_id)],
    policy_refs: ["civilization_orchestration", "runtime_civilization_policy"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `civilization_smoke_${Date.now()}`,
    risk_conflict: riskSignals,
    arbitration,
    risk,
    resources,
    continuity,
    stabilization,
    closure,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "civilization_orchestration_smoke_completed"),
    trace_id: "rc15_civilization_smoke",
    job_id: "civilization_orchestration",
    type: "civilization_orchestration_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeCivilizationOrchestrationFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runCivilizationOrchestrationSmokePack();
  const dashboard = await createCivilizationOrchestrationDashboard();
  const freeze = {
    freeze_id: `rc15_civilization_orchestration_freeze_${Date.now()}`,
    scope: "RC-15 Runtime Civilization Orchestration",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "civilization_objective_engine",
      "multi_epoch_runtime_planning",
      "civilization_risk_balancer",
      "strategic_resource_arbitration",
      "runtime_civilization_policies",
      "civilization_continuity_coordination",
      "civilization_orchestration_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_civilization_orchestration_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "civilization_orchestration",
    type: "runtime_civilization_orchestration_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
