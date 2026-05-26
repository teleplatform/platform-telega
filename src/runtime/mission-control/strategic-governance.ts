import fs from "node:fs";
import path from "node:path";
import { getConstitutionPrecedence, getConstitutionState } from "../constitution/runtime-constitution.js";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllDoctrines } from "../knowledge/runtime-doctrine-registry.js";
import { readAllExecutionRequests } from "../policy/execution-approval-queue.js";
import { getExecutionTrustLevel } from "./autonomous-governance.js";
import { applyRuntimeSelfStabilization, arbitrateCognitivePriority, type CognitiveSignal } from "./cognitive-coordination.js";
import { calculateRuntimeStabilityScore } from "./coordination-runtime.js";
import {
  createCognitiveMemoryDashboard,
  generateExperienceAwareCoordination,
  generateLongTermStabilityForecast,
  recognizeCognitivePatterns,
} from "./cognitive-memory.js";
import { forecastFederationRisk } from "./intelligence-operations.js";
import { recordGovernanceDecision } from "./governance-operations.js";

export type StrategicGovernanceDomain = "stability" | "trust" | "economy" | "security" | "federation" | "autonomy";
export type GovernanceTradeoffKind = "security_vs_availability" | "economy_vs_recovery" | "autonomy_vs_safety" | "federation_vs_isolation";
export type GovernanceHorizon = "days" | "weeks" | "epochs";
export type StrategicDriftKind = "policy_drift" | "trust_degradation" | "autonomy_escalation" | "federation_fracture";

export interface GovernanceTradeoff {
  tradeoff_id: string;
  kind: GovernanceTradeoffKind;
  preferred: StrategicGovernanceDomain;
  secondary: StrategicGovernanceDomain;
  risk_level: "low" | "medium" | "high" | "critical";
  rationale: string;
  evidence_refs: string[];
  recommended_action: "approve" | "defer" | "freeze" | "escalate" | "isolate" | "stabilize";
  analyzed_at: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STRATEGIC_DIR = path.join(DATA_DIR, "mission-control", "strategic-governance");
const TRADEOFFS_PATH = path.join(STRATEGIC_DIR, "tradeoffs.jsonl");
const PLANS_PATH = path.join(STRATEGIC_DIR, "governance-plans.jsonl");
const DRIFTS_PATH = path.join(STRATEGIC_DIR, "strategic-drifts.jsonl");
const HEURISTICS_PATH = path.join(STRATEGIC_DIR, "governance-heuristics.json");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-strategic-governance-freeze.json");

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

function maxBudgetPressure(): number {
  return getAllBudgets().reduce((max, budget) => Math.max(max, budget.limit > 0 ? budget.used / budget.limit : 0), 0);
}

function pendingApprovalPressure(): number {
  const approvals = readAllExecutionRequests();
  if (!approvals.length) return 0;
  return approvals.filter((approval) => approval.status === "pending").length / approvals.length;
}

function riskFromScore(score: number): GovernanceTradeoff["risk_level"] {
  return score >= 80 ? "critical" : score >= 55 ? "high" : score >= 30 ? "medium" : "low";
}

export async function runStrategicGovernanceEngine(): Promise<Record<string, unknown>> {
  const [stability, memory, federationRisk, experience] = await Promise.all([
    calculateRuntimeStabilityScore(),
    createCognitiveMemoryDashboard(),
    forecastFederationRisk(),
    generateExperienceAwareCoordination(),
  ]);
  const constitution = getConstitutionState();
  const trustLevel = getExecutionTrustLevel();
  const budgetPressure = maxBudgetPressure();
  const approvalPressure = pendingApprovalPressure();
  const domains = {
    stability: { state: stability.state, score: stability.score, risk: 100 - stability.score },
    trust: { state: trustLevel, risk: trustLevel === "trusted_autonomous" ? 35 : trustLevel === "semi_autonomous" ? 20 : 10 },
    economy: { pressure: Number(budgetPressure.toFixed(2)), risk: Math.round(budgetPressure * 100) },
    security: { patterns: (memory.patterns as Array<{ kind: string }>).filter((pattern) => pattern.kind === "security_regression").length, risk: (memory.patterns as Array<{ kind: string }>).some((pattern) => pattern.kind === "security_regression") ? 45 : 10 },
    federation: { risks: (federationRisk.risks as unknown[]).length, risk: (federationRisk.risks as unknown[]).length * 25 },
    autonomy: { trust_level: trustLevel, approval_pressure: Number(approvalPressure.toFixed(2)), risk: Math.round(approvalPressure * 100) },
  };
  const strategicRisk = Math.max(...Object.values(domains).map((domain) => Number(domain.risk || 0)), constitution.emergency_freeze_active ? 100 : 0);
  const analysis = {
    analysis_id: `strategic_governance_${Date.now()}`,
    generated_at: new Date().toISOString(),
    domains,
    strategic_risk: riskFromScore(strategicRisk),
    constitution: {
      epoch: constitution.epoch,
      emergency_freeze_active: constitution.emergency_freeze_active,
      violations: constitution.violations.length,
    },
    memory_summary: {
      patterns: Array.isArray(memory.patterns) ? memory.patterns.length : 0,
      lessons: Array.isArray(memory.lessons) ? memory.lessons.length : 0,
      anchors: Array.isArray(memory.anchors) ? memory.anchors.length : 0,
    },
    experience,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(analysis.analysis_id, "strategic_governance_analysis_generated"),
    trace_id: analysis.analysis_id,
    job_id: "strategic_governance",
    type: "strategic_governance_analysis_generated",
    timestamp: analysis.generated_at,
    payload: analysis as unknown as Record<string, unknown>,
  });
  return analysis;
}

export async function analyzeGovernanceTradeoff(kind: GovernanceTradeoffKind): Promise<GovernanceTradeoff> {
  const stability = await calculateRuntimeStabilityScore();
  const federation = await forecastFederationRisk();
  const budgetPressure = maxBudgetPressure();
  const trustLevel = getExecutionTrustLevel();
  const approvalPressure = pendingApprovalPressure();
  const map: Record<GovernanceTradeoffKind, Omit<GovernanceTradeoff, "tradeoff_id" | "kind" | "analyzed_at">> = {
    security_vs_availability: {
      preferred: "security",
      secondary: "stability",
      risk_level: stability.state === "stable" ? "medium" : "high",
      rationale: `security precedence dominates when availability=${stability.state}`,
      evidence_refs: ["constitution:approval_mandatory", "doctrine:survival"],
      recommended_action: stability.state === "stable" ? "escalate" : "freeze",
    },
    economy_vs_recovery: {
      preferred: budgetPressure >= 0.85 ? "economy" : "stability",
      secondary: "economy",
      risk_level: budgetPressure >= 0.85 ? "high" : "medium",
      rationale: `budget_pressure=${budgetPressure.toFixed(2)}; recovery remains bounded by cost pressure`,
      evidence_refs: ["economy:budget", "recovery:dashboard"],
      recommended_action: budgetPressure >= 0.85 ? "defer" : "stabilize",
    },
    autonomy_vs_safety: {
      preferred: "security",
      secondary: "autonomy",
      risk_level: trustLevel === "trusted_autonomous" || approvalPressure >= 0.5 ? "high" : "medium",
      rationale: `trust=${trustLevel};approval_pressure=${approvalPressure.toFixed(2)}`,
      evidence_refs: ["autonomy:trust", "governance:approvals"],
      recommended_action: trustLevel === "trusted_autonomous" ? "escalate" : "approve",
    },
    federation_vs_isolation: {
      preferred: (federation.risks as unknown[]).length ? "security" : "federation",
      secondary: "federation",
      risk_level: (federation.risks as unknown[]).length ? "high" : "low",
      rationale: `federation_risks=${(federation.risks as unknown[]).length}`,
      evidence_refs: ["federation:risk_forecast"],
      recommended_action: (federation.risks as unknown[]).length ? "isolate" : "approve",
    },
  };
  const tradeoff: GovernanceTradeoff = {
    tradeoff_id: `tradeoff_${kind}_${Date.now()}`,
    kind,
    analyzed_at: new Date().toISOString(),
    ...map[kind],
  };
  appendJsonl(TRADEOFFS_PATH, tradeoff as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(tradeoff.tradeoff_id, "governance_tradeoff_analyzed"),
    trace_id: tradeoff.tradeoff_id,
    job_id: "strategic_governance",
    type: "governance_tradeoff_analyzed",
    timestamp: tradeoff.analyzed_at,
    payload: tradeoff as unknown as Record<string, unknown>,
  });
  return tradeoff;
}

export async function createLongHorizonGovernancePlan(): Promise<Record<string, unknown>> {
  const forecast = await generateLongTermStabilityForecast();
  const drifts = await projectStrategicDrift();
  const plan = {
    plan_id: `governance_plan_${Date.now()}`,
    generated_at: new Date().toISOString(),
    horizons: (["days", "weeks", "epochs"] as GovernanceHorizon[]).map((horizon) => ({
      horizon,
      objective: horizon === "days" ? "stabilize current governance pressure" : horizon === "weeks" ? "reduce recurring drift and approval pressure" : "preserve constitutional precedence across runtime epochs",
      actions: horizon === "days" ? ["review high-risk tradeoffs", "refresh heuristics"] : horizon === "weeks" ? ["audit autonomy trust", "verify federation risk"] : ["re-baseline doctrines", "anchor strategic precedents"],
    })),
    forecast,
    drifts,
  };
  appendJsonl(PLANS_PATH, plan as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(plan.plan_id), "long_horizon_governance_plan_created"),
    trace_id: String(plan.plan_id),
    job_id: "strategic_governance",
    type: "long_horizon_governance_plan_created",
    timestamp: plan.generated_at,
    payload: plan as unknown as Record<string, unknown>,
  });
  return plan;
}

export async function projectStrategicDrift(): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-700);
  const federation = await forecastFederationRisk();
  const trustLevel = getExecutionTrustLevel();
  const approvalPressure = pendingApprovalPressure();
  const driftCandidates = [
    { kind: "policy_drift" as StrategicDriftKind, score: records.filter((record) => record.type.includes("drift") || record.type.includes("policy")).length, reason: "policy and drift signals" },
    { kind: "trust_degradation" as StrategicDriftKind, score: approvalPressure * 100, reason: "approval pressure implies trust friction" },
    { kind: "autonomy_escalation" as StrategicDriftKind, score: trustLevel === "trusted_autonomous" ? 70 : trustLevel === "semi_autonomous" ? 35 : 10, reason: `trust_level=${trustLevel}` },
    { kind: "federation_fracture" as StrategicDriftKind, score: (federation.risks as unknown[]).length * 35, reason: "federation risk count" },
  ];
  const projection = {
    projection_id: `strategic_drift_${Date.now()}`,
    generated_at: new Date().toISOString(),
    drifts: driftCandidates.map((candidate) => ({
      ...candidate,
      risk_level: riskFromScore(candidate.score),
      probability: Math.min(1, Number((candidate.score / 100).toFixed(2))),
    })),
  };
  appendJsonl(DRIFTS_PATH, projection as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(projection.projection_id), "strategic_drift_projection_generated"),
    trace_id: String(projection.projection_id),
    job_id: "strategic_governance",
    type: "strategic_drift_projection_generated",
    timestamp: projection.generated_at,
    payload: projection as unknown as Record<string, unknown>,
  });
  return projection;
}

export async function generateGovernanceStabilityHeuristics(): Promise<Record<string, unknown>> {
  const patterns = await recognizeCognitivePatterns();
  const stability = await calculateRuntimeStabilityScore();
  const heuristics = {
    heuristics_id: `governance_heuristics_${Date.now()}`,
    generated_at: new Date().toISOString(),
    freeze_thresholds: {
      stability_score_below: 45,
      security_pattern_severity: "high",
      federation_risk_count: 2,
    },
    risk_escalation_patterns: patterns.filter((pattern) => pattern.severity === "high" || pattern.severity === "critical").map((pattern) => pattern.kind),
    approval_pressure: pendingApprovalPressure(),
    stability_decay: Math.max(0, 100 - stability.score),
    recommended_heuristics: [
      "Security tradeoffs dominate availability when constitutional approval rules are implicated.",
      "Autonomy should downgrade when approval pressure or security regressions rise.",
      "Recovery actions should be preferred when stability drops below degraded.",
    ],
  };
  writeJson(HEURISTICS_PATH, heuristics);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(heuristics.heuristics_id), "governance_stability_heuristics_generated"),
    trace_id: String(heuristics.heuristics_id),
    job_id: "strategic_governance",
    type: "governance_stability_heuristics_generated",
    timestamp: heuristics.generated_at,
    payload: heuristics as unknown as Record<string, unknown>,
  });
  return heuristics;
}

export async function generateRuntimeConstitutionalIntelligence(): Promise<Record<string, unknown>> {
  const constitution = getConstitutionState();
  const precedence = getConstitutionPrecedence();
  const doctrines = getAllDoctrines();
  const policies = readEvidenceRecords({ order: "asc" }).filter((record) => record.type.includes("policy") || record.type.includes("approval")).slice(-100);
  const precedents = readJsonl<GovernanceTradeoff>(TRADEOFFS_PATH).slice(-20);
  const intelligence = {
    intelligence_id: `constitutional_intel_${Date.now()}`,
    generated_at: new Date().toISOString(),
    constitution: {
      version: constitution.version,
      epoch: constitution.epoch,
      violations: constitution.violations.length,
      emergency_freeze_active: constitution.emergency_freeze_active,
      precedence,
    },
    doctrines: doctrines.map((doctrine) => ({ id: doctrine.doctrine_id, category: doctrine.category, priority: doctrine.priority, immutable: doctrine.immutable })),
    policies: policies.length,
    precedence_examples: precedents.map((tradeoff) => ({ kind: tradeoff.kind, preferred: tradeoff.preferred, action: tradeoff.recommended_action })),
    conclusion: constitution.violations.length || constitution.emergency_freeze_active ? "constitutional_risk_active" : "constitutional_bounds_nominal",
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(intelligence.intelligence_id), "runtime_constitutional_intelligence_generated"),
    trace_id: String(intelligence.intelligence_id),
    job_id: "strategic_governance",
    type: "runtime_constitutional_intelligence_generated",
    timestamp: intelligence.generated_at,
    payload: intelligence as unknown as Record<string, unknown>,
  });
  return intelligence;
}

export async function createStrategicGovernanceDashboard(): Promise<Record<string, unknown>> {
  const [analysis, drifts, plan, heuristics, constitutional] = await Promise.all([
    runStrategicGovernanceEngine(),
    projectStrategicDrift(),
    createLongHorizonGovernancePlan(),
    generateGovernanceStabilityHeuristics(),
    generateRuntimeConstitutionalIntelligence(),
  ]);
  const dashboard = {
    dashboard_id: `strategic_governance_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    tradeoffs: readJsonl<GovernanceTradeoff>(TRADEOFFS_PATH).slice(-20),
    drifts,
    objectives: plan.horizons,
    stability: (analysis.domains as Record<string, unknown>).stability,
    trust: (analysis.domains as Record<string, unknown>).trust,
    strategic_risk: analysis.strategic_risk,
    heuristics,
    constitutional,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "strategic_governance_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "strategic_governance",
    type: "strategic_governance_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: { strategic_risk: dashboard.strategic_risk, tradeoffs: dashboard.tradeoffs.length },
  });
  return dashboard;
}

export async function runStrategicGovernanceSmokePack(): Promise<Record<string, unknown>> {
  const conflict: CognitiveSignal[] = [
    { layer: "security", intent: "freeze", priority: "security", reason: "security vs availability governance conflict", risk: "high", evidence_refs: ["security_vs_availability"] },
    { layer: "execution", intent: "coordinate", priority: "survival", reason: "availability wants execution continuity", risk: "medium", evidence_refs: ["availability"] },
  ];
  const arbitration = await arbitrateCognitivePriority(conflict);
  const tradeoff = await analyzeGovernanceTradeoff("security_vs_availability");
  const decision = await recordGovernanceDecision({
    trace_id: String(tradeoff.tradeoff_id),
    decision: "strategic_governance_tradeoff_decided",
    why: tradeoff.rationale,
    based_on: [String((arbitration.selected as CognitiveSignal).priority), tradeoff.kind],
    evidence_refs: tradeoff.evidence_refs,
    policy_refs: ["constitutional_precedence", "strategic_governance_tradeoffs"],
    risk_level: tradeoff.risk_level,
  });
  const stabilization = await applyRuntimeSelfStabilization("rc14 strategic governance smoke");
  const audit = await generateRuntimeConstitutionalIntelligence();
  const smoke = {
    smoke_id: `strategic_governance_smoke_${Date.now()}`,
    conflict,
    arbitration,
    tradeoff,
    decision,
    stabilization,
    audit,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "strategic_governance_smoke_completed"),
    trace_id: smoke.smoke_id,
    job_id: "strategic_governance",
    type: "strategic_governance_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeStrategicGovernanceFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runStrategicGovernanceSmokePack();
  const dashboard = await createStrategicGovernanceDashboard();
  const freeze = {
    freeze_id: `rc14_strategic_governance_freeze_${Date.now()}`,
    scope: "RC-14 Runtime Strategic Governance Intelligence",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "strategic_governance_engine",
      "governance_tradeoff_analysis",
      "long_horizon_governance_planning",
      "strategic_drift_projection",
      "governance_stability_heuristics",
      "runtime_constitutional_intelligence",
      "strategic_governance_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_strategic_governance_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "strategic_governance",
    type: "runtime_strategic_governance_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
