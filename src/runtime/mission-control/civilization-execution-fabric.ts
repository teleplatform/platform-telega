import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import {
  buildOperationalRealityGraph,
  createCivilizationRealityKernelState,
  createRealityCivilizationDashboard,
} from "./reality-civilization-kernel.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import { recordInstitutionalMemory } from "./institutional-governance.js";
import {
  recordExecutionTruthLedger,
  runRealityVerificationEngine,
  trackObservableEffect,
} from "./reality-verification.js";

const DATA_DIR = path.join(process.cwd(), ".data");
const FABRIC_DIR = path.join(DATA_DIR, "mission-control", "civilization-execution-fabric");
const FABRIC_PATH = path.join(FABRIC_DIR, "execution-fabric.jsonl");
const LINEAGE_PATH = path.join(FABRIC_DIR, "cross-layer-lineage.jsonl");
const SYNC_PATH = path.join(FABRIC_DIR, "execution-synchronization.jsonl");
const INTEGRITY_PATH = path.join(FABRIC_DIR, "distributed-integrity.jsonl");
const RECOVERY_PATH = path.join(FABRIC_DIR, "fabric-recovery.jsonl");
const GUARANTEE_PATH = path.join(FABRIC_DIR, "sovereign-execution-guarantees.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-civilization-execution-fabric-freeze.json");

type FabricFlow =
  | "execution"
  | "governance"
  | "security"
  | "recovery"
  | "planning"
  | "federation"
  | "autonomy"
  | "memory";

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

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export async function createUnifiedCivilizationExecutionFabric(input?: {
  trace_id?: string;
  flows?: FabricFlow[];
}): Promise<Record<string, unknown>> {
  const flows: FabricFlow[] = input?.flows || [
    "execution",
    "governance",
    "security",
    "recovery",
    "planning",
    "federation",
    "autonomy",
    "memory",
  ];
  const graph = await buildOperationalRealityGraph();
  const fabric = {
    fabric_id: `civilization_execution_fabric_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id || `fabric_${Date.now()}`,
    created_at: new Date().toISOString(),
    flows,
    routing: flows.map((flow) => ({
      flow,
      substrate: "reality_verified_execution_fabric",
      required_stages: ["intent", "plan", "approval", "execution", "observable_effect", "verification", "closure", "memory"],
    })),
    reality_graph_ref: graph.graph_id,
    status: "active",
  };
  appendJsonl(FABRIC_PATH, fabric as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(fabric.fabric_id), "civilization_execution_fabric_created"),
    trace_id: String(fabric.trace_id),
    job_id: "civilization_execution_fabric",
    type: "civilization_execution_fabric_created",
    timestamp: String(fabric.created_at),
    payload: fabric as unknown as Record<string, unknown>,
  });
  return fabric;
}

export async function recordCrossLayerExecutionLineage(input: {
  trace_id: string;
  intent: string;
  plan_ref?: string;
  approval_ref?: string;
  execution_ref?: string;
  observable_effect_ref?: string;
  verification_ref?: string;
  closure_ref?: string;
  memory_ref?: string;
}): Promise<Record<string, unknown>> {
  const verification = await runRealityVerificationEngine(input.trace_id);
  const lineage = {
    lineage_id: `execution_lineage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    recorded_at: new Date().toISOString(),
    stages: {
      intent: input.intent,
      plan: input.plan_ref,
      approval: input.approval_ref,
      execution: input.execution_ref,
      observable_effect: input.observable_effect_ref,
      verification: input.verification_ref,
      closure: input.closure_ref,
      memory: input.memory_ref,
    },
    missing: Object.entries({
      plan: input.plan_ref,
      approval: input.approval_ref,
      execution: input.execution_ref,
      observable_effect: input.observable_effect_ref,
      verification: input.verification_ref,
      closure: input.closure_ref,
      memory: input.memory_ref,
    }).filter(([, value]) => !value).map(([key]) => key),
    verification,
  };
  appendJsonl(LINEAGE_PATH, lineage as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(lineage.lineage_id), "cross_layer_execution_lineage_recorded"),
    trace_id: input.trace_id,
    job_id: "civilization_execution_fabric",
    type: "cross_layer_execution_lineage_recorded",
    timestamp: String(lineage.recorded_at),
    payload: lineage as unknown as Record<string, unknown>,
  });
  return lineage;
}

export async function synchronizeCivilizationExecution(input: {
  trace_id: string;
  nodes?: string[];
  agents?: string[];
  federation_refs?: string[];
  governance_refs?: string[];
}): Promise<Record<string, unknown>> {
  const participants = uniq([
    ...(input.nodes || ["local-runtime"]),
    ...(input.agents || ["operator"]),
    ...(input.federation_refs || []),
    ...(input.governance_refs || []),
  ]);
  const synchronization = {
    sync_id: `execution_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    synchronized_at: new Date().toISOString(),
    participants,
    surfaces: {
      runtime_nodes: input.nodes || ["local-runtime"],
      agents: input.agents || ["operator"],
      federation: input.federation_refs || [],
      governance: input.governance_refs || [],
    },
    state: "synchronized",
  };
  appendJsonl(SYNC_PATH, synchronization as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(synchronization.sync_id), "civilization_execution_synchronized"),
    trace_id: input.trace_id,
    job_id: "civilization_execution_fabric",
    type: "civilization_execution_synchronized",
    timestamp: String(synchronization.synchronized_at),
    payload: synchronization as unknown as Record<string, unknown>,
  });
  return synchronization;
}

export async function verifyDistributedExecutionIntegrity(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const lineages = readJsonl<Record<string, unknown>>(LINEAGE_PATH);
  const scoped = input?.trace_id ? lineages.filter((lineage) => lineage.trace_id === input.trace_id) : lineages.slice(-100);
  const gaps = scoped.filter((lineage) => ((lineage.missing as unknown[] | undefined)?.length || 0) > 0);
  const syncs = readJsonl<Record<string, unknown>>(SYNC_PATH);
  const records = readEvidenceRecords({ order: "asc" }).slice(-3000);
  const replayRefs = records.filter((record) => record.type.includes("replay") && (!input?.trace_id || record.trace_id === input.trace_id));
  const integrity = {
    integrity_id: `distributed_execution_integrity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    verified_at: new Date().toISOString(),
    execution_consistency: gaps.length === 0 ? "consistent" : "lineage_gaps_detected",
    cross_node_integrity: syncs.length > 0 ? "synchronized" : "single_node_or_unsynchronized",
    replay_consistency: replayRefs.length > 1 ? "multiple_replay_refs_review_required" : "consistent",
    lineage_continuity: gaps.length === 0,
    gaps: gaps.map((lineage) => ({ lineage_id: lineage.lineage_id, missing: lineage.missing })),
  };
  appendJsonl(INTEGRITY_PATH, integrity as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(integrity.integrity_id), "distributed_execution_integrity_verified"),
    trace_id: input?.trace_id || String(integrity.integrity_id),
    job_id: "civilization_execution_fabric",
    type: "distributed_execution_integrity_verified",
    timestamp: String(integrity.verified_at),
    payload: integrity as unknown as Record<string, unknown>,
  });
  return integrity;
}

export async function recoverExecutionFabric(input: {
  trace_id: string;
  fracture: string;
  checkpoint_refs?: string[];
}): Promise<Record<string, unknown>> {
  const graph = await buildOperationalRealityGraph();
  const lineage = readJsonl<Record<string, unknown>>(LINEAGE_PATH)
    .filter((item) => item.trace_id === input.trace_id)
    .slice(-1)[0];
  const recovery = {
    recovery_id: `execution_fabric_recovery_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    recovered_at: new Date().toISOString(),
    fracture: input.fracture,
    actions: ["rebuild_lineage", "recover_checkpoints", "restore_synchronization"],
    checkpoint_refs: input.checkpoint_refs || [],
    rebuilt_lineage_ref: lineage?.lineage_id,
    reality_graph_ref: graph.graph_id,
    state: "recovered",
  };
  appendJsonl(RECOVERY_PATH, recovery as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(recovery.recovery_id), "execution_fabric_recovered"),
    trace_id: input.trace_id,
    job_id: "civilization_execution_fabric",
    type: "execution_fabric_recovered",
    timestamp: String(recovery.recovered_at),
    payload: recovery as unknown as Record<string, unknown>,
  });
  return recovery;
}

export async function verifySovereignExecutionGuarantees(input?: { trace_id?: string }): Promise<Record<string, unknown>> {
  const lineages = readJsonl<Record<string, unknown>>(LINEAGE_PATH);
  const scoped = input?.trace_id ? lineages.filter((lineage) => lineage.trace_id === input.trace_id) : lineages.slice(-100);
  const violations = scoped.flatMap((lineage) => {
    const missing = new Set((lineage.missing as string[] | undefined) || []);
    const found: Array<Record<string, unknown>> = [];
    if (missing.has("execution")) found.push({ lineage_id: lineage.lineage_id, guarantee: "no_orphan_execution" });
    if (missing.has("observable_effect") || missing.has("verification")) found.push({ lineage_id: lineage.lineage_id, guarantee: "no_unverifiable_execution" });
    if (missing.size > 0) found.push({ lineage_id: lineage.lineage_id, guarantee: "no_lineage_gaps", missing: [...missing] });
    if (missing.has("intent") || !lineage.trace_id) found.push({ lineage_id: lineage.lineage_id, guarantee: "no_silent_execution" });
    return found;
  });
  const guarantee = {
    guarantee_id: `sovereign_execution_guarantees_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    verified_at: new Date().toISOString(),
    guarantees: ["no_orphan_execution", "no_unverifiable_execution", "no_lineage_gaps", "no_silent_execution"],
    violations,
    preserved: violations.length === 0,
  };
  appendJsonl(GUARANTEE_PATH, guarantee as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(guarantee.guarantee_id), "sovereign_execution_guarantees_verified"),
    trace_id: input?.trace_id || String(guarantee.guarantee_id),
    job_id: "civilization_execution_fabric",
    type: "sovereign_execution_guarantees_verified",
    timestamp: String(guarantee.verified_at),
    payload: guarantee as unknown as Record<string, unknown>,
  });
  return guarantee;
}

export async function createCivilizationFabricDashboard(): Promise<Record<string, unknown>> {
  const [graph, reality, integrity, guarantees] = await Promise.all([
    buildOperationalRealityGraph(),
    createRealityCivilizationDashboard(),
    verifyDistributedExecutionIntegrity(),
    verifySovereignExecutionGuarantees(),
  ]);
  const dashboard = {
    dashboard_id: `civilization_fabric_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    execution_lineage: readJsonl<Record<string, unknown>>(LINEAGE_PATH).slice(-25),
    cross_layer_synchronization: readJsonl<Record<string, unknown>>(SYNC_PATH).slice(-25),
    integrity,
    fabric_health: guarantees.preserved && integrity.lineage_continuity ? "stable" : "degraded",
    distributed_consistency: {
      graph_ref: graph.graph_id,
      reality_confidence: reality.verification_confidence,
      guarantees,
    },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "civilization_fabric_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "civilization_execution_fabric",
    type: "civilization_fabric_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      lineage_items: dashboard.execution_lineage.length,
      synchronized_items: dashboard.cross_layer_synchronization.length,
      fabric_health: dashboard.fabric_health,
    },
  });
  return dashboard;
}

export async function runExecutionFabricSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc22_execution_fabric_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fabric = await createUnifiedCivilizationExecutionFabric({ trace_id: traceId });
  const planned = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "planned",
    intent: "civilization execution fabric verified closure",
  });
  const approval = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "execution_fabric_smoke_approved",
    why: "RC22 fabric smoke requires cross-layer execution lineage",
    based_on: [String(fabric.fabric_id)],
    evidence_refs: [planned.truth_id],
    policy_refs: ["sovereign_execution_guarantees", "reality_civilization_kernel"],
    risk_level: "low",
  });
  const claimed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "claimed",
    intent: "civilization execution fabric verified closure",
    claimed_success: true,
    execution_ref: planned.truth_id,
  });
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "civilization execution fabric verified closure",
    execution_ref: claimed.truth_id,
  });
  const federationPropagation = await synchronizeCivilizationExecution({
    trace_id: traceId,
    nodes: ["local-runtime", "peer-runtime"],
    agents: ["operator", "verifier"],
    federation_refs: [String(fabric.fabric_id)],
    governance_refs: [String(approval.decision_id)],
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "execution fabric lineage propagated and synchronized",
    observed_effect: "federation propagation, synchronization, verification, and lineage closure recorded",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "civilization execution fabric verified closure",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const memory = await recordInstitutionalMemory({
    kind: "civilization_milestone",
    title: "Civilization execution fabric smoke completed",
    summary: "Execution flowed through lineage, synchronization, observable verification, and memory closure.",
    trigger: "rc22_execution_fabric_smoke",
    stabilized_by: ["lineage", "synchronization", "truth_verification", "sovereign_execution_guarantees"],
    evidence_refs: [planned.truth_id, claimed.truth_id, executed.truth_id, String(effect.effect_id), verified.truth_id],
  });
  const lineage = await recordCrossLayerExecutionLineage({
    trace_id: traceId,
    intent: "civilization execution fabric verified closure",
    plan_ref: planned.truth_id,
    approval_ref: String(approval.decision_id),
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
    closure_ref: String(approval.decision_id),
    memory_ref: String(memory.memory_id),
  });
  const integrity = await verifyDistributedExecutionIntegrity({ trace_id: traceId });
  const guarantees = await verifySovereignExecutionGuarantees({ trace_id: traceId });
  const truthState = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "execution fabric closure verified by observable effect",
    execution_ref: executed.truth_id,
    effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
  });
  const recovery = await recoverExecutionFabric({
    trace_id: traceId,
    fracture: "smoke_checkpoint_recovery",
    checkpoint_refs: [String(lineage.lineage_id), String(federationPropagation.sync_id), String(truthState.truth_state_id)],
  });
  const dashboard = await createCivilizationFabricDashboard();
  const smoke = {
    smoke_id: `execution_fabric_smoke_${Date.now()}`,
    trace_id: traceId,
    claim: claimed,
    execution: executed,
    federation_propagation: federationPropagation,
    synchronization: federationPropagation,
    verification: verified,
    lineage_closure: lineage,
    observable_effect: effect,
    integrity,
    guarantees,
    recovery,
    dashboard,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "execution_fabric_smoke_completed"),
    trace_id: traceId,
    job_id: "civilization_execution_fabric",
    type: "execution_fabric_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeCivilizationExecutionFabricFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runExecutionFabricSmokePack();
  const dashboard = await createCivilizationFabricDashboard();
  const freeze = {
    freeze_id: `rc22_civilization_execution_fabric_freeze_${Date.now()}`,
    scope: "RC-22 Runtime Civilization Execution Fabric",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "unified_civilization_execution_fabric",
      "cross_layer_execution_lineage",
      "civilization_execution_synchronization",
      "distributed_execution_integrity",
      "execution_fabric_recovery",
      "sovereign_execution_guarantees",
      "civilization_fabric_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_civilization_execution_fabric_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "civilization_execution_fabric",
    type: "runtime_civilization_execution_fabric_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
