import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord, readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { openIncident, resolveIncident } from "../incidents/runtime-incident-command.js";
import { writeCulturalMemory } from "../knowledge/runtime-cultural-memory.js";
import {
  arbitrateCognitivePriority,
  createCognitiveMissionControlDashboard,
  type CognitiveSignal,
} from "./cognitive-coordination.js";
import { calculateRuntimeStabilityScore } from "./coordination-runtime.js";
import { generatePredictiveIncidentForecast } from "./intelligence-operations.js";
import { recordGovernanceDecision } from "./governance-operations.js";

export type LongHorizonMemoryKind =
  | "incident"
  | "recovery"
  | "strategic_shift"
  | "operator_intervention"
  | "federation_crisis"
  | "autonomy_regression";
export type CognitivePatternKind = "repeated_failures" | "approval_bottleneck" | "recovery_loop" | "security_regression";
export type StrategicAnchorKind = "critical_incident" | "major_freeze" | "federation_split" | "recovery_milestone";
export type StabilityHorizon = "hours" | "days" | "weeks";

export interface LongHorizonMemoryEntry {
  memory_id: string;
  kind: LongHorizonMemoryKind;
  trace_id: string;
  title: string;
  summary: string;
  impact: "low" | "medium" | "high" | "critical";
  lessons: string[];
  evidence_refs: string[];
  created_at: string;
}

export interface RuntimeExperienceLesson {
  lesson_id: string;
  pattern: string;
  heuristic: string;
  confidence: "low" | "medium" | "high";
  evidence_refs: string[];
}

export interface CognitivePattern {
  pattern_id: string;
  kind: CognitivePatternKind;
  severity: "low" | "medium" | "high" | "critical";
  count: number;
  evidence_refs: string[];
  recommendation: string;
  detected_at: string;
}

export interface StrategicMemoryAnchor {
  anchor_id: string;
  kind: StrategicAnchorKind;
  trace_id: string;
  title: string;
  reason: string;
  evidence_refs: string[];
  anchored_at: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const MEMORY_DIR = path.join(DATA_DIR, "mission-control", "cognitive-memory");
const LEDGER_PATH = path.join(MEMORY_DIR, "long-horizon-memory.jsonl");
const LESSONS_PATH = path.join(MEMORY_DIR, "experience-lessons.jsonl");
const PATTERNS_PATH = path.join(MEMORY_DIR, "cognitive-patterns.jsonl");
const ANCHORS_PATH = path.join(MEMORY_DIR, "strategic-anchors.jsonl");
const NARRATIVES_PATH = path.join(MEMORY_DIR, "cognitive-narratives.jsonl");
const FREEZE_PATH = path.join(DATA_DIR, "civilization", "runtime-cognitive-memory-freeze.json");

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

function severityFromCount(count: number): CognitivePattern["severity"] {
  return count >= 12 ? "critical" : count >= 8 ? "high" : count >= 4 ? "medium" : "low";
}

export async function recordLongHorizonMemory(input: {
  kind: LongHorizonMemoryKind;
  trace_id: string;
  title: string;
  summary: string;
  impact?: LongHorizonMemoryEntry["impact"];
  lessons?: string[];
  evidence_refs?: string[];
}): Promise<LongHorizonMemoryEntry> {
  const entry: LongHorizonMemoryEntry = {
    memory_id: `lh_memory_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    trace_id: input.trace_id,
    title: input.title,
    summary: input.summary,
    impact: input.impact || "medium",
    lessons: input.lessons || [],
    evidence_refs: input.evidence_refs || [input.trace_id],
    created_at: new Date().toISOString(),
  };
  appendJsonl(LEDGER_PATH, entry as unknown as Record<string, unknown>);
  writeCulturalMemory(input.kind === "recovery" ? "recovery_story" : "lesson", input.title, input.summary, input.trace_id);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(entry.memory_id, "long_horizon_memory_recorded"),
    trace_id: input.trace_id,
    job_id: "cognitive_memory",
    type: "long_horizon_memory_recorded",
    timestamp: entry.created_at,
    payload: entry as unknown as Record<string, unknown>,
  });
  return entry;
}

export async function compressRuntimeExperience(limit = 500): Promise<{ compression_id: string; generated_at: string; source_events: number; lessons: RuntimeExperienceLesson[] }> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-limit);
  const failures = records.filter((record) => record.type.includes("failed") || record.type.includes("blocked"));
  const approvals = records.filter((record) => record.type.includes("approval"));
  const recoveries = records.filter((record) => record.type.includes("recovery") || record.type.includes("resolved"));
  const freezes = records.filter((record) => record.type.includes("freeze_created"));
  const lessons: RuntimeExperienceLesson[] = [];
  if (failures.length) lessons.push({
    lesson_id: `lesson_failures_${Date.now()}`,
    pattern: "failure_pressure",
    heuristic: "When blocked or failed events cluster, reduce autonomy and increase approval visibility.",
    confidence: failures.length >= 8 ? "high" : "medium",
    evidence_refs: failures.slice(-10).map((record) => record.evidence_id),
  });
  if (approvals.length >= 5) lessons.push({
    lesson_id: `lesson_approvals_${Date.now()}`,
    pattern: "approval_bottleneck",
    heuristic: "Pending approvals should be surfaced before autonomous actions expand.",
    confidence: approvals.length >= 12 ? "high" : "medium",
    evidence_refs: approvals.slice(-10).map((record) => record.evidence_id),
  });
  if (recoveries.length) lessons.push({
    lesson_id: `lesson_recovery_${Date.now()}`,
    pattern: "recovery_success",
    heuristic: "Successful recovery paths should be preferred during degraded stability.",
    confidence: recoveries.length >= 5 ? "high" : "medium",
    evidence_refs: recoveries.slice(-10).map((record) => record.evidence_id),
  });
  if (freezes.length) lessons.push({
    lesson_id: `lesson_freeze_${Date.now()}`,
    pattern: "freeze_anchor",
    heuristic: "Major freezes are strategic anchors and should bias future coordination toward auditability.",
    confidence: "high",
    evidence_refs: freezes.slice(-10).map((record) => record.evidence_id),
  });
  for (const lesson of lessons) appendJsonl(LESSONS_PATH, lesson as unknown as Record<string, unknown>);
  const result = {
    compression_id: `experience_compression_${Date.now()}`,
    generated_at: new Date().toISOString(),
    source_events: records.length,
    lessons,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.compression_id, "runtime_experience_compressed"),
    trace_id: result.compression_id,
    job_id: "cognitive_memory",
    type: "runtime_experience_compressed",
    timestamp: result.generated_at,
    payload: { source_events: result.source_events, lessons: lessons.length },
  });
  return result;
}

export async function recognizeCognitivePatterns(limit = 500): Promise<CognitivePattern[]> {
  const records = readEvidenceRecords({ order: "asc" }).slice(-limit);
  const candidates: Array<{ kind: CognitivePatternKind; records: typeof records; recommendation: string }> = [
    {
      kind: "repeated_failures",
      records: records.filter((record) => record.type.includes("failed") || record.type.includes("blocked")),
      recommendation: "Reduce concurrency and route failures through recovery playbooks.",
    },
    {
      kind: "approval_bottleneck",
      records: records.filter((record) => record.type.includes("approval") && !record.type.includes("closed")),
      recommendation: "Escalate pending approvals and simplify low-risk approval surfaces.",
    },
    {
      kind: "recovery_loop",
      records: records.filter((record) => record.type.includes("recovery") || record.type.includes("restart")),
      recommendation: "Checkpoint recovery paths and prefer proven recovery sequences.",
    },
    {
      kind: "security_regression",
      records: records.filter((record) => record.type.includes("security") || record.type.includes("secret") || record.type.includes("threat")),
      recommendation: "Increase security review and freeze risky autonomous zones.",
    },
  ];
  const patterns = candidates
    .filter((candidate) => candidate.records.length > 0)
    .map((candidate) => ({
      pattern_id: `cog_pattern_${candidate.kind}_${Date.now()}`,
      kind: candidate.kind,
      severity: severityFromCount(candidate.records.length),
      count: candidate.records.length,
      evidence_refs: candidate.records.slice(-12).map((record) => record.evidence_id),
      recommendation: candidate.recommendation,
      detected_at: new Date().toISOString(),
    }));
  for (const pattern of patterns) {
    appendJsonl(PATTERNS_PATH, pattern as unknown as Record<string, unknown>);
    await appendEvidenceRecord({
      evidence_id: hashTraceId(pattern.pattern_id, "cognitive_pattern_recognized"),
      trace_id: pattern.pattern_id,
      job_id: "cognitive_memory",
      type: "cognitive_pattern_recognized",
      timestamp: pattern.detected_at,
      payload: pattern as unknown as Record<string, unknown>,
    });
  }
  return patterns;
}

export async function createStrategicMemoryAnchor(input: {
  kind: StrategicAnchorKind;
  trace_id: string;
  title: string;
  reason: string;
  evidence_refs?: string[];
}): Promise<StrategicMemoryAnchor> {
  const anchor: StrategicMemoryAnchor = {
    anchor_id: `memory_anchor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    trace_id: input.trace_id,
    title: input.title,
    reason: input.reason,
    evidence_refs: input.evidence_refs || [input.trace_id],
    anchored_at: new Date().toISOString(),
  };
  appendJsonl(ANCHORS_PATH, anchor as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(anchor.anchor_id, "strategic_memory_anchor_created"),
    trace_id: input.trace_id,
    job_id: "cognitive_memory",
    type: "strategic_memory_anchor_created",
    timestamp: anchor.anchored_at,
    payload: anchor as unknown as Record<string, unknown>,
  });
  return anchor;
}

export async function generateLongTermStabilityForecast(): Promise<Record<string, unknown>> {
  const stability = await calculateRuntimeStabilityScore();
  const patterns = readJsonl<CognitivePattern>(PATTERNS_PATH).slice(-20);
  const predictive = await generatePredictiveIncidentForecast();
  const riskPressure = patterns.reduce((sum, pattern) => sum + (pattern.severity === "critical" ? 4 : pattern.severity === "high" ? 3 : pattern.severity === "medium" ? 2 : 1), 0);
  const predictionPressure = predictive.predictions.reduce((sum, prediction) => sum + prediction.probability, 0);
  const baseRisk = Math.max(0, 100 - stability.score) + riskPressure * 2 + predictionPressure * 10;
  const horizons = (["hours", "days", "weeks"] as StabilityHorizon[]).map((horizon, index) => {
    const risk_score = Math.min(100, Math.round(baseRisk + index * 8));
    return {
      horizon,
      risk_score,
      stability: risk_score >= 70 ? "critical" : risk_score >= 45 ? "degraded" : "stable",
      drivers: patterns.slice(-5).map((pattern) => pattern.kind),
    };
  });
  const forecast = {
    forecast_id: `long_term_stability_${Date.now()}`,
    generated_at: new Date().toISOString(),
    current_stability: stability,
    horizons,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(forecast.forecast_id), "long_term_stability_forecast_generated"),
    trace_id: String(forecast.forecast_id),
    job_id: "cognitive_memory",
    type: "long_term_stability_forecast_generated",
    timestamp: forecast.generated_at,
    payload: forecast as unknown as Record<string, unknown>,
  });
  return forecast;
}

export async function generateRuntimeCognitiveNarrative(traceId?: string): Promise<Record<string, unknown>> {
  const memories = readJsonl<LongHorizonMemoryEntry>(LEDGER_PATH).slice(-20);
  const patterns = readJsonl<CognitivePattern>(PATTERNS_PATH).slice(-10);
  const anchors = readJsonl<StrategicMemoryAnchor>(ANCHORS_PATH).slice(-10);
  const forecast = await generateLongTermStabilityForecast();
  const narrative = {
    narrative_id: `cognitive_narrative_${Date.now()}`,
    generated_at: new Date().toISOString(),
    trace_id: traceId,
    what_happened: memories.length ? memories.map((memory) => memory.title).join("; ") : "No long-horizon memories recorded yet",
    why: patterns.length ? patterns.map((pattern) => `${pattern.kind}:${pattern.count}`).join("; ") : "No recurring cognitive pattern detected",
    impact: memories.some((memory) => memory.impact === "critical" || memory.impact === "high") ? "high" : "normal",
    lessons: readJsonl<RuntimeExperienceLesson>(LESSONS_PATH).slice(-8),
    future_risk: forecast,
    anchors,
  };
  appendJsonl(NARRATIVES_PATH, narrative as unknown as Record<string, unknown>);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(narrative.narrative_id), "runtime_cognitive_narrative_generated"),
    trace_id: traceId || String(narrative.narrative_id),
    job_id: "cognitive_memory",
    type: "runtime_cognitive_narrative_generated",
    timestamp: String(narrative.generated_at),
    payload: { narrative_id: narrative.narrative_id, memories: memories.length, patterns: patterns.length, anchors: anchors.length },
  });
  return narrative;
}

export async function generateExperienceAwareCoordination(): Promise<Record<string, unknown>> {
  const patterns = await recognizeCognitivePatterns();
  const lessons = await compressRuntimeExperience();
  const signals: CognitiveSignal[] = patterns.slice(0, 4).map((pattern) => ({
    layer: pattern.kind === "security_regression" ? "security" : pattern.kind === "recovery_loop" ? "recovery" : pattern.kind === "approval_bottleneck" ? "governance" : "execution",
    intent: pattern.kind === "security_regression" ? "protect" : pattern.kind === "recovery_loop" ? "recover" : pattern.kind === "approval_bottleneck" ? "coordinate" : "stabilize",
    priority: pattern.kind === "security_regression" ? "security" : pattern.kind === "recovery_loop" ? "recovery" : pattern.kind === "approval_bottleneck" ? "governance" : "survival",
    reason: pattern.recommendation,
    risk: pattern.severity === "critical" ? "critical" : pattern.severity === "high" ? "high" : pattern.severity === "medium" ? "medium" : "low",
    evidence_refs: pattern.evidence_refs,
  }));
  const arbitration = await arbitrateCognitivePriority(signals);
  const result = {
    coordination_id: `experience_coordination_${Date.now()}`,
    generated_at: new Date().toISOString(),
    lessons,
    patterns,
    recommendation: signals.length ? arbitration : { selected: "coordinate", reason: "no strong historical pattern" },
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.coordination_id, "experience_aware_coordination_generated"),
    trace_id: result.coordination_id,
    job_id: "cognitive_memory",
    type: "experience_aware_coordination_generated",
    timestamp: result.generated_at,
    payload: { lessons: lessons.lessons.length, patterns: patterns.length },
  });
  return result;
}

export async function createCognitiveMemoryDashboard(): Promise<Record<string, unknown>> {
  const dashboard = {
    dashboard_id: `cognitive_memory_dashboard_${Date.now()}`,
    generated_at: new Date().toISOString(),
    patterns: readJsonl<CognitivePattern>(PATTERNS_PATH).slice(-25),
    lessons: readJsonl<RuntimeExperienceLesson>(LESSONS_PATH).slice(-25),
    anchors: readJsonl<StrategicMemoryAnchor>(ANCHORS_PATH).slice(-25),
    forecasts: readEvidenceRecords({ type: "long_term_stability_forecast_generated" }).slice(0, 10),
    narratives: readJsonl<Record<string, unknown>>(NARRATIVES_PATH).slice(-10),
    coordination: await createCognitiveMissionControlDashboard(),
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "cognitive_memory_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "cognitive_memory",
    type: "cognitive_memory_dashboard_viewed",
    timestamp: dashboard.generated_at,
    payload: {
      patterns: dashboard.patterns.length,
      lessons: dashboard.lessons.length,
      anchors: dashboard.anchors.length,
      narratives: dashboard.narratives.length,
    },
  });
  return dashboard;
}

export async function runLongHorizonSmokePack(): Promise<Record<string, unknown>> {
  const incident = await openIncident("RC13 cognitive memory smoke incident", "Long-horizon memory test incident", ["cognitive_memory"], "high");
  await resolveIncident(incident.incident_id);
  const memory = await recordLongHorizonMemory({
    kind: "incident",
    trace_id: incident.incident_id,
    title: "RC13 smoke incident remembered",
    summary: "Incident was recorded into long-horizon cognitive memory.",
    impact: "high",
    lessons: ["Record operational incidents as durable memory", "Use incidents as future pattern evidence"],
    evidence_refs: [incident.incident_id],
  });
  const anchor = await createStrategicMemoryAnchor({
    kind: "critical_incident",
    trace_id: incident.incident_id,
    title: "RC13 smoke anchor",
    reason: "Incident-to-memory path verified",
    evidence_refs: [memory.memory_id],
  });
  const compression = await compressRuntimeExperience();
  const patterns = await recognizeCognitivePatterns();
  const forecast = await generateLongTermStabilityForecast();
  const recommendation = await generateExperienceAwareCoordination();
  const narrative = await generateRuntimeCognitiveNarrative(incident.incident_id);
  const closure = await recordGovernanceDecision({
    trace_id: incident.incident_id,
    decision: "long_horizon_memory_closed",
    why: "Incident recorded, compressed into patterns, forecasted, and converted into coordination recommendation",
    based_on: [memory.memory_id, anchor.anchor_id],
    evidence_refs: [memory.memory_id, anchor.anchor_id],
    policy_refs: ["runtime_cognitive_memory"],
    risk_level: "low",
  });
  const smoke = {
    smoke_id: `long_horizon_smoke_${Date.now()}`,
    incident,
    memory,
    anchor,
    compression,
    patterns,
    forecast,
    recommendation,
    narrative,
    closure,
  };
  await appendEvidenceRecord({
    evidence_id: hashTraceId(smoke.smoke_id, "long_horizon_smoke_completed"),
    trace_id: incident.incident_id,
    job_id: "cognitive_memory",
    type: "long_horizon_smoke_completed",
    timestamp: new Date().toISOString(),
    payload: { memory: memory.memory_id, patterns: patterns.length, forecast: forecast.forecast_id },
  });
  return smoke;
}

export async function createRuntimeCognitiveMemoryFreeze(): Promise<Record<string, unknown>> {
  const smoke = await runLongHorizonSmokePack();
  const dashboard = await createCognitiveMemoryDashboard();
  const freeze = {
    freeze_id: `rc13_cognitive_memory_freeze_${Date.now()}`,
    scope: "RC-13 Runtime Memory & Long-Horizon Cognition",
    status: "frozen",
    created_at: new Date().toISOString(),
    path: FREEZE_PATH,
    smoke,
    dashboard,
    capabilities: [
      "long_horizon_memory_ledger",
      "runtime_experience_compression",
      "cognitive_pattern_recognition",
      "strategic_memory_anchors",
      "long_term_stability_forecasting",
      "runtime_cognitive_narratives",
      "experience_aware_coordination",
      "cognitive_memory_dashboard",
    ],
  };
  writeJson(FREEZE_PATH, freeze);
  await appendEvidenceRecord({
    evidence_id: hashTraceId(String(freeze.freeze_id), "runtime_cognitive_memory_freeze_created"),
    trace_id: String(freeze.freeze_id),
    job_id: "cognitive_memory",
    type: "runtime_cognitive_memory_freeze_created",
    timestamp: String(freeze.created_at),
    payload: freeze as unknown as Record<string, unknown>,
  });
  return freeze;
}
