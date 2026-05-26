import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { recordGovernanceDecision } from "./governance-operations.js";
import { createSovereignMissionControlSurface, enforceSovereignBoundary } from "./sovereign-intelligence.js";

export type RealityStage = "planned" | "claimed" | "executed" | "verified";
export type TruthConfidence = "unverified" | "weak" | "verified" | "strongly_verified";

export interface ExecutionTruthLedgerEntry {
  truth_id: string;
  trace_id: string;
  stage: RealityStage;
  intent: string;
  execution_ref?: string;
  observable_effect_ref?: string;
  verification_ref?: string;
  claimed_success?: boolean;
  recorded_at: string;
  notes?: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const REALITY_DIR = path.join(DATA_DIR, "mission-control", "reality-verification");
const LEDGER_PATH = path.join(REALITY_DIR, "execution-truth-ledger.jsonl");
const EFFECTS_PATH = path.join(REALITY_DIR, "observable-effects.jsonl");
const ALERTS_PATH = path.join(REALITY_DIR, "false-success-alerts.jsonl");
const ENFORCEMENT_PATH = path.join(REALITY_DIR, "truth-enforcement.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-reality-verification-freeze.json");

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

function ledgerFor(traceId: string): ExecutionTruthLedgerEntry[] {
  return readJsonl<ExecutionTruthLedgerEntry>(LEDGER_PATH).filter((entry) => entry.trace_id === traceId);
}

function effectsFor(traceId: string): Array<Record<string, unknown>> {
  return readJsonl<Record<string, unknown>>(EFFECTS_PATH).filter((effect) => effect.trace_id === traceId);
}

export async function recordExecutionTruthLedger(input: {
  trace_id: string;
  stage: RealityStage;
  intent: string;
  execution_ref?: string;
  observable_effect_ref?: string;
  verification_ref?: string;
  claimed_success?: boolean;
  notes?: string;
}): Promise<ExecutionTruthLedgerEntry> {
  const entry: ExecutionTruthLedgerEntry = {
    truth_id: `truth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    stage: input.stage,
    intent: input.intent,
    execution_ref: input.execution_ref,
    observable_effect_ref: input.observable_effect_ref,
    verification_ref: input.verification_ref,
    claimed_success: input.claimed_success,
    recorded_at: new Date().toISOString(),
    notes: input.notes,
  };
  appendJsonl(LEDGER_PATH, entry as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(entry.truth_id, "execution_truth_ledger_recorded"),
    trace_id: entry.trace_id,
    job_id: "reality_verification",
    type: "execution_truth_ledger_recorded",
    timestamp: entry.recorded_at,
    payload: entry as unknown as Record<string, unknown>,
  });
  return entry;
}

export async function runRealityVerificationEngine(traceId: string): Promise<Record<string, unknown>> {
  const entries = ledgerFor(traceId);
  const stages = new Set(entries.map((entry) => entry.stage));
  const result = {
    verification_id: `reality_verification_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: traceId,
    verified_at: new Date().toISOString(),
    planned: stages.has("planned"),
    claimed: stages.has("claimed"),
    executed: stages.has("executed"),
    verified: stages.has("verified"),
    missing: (["planned", "claimed", "executed", "verified"] as RealityStage[]).filter((stage) => !stages.has(stage)),
    ledger_refs: entries.map((entry) => entry.truth_id),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.verification_id, "reality_verification_engine_ran"),
    trace_id: traceId,
    job_id: "reality_verification",
    type: "reality_verification_engine_ran",
    timestamp: result.verified_at,
    payload: result,
  });
  return result;
}

export async function trackObservableEffect(input: {
  trace_id: string;
  expected_effect: string;
  observed_effect: string;
  changed_reality: boolean;
  evidence_ref?: string;
}): Promise<Record<string, unknown>> {
  const effect = {
    effect_id: `observable_effect_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    expected_effect: input.expected_effect,
    observed_effect: input.observed_effect,
    changed_reality: input.changed_reality,
    evidence_ref: input.evidence_ref,
    tracked_at: new Date().toISOString(),
    verified: input.changed_reality && Boolean(input.observed_effect),
  };
  appendJsonl(EFFECTS_PATH, effect);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(effect.effect_id, "observable_effect_tracked"),
    trace_id: input.trace_id,
    job_id: "reality_verification",
    type: "observable_effect_tracked",
    timestamp: effect.tracked_at,
    payload: effect,
  });
  return effect;
}

export async function detectFalseSuccess(traceId?: string): Promise<Record<string, unknown>> {
  const entries = traceId ? ledgerFor(traceId) : readJsonl<ExecutionTruthLedgerEntry>(LEDGER_PATH);
  const grouped = new Map<string, ExecutionTruthLedgerEntry[]>();
  for (const entry of entries) grouped.set(entry.trace_id, [...(grouped.get(entry.trace_id) || []), entry]);
  const alerts = Array.from(grouped.entries())
    .filter(([, traceEntries]) => traceEntries.some((entry) => entry.claimed_success || entry.stage === "claimed"))
    .filter(([id, traceEntries]) => !traceEntries.some((entry) => entry.stage === "verified") && !effectsFor(id).some((effect) => effect.verified === true))
    .map(([id, traceEntries]) => ({
      alert_id: `false_success_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      trace_id: id,
      detected_at: new Date().toISOString(),
      reason: "reported_success_without_observable_effect",
      claimed_refs: traceEntries.filter((entry) => entry.claimed_success || entry.stage === "claimed").map((entry) => entry.truth_id),
    }));
  for (const alert of alerts) {
    appendJsonl(ALERTS_PATH, alert);
    await appendEvidenceRecord({
      evidence_id: hashTraceId(alert.alert_id, "false_success_detected"),
      trace_id: alert.trace_id,
      job_id: "reality_verification",
      type: "false_success_detected",
      timestamp: alert.detected_at,
      payload: alert,
    });
  }
  return {
    scan_id: `false_success_scan_${Date.now()}`,
    trace_id: traceId,
    detected_at: new Date().toISOString(),
    alerts,
  };
}

export async function evaluateRuntimeTruthConfidence(traceId: string): Promise<Record<string, unknown>> {
  const entries = ledgerFor(traceId);
  const effects = effectsFor(traceId);
  const evidence = readEvidenceRecords({ trace_id: traceId });
  const hasExecution = entries.some((entry) => entry.stage === "executed") || evidence.some((record) => record.type.includes("execution"));
  const hasEffect = effects.some((effect) => effect.verified === true);
  const hasVerification = entries.some((entry) => entry.stage === "verified") || evidence.some((record) => record.type === "reality_verification_engine_ran");
  const hasClosure = evidence.some((record) => record.type.includes("closure") || record.type === "governance_decision_ledger_recorded");
  const confidence: TruthConfidence = hasExecution && hasEffect && hasVerification && hasClosure
    ? "strongly_verified"
    : hasExecution && hasEffect && hasVerification
      ? "verified"
      : hasEffect || hasExecution
        ? "weak"
        : "unverified";
  const result = {
    confidence_id: `truth_confidence_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: traceId,
    evaluated_at: new Date().toISOString(),
    confidence,
    signals: {
      execution: hasExecution,
      observable_effect: hasEffect,
      verification: hasVerification,
      closure: hasClosure,
    },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.confidence_id, "runtime_truth_confidence_evaluated"),
    trace_id: traceId,
    job_id: "reality_verification",
    type: "runtime_truth_confidence_evaluated",
    timestamp: result.evaluated_at,
    payload: result,
  });
  return result;
}

export async function enforceSovereignTruth(input: {
  trace_id: string;
  action: "claim_success" | "close_incident" | "approve_replay";
}): Promise<Record<string, unknown>> {
  const confidence = await evaluateRuntimeTruthConfidence(input.trace_id);
  const entries = ledgerFor(input.trace_id);
  const effects = effectsFor(input.trace_id);
  const hasVerifiedEffect = effects.some((effect) => effect.verified === true) || entries.some((entry) => entry.stage === "verified");
  const hasExecutionEvidence = entries.some((entry) => entry.stage === "executed") || readEvidenceRecords({ trace_id: input.trace_id }).some((record) => record.type.includes("execution"));
  const violations: string[] = [];
  if (input.action === "claim_success" && !hasVerifiedEffect) violations.push("claim_success_without_verification");
  if (input.action === "close_incident" && !hasVerifiedEffect) violations.push("incident_closure_without_observable_resolution");
  if (input.action === "approve_replay" && !hasExecutionEvidence) violations.push("replay_approval_without_execution_evidence");
  const boundary = violations.length
    ? await enforceSovereignBoundary({
      action: `claim_without_evidence ${violations.join(" ")}`,
      actor: "reality_verification",
    })
    : undefined;
  const result = {
    enforcement_id: `truth_enforcement_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trace_id: input.trace_id,
    action: input.action,
    enforced_at: new Date().toISOString(),
    allowed: violations.length === 0,
    violations,
    confidence,
    boundary,
  };
  appendJsonl(ENFORCEMENT_PATH, result as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.enforcement_id, "sovereign_truth_enforced"),
    trace_id: input.trace_id,
    job_id: "reality_verification",
    type: "sovereign_truth_enforced",
    timestamp: result.enforced_at,
    payload: result as unknown as Record<string, unknown>,
  });
  return result;
}

export async function createRealityMissionControlDashboard(): Promise<Record<string, unknown>> {
  const ledger = readJsonl<ExecutionTruthLedgerEntry>(LEDGER_PATH);
  const effects = readJsonl<Record<string, unknown>>(EFFECTS_PATH);
  const alerts = readJsonl<Record<string, unknown>>(ALERTS_PATH);
  const enforcement = readJsonl<Record<string, unknown>>(ENFORCEMENT_PATH);
  const recentTrace = ledger.at(-1)?.trace_id;
  const confidence = recentTrace ? await evaluateRuntimeTruthConfidence(recentTrace) : undefined;
  const dashboard = {
    dashboard_id: `reality_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    execution_truth: ledger.slice(-50),
    verification_state: recentTrace ? await runRealityVerificationEngine(recentTrace) : undefined,
    false_success_alerts: alerts.slice(-25),
    observable_effects: effects.slice(-50),
    confidence,
    enforcement: enforcement.slice(-25),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "reality_mission_control_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "reality_verification",
    type: "reality_mission_control_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      truth_entries: ledger.length,
      effects: effects.length,
      alerts: alerts.length,
      confidence: confidence?.confidence,
    },
  });
  return dashboard;
}

export async function runRealityVerificationSmokePack(): Promise<Record<string, unknown>> {
  const traceId = `rc17_reality_smoke_${Date.now()}`;
  const planned = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "planned",
    intent: "verify runtime execution truth",
    notes: "RC17 planned stage",
  });
  const claimed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "claimed",
    intent: "verify runtime execution truth",
    claimed_success: true,
    notes: "Success claim before effect verification",
  });
  const falseSuccess = await detectFalseSuccess(traceId);
  const executed = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "executed",
    intent: "verify runtime execution truth",
    execution_ref: planned.truth_id,
  });
  const effect = await trackObservableEffect({
    trace_id: traceId,
    expected_effect: "observable truth ledger contains executed stage",
    observed_effect: `ledger stage recorded: ${executed.stage}`,
    changed_reality: true,
    evidence_ref: executed.truth_id,
  });
  const verified = await recordExecutionTruthLedger({
    trace_id: traceId,
    stage: "verified",
    intent: "verify runtime execution truth",
    execution_ref: executed.truth_id,
    observable_effect_ref: String(effect.effect_id),
    verification_ref: String(effect.effect_id),
    claimed_success: true,
  });
  const verification = await runRealityVerificationEngine(traceId);
  const confidence = await evaluateRuntimeTruthConfidence(traceId);
  const enforcement = await enforceSovereignTruth({ trace_id: traceId, action: "claim_success" });
  const closure = await recordGovernanceDecision({
    trace_id: traceId,
    decision: "reality_verification_smoke_closed",
    why: "Execution truth moved from planned claim to observable verified effect",
    based_on: [planned.truth_id, claimed.truth_id, executed.truth_id, String(effect.effect_id), verified.truth_id],
    evidence_refs: [planned.truth_id, executed.truth_id, String(effect.effect_id), verified.truth_id],
    policy_refs: ["evidence_before_claim", "sovereign_truth_enforcement", "runtime_reality_verification"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `reality_smoke_${Date.now()}`,
    trace_id: traceId,
    planned,
    claimed,
    false_success_detection: falseSuccess,
    executed,
    observable_effect: effect,
    verified,
    verification,
    confidence,
    enforcement,
    closure,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "reality_verification_smoke_completed"),
    trace_id: traceId,
    job_id: "reality_verification",
    type: "reality_verification_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: smoke as unknown as Record<string, unknown>,
  });
  return smoke;
}

export async function createRuntimeRealityVerificationFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runRealityVerificationSmokePack();
  const [dashboard, sovereign] = await Promise.all([
    createRealityMissionControlDashboard(),
    createSovereignMissionControlSurface(),
  ]);
  const freeze = {
    freeze_id: `rc17_reality_verification_freeze_${Date.now()}`,
    scope: "RC-17 Runtime Reality & Execution Verification Layer",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    sovereign_integrity: {
      identity: sovereign.identity,
      containment: sovereign.containment,
      integrity: sovereign.integrity,
    },
    capabilities: [
      "reality_verification_engine",
      "execution_truth_ledger",
      "observable_effect_tracking",
      "false_success_detection",
      "runtime_truth_confidence",
      "sovereign_truth_enforcement",
      "reality_mission_control_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_reality_verification_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "reality_verification",
    type: "runtime_reality_verification_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
