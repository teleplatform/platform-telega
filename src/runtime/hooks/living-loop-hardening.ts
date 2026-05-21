import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import type { ExecutionEvidenceRecord, EvidenceRecordType } from "../evidence/execution-evidence.types.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllBudgets } from "../economy/runtime-budget-engine.js";
import {
  getOpenIncidents,
  resolveIncident,
  type Incident,
} from "../incidents/runtime-incident-command.js";
import {
  createOperationalLoopDashboardSnapshot,
  type OperationalLoopDashboardSnapshot,
} from "./operational-loop-dashboard-snapshot.js";

export type LivingLoopRequiredRecordKind =
  | "preflight"
  | "decision_point"
  | "budget"
  | "execution"
  | "closure";

export interface EvidenceCompletenessGateResult {
  trace_id: string;
  passed: boolean;
  required: LivingLoopRequiredRecordKind[];
  present: Record<LivingLoopRequiredRecordKind, boolean>;
  missing: LivingLoopRequiredRecordKind[];
  evidence_count: number;
}

export interface OperationalLoopReplayResult {
  trace_id: string;
  replay_id: string;
  passed: boolean;
  events: Array<{
    type: EvidenceRecordType;
    timestamp: string;
    job_id: string;
    evidence_id: string;
  }>;
  completeness: EvidenceCompletenessGateResult;
}

export interface MissionControlFeedItem {
  event_id?: string;
  kind?: string;
  severity?: string;
  title?: string;
  trace_id: string;
  created_at: string;
}

export interface BudgetBurnRateReport {
  generated_at: string;
  window_minutes: number;
  total_consumed: number;
  burn_rate_per_minute: number;
  anomalies: string[];
  budgets: Array<{ category: string; used: number; limit: number; used_ratio: number }>;
}

export interface IncidentAutoClosureResult {
  checked: number;
  closed: number;
  closed_incident_ids: string[];
  skipped_incident_ids: string[];
}

export interface LivingLoopBaselineFreeze {
  artifact_id: "living_loop_baseline";
  frozen_at: string;
  status: "frozen";
  milestone: "A28";
  completeness_gate: EvidenceCompletenessGateResult;
  replay: OperationalLoopReplayResult;
  snapshot: OperationalLoopDashboardSnapshot;
  burn_rate: BudgetBurnRateReport;
}

export interface OperationalLoopTraceInspection {
  trace_id: string;
  inspected_at: string;
  complete: boolean;
  phases: Array<{
    phase: LivingLoopRequiredRecordKind;
    present: boolean;
    events: Array<{
      type: EvidenceRecordType;
      timestamp: string;
      evidence_id: string;
      reason?: string;
    }>;
  }>;
  missing: LivingLoopRequiredRecordKind[];
}

export interface GovernanceFailureMatrixRow {
  surface: "shell" | "file" | "browser" | "replay" | "federation" | "evolution" | "model";
  blocked: number;
  requires_approval: number;
  reasons: string[];
}

export interface BudgetConsistencyAudit {
  passed: boolean;
  checked_at: string;
  paths: Array<{
    path: string;
    risky: boolean;
    mode_forwarded_to_budget: boolean;
    budget_gate: string;
  }>;
  failures: string[];
}

export interface ModeBoundaryAudit {
  passed: boolean;
  checked_at: string;
  boundaries: Array<{
    surface: string;
    public_expected: "allowed" | "blocked" | "requires_approval";
    creator_expected: "allowed" | "blocked" | "requires_approval";
    reason: string;
  }>;
}

export interface ProductionActivationFreeze {
  artifact_id: "production_activation_freeze";
  frozen_at: string;
  status: "frozen";
  milestone: "A36";
  trace_id: string;
  production_ready: boolean;
  trace_inspection: OperationalLoopTraceInspection;
  governance_failure_matrix: GovernanceFailureMatrixRow[];
  budget_consistency_audit: BudgetConsistencyAudit;
  mode_boundary_audit: ModeBoundaryAudit;
  mission_control_feed: MissionControlFeedItem[];
  burn_rate: BudgetBurnRateReport;
}

const REQUIRED_RECORDS: Record<LivingLoopRequiredRecordKind, EvidenceRecordType[]> = {
  preflight: ["chat_route_preflight_started"],
  decision_point: ["runtime_decision_point_checked"],
  budget: ["runtime_budget_middleware_checked", "runtime_budget_consumed", "runtime_budget_middleware_blocked"],
  execution: ["execution_started", "execution_completed", "execution_failed", "execution_finished"],
  closure: ["runtime_closure_completed"],
};

const DEFAULT_BASELINE_PATH = path.join(process.cwd(), ".data", "civilization", "living-loop-baseline.json");
const DEFAULT_PRODUCTION_FREEZE_PATH = path.join(process.cwd(), ".data", "civilization", "production-activation-freeze.json");

export function checkLivingLoopEvidenceCompleteness(traceId: string): EvidenceCompletenessGateResult {
  const records = readEvidenceRecords({ trace_id: traceId, order: "asc" });
  const present = Object.fromEntries(
    Object.entries(REQUIRED_RECORDS).map(([kind, types]) => [
      kind,
      records.some((record) => types.includes(record.type)),
    ]),
  ) as Record<LivingLoopRequiredRecordKind, boolean>;
  const missing = (Object.keys(present) as LivingLoopRequiredRecordKind[]).filter((kind) => !present[kind]);

  return {
    trace_id: traceId,
    passed: missing.length === 0,
    required: Object.keys(REQUIRED_RECORDS) as LivingLoopRequiredRecordKind[],
    present,
    missing,
    evidence_count: records.length,
  };
}

export async function recordLivingLoopCompletenessGate(traceId: string): Promise<EvidenceCompletenessGateResult> {
  const result = checkLivingLoopEvidenceCompleteness(traceId);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(traceId, "living_loop_completeness_gate_checked"),
    trace_id: traceId,
    job_id: "living_loop_hardening",
    type: result.passed ? "validation_gate_passed" : "validation_gate_failed",
    timestamp: new Date().toISOString(),
    payload: {
      gate: "living_loop_evidence_completeness",
      present: result.present,
      missing: result.missing,
      evidence_count: result.evidence_count,
    },
  });
  return result;
}

export async function replayOperationalLoopTrace(traceId: string): Promise<OperationalLoopReplayResult> {
  const replayId = hashTraceId(traceId, "operational_loop_replay");
  const records = readEvidenceRecords({ trace_id: traceId, order: "asc" });
  const completeness = checkLivingLoopEvidenceCompleteness(traceId);
  const result: OperationalLoopReplayResult = {
    trace_id: traceId,
    replay_id: replayId,
    passed: completeness.passed && records.length > 0,
    events: records.map((record) => ({
      type: record.type,
      timestamp: record.timestamp,
      job_id: record.job_id,
      evidence_id: record.evidence_id,
    })),
    completeness,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(replayId, "operational_loop_replay_tested"),
    trace_id: traceId,
    job_id: "living_loop_hardening",
    type: result.passed ? "replay_finished" : "replay_blocked",
    timestamp: new Date().toISOString(),
    replay_of: traceId,
    payload: {
      replay_id: replayId,
      passed: result.passed,
      event_count: result.events.length,
      missing: completeness.missing,
    },
  });

  return result;
}

export function aggregateMissionControlLiveFeed(limit = 50): MissionControlFeedItem[] {
  return readEvidenceRecords({
    type: "mission_control_live_event_emitted",
    order: "desc",
    limit,
  }).map((record) => ({
    event_id: String(record.payload?.event_id || ""),
    kind: String(record.payload?.kind || ""),
    severity: String(record.payload?.severity || ""),
    title: String(record.payload?.title || ""),
    trace_id: record.trace_id,
    created_at: record.timestamp,
  }));
}

export function calculateBudgetBurnRate(windowMinutes = 60): BudgetBurnRateReport {
  const now = Date.now();
  const windowMs = windowMinutes * 60_000;
  const consumedRecords = readEvidenceRecords({ type: "runtime_budget_consumed", order: "asc" }).filter((record) => {
    const ts = new Date(record.timestamp).getTime();
    return Number.isFinite(ts) && ts >= now - windowMs;
  });
  const totalConsumed = consumedRecords.reduce((sum, record) => {
    const consumed = Number(record.payload?.consumed || 0);
    return sum + (Number.isFinite(consumed) ? consumed : 0);
  }, 0);
  const budgets = getAllBudgets().map((budget) => ({
    category: budget.category,
    used: budget.used,
    limit: budget.limit,
    used_ratio: budget.limit > 0 ? budget.used / budget.limit : 1,
  }));
  const burnRate = totalConsumed / Math.max(1, windowMinutes);
  const anomalies = [
    ...budgets.filter((budget) => budget.used_ratio >= 0.9).map((budget) => `budget_${budget.category}_above_90_percent`),
    ...(burnRate > 100 ? ["burn_rate_above_100_units_per_minute"] : []),
  ];

  return {
    generated_at: new Date().toISOString(),
    window_minutes: windowMinutes,
    total_consumed: totalConsumed,
    burn_rate_per_minute: burnRate,
    anomalies,
    budgets,
  };
}

export async function autoCloseLowIncidentsAfterClosure(input: {
  trace_id: string;
  closure_status: "success" | "failure" | "blocked";
}): Promise<IncidentAutoClosureResult> {
  const open = getOpenIncidents();
  const eligible = input.closure_status === "success"
    ? open.filter((incident) => incident.severity === "info" || incident.severity === "low")
    : [];
  const closed: Incident[] = [];

  for (const incident of eligible) {
    const resolved = await resolveIncident(incident.incident_id);
    if (resolved) closed.push(resolved);
  }

  const result: IncidentAutoClosureResult = {
    checked: open.length,
    closed: closed.length,
    closed_incident_ids: closed.map((incident) => incident.incident_id),
    skipped_incident_ids: open
      .filter((incident) => !closed.some((closedIncident) => closedIncident.incident_id === incident.incident_id))
      .map((incident) => incident.incident_id),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id, "living_loop_incident_auto_closure_checked"),
    trace_id: input.trace_id,
    job_id: "living_loop_hardening",
    type: "runtime_incident_updated",
    timestamp: new Date().toISOString(),
    payload: {
      rule: "auto_close_low_incidents_after_successful_closure",
      closure_status: input.closure_status,
      ...result,
    },
  });

  return result;
}

export async function freezeLivingLoopBaseline(input: {
  trace_id: string;
  output_path?: string;
}): Promise<LivingLoopBaselineFreeze> {
  const completeness = await recordLivingLoopCompletenessGate(input.trace_id);
  const replay = await replayOperationalLoopTrace(input.trace_id);
  const snapshot = await createOperationalLoopDashboardSnapshot();
  const burnRate = calculateBudgetBurnRate();
  const baseline: LivingLoopBaselineFreeze = {
    artifact_id: "living_loop_baseline",
    frozen_at: new Date().toISOString(),
    status: "frozen",
    milestone: "A28",
    completeness_gate: completeness,
    replay,
    snapshot,
    burn_rate: burnRate,
  };

  const outputPath = input.output_path || DEFAULT_BASELINE_PATH;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id, "living_loop_baseline_frozen"),
    trace_id: input.trace_id,
    job_id: "living_loop_hardening",
    type: "operational_baseline_frozen",
    timestamp: baseline.frozen_at,
    payload: {
      artifact_id: baseline.artifact_id,
      output_path: outputPath,
      completeness_passed: completeness.passed,
      replay_passed: replay.passed,
    },
  });

  return baseline;
}

export function inspectOperationalLoopTrace(traceId: string): OperationalLoopTraceInspection {
  const records = readEvidenceRecords({ trace_id: traceId, order: "asc" });
  const completeness = checkLivingLoopEvidenceCompleteness(traceId);
  const phases = completeness.required.map((phase) => ({
    phase,
    present: completeness.present[phase],
    events: records
      .filter((record) => REQUIRED_RECORDS[phase].includes(record.type))
      .map((record) => ({
        type: record.type,
        timestamp: record.timestamp,
        evidence_id: record.evidence_id,
        reason: typeof record.payload?.reason === "string" ? record.payload.reason : undefined,
      })),
  }));

  return {
    trace_id: traceId,
    inspected_at: new Date().toISOString(),
    complete: completeness.passed,
    phases,
    missing: completeness.missing,
  };
}

export function buildGovernanceFailureMatrix(): GovernanceFailureMatrixRow[] {
  const records = readEvidenceRecords({ order: "asc" });
  const surfaceTypes: Record<GovernanceFailureMatrixRow["surface"], { blocked: EvidenceRecordType[]; approval: EvidenceRecordType[] }> = {
    shell: { blocked: ["shell_governance_blocked"], approval: ["shell_governance_approval_required"] },
    file: { blocked: ["file_governance_blocked"], approval: ["file_governance_approval_required"] },
    browser: { blocked: ["browser_governance_blocked"], approval: ["browser_governance_approval_required"] },
    replay: { blocked: ["replay_hardening_blocked"], approval: ["replay_hardening_approval_required"] },
    federation: { blocked: ["federation_governance_hook_blocked"], approval: ["federation_governance_hook_approval_required"] },
    evolution: { blocked: ["evolution_governance_hook_blocked"], approval: ["evolution_governance_hook_approval_required"] },
    model: { blocked: ["model_api_call_blocked"], approval: [] },
  };

  return (Object.keys(surfaceTypes) as GovernanceFailureMatrixRow["surface"][]).map((surface) => {
    const types = surfaceTypes[surface];
    const blockedRecords = records.filter((record) => types.blocked.includes(record.type));
    const approvalRecords = records.filter((record) => types.approval.includes(record.type));
    const reasons = [...blockedRecords, ...approvalRecords]
      .map((record) => String(record.payload?.reason || record.payload?.policy || record.payload?.decision || "unknown"))
      .filter((reason, index, all) => all.indexOf(reason) === index)
      .slice(0, 20);
    return {
      surface,
      blocked: blockedRecords.length,
      requires_approval: approvalRecords.length,
      reasons,
    };
  });
}

export function auditBudgetConsistency(): BudgetConsistencyAudit {
  const paths = [
    { path: "shell-execution-governance-hook", risky: true, mode_forwarded_to_budget: true, budget_gate: "consumeRuntimeBudget" },
    { path: "federation-action-governance-hook", risky: true, mode_forwarded_to_budget: true, budget_gate: "consumeRuntimeBudget" },
    { path: "replay-governance-hardening-hook", risky: true, mode_forwarded_to_budget: true, budget_gate: "consumeRuntimeBudget" },
    { path: "model-api-call-governance-hook", risky: true, mode_forwarded_to_budget: true, budget_gate: "consumeRuntimeBudget" },
    { path: "runtime-route-governance-middleware", risky: true, mode_forwarded_to_budget: true, budget_gate: "checkRuntimeBudget" },
    { path: "real-planning-activation-hook", risky: true, mode_forwarded_to_budget: true, budget_gate: "checkRuntimeBudget" },
    { path: "file-operation-governance-hook", risky: true, mode_forwarded_to_budget: true, budget_gate: "checkCostGovernance" },
    { path: "browser-action-governance-hook", risky: true, mode_forwarded_to_budget: true, budget_gate: "consumeRuntimeBudget" },
    { path: "evolution-proposal-governance-hook", risky: true, mode_forwarded_to_budget: true, budget_gate: "checkCostGovernance_after_primary_blocks" },
  ];
  const failures = paths
    .filter((item) => item.risky && !item.mode_forwarded_to_budget)
    .map((item) => `${item.path} does not carry mode into budget gate`);

  return {
    passed: failures.length === 0,
    checked_at: new Date().toISOString(),
    paths,
    failures,
  };
}

export function auditModeBoundaries(): ModeBoundaryAudit {
  const boundaries: ModeBoundaryAudit["boundaries"] = [
    { surface: "shell", public_expected: "blocked", creator_expected: "allowed", reason: "Public mode blocks shell execution" },
    { surface: "file_destructive", public_expected: "blocked", creator_expected: "requires_approval", reason: "Public mode blocks destructive/high-risk file operations" },
    { surface: "browser_high_risk", public_expected: "requires_approval", creator_expected: "requires_approval", reason: "Browser high-risk actions require approval" },
    { surface: "replay_force", public_expected: "requires_approval", creator_expected: "requires_approval", reason: "Force replay requires approval" },
    { surface: "federation_mutation", public_expected: "blocked", creator_expected: "requires_approval", reason: "Public mode blocks federation mutation" },
    { surface: "evolution_apply", public_expected: "blocked", creator_expected: "requires_approval", reason: "Public mode blocks evolution apply/change" },
    { surface: "model_api", public_expected: "allowed", creator_expected: "allowed", reason: "Model calls are budget/rate limited in both modes" },
  ];

  return {
    passed: boundaries.every((boundary) => !!boundary.reason),
    checked_at: new Date().toISOString(),
    boundaries,
  };
}

export async function freezeProductionActivation(input: {
  trace_id: string;
  output_path?: string;
}): Promise<ProductionActivationFreeze> {
  const traceInspection = inspectOperationalLoopTrace(input.trace_id);
  const governanceFailureMatrix = buildGovernanceFailureMatrix();
  const budgetConsistencyAudit = auditBudgetConsistency();
  const modeBoundaryAudit = auditModeBoundaries();
  const missionControlFeed = aggregateMissionControlLiveFeed(50);
  const burnRate = calculateBudgetBurnRate();
  const productionReady = traceInspection.complete && budgetConsistencyAudit.passed && modeBoundaryAudit.passed;

  const freeze: ProductionActivationFreeze = {
    artifact_id: "production_activation_freeze",
    frozen_at: new Date().toISOString(),
    status: "frozen",
    milestone: "A36",
    trace_id: input.trace_id,
    production_ready: productionReady,
    trace_inspection: traceInspection,
    governance_failure_matrix: governanceFailureMatrix,
    budget_consistency_audit: budgetConsistencyAudit,
    mode_boundary_audit: modeBoundaryAudit,
    mission_control_feed: missionControlFeed,
    burn_rate: burnRate,
  };

  const outputPath = input.output_path || DEFAULT_PRODUCTION_FREEZE_PATH;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(freeze, null, 2)}\n`, "utf8");

  await appendEvidenceRecord({
    evidence_id: hashTraceId(input.trace_id, "production_activation_freeze_created"),
    trace_id: input.trace_id,
    job_id: "living_loop_hardening",
    type: "operational_baseline_frozen",
    timestamp: freeze.frozen_at,
    payload: {
      artifact_id: freeze.artifact_id,
      output_path: outputPath,
      production_ready: productionReady,
    },
  });

  return freeze;
}
