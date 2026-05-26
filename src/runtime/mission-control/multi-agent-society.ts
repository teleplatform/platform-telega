import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import {
  enforceSovereignTruth,
  evaluateRuntimeTruthConfidence,
  recordExecutionTruthLedger,
  runRealityVerificationEngine,
  trackObservableEffect,
} from "./reality-verification.js";

export type AgentRole = "creator" | "governance" | "security" | "recovery" | "execution" | "verifier" | "planner" | "background";
export type AgentTrust = "untrusted" | "limited" | "trusted" | "sovereign";
export type CooperationAction = "delegate" | "request" | "verify" | "review" | "handoff";

export interface RuntimeAgentIdentity {
  agent_id: string;
  identity: string;
  role: AgentRole;
  trust: AgentTrust;
  authority: number;
  history: string[];
  specialization: string[];
  declared_at: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const SOCIETY_DIR = path.join(DATA_DIR, "mission-control", "multi-agent-society");
const AGENTS_PATH = path.join(SOCIETY_DIR, "agents.jsonl");
const COOPERATION_PATH = path.join(SOCIETY_DIR, "cooperation.jsonl");
const DISAGREEMENTS_PATH = path.join(SOCIETY_DIR, "disagreements.jsonl");
const REPUTATION_PATH = path.join(SOCIETY_DIR, "reputation.jsonl");
const MEMORY_PATH = path.join(SOCIETY_DIR, "coordination-memory.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-multi-agent-society-freeze.json");

const HIERARCHY: AgentRole[] = ["creator", "governance", "security", "recovery", "verifier", "execution", "planner", "background"];

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

function roleAuthority(role: AgentRole): number {
  const index = HIERARCHY.indexOf(role);
  return index === -1 ? 10 : (HIERARCHY.length - index) * 10;
}

function getAgent(agentId: string): RuntimeAgentIdentity | undefined {
  return readJsonl<RuntimeAgentIdentity>(AGENTS_PATH).reverse().find((agent) => agent.agent_id === agentId);
}

export async function declareAgentIdentity(input: {
  identity: string;
  role: AgentRole;
  trust?: AgentTrust;
  history?: string[];
  specialization?: string[];
}): Promise<RuntimeAgentIdentity> {
  const agent: RuntimeAgentIdentity = {
    agent_id: `agent_${input.role}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    identity: input.identity,
    role: input.role,
    trust: input.trust || (input.role === "creator" ? "sovereign" : "trusted"),
    authority: roleAuthority(input.role),
    history: input.history || [],
    specialization: input.specialization || [input.role],
    declared_at: new Date().toISOString(),
  };
  appendJsonl(AGENTS_PATH, agent as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(agent.agent_id, "agent_identity_declared"),
    trace_id: agent.agent_id,
    job_id: "multi_agent_society",
    type: "agent_identity_declared",
    timestamp: agent.declared_at,
    payload: agent as unknown as Record<string, unknown>,
  });
  return agent;
}

export async function recordAgentCooperation(input: {
  trace_id: string;
  from_agent_id: string;
  to_agent_id: string;
  action: CooperationAction;
  task: string;
  evidence_ref?: string;
}): Promise<Record<string, unknown>> {
  const record = {
    cooperation_id: `cooperation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    from_agent_id: input.from_agent_id,
    to_agent_id: input.to_agent_id,
    action: input.action,
    task: input.task,
    evidence_ref: input.evidence_ref,
    recorded_at: new Date().toISOString(),
  };
  appendJsonl(COOPERATION_PATH, record);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(record.cooperation_id, "agent_cooperation_protocol_recorded"),
    trace_id: input.trace_id,
    job_id: "multi_agent_society",
    type: "agent_cooperation_protocol_recorded",
    timestamp: record.recorded_at,
    payload: record,
  });
  return record;
}

export async function resolveAgentDisagreement(input: {
  trace_id: string;
  agents: Array<{ agent_id: string; position: string; role?: AgentRole }>;
  issue: string;
}): Promise<Record<string, unknown>> {
  const ranked = input.agents
    .map((agent) => {
      const identity = getAgent(agent.agent_id);
      const role = agent.role || identity?.role || "background";
      return { ...agent, role, authority: identity?.authority ?? roleAuthority(role) };
    })
    .sort((a, b) => b.authority - a.authority);
  const winner = ranked[0];
  const resolution = {
    disagreement_id: `disagreement_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    issue: input.issue,
    resolved_at: new Date().toISOString(),
    agents: ranked,
    resolution: winner.position,
    resolved_by: winner.agent_id,
    arbitration_basis: "agent_governance_hierarchy",
  };
  appendJsonl(DISAGREEMENTS_PATH, resolution as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(resolution.disagreement_id, "agent_disagreement_resolved"),
    trace_id: input.trace_id,
    job_id: "multi_agent_society",
    type: "agent_disagreement_resolved",
    timestamp: resolution.resolved_at,
    payload: resolution as unknown as Record<string, unknown>,
  });
  return resolution;
}

export async function updateAgentReputation(agentId: string): Promise<Record<string, unknown>> {
  const cooperation = readJsonl<Record<string, unknown>>(COOPERATION_PATH)
    .filter((record) => record.from_agent_id === agentId || record.to_agent_id === agentId);
  const disagreements = readJsonl<Record<string, unknown>>(DISAGREEMENTS_PATH)
    .filter((record) => record.resolved_by === agentId || JSON.stringify(record.agents || []).includes(agentId));
  const verificationQuality = cooperation.filter((record) => record.action === "verify" || record.evidence_ref).length;
  const rollbackRate = disagreements.length
    ? disagreements.filter((record) => String(record.resolution).includes("rollback")).length / disagreements.length
    : 0;
  const reputation = {
    reputation_id: `reputation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    agent_id: agentId,
    updated_at: new Date().toISOString(),
    accuracy: Math.min(1, 0.6 + verificationQuality * 0.1),
    verification_quality: verificationQuality,
    rollback_rate: rollbackRate,
    incident_contribution: cooperation.length,
    trustworthiness: Math.max(0, Math.min(1, 0.75 + verificationQuality * 0.05 - rollbackRate * 0.2)),
  };
  appendJsonl(REPUTATION_PATH, reputation);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(reputation.reputation_id, "agent_reputation_updated"),
    trace_id: agentId,
    job_id: "multi_agent_society",
    type: "agent_reputation_updated",
    timestamp: reputation.updated_at,
    payload: reputation,
  });
  return reputation;
}

export async function buildAgentGovernanceHierarchy(): Promise<Record<string, unknown>> {
  const agents = readJsonl<RuntimeAgentIdentity>(AGENTS_PATH);
  const hierarchy = {
    hierarchy_id: `agent_hierarchy_${Date.now()}`,
    generated_at: new Date().toISOString(),
    levels: HIERARCHY.map((role) => ({
      role,
      authority: roleAuthority(role),
      agents: agents.filter((agent) => agent.role === role).map((agent) => agent.agent_id),
    })),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(hierarchy.hierarchy_id, "agent_governance_hierarchy_built"),
    trace_id: hierarchy.hierarchy_id,
    job_id: "multi_agent_society",
    type: "agent_governance_hierarchy_built",
    timestamp: hierarchy.generated_at,
    payload: hierarchy,
  });
  return hierarchy;
}

export async function recordAgentCoordinationMemory(input: {
  trace_id: string;
  kind: "lesson" | "pattern" | "decision" | "failure" | "strategy";
  summary: string;
  agent_ids: string[];
  evidence_refs?: string[];
}): Promise<Record<string, unknown>> {
  const memory = {
    memory_id: `agent_memory_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    kind: input.kind,
    summary: input.summary,
    agent_ids: input.agent_ids,
    evidence_refs: input.evidence_refs || [],
    recorded_at: new Date().toISOString(),
  };
  appendJsonl(MEMORY_PATH, memory);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(memory.memory_id, "agent_coordination_memory_recorded"),
    trace_id: input.trace_id,
    job_id: "multi_agent_society",
    type: "agent_coordination_memory_recorded",
    timestamp: memory.recorded_at,
    payload: memory,
  });
  return memory;
}

export async function createMultiAgentMissionControlDashboard(): Promise<Record<string, unknown>> {
  const agents = readJsonl<RuntimeAgentIdentity>(AGENTS_PATH).slice(-50);
  const cooperation = readJsonl<Record<string, unknown>>(COOPERATION_PATH).slice(-50);
  const disagreements = readJsonl<Record<string, unknown>>(DISAGREEMENTS_PATH).slice(-25);
  const reputation = readJsonl<Record<string, unknown>>(REPUTATION_PATH).slice(-50);
  const memory = readJsonl<Record<string, unknown>>(MEMORY_PATH).slice(-50);
  const hierarchy = await buildAgentGovernanceHierarchy();
  const dashboard = {
    dashboard_id: `multi_agent_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    agents,
    roles: hierarchy,
    trust: agents.map((agent) => ({ agent_id: agent.agent_id, role: agent.role, trust: agent.trust, authority: agent.authority })),
    reputation,
    disagreements,
    coordination: cooperation,
    memory,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "multi_agent_mission_control_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "multi_agent_society",
    type: "multi_agent_mission_control_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      agents: agents.length,
      disagreements: disagreements.length,
      cooperation: cooperation.length,
      memory: memory.length,
    },
  });
  return dashboard;
}

export async function runMultiAgentSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc18_multi_agent_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const planner = await declareAgentIdentity({
    identity: "Runtime Planner Agent",
    role: "planner",
    trust: "trusted",
    specialization: ["planning", "delegation"],
  });
  const verifier = await declareAgentIdentity({
    identity: "Reality Verifier Agent",
    role: "verifier",
    trust: "trusted",
    specialization: ["verification", "observable_effects"],
  });
  const security = await declareAgentIdentity({
    identity: "Security Governance Agent",
    role: "security",
    trust: "trusted",
    specialization: ["risk", "containment"],
  });
  const task = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "planned",
    intent: "multi-agent task verification",
    notes: "RC18 task created",
  });
  const delegation = await recordAgentCooperation({
    trace_id: traceId,
    from_agent_id: planner.agent_id,
    to_agent_id: verifier.agent_id,
    action: "delegate",
    task: "verify observable execution result",
    evidence_ref: task.truth_id,
  });
  const disagreement = await resolveAgentDisagreement({
    trace_id: traceId,
    issue: "planner wants closure before verifier confirms reality",
    agents: [
      { agent_id: planner.agent_id, role: "planner", position: "close_after_claim" },
      { agent_id: verifier.agent_id, role: "verifier", position: "require_observable_verification" },
      { agent_id: security.agent_id, role: "security", position: "block_unverified_closure" },
    ],
  });
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "multi-agent task verification",
    execution_ref: task.truth_id,
  });
  const review = await recordAgentCooperation({
    trace_id: traceId,
    from_agent_id: verifier.agent_id,
    to_agent_id: security.agent_id,
    action: "review",
    task: "review execution truth before closure",
    evidence_ref: executed.truth_id,
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "multi-agent task execution recorded",
    observed_effect: "execution ledger and cooperation protocol updated",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "multi-agent task verification",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const verification = await runRealityVerificationEngine(traceId);
  const confidence = await evaluateRuntimeTruthConfidence(traceId);
  const enforcement = await enforceSovereignTruth({ trace_id: traceId, action: "close_incident" });
  const memory = await recordAgentCoordinationMemory({
    trace_id: traceId,
    kind: "lesson",
    summary: "Multi-agent closure requires verifier-observed reality before governance closure.",
    agent_ids: [planner.agent_id, verifier.agent_id, security.agent_id],
    evidence_refs: [String(delegation.cooperation_id), String(disagreement.disagreement_id), verified.truth_id],
  });
  const reputations = await Promise.all([
    updateAgentReputation(planner.agent_id),
    updateAgentReputation(verifier.agent_id),
    updateAgentReputation(security.agent_id),
  ]);
  const closure = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "multi_agent_smoke_closed",
    why: "Delegation, disagreement arbitration, observable verification, sovereign truth enforcement, and coordination memory completed",
    based_on: [String(delegation.cooperation_id), String(disagreement.disagreement_id), String(effect.effect_id), verified.truth_id],
    evidence_refs: [String(task.truth_id), String(executed.truth_id), String(effect.effect_id), verified.truth_id],
    policy_refs: ["agent_governance_hierarchy", "sovereign_truth_enforcement", "reality_verification"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `multi_agent_smoke_${Date.now()}`,
    trace_id: traceId,
    task,
    delegation,
    disagreement,
    arbitration: disagreement,
    review,
    verification,
    confidence,
    enforcement,
    memory,
    reputations,
    closure,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "multi_agent_smoke_completed"),
    trace_id: traceId,
    job_id: "multi_agent_society",
    type: "multi_agent_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeMultiAgentSocietyFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runMultiAgentSmokePack();
  const dashboard = await createMultiAgentMissionControlDashboard();
  const freeze = {
    freeze_id: `rc18_multi_agent_society_freeze_${Date.now()}`,
    scope: "RC-18 Runtime Multi-Agent Operational Society",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "agent_identity_layer",
      "agent_cooperation_protocol",
      "agent_disagreement_resolution",
      "agent_reputation_system",
      "agent_governance_hierarchy",
      "agent_coordination_memory",
      "multi_agent_mission_control_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_multi_agent_society_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "multi_agent_society",
    type: "runtime_multi_agent_society_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
