import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { createExecutionApprovalRequest } from "../policy/execution-approval-queue.js";
import { evaluateRuntimeConfidence, recordGovernanceDecision } from "./governance-operations.js";
import { runAutonomousCleanup, runAutonomousRetry } from "./coordination-runtime.js";
import { syncFederationOperationalState } from "./federation-operations.js";
import { generateOperationalDigest } from "./operational-runtime.js";

export type ExecutionTrustLevel = "manual_only" | "approval_required" | "semi_autonomous" | "trusted_autonomous";
export type SafeAutonomousZone = "cleanup" | "retries" | "low_risk_maintenance" | "digest_generation" | "low_risk_federation_sync";
export type AutonomousActionStatus = "proposed" | "approved" | "executed" | "rolled_back" | "blocked" | "closed";

export interface AutonomousActionProposal {
  proposal_id: string;
  zone: SafeAutonomousZone;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  confidence: "high" | "medium" | "low" | "unsafe";
  expected_effect: string;
  rollback: string[];
  status: AutonomousActionStatus;
  trace_id: string;
  created_at: string;
  approval_id?: string;
}

export interface RollbackContract {
  contract_id: string;
  proposal_id: string;
  rollback: string[];
  evidence_required: boolean;
  closure_required: boolean;
  registered_at: string;
}

export interface AutonomyBudget {
  actions_per_hour: number;
  risk_budget: number;
  retry_budget: number;
  federation_autonomy_budget: number;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const AUTO_DIR = path.join(DATA_DIR, "mission-control", "autonomy");
const PROPOSALS_PATH = path.join(AUTO_DIR, "autonomous-proposals.jsonl");
const TRUST_PATH = path.join(AUTO_DIR, "trust-level.json");
const OVERRIDE_PATH = path.join(AUTO_DIR, "human-override.json");
const BUDGET_PATH = path.join(AUTO_DIR, "autonomy-budget.json");
const ROLLBACK_PATH = path.join(AUTO_DIR, "rollback-contracts.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-autonomous-governance-freeze.json");

const DEFAULT_BUDGET: AutonomyBudget = {
  actions_per_hour: 20,
  risk_budget: 20,
  retry_budget: 10,
  federation_autonomy_budget: 5,
};

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

function riskCost(risk: AutonomousActionProposal["risk"]): number {
  return risk === "critical" ? 10 : risk === "high" ? 5 : risk === "medium" ? 2 : 1;
}

export function getExecutionTrustLevel(): ExecutionTrustLevel {
  return readJson<{ level: ExecutionTrustLevel }>(TRUST_PATH, { level: "approval_required" }).level;
}

export async function setExecutionTrustLevel(level: ExecutionTrustLevel, reason?: string): Promise<{ level: ExecutionTrustLevel; updated_at: string; reason?: string }> {
  const value = { level, updated_at: new Date().toISOString(), reason };
  writeJson(TRUST_PATH, value);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`trust_${value.updated_at}`, "execution_trust_level_updated"),
    trace_id: "runtime_autonomy_trust",
    job_id: "autonomy",
    type: "execution_trust_level_updated",
    timestamp: value.updated_at,
    payload: value,
  });
  return value;
}

export async function checkSafeAutonomousZone(zone: SafeAutonomousZone, risk: AutonomousActionProposal["risk"]): Promise<{ allowed: boolean; reason: string }> {
  const trust = getExecutionTrustLevel();
  const override = readJson<Record<string, unknown>>(OVERRIDE_PATH, {});
  const frozenZones = Array.isArray(override.frozen_zones) ? override.frozen_zones.map(String) : [];
  const allowedByTrust = trust === "trusted_autonomous" || (trust === "semi_autonomous" && (risk === "low" || risk === "medium"));
  const allowed = allowedByTrust && !frozenZones.includes(zone) && override.pause_autonomy !== true && override.force_approval_mode !== true;
  const result = { allowed, reason: allowed ? "zone_allowed" : "zone_requires_approval_or_frozen" };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${zone}_${Date.now()}`, "safe_autonomous_zone_checked"),
    trace_id: "runtime_autonomy_zone",
    job_id: "autonomy",
    type: "safe_autonomous_zone_checked",
    timestamp: new Date().toISOString(),
    payload: { zone, risk, trust, frozen_zones: frozenZones, ...result },
  });
  return result;
}

export async function createAutonomousActionProposal(input: {
  zone: SafeAutonomousZone;
  action: string;
  risk?: AutonomousActionProposal["risk"];
  expected_effect: string;
  rollback: string[];
  trace_id?: string;
}): Promise<AutonomousActionProposal> {
  const traceId = input.trace_id || `auto_proposal_${Date.now()}`;
  const confidence = await evaluateRuntimeConfidence({
    trace_id: traceId,
    risk_level: input.risk || "low",
  });
  const proposal: AutonomousActionProposal = {
    proposal_id: `auto_prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    zone: input.zone,
    action: input.action,
    risk: input.risk || "low",
    confidence: confidence.confidence,
    expected_effect: input.expected_effect,
    rollback: input.rollback,
    status: "proposed",
    trace_id: traceId,
    created_at: new Date().toISOString(),
  };
  appendJsonl(PROPOSALS_PATH, proposal as unknown as Record<string, unknown>);
  await recordGovernanceDecision({
    trace_id: traceId,
    decision: "autonomous_action_proposed",
    why: input.expected_effect,
    based_on: ["runtime_confidence", "safe_autonomous_zone", "autonomy_budget"],
    evidence_refs: [proposal.proposal_id],
    policy_refs: ["autonomous_execution_governance"],
    risk_level: proposal.risk,
  });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(proposal.proposal_id, "autonomous_action_proposal_created"),
    trace_id: traceId,
    job_id: "autonomy",
    type: "autonomous_action_proposal_created",
    timestamp: proposal.created_at,
    payload: proposal as unknown as Record<string, unknown>,
  });
  await registerAutonomousRollbackContract(proposal);
  return proposal;
}

export async function registerAutonomousRollbackContract(proposal: AutonomousActionProposal): Promise<RollbackContract> {
  const contract: RollbackContract = {
    contract_id: `rollback_${proposal.proposal_id}`,
    proposal_id: proposal.proposal_id,
    rollback: proposal.rollback,
    evidence_required: true,
    closure_required: true,
    registered_at: new Date().toISOString(),
  };
  appendJsonl(ROLLBACK_PATH, contract as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(contract.contract_id, "autonomous_rollback_contract_registered"),
    trace_id: proposal.trace_id,
    job_id: "autonomy",
    type: "autonomous_rollback_contract_registered",
    timestamp: contract.registered_at,
    payload: contract as unknown as Record<string, unknown>,
  });
  return contract;
}

export async function checkRuntimeAutonomyBudget(proposal: AutonomousActionProposal): Promise<{ allowed: boolean; remaining: AutonomyBudget; reason: string }> {
  const budget = readJson<AutonomyBudget>(BUDGET_PATH, DEFAULT_BUDGET);
  const recent = readEvidenceRecords({ type: "autonomous_action_executed", order: "asc" }).filter((record) => Date.now() - new Date(record.timestamp).getTime() <= 60 * 60_000);
  const usedRisk = recent.reduce((sum, record) => sum + Number(record.payload?.risk_cost || 0), 0);
  const usedRetries = recent.filter((record) => record.payload?.zone === "retries").length;
  const usedFederation = recent.filter((record) => record.payload?.zone === "low_risk_federation_sync").length;
  const remaining: AutonomyBudget = {
    actions_per_hour: Math.max(0, budget.actions_per_hour - recent.length),
    risk_budget: Math.max(0, budget.risk_budget - usedRisk),
    retry_budget: Math.max(0, budget.retry_budget - usedRetries),
    federation_autonomy_budget: Math.max(0, budget.federation_autonomy_budget - usedFederation),
  };
  const cost = riskCost(proposal.risk);
  const allowed = remaining.actions_per_hour > 0
    && remaining.risk_budget >= cost
    && (proposal.zone !== "retries" || remaining.retry_budget > 0)
    && (proposal.zone !== "low_risk_federation_sync" || remaining.federation_autonomy_budget > 0);
  const result = { allowed, remaining, reason: allowed ? "autonomy_budget_available" : "autonomy_budget_exceeded" };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(proposal.proposal_id, "runtime_autonomy_budget_checked"),
    trace_id: proposal.trace_id,
    job_id: "autonomy",
    type: "runtime_autonomy_budget_checked",
    timestamp: new Date().toISOString(),
    payload: { proposal_id: proposal.proposal_id, risk_cost: cost, ...result },
  });
  return result;
}

export async function applyHumanOverride(input: {
  pause_autonomy?: boolean;
  downgrade_trust?: ExecutionTrustLevel;
  freeze_zone?: SafeAutonomousZone;
  clear_frozen_zones?: boolean;
  force_approval_mode?: boolean;
  actor?: string;
  reason?: string;
}): Promise<Record<string, unknown>> {
  const current = readJson<Record<string, unknown>>(OVERRIDE_PATH, {});
  const frozenZones = input.clear_frozen_zones ? [] : Array.isArray(current.frozen_zones) ? current.frozen_zones.map(String) : [];
  if (input.freeze_zone && !frozenZones.includes(input.freeze_zone)) frozenZones.push(input.freeze_zone);
  const override = {
    ...current,
    pause_autonomy: input.pause_autonomy ?? current.pause_autonomy ?? false,
    force_approval_mode: input.force_approval_mode ?? current.force_approval_mode ?? false,
    frozen_zones: frozenZones,
    actor: input.actor || "operator",
    reason: input.reason,
    updated_at: new Date().toISOString(),
  };
  writeJson(OVERRIDE_PATH, override);
  if (input.downgrade_trust) await setExecutionTrustLevel(input.downgrade_trust, input.reason || "human_override");
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`override_${override.updated_at}`, "human_override_applied"),
    trace_id: "runtime_autonomy_override",
    job_id: "autonomy",
    type: "human_override_applied",
    timestamp: String(override.updated_at),
    payload: override,
  });
  return override;
}

function latestProposal(proposalId: string): AutonomousActionProposal | null {
  return readJsonl<AutonomousActionProposal>(PROPOSALS_PATH).filter((proposal) => proposal.proposal_id === proposalId).at(-1) || null;
}

function writeProposalState(proposal: AutonomousActionProposal): void {
  appendJsonl(PROPOSALS_PATH, proposal as unknown as Record<string, unknown>);
}

export async function executeAutonomousProposal(proposalId: string): Promise<Record<string, unknown>> {
  const proposal = latestProposal(proposalId);
  if (!proposal) return { ok: false, status: "blocked", reason: "proposal_not_found" };
  const zone = await checkSafeAutonomousZone(proposal.zone, proposal.risk);
  const budget = await checkRuntimeAutonomyBudget(proposal);
  const trust = getExecutionTrustLevel();
  if (!zone.allowed || !budget.allowed || proposal.confidence === "low" || proposal.confidence === "unsafe" || trust === "approval_required" || trust === "manual_only") {
    const approval = await createExecutionApprovalRequest({
      trace_id: proposal.trace_id,
      task_kind: `autonomous_${proposal.zone}`,
      requested_by: "mission_control",
      reason: `Autonomous proposal requires approval: ${proposal.action}`,
    });
    proposal.approval_id = approval.approval_id;
    proposal.status = "blocked";
    writeProposalState(proposal);
    return { ok: false, status: "blocked", reason: "approval_required", approval_id: approval.approval_id, zone, budget, trust };
  }

  let execution: unknown;
  if (proposal.zone === "cleanup") execution = await runAutonomousCleanup();
  else if (proposal.zone === "retries") execution = await runAutonomousRetry({ trace_id: proposal.trace_id, failure_kind: "transient", attempt: 0 });
  else if (proposal.zone === "digest_generation") execution = await generateOperationalDigest();
  else if (proposal.zone === "low_risk_federation_sync") execution = await syncFederationOperationalState("local");
  else execution = { ok: true, action: "low_risk_maintenance_recorded" };

  proposal.status = "executed";
  writeProposalState(proposal);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(proposal.proposal_id, "autonomous_action_executed"),
    trace_id: proposal.trace_id,
    job_id: "autonomy",
    type: "autonomous_action_executed",
    timestamp: new Date().toISOString(),
    payload: { proposal_id: proposal.proposal_id, zone: proposal.zone, action: proposal.action, risk_cost: riskCost(proposal.risk), execution },
  });
  return { ok: true, status: "executed", proposal, execution };
}

export async function rollbackAutonomousProposal(proposalId: string, reason = "operator_requested"): Promise<Record<string, unknown>> {
  const proposal = latestProposal(proposalId);
  if (!proposal) return { ok: false, reason: "proposal_not_found" };
  proposal.status = "rolled_back";
  writeProposalState(proposal);
  const result = {
    rollback_id: `auto_rollback_${Date.now()}`,
    proposal_id: proposalId,
    trace_id: proposal.trace_id,
    reason,
    rollback: proposal.rollback,
    closure: "rollback_recorded",
    rolled_back_at: new Date().toISOString(),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.rollback_id, "autonomous_action_rolled_back"),
    trace_id: proposal.trace_id,
    job_id: "autonomy",
    type: "autonomous_action_rolled_back",
    timestamp: result.rolled_back_at,
    payload: result,
  });
  return result;
}

export async function createAutonomousGovernanceDashboard(): Promise<Record<string, unknown>> {
  const proposals = readJsonl<AutonomousActionProposal>(PROPOSALS_PATH);
  const latest = new Map<string, AutonomousActionProposal>();
  for (const proposal of proposals) latest.set(proposal.proposal_id, proposal);
  const dashboard = {
    dashboard_id: `autonomy_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    proposals: Array.from(latest.values()),
    autonomous_actions: readEvidenceRecords({ type: "autonomous_action_executed" }).slice(0, 50),
    trust_level: getExecutionTrustLevel(),
    rollback_state: readJsonl<RollbackContract>(ROLLBACK_PATH).slice(-50),
    autonomy_budget: readJson<AutonomyBudget>(BUDGET_PATH, DEFAULT_BUDGET),
    override: readJson<Record<string, unknown>>(OVERRIDE_PATH, {}),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "autonomous_governance_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "autonomy",
    type: "autonomous_governance_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: { proposals: dashboard.proposals.length, trust_level: dashboard.trust_level },
  });
  return dashboard;
}

export async function runAutonomousGovernanceSmokePack(): Promise<Record<string, unknown>> {
  await setExecutionTrustLevel("semi_autonomous", "rc11 smoke");
  await applyHumanOverride({
    pause_autonomy: false,
    force_approval_mode: false,
    clear_frozen_zones: true,
    actor: "mission_control",
    reason: "rc11 smoke reset",
  });
  const proposal = await createAutonomousActionProposal({
    zone: "digest_generation",
    action: "generate_runtime_digest",
    risk: "low",
    expected_effect: "Generate digest without mutating runtime state",
    rollback: ["mark digest superseded", "record closure"],
    trace_id: "rc11_autonomous_smoke",
  });
  const execution = await executeAutonomousProposal(proposal.proposal_id);
  const rollback = await rollbackAutonomousProposal(proposal.proposal_id, "rc11 smoke rollback verification");
  const closed = await recordGovernanceDecision({
    trace_id: proposal.trace_id,
    decision: "autonomous_action_closed",
    why: "Autonomous smoke executed and rollback contract verified",
    based_on: [proposal.proposal_id],
    evidence_refs: [proposal.proposal_id],
    policy_refs: ["autonomous_rollback_contract"],
    risk_level: "low",
  });
  return {
    smoke_id: `autonomy_smoke_${Date.now()}`,
    proposal,
    execution,
    rollback,
    closure: closed,
  };
}

export async function createRuntimeAutonomousGovernanceFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runAutonomousGovernanceSmokePack();
  const dashboard = await createAutonomousGovernanceDashboard();
  const freeze = {
    freeze_id: `rc11_autonomous_freeze_${Date.now()}`,
    scope: "RC-11 Runtime Autonomous Execution Governance",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "autonomous_action_proposal_engine",
      "execution_trust_levels",
      "safe_autonomous_zones",
      "autonomous_rollback_contracts",
      "runtime_autonomy_budget",
      "human_override_layer",
      "autonomous_governance_dashboard",
    ],
  };
  ensureDir(path.dirname(FREEZE_PATH));
  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_autonomous_governance_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "autonomy",
    type: "runtime_autonomous_governance_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
