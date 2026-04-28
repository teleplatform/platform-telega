/**
 * Voice Runtime Trace Layer — V12.8
 *
 * First-class entity: VoiceRuntimeTrace
 *
 * This layer answers:
 *   - "What happened to this request?"
 *   - "Where was it routed and what was the result?"
 *   - "What is the latency and health of the runtime?"
 *
 * RULE: NO ACTION WITHOUT TRACE RECORD
 */

import type { VoiceMessageType } from "./voiceRuntimeGovernanceGate.js";
import type { VoiceRoutingDecision, VoiceRoutingReason } from "./voiceSafeRoutingFailover.js";

export type VoiceTraceResultStatus =
  | "success"
  | "error"
  | "fallback"
  | "blocked";

export interface VoiceRuntimeTrace {
  traceId: string;
  userId: string;
  message: string;
  routedTo: "telegpt" | "vault" | "local";
  resultStatus: VoiceTraceResultStatus;
  routingReason?: VoiceRoutingReason;
  latencyMs?: number;
  gateId?: string;
  messageType?: VoiceMessageType;
  errorMessage?: string;
  timestamp: number;
}

export type VoiceTraceValidationError =
  | "missing_trace_id"
  | "missing_user_id"
  | "invalid_result_status"
  | "missing_timestamp";

// ============================================================================
// ID generation
// ============================================================================

function generateTraceId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_trace_${timestamp}_${random}`;
}

function cryptoRandomHex(bytes: number): string {
  try {
    const { randomBytes } = require("node:crypto");
    return randomBytes(bytes).toString("hex");
  } catch {
    return Math.random().toString(16).slice(2, 2 + bytes * 2);
  }
}

// ============================================================================
// Validation
// ============================================================================

const VALID_RESULT_STATUSES: VoiceTraceResultStatus[] = [
  "success",
  "error",
  "fallback",
  "blocked",
];

export function validateTrace(
  trace: Partial<VoiceRuntimeTrace>,
): VoiceTraceValidationError[] {
  const errors: VoiceTraceValidationError[] = [];

  if (!trace.traceId || trace.traceId.trim().length === 0) {
    errors.push("missing_trace_id");
  }

  if (!trace.userId || trace.userId.trim().length === 0) {
    errors.push("missing_user_id");
  }

  if (
    trace.resultStatus &&
    !VALID_RESULT_STATUSES.includes(trace.resultStatus)
  ) {
    errors.push("invalid_result_status");
  }

  if (trace.timestamp === undefined) {
    errors.push("missing_timestamp");
  }

  return errors;
}

// ============================================================================
// Trace registry
// ============================================================================

const _traceLog: VoiceRuntimeTrace[] = [];
const MAX_TRACE_ENTRIES = 500;

export function recordTrace(trace: VoiceRuntimeTrace): void {
  const errors = validateTrace(trace);
  if (errors.length > 0) {
    throw new Error(`Invalid trace: ${errors.join(", ")}`);
  }

  _traceLog.unshift(trace);
  if (_traceLog.length > MAX_TRACE_ENTRIES) {
    _traceLog.pop();
  }
}

export function getRuntimeTraces(limit = 20): VoiceRuntimeTrace[] {
  return _traceLog.slice(0, limit);
}

export function getTracesByUser(userId: string, limit = 10): VoiceRuntimeTrace[] {
  return _traceLog
    .filter((t) => t.userId === userId)
    .slice(0, limit);
}

export function getTracesByRoute(
  route: "telegpt" | "vault" | "local",
  limit = 10,
): VoiceRuntimeTrace[] {
  return _traceLog
    .filter((t) => t.routedTo === route)
    .slice(0, limit);
}

export function getTracesByResultStatus(
  status: VoiceTraceResultStatus,
  limit = 10,
): VoiceRuntimeTrace[] {
  return _traceLog
    .filter((t) => t.resultStatus === status)
    .slice(0, limit);
}

export function clearRuntimeTraces(): void {
  _traceLog.length = 0;
}

export function getTraceCount(): number {
  return _traceLog.length;
}

// ============================================================================
// Trace statistics
// ============================================================================

export interface VoiceTraceStatistics {
  totalTraces: number;
  successCount: number;
  errorCount: number;
  fallbackCount: number;
  blockedCount: number;
  avgLatencyMs: number;
  teleGPTRouteCount: number;
  vaultRouteCount: number;
  localRouteCount: number;
}

export function getTraceStatistics(): VoiceTraceStatistics {
  const traces = _traceLog;

  const latencies = traces
    .filter((t) => t.latencyMs !== undefined)
    .map((t) => t.latencyMs!);

  const avgLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
      : 0;

  return {
    totalTraces: traces.length,
    successCount: traces.filter((t) => t.resultStatus === "success").length,
    errorCount: traces.filter((t) => t.resultStatus === "error").length,
    fallbackCount: traces.filter((t) => t.resultStatus === "fallback").length,
    blockedCount: traces.filter((t) => t.resultStatus === "blocked").length,
    avgLatencyMs: avgLatency,
    teleGPTRouteCount: traces.filter((t) => t.routedTo === "telegpt").length,
    vaultRouteCount: traces.filter((t) => t.routedTo === "vault").length,
    localRouteCount: traces.filter((t) => t.routedTo === "local").length,
  };
}

// ============================================================================
// Trace creation helper
// ============================================================================

export interface VoiceCreateTraceInput {
  userId: string;
  message: string;
  routedTo: VoiceRuntimeTrace["routedTo"];
  resultStatus: VoiceTraceResultStatus;
  latencyMs?: number;
  gateId?: string;
  messageType?: VoiceMessageType;
  routingReason?: VoiceRoutingReason;
  errorMessage?: string;
}

export function createTrace(
  input: VoiceCreateTraceInput,
): VoiceRuntimeTrace {
  const trace: VoiceRuntimeTrace = {
    traceId: generateTraceId(),
    userId: input.userId,
    message: input.message,
    routedTo: input.routedTo,
    resultStatus: input.resultStatus,
    latencyMs: input.latencyMs,
    gateId: input.gateId,
    messageType: input.messageType,
    routingReason: input.routingReason,
    errorMessage: input.errorMessage,
    timestamp: Date.now(),
  };

  return trace;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatRuntimeTrace(trace: VoiceRuntimeTrace): string {
  const routeEmoji: Record<VoiceRuntimeTrace["routedTo"], string> = {
    telegpt: "🧠",
    vault: "🔐",
    local: "🏠",
  };

  const statusEmoji: Record<VoiceTraceResultStatus, string> = {
    success: "✅",
    error: "❌",
    fallback: "⚠️",
    blocked: "🚫",
  };

  return [
    `📝 Runtime Trace`,
    `• trace ID: ${trace.traceId}`,
    `• user: ${trace.userId}`,
    `• routed: ${routeEmoji[trace.routedTo]} ${trace.routedTo}`,
    `• result: ${statusEmoji[trace.resultStatus]} ${trace.resultStatus}`,
    trace.latencyMs ? `• latency: ${trace.latencyMs}ms` : null,
    trace.routingReason ? `• reason: ${trace.routingReason}` : null,
    trace.errorMessage ? `• error: ${trace.errorMessage}` : null,
    `• time: ${new Date(trace.timestamp).toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatTraceStatistics(stats: VoiceTraceStatistics): string {
  return [
    `📊 Runtime Trace Statistics`,
    `• total traces: ${stats.totalTraces}`,
    `• ✅ success: ${stats.successCount}`,
    `• ❌ error: ${stats.errorCount}`,
    `• ⚠️ fallback: ${stats.fallbackCount}`,
    `• 🚫 blocked: ${stats.blockedCount}`,
    `• avg latency: ${stats.avgLatencyMs}ms`,
    `• 🧠 Tele GPT: ${stats.teleGPTRouteCount}`,
    `• 🔐 Vault: ${stats.vaultRouteCount}`,
    `• 🏠 Local: ${stats.localRouteCount}`,
  ].join("\n");
}
