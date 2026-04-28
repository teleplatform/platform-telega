import type { ProviderId } from "./provider-resolution.js";
import { loadTraces, saveTraces, clearOldTraces, type StoredTrace } from "./persistence.js";

export type GovernanceDecision = {
  step: "resolve" | "rank" | "budget" | "role" | "creator" | "execute" | "fallback" | "final" | "session_transport" | "provider_final" | "web_transport";
  provider: ProviderId | null;
  model: string | null;
  decision: "selected" | "blocked" | "fallback_to" | "completed" | "success" | "failed" | "fallback_to_api" | "hard_fail" | "exception";
  reason: string;
  evidence?: string[];
  timestamp: number;
};

export type ExecutionTrace = {
  traceId: string;
  decisions: GovernanceDecision[];
  final: {
    provider: ProviderId;
    model: string;
    success: boolean;
    fallback_used: boolean;
    error_type?: string;
  } | null;
};

const MAX_TRACE_ENTRIES = 10000;
const traces: Map<string, ExecutionTrace> = new Map();
let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  
  const stored = loadTraces();
  for (const t of stored) {
    traces.set(t.traceId, {
      traceId: t.traceId,
      decisions: t.decisions.map(d => ({
        step: d.step as any,
        provider: d.provider as any,
        model: d.model,
        decision: d.decision as any,
        reason: d.reason,
        timestamp: d.timestamp,
      })),
      final: t.final ? {
        provider: t.final.provider as any,
        model: t.final.model,
        success: t.final.success,
        fallback_used: t.final.fallback_used,
        error_type: t.final.error_type,
      } : null,
    });
  }
  
  const removed = clearOldTraces();
  console.log(`[provider-trace] Loaded ${stored.length} traces from disk, removed ${removed} old traces`);
  initialized = true;
}

function persistTraces(): void {
  const stored: StoredTrace[] = [];
  for (const [traceId, trace] of traces.entries()) {
    stored.push({
      traceId,
      decisions: trace.decisions.map(d => ({
        step: d.step,
        provider: d.provider,
        model: d.model,
        decision: d.decision,
        reason: d.reason,
        timestamp: d.timestamp,
      })),
      final: trace.final ? {
        provider: trace.final.provider,
        model: trace.final.model,
        success: trace.final.success,
        fallback_used: trace.final.fallback_used,
        error_type: trace.final.error_type,
      } : null,
      createdAt: trace.decisions[0]?.timestamp || Date.now(),
    });
  }
  saveTraces(stored);
}

export function startTrace(traceId: string): void {
  ensureInitialized();
  traces.set(traceId, {
    traceId,
    decisions: [],
    final: null,
  });
}

export function addDecision(
  traceId: string,
  decision: Omit<GovernanceDecision, "timestamp">
): void {
  ensureInitialized();
  const trace = traces.get(traceId);
  if (!trace) return;
  
  trace.decisions.push({
    ...decision,
    timestamp: Date.now(),
  });
}

export function completeTrace(
  traceId: string,
  provider: ProviderId,
  model: string,
  success: boolean,
  fallback_used: boolean,
  error_type?: string
): void {
  ensureInitialized();
  const trace = traces.get(traceId);
  if (!trace) return;
  
  trace.final = {
    provider,
    model,
    success,
    fallback_used,
    error_type,
  };
  
  if (traces.size > MAX_TRACE_ENTRIES) {
    const firstKey = traces.keys().next().value;
    if (firstKey) traces.delete(firstKey);
  }
  
  persistTraces();
}

export function getTrace(traceId: string): ExecutionTrace | undefined {
  ensureInitialized();
  return traces.get(traceId);
}

export function getTraceSummary(traceId: string): {
  steps: number;
  finalProvider: string | null;
  fallbackUsed: boolean;
  blocked: boolean;
} {
  ensureInitialized();
  const trace = traces.get(traceId);
  if (!trace) {
    return { steps: 0, finalProvider: null, fallbackUsed: false, blocked: false };
  }
  
  const blocked = trace.decisions.some(d => d.decision === "blocked");
  
  return {
    steps: trace.decisions.length,
    finalProvider: trace.final?.provider || null,
    fallbackUsed: trace.final?.fallback_used || false,
    blocked,
  };
}

export function getTraceByRequestId(requestId: string): ExecutionTrace | null {
  ensureInitialized();
  const trace = traces.get(requestId);
  return trace || null;
}

export function clearTraces(): void {
  ensureInitialized();
  traces.clear();
  persistTraces();
}