import type { ContextBuildParams, ContextBlock, ContextEntry } from "./context.types.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

function makeEntry(key: string, value: string, source: ContextBlock["source"], priority: number): ContextEntry {
  return { id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, key, value, source, priority, token_count: estimateTokens(value) };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface ContextSourceLoader {
  name: string;
  load(params: ContextBuildParams): Promise<ContextBlock>;
}

export async function loadUserContext(params: ContextBuildParams): Promise<ContextBlock> {
  const entries: ContextEntry[] = [
    makeEntry("user_id", params.user_id, "user", 90),
    makeEntry("surface", params.surface, "user", 70),
    makeEntry("intent", params.intent, "user", 60),
    makeEntry("risk_level", params.risk_level, "user", 50),
  ];

  const block: ContextBlock = { source: "user", entries, priority: 90, token_count: entries.reduce((s, e) => s + e.token_count, 0) };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(params.input_id, "context_source_loaded"),
    trace_id: params.input_id,
    job_id: "context",
    type: "context_source_loaded" as any,
    timestamp: new Date().toISOString(),
    payload: { source: "user", entry_count: entries.length },
  });

  return block;
}

export async function loadProjectContext(params: ContextBuildParams): Promise<ContextBlock> {
  const entries: ContextEntry[] = [
    makeEntry("route", params.route, "project", 80),
    makeEntry("input_id", params.input_id, "project", 30),
  ];

  const block: ContextBlock = { source: "project", entries, priority: 80, token_count: entries.reduce((s, e) => s + e.token_count, 0) };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(params.input_id, "context_source_loaded"),
    trace_id: params.input_id,
    job_id: "context",
    type: "context_source_loaded" as any,
    timestamp: new Date().toISOString(),
    payload: { source: "project", entry_count: entries.length },
  });

  return block;
}

export async function loadCanonContext(params: ContextBuildParams): Promise<ContextBlock> {
  const entries: ContextEntry[] = [
    makeEntry("content_preview", params.content.length > 100 ? params.content.slice(0, 100) + "..." : params.content, "canon", 70),
  ];

  const block: ContextBlock = { source: "canon", entries, priority: 70, token_count: entries.reduce((s, e) => s + e.token_count, 0) };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(params.input_id, "context_source_loaded"),
    trace_id: params.input_id,
    job_id: "context",
    type: "context_source_loaded" as any,
    timestamp: new Date().toISOString(),
    payload: { source: "canon", entry_count: entries.length },
  });

  return block;
}

export async function loadRunContext(params: ContextBuildParams): Promise<ContextBlock> {
  const entries: ContextEntry[] = [
    makeEntry("intent", params.intent, "run", 60),
    makeEntry("route", params.route, "run", 50),
  ];

  const block: ContextBlock = { source: "run", entries, priority: 60, token_count: entries.reduce((s, e) => s + e.token_count, 0) };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(params.input_id, "context_source_loaded"),
    trace_id: params.input_id,
    job_id: "context",
    type: "context_source_loaded" as any,
    timestamp: new Date().toISOString(),
    payload: { source: "run", entry_count: entries.length },
  });

  return block;
}

export async function loadEvidenceContext(params: ContextBuildParams): Promise<ContextBlock> {
  const entries: ContextEntry[] = [
    makeEntry("input_id", params.input_id, "evidence", 50),
    makeEntry("recent_activity", `Intent: ${params.intent}, Risk: ${params.risk_level}`, "evidence", 40),
  ];

  const block: ContextBlock = { source: "evidence", entries, priority: 50, token_count: entries.reduce((s, e) => s + e.token_count, 0) };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(params.input_id, "context_source_loaded"),
    trace_id: params.input_id,
    job_id: "context",
    type: "context_source_loaded" as any,
    timestamp: new Date().toISOString(),
    payload: { source: "evidence", entry_count: entries.length },
  });

  return block;
}

export async function loadCapabilityContext(params: ContextBuildParams): Promise<ContextBlock> {
  const entries: ContextEntry[] = [
    makeEntry("route", params.route, "capability", 40),
    makeEntry("intent", params.intent, "capability", 30),
  ];

  const block: ContextBlock = { source: "capability", entries, priority: 40, token_count: entries.reduce((s, e) => s + e.token_count, 0) };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(params.input_id, "context_source_loaded"),
    trace_id: params.input_id,
    job_id: "context",
    type: "context_source_loaded" as any,
    timestamp: new Date().toISOString(),
    payload: { source: "capability", entry_count: entries.length },
  });

  return block;
}

export async function loadSurfaceContext(params: ContextBuildParams): Promise<ContextBlock> {
  const entries: ContextEntry[] = [
    makeEntry("surface", params.surface, "surface", 30),
  ];

  const block: ContextBlock = { source: "surface", entries, priority: 30, token_count: entries.reduce((s, e) => s + e.token_count, 0) };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(params.input_id, "context_source_loaded"),
    trace_id: params.input_id,
    job_id: "context",
    type: "context_source_loaded" as any,
    timestamp: new Date().toISOString(),
    payload: { source: "surface", entry_count: entries.length },
  });

  return block;
}

export async function loadTemporaryContext(params: ContextBuildParams): Promise<ContextBlock> {
  const entries: ContextEntry[] = [
    makeEntry("content", params.content.length > 200 ? params.content.slice(0, 200) + "..." : params.content, "temporary", 20),
  ];

  const block: ContextBlock = { source: "temporary", entries, priority: 20, token_count: entries.reduce((s, e) => s + e.token_count, 0) };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(params.input_id, "context_source_loaded"),
    trace_id: params.input_id,
    job_id: "context",
    type: "context_source_loaded" as any,
    timestamp: new Date().toISOString(),
    payload: { source: "temporary", entry_count: entries.length },
  });

  return block;
}

export const CONTEXT_LOADERS: Array<{ name: string; load: (params: ContextBuildParams) => Promise<ContextBlock> }> = [
  { name: "user", load: loadUserContext },
  { name: "project", load: loadProjectContext },
  { name: "canon", load: loadCanonContext },
  { name: "run", load: loadRunContext },
  { name: "evidence", load: loadEvidenceContext },
  { name: "capability", load: loadCapabilityContext },
  { name: "surface", load: loadSurfaceContext },
  { name: "temporary", load: loadTemporaryContext },
];
