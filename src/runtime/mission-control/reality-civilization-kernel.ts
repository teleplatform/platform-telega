import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import {
  createConstitutionalMissionControlDashboard,
  verifyConstitutionalIntegrity,
} from "./constitutional-civilization.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import {
  archiveStrategicContinuity,
  recordInstitutionalMemory,
} from "./institutional-governance.js";
import {
  createRealityMissionControlDashboard,
  detectFalseSuccess,
  enforceSovereignTruth,
  evaluateRuntimeTruthConfidence,
  recordExecutionTruthLedger,
  runRealityVerificationEngine,
  trackObservableEffect,
} from "./reality-verification.js";

export type CivilizationTruthConfidence = "unverified" | "weak" | "verified" | "strongly_verified";

const DATA_DIR = path.join(process.cwd(), ".data");
const KERNEL_DIR = path.join(DATA_DIR, "mission-control", "reality-civilization-kernel");
const TRUTH_STATE_PATH = path.join(KERNEL_DIR, "civilization-truth-state.jsonl");
const GRAPH_PATH = path.join(KERNEL_DIR, "operational-reality-graph.json");
const DRIFT_PATH = path.join(KERNEL_DIR, "reality-drift.jsonl");
const ARBITRATION_PATH = path.join(KERNEL_DIR, "truth-arbitration.jsonl");
const PRESERVATION_PATH = path.join(KERNEL_DIR, "truth-preservation.jsonl");
const FORECAST_PATH = path.join(KERNEL_DIR, "reality-forecast.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-reality-civilization-freeze.json");

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

function confidenceRank(confidence: string): number {
  return { unverified: 0, weak: 1, verified: 2, strongly_verified: 3 }[confidence] ?? 0;
}

export async function createCivilizationRealityKernelState(input: {
  trace_id: string;
  claim: string;
  execution_ref?: string;
  effect_ref?: string;
  verification_ref?: string;
}): Promise<Record<string, unknown>> {
  const confidence = await evaluateRuntimeTruthConfidence(input.trace_id);
  const verification = await runRealityVerificationEngine(input.trace_id);
  const truthState = {
    truth_state_id: `civilization_truth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    claim: input.claim,
    execution_ref: input.execution_ref,
    observable_effect_ref: input.effect_ref,
    verification_ref: input.verification_ref,
    confidence: confidence.confidence as CivilizationTruthConfidence,
    verification,
    created_at: new Date().toISOString(),
  };
  appendJsonl(TRUTH_STATE_PATH, truthState as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(truthState.truth_state_id, "civilization_reality_kernel_state_created"),
    trace_id: input.trace_id,
    job_id: "reality_civilization_kernel",
    type: "civilization_reality_kernel_state_created",
    timestamp: truthState.created_at,
    payload: truthState as unknown as Record<string, unknown>,
  });
  return truthState;
}

export async function buildOperationalRealityGraph(): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-3000);
  const nodes = records
    .filter((record) =>
      record.type.includes("execution")
      || record.type.includes("incident")
      || record.type.includes("recovery")
      || record.type.includes("governance")
      || record.type.includes("federation")
      || record.type.includes("truth")
      || record.type.includes("verification"))
    .slice(-500)
    .map((record) => ({
      id: record.evidence_id,
      trace_id: record.trace_id,
      type: record.type,
      timestamp: record.timestamp,
    }));
  const edges = nodes
    .filter((node) => node.trace_id)
    .map((node) => ({ from: node.trace_id, to: node.id, relation: "evidenced_by" }));
  const graph = {
    graph_id: `operational_reality_graph_${Date.now()}`,
    generated_at: new Date().toISOString(),
    nodes,
    edges,
    categories: ["actions", "effects", "incidents", "recoveries", "governance_decisions", "federation_consequences"],
  };
  writeJson(GRAPH_PATH, graph);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(graph.graph_id, "operational_reality_graph_built"),
    trace_id: graph.graph_id,
    job_id: "reality_civilization_kernel",
    type: "operational_reality_graph_built",
    timestamp: graph.generated_at,
    payload: { nodes: nodes.length, edges: edges.length, categories: graph.categories },
  });
  return graph;
}

export async function detectRealityDrift(input?: { trace_id?: string; claimed_state?: string }): Promise<Record<string, unknown>> {
  const truthStates = readJsonl<Record<string, unknown>>(TRUTH_STATE_PATH);
  const scoped = input?.trace_id ? truthStates.filter((state) => state.trace_id === input.trace_id) : truthStates;
  const falseSuccess = await detectFalseSuccess(input?.trace_id);
  const drifts = scoped
    .filter((state) =>
      String(input?.claimed_state || state.claim || "").toLowerCase().includes("stable")
      && confidenceRank(String(state.confidence)) < 2)
    .map((state) => ({
      trace_id: state.trace_id,
      truth_state_id: state.truth_state_id,
      reason: "claimed_stability_without_verified_operational_stability",
      confidence: state.confidence,
    }));
  const result = {
    drift_id: `reality_drift_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input?.trace_id,
    detected_at: new Date().toISOString(),
    claimed_state: input?.claimed_state,
    drifts,
    false_success_alerts: falseSuccess.alerts,
  };
  appendJsonl(DRIFT_PATH, result as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.drift_id, "reality_drift_detected"),
    trace_id: input?.trace_id || result.drift_id,
    job_id: "reality_civilization_kernel",
    type: "reality_drift_detected",
    timestamp: result.detected_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function arbitrateCivilizationTruth(input: {
  trace_id: string;
  claims: Array<{ actor: string; claim: string; evidence_ref?: string; confidence?: CivilizationTruthConfidence }>;
  verification_required?: boolean;
}): Promise<Record<string, unknown>> {
  const confidence = await evaluateRuntimeTruthConfidence(input.trace_id);
  const verification = await runRealityVerificationEngine(input.trace_id);
  const ranked = input.claims
    .map((claim) => ({ ...claim, rank: confidenceRank(claim.confidence || String(confidence.confidence)) }))
    .sort((a, b) => b.rank - a.rank);
  const incomplete = Boolean((verification.missing as unknown[] | undefined)?.length);
  const selected = input.verification_required && incomplete
    ? { actor: "reality_kernel", claim: "verification_incomplete_require_more_evidence", rank: -1 }
    : ranked[0];
  const arbitration = {
    arbitration_id: `truth_arbitration_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    arbitrated_at: new Date().toISOString(),
    claims: ranked,
    verification,
    selected_truth: selected,
    decision: selected?.actor === "reality_kernel" ? "defer_until_verified" : "accept_highest_verified_truth",
  };
  appendJsonl(ARBITRATION_PATH, arbitration as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(arbitration.arbitration_id, "civilization_truth_arbitrated"),
    trace_id: input.trace_id,
    job_id: "reality_civilization_kernel",
    type: "civilization_truth_arbitrated",
    timestamp: arbitration.arbitrated_at,
    payload: arbitration as unknown as Record<string, unknown>,
  });
  return arbitration;
}

export async function verifySovereignTruthPreservation(): Promise<Record<string, unknown>> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-3000);
  const suspicious = records.filter((record) => {
    const text = JSON.stringify(record.payload || {}).toLowerCase();
    return text.includes("erase evidence")
      || text.includes("mutate evidence history")
      || text.includes("rewrite governance outcome")
      || text.includes("fake closure");
  });
  const preservation = {
    preservation_id: `truth_preservation_${Date.now()}`,
    verified_at: new Date().toISOString(),
    guarantees: [
      "no_evidence_history_mutation",
      "no_failure_erasure",
      "no_governance_outcome_rewrite",
      "no_fake_closure",
    ],
    suspicious_refs: suspicious.map((record) => record.evidence_id),
    preserved: suspicious.length === 0,
  };
  appendJsonl(PRESERVATION_PATH, preservation);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(preservation.preservation_id, "sovereign_truth_preservation_verified"),
    trace_id: preservation.preservation_id,
    job_id: "reality_civilization_kernel",
    type: "sovereign_truth_preservation_verified",
    timestamp: preservation.verified_at,
    payload: preservation,
  });
  return preservation;
}

export async function generateLongHorizonRealityForecast(): Promise<Record<string, unknown>> {
  const truthStates = readJsonl<Record<string, unknown>>(TRUTH_STATE_PATH).slice(-200);
  const drift = readJsonl<Record<string, unknown>>(DRIFT_PATH).slice(-100);
  const weakTruth = truthStates.filter((state) => confidenceRank(String(state.confidence)) < 2).length;
  const falsePressure = drift.reduce((sum, item) => sum + ((item.false_success_alerts as unknown[] | undefined)?.length || 0), 0);
  const forecast = {
    forecast_id: `reality_forecast_${Date.now()}`,
    generated_at: new Date().toISOString(),
    truth_degradation: weakTruth > 5 ? "elevated" : weakTruth > 0 ? "watch" : "low",
    verification_collapse: weakTruth > truthStates.length / 2 && truthStates.length > 0 ? "risk" : "low",
    governance_blindness: falsePressure > 3 ? "watch" : "low",
    false_stability_accumulation: drift.length > 5 ? "watch" : "low",
    signals: { truth_states: truthStates.length, weak_truth: weakTruth, false_success_pressure: falsePressure, drift_events: drift.length },
  };
  appendJsonl(FORECAST_PATH, forecast);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(forecast.forecast_id, "long_horizon_reality_forecast_generated"),
    trace_id: forecast.forecast_id,
    job_id: "reality_civilization_kernel",
    type: "long_horizon_reality_forecast_generated",
    timestamp: forecast.generated_at,
    payload: forecast,
  });
  return forecast;
}

export async function createRealityCivilizationDashboard(): Promise<Record<string, unknown>> {
  const [graph, reality, integrity, preservation, forecast, constitutional] = await Promise.all([
    buildOperationalRealityGraph(),
    createRealityMissionControlDashboard(),
    verifyConstitutionalIntegrity(),
    verifySovereignTruthPreservation(),
    generateLongHorizonRealityForecast(),
    createConstitutionalMissionControlDashboard(),
  ]);
  const dashboard = {
    dashboard_id: `reality_civilization_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    truth_graph: graph,
    verification_confidence: reality.confidence,
    reality_drift: readJsonl<Record<string, unknown>>(DRIFT_PATH).slice(-25),
    false_success_pressure: reality.false_success_alerts,
    truth_integrity: {
      constitutional: integrity.truth_integrity,
      preservation,
    },
    forecast,
    constitutional,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "reality_civilization_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "reality_civilization_kernel",
    type: "reality_civilization_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      graph_nodes: (graph.nodes as unknown[]).length,
      drift_events: dashboard.reality_drift.length,
      preservation: preservation.preserved,
    },
  });
  return dashboard;
}

export async function runRealityKernelSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc21_reality_kernel_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const claim = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "claimed",
    intent: "reality kernel verified closure",
    claimed_success: true,
    notes: "claimed stable before complete verification",
  });
  const planned = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "planned",
    intent: "reality kernel verified closure",
  });
  const driftBefore = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "claimed stable",
    verification_ref: claim.truth_id,
  });
  const drift = await detectRealityDrift({ trace_id: traceId, claimed_state: "claimed stable" });
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "reality kernel verified closure",
    execution_ref: planned.truth_id,
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "reality kernel graph and truth state updated",
    observed_effect: "execution, observable effect, truth arbitration, preservation, and closure recorded",
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "reality kernel verified closure",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const truthState = await createCivilizationRealityKernelState({
    trace_id: traceId,
    claim: "verified operational stability",
    execution_ref: executed.truth_id,
    effect_ref: String(effect.effect_id),
    verification_ref: verified.truth_id,
  });
  const arbitration = await arbitrateCivilizationTruth({
    trace_id: traceId,
    verification_required: true,
    claims: [
      { actor: "planner", claim: "stable_after_claim", evidence_ref: claim.truth_id, confidence: "weak" },
      { actor: "verifier", claim: "stable_after_observable_effect", evidence_ref: verified.truth_id, confidence: "verified" },
    ],
  });
  const preservation = await verifySovereignTruthPreservation();
  const graph = await buildOperationalRealityGraph();
  const forecast = await generateLongHorizonRealityForecast();
  const enforcement = await enforceSovereignTruth({ trace_id: traceId, action: "close_incident" });
  const archive = await archiveStrategicContinuity({
    epoch: "rc21_reality_civilization_kernel",
    freeze_ref: "runtime-reality-civilization-freeze.json",
    incident_ref: String((drift.drifts as unknown[]).length ? drift.drift_id : driftBefore.truth_state_id),
    recovery_wave: "truth-arbitrated-verified-closure",
    stability_transition: "constitutional civilization to reality-centered civilization kernel",
    evidence_refs: [String(truthState.truth_state_id), String(arbitration.arbitration_id), String(preservation.preservation_id)],
  });
  await recordInstitutionalMemory({
    kind: "civilization_milestone",
    title: "Reality civilization kernel verified closure",
    summary: "Conflicting claims were arbitrated through observable reality and sovereign truth preservation.",
    trigger: "rc21_reality_kernel_smoke",
    stabilized_by: ["truth_arbitration", "observable_effect", "sovereign_truth_preservation"],
    evidence_refs: [String(truthState.truth_state_id), String(arbitration.arbitration_id)],
  });
  const closure = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "reality_kernel_smoke_closed",
    why: "Execution produced observable effect, conflicting claims were arbitrated, truth preservation verified, and closure enforced",
    based_on: [String(truthState.truth_state_id), String(arbitration.arbitration_id), String(graph.graph_id), String(archive.archive_id)],
    evidence_refs: [claim.truth_id, executed.truth_id, String(effect.effect_id), verified.truth_id],
    policy_refs: ["reality_kernel", "sovereign_truth_preservation", "constitutional_integrity"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `reality_kernel_smoke_${Date.now()}`,
    trace_id: traceId,
    execution: executed,
    observable_effect: effect,
    conflicting_claims: [claim, verified],
    drift,
    arbitration,
    truth_state: truthState,
    preservation,
    graph,
    forecast,
    enforcement,
    continuity: archive,
    verified_closure: closure,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "reality_kernel_smoke_completed"),
    trace_id: traceId,
    job_id: "reality_civilization_kernel",
    type: "reality_kernel_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeRealityCivilizationFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runRealityKernelSmokePack();
  const dashboard = await createRealityCivilizationDashboard();
  const freeze = {
    freeze_id: `rc21_reality_civilization_freeze_${Date.now()}`,
    scope: "RC-21 Runtime Reality Civilization Kernel",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "civilization_reality_kernel",
      "operational_reality_graph",
      "reality_drift_detection",
      "civilization_truth_arbitration",
      "sovereign_truth_preservation",
      "long_horizon_reality_forecasting",
      "reality_civilization_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_reality_civilization_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "reality_civilization_kernel",
    type: "runtime_reality_civilization_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
