/**
 * TGP-17A — Provider Health Runtime
 *
 * Canonical dynamic health layer for Tele•GPT providers.
 * Provider-agnostic. Observes execution outcomes via ProviderFailurePolicy.
 *
 * Does NOT:
 * - Score or rank providers (TGP-17B)
 * - Parse raw provider errors (delegates to ProviderFailurePolicy)
 * - Persist to database (in-memory only for v1)
 * - Include API keys, credentials, prompts, or response bodies
 */

import { CircuitBreaker, type CircuitState } from "./circuitBreaker.js";
import type { FailureDecision, ProviderFailureType } from "./provider-failure-policy.js";
import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";

// ─── Configuration Constants ──────────────────────────────────────────────────

export const HEALTH_CONFIG = {
  /** Consecutive failures to transition from healthy → degraded */
  DEGRADATION_THRESHOLD: 2,

  /** Consecutive failures to transition from degraded → unavailable */
  UNAVAILABLE_THRESHOLD: 5,

  /** Consecutive successes to transition from degraded → healthy */
  RECOVERY_SUCCESS_THRESHOLD: 3,

  /** Rolling window size for success/failure outcomes */
  ROLLING_WINDOW_SIZE: 50,

  /** Latency sample window size */
  LATENCY_SAMPLE_WINDOW: 30,

  /** Circuit breaker failure threshold (matches existing) */
  CIRCUIT_FAILURE_THRESHOLD: 3,

  /** Circuit breaker window (matches existing) */
  CIRCUIT_WINDOW_MS: 60_000,

  /** Circuit breaker cooldown (matches existing) */
  CIRCUIT_COOLDOWN_MS: 300_000,
} as const;

// ─── Health Status ────────────────────────────────────────────────────────────

export type ProviderHealthStatus =
  | "unknown"
  | "healthy"
  | "degraded"
  | "unavailable";

// ─── Health Snapshot ──────────────────────────────────────────────────────────

export interface ProviderHealthSnapshot {
  providerId: string;
  status: ProviderHealthStatus;
  circuitState: CircuitState;

  /** Rolling counters */
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;

  /** Derived rates */
  availabilityRate: number;
  rollingFailureRate: number;

  /** Latency */
  averageLatencyMs: number;
  latencyP95Ms: number;
  lastLatencyMs: number;

  /** Timestamps */
  lastAttemptAt: number;
  lastSuccessAt: number;
  lastFailureAt: number;

  /** Last failure classification */
  lastFailureType: ProviderFailureType | null;

  /** Cooldown expiry (open circuit) */
  cooldownUntil: number;

  /** Snapshot timestamp */
  updatedAt: number;
}

// ─── Rolling Sample Window ────────────────────────────────────────────────────

class RollingWindow<T> {
  private buffer: T[];
  private maxSize: number;

  constructor(maxSize: number) {
    this.buffer = [];
    this.maxSize = maxSize;
  }

  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): readonly T[] {
    return this.buffer;
  }

  get size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer.length = 0;
  }
}

// ─── Provider Health Record ───────────────────────────────────────────────────

interface ProviderHealthRecord {
  providerId: string;

  /** Status */
  status: ProviderHealthStatus;

  /** Consecutive counters (reset on transition) */
  consecutiveSuccesses: number;
  consecutiveFailures: number;

  /** Lifetime counters */
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;

  /** Rolling success/failure outcomes */
  recentOutcomes: RollingWindow<boolean>;

  /** Latency samples (rolling window) */
  latencySamples: RollingWindow<number>;

  /** Last latency */
  lastLatencyMs: number;

  /** Timestamps */
  lastAttemptAt: number;
  lastSuccessAt: number;
  lastFailureAt: number;

  /** Last failure type */
  lastFailureType: ProviderFailureType | null;

  /** Circuit breaker (per-provider) */
  circuit: CircuitBreaker;
}

// ─── Health Registry ──────────────────────────────────────────────────────────

const records = new Map<string, ProviderHealthRecord>();

function getOrCreateRecord(providerId: string): ProviderHealthRecord {
  if (!records.has(providerId)) {
    records.set(providerId, {
      providerId,
      status: "unknown",
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      recentOutcomes: new RollingWindow<boolean>(HEALTH_CONFIG.ROLLING_WINDOW_SIZE),
      latencySamples: new RollingWindow<number>(HEALTH_CONFIG.LATENCY_SAMPLE_WINDOW),
      lastLatencyMs: 0,
      lastAttemptAt: 0,
      lastSuccessAt: 0,
      lastFailureAt: 0,
      lastFailureType: null,
      circuit: new CircuitBreaker({
        failureThreshold: HEALTH_CONFIG.CIRCUIT_FAILURE_THRESHOLD,
        windowMs: HEALTH_CONFIG.CIRCUIT_WINDOW_MS,
        cooldownMs: HEALTH_CONFIG.CIRCUIT_COOLDOWN_MS,
      }),
    });
  }
  return records.get(providerId)!;
}

// ─── State Transition Logic ───────────────────────────────────────────────────

function computeNewStatus(
  current: ProviderHealthStatus,
  circuitState: CircuitState,
  consecutiveSuccesses: number,
  consecutiveFailures: number,
  totalRequests: number,
): ProviderHealthStatus {
  const cs = circuitState;

  // Circuit breaker states override health status
  if (cs === "open") return "unavailable";
  if (cs === "half-open") return "degraded";

  // Unknown → first success → healthy
  if (current === "unknown" && consecutiveSuccesses >= 1) {
    return "healthy";
  }

  // Healthy → repeated failures → degraded
  if (current === "healthy" && consecutiveFailures >= HEALTH_CONFIG.DEGRADATION_THRESHOLD) {
    return "degraded";
  }

  // Degraded → more failures → unavailable
  if (current === "degraded" && consecutiveFailures >= HEALTH_CONFIG.UNAVAILABLE_THRESHOLD) {
    return "unavailable";
  }

  // Degraded → recovery threshold met → healthy
  if (current === "degraded" && consecutiveSuccesses >= HEALTH_CONFIG.RECOVERY_SUCCESS_THRESHOLD) {
    return "healthy";
  }

  // Unavailable stays unavailable (only circuit half-open can rescue it)
  if (current === "unavailable") {
    return (cs as CircuitState) === "half-open" ? "degraded" : "unavailable";
  }

  return current;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a provider lazily. Unknown providers auto-register on first attempt.
 */
export function registerProvider(providerId: string): void {
  getOrCreateRecord(providerId);
}

/**
 * Record an attempt beginning (for timestamp tracking).
 * Does NOT increment totalRequests — that happens in recordSuccess/recordFailure
 * to avoid double-counting when both are called for the same upstream request.
 */
export function recordAttempt(providerId: string, timestamp: number = Date.now()): void {
  const record = getOrCreateRecord(providerId);
  record.lastAttemptAt = timestamp;
}

/**
 * Record a successful execution.
 * Also counts as an attempt (every upstream request = 1 attempt).
 */
export function recordSuccess(
  providerId: string,
  latencyMs: number,
  timestamp: number = Date.now(),
): void {
  const record = getOrCreateRecord(providerId);

  // Update circuit breaker
  record.circuit.recordSuccess(providerId, providerId);

  // Count as attempt
  record.totalRequests++;
  record.lastAttemptAt = timestamp;

  // Update consecutive counters
  record.consecutiveSuccesses++;
  record.consecutiveFailures = 0;

  // Update lifetime counters
  record.successfulRequests++;

  // Update rolling windows
  record.recentOutcomes.push(true);
  record.latencySamples.push(latencyMs);
  record.lastLatencyMs = latencyMs;

  // Update timestamps
  record.lastSuccessAt = timestamp;

  // Recompute status
  const circuitState = record.circuit.getState(providerId, providerId);
  const previousStatus = record.status;
  record.status = computeNewStatus(
    record.status,
    circuitState,
    record.consecutiveSuccesses,
    record.consecutiveFailures,
    record.totalRequests,
  );

  // Emit transition event
  if (previousStatus !== record.status) {
    emitHealthEvent(providerId, previousStatus, record.status, circuitState, null, latencyMs);
  }
}

/**
 * Record a failed execution with failure classification from ProviderFailurePolicy.
 * Also counts as an attempt (every upstream request = 1 attempt).
 */
export function recordFailure(
  providerId: string,
  decision: FailureDecision,
  latencyMs: number,
  timestamp: number = Date.now(),
): void {
  const record = getOrCreateRecord(providerId);

  // Update circuit breaker
  record.circuit.recordFailure(providerId, providerId);

  // Count as attempt
  record.totalRequests++;
  record.lastAttemptAt = timestamp;

  // Update consecutive counters
  record.consecutiveFailures++;
  record.consecutiveSuccesses = 0;

  // Update lifetime counters
  record.failedRequests++;

  // Update rolling windows
  record.recentOutcomes.push(false);
  record.latencySamples.push(latencyMs);
  record.lastLatencyMs = latencyMs;

  // Update timestamps and failure type
  record.lastFailureAt = timestamp;
  record.lastFailureType = decision.type;

  // Recompute status
  const circuitState = record.circuit.getState(providerId, providerId);
  const previousStatus = record.status;
  record.status = computeNewStatus(
    record.status,
    circuitState,
    record.consecutiveSuccesses,
    record.consecutiveFailures,
    record.totalRequests,
  );

  // Emit transition event
  if (previousStatus !== record.status) {
    emitHealthEvent(providerId, previousStatus, record.status, circuitState, decision.type, latencyMs);
  }
}

/**
 * Get a snapshot of a provider's health.
 */
export function getSnapshot(providerId: string): ProviderHealthSnapshot {
  const record = getOrCreateRecord(providerId);
  const circuitState = record.circuit.getState(providerId, providerId);

  const recentOutcomes = record.recentOutcomes.getAll();
  const latencySamples = record.latencySamples.getAll();

  // Compute rolling availability
  const availabilityRate = recentOutcomes.length > 0
    ? recentOutcomes.filter(Boolean).length / recentOutcomes.length
    : 1.0;

  // Compute rolling failure rate
  const rollingFailureRate = recentOutcomes.length > 0
    ? recentOutcomes.filter(o => !o).length / recentOutcomes.length
    : 0;

  // Compute rolling average latency
  const averageLatencyMs = latencySamples.length > 0
    ? latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length
    : 0;

  // Compute p95 latency
  const sortedLatencies = [...latencySamples].sort((a, b) => a - b);
  const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
  const latencyP95Ms = sortedLatencies.length > 0
    ? sortedLatencies[Math.max(0, p95Index)]
    : 0;

  // Compute cooldown
  const cooldownUntil = circuitState === "open"
    ? Date.now() + HEALTH_CONFIG.CIRCUIT_COOLDOWN_MS
    : 0;

  return {
    providerId,
    status: record.status,
    circuitState,
    consecutiveSuccesses: record.consecutiveSuccesses,
    consecutiveFailures: record.consecutiveFailures,
    totalRequests: record.totalRequests,
    successfulRequests: record.successfulRequests,
    failedRequests: record.failedRequests,
    availabilityRate,
    rollingFailureRate,
    averageLatencyMs,
    latencyP95Ms,
    lastLatencyMs: record.lastLatencyMs,
    lastAttemptAt: record.lastAttemptAt,
    lastSuccessAt: record.lastSuccessAt,
    lastFailureAt: record.lastFailureAt,
    lastFailureType: record.lastFailureType,
    cooldownUntil,
    updatedAt: Date.now(),
  };
}

/**
 * Get snapshots for all registered providers.
 */
export function getAllSnapshots(): ProviderHealthSnapshot[] {
  return Array.from(records.keys()).map(getSnapshot);
}

/**
 * Reset a specific provider's health state.
 */
export function resetProvider(providerId: string): void {
  records.delete(providerId);
}

/**
 * Reset all provider health states.
 */
export function resetAll(): void {
  records.clear();
}

/**
 * Check if a provider is eligible for execution.
 * Used by Router for hard eligibility gates only (no scoring).
 */
export function isProviderEligible(providerId: string): boolean {
  const record = records.get(providerId);
  if (!record) return true; // Unknown providers are eligible (lazy registration)
  if (record.status === "unavailable") return false;
  const circuitState = record.circuit.getState(providerId, providerId);
  if (circuitState === "open") return false;
  return true;
}

// ─── Evidence Emission ─────────────────────────────────────────────────────────

function emitHealthEvent(
  providerId: string,
  previousStatus: ProviderHealthStatus,
  currentStatus: ProviderHealthStatus,
  circuitState: CircuitState,
  failureType: ProviderFailureType | null,
  latencyMs: number,
): void {
  const record = records.get(providerId);
  if (!record) return;

  appendEvidenceRecord({
    evidence_id: `provider.health.transitioned-${providerId}-${Date.now()}`,
    trace_id: "provider_health",
    job_id: `health_${providerId}`,
    type: "provider.health.transitioned" as any,
    timestamp: new Date().toISOString(),
    payload: {
      providerId,
      previousStatus,
      currentStatus,
      circuitState,
      failureType,
      latencyMs,
      consecutiveFailures: record.consecutiveFailures,
      consecutiveSuccesses: record.consecutiveSuccesses,
      availabilityRate: record.recentOutcomes.size > 0
        ? record.recentOutcomes.getAll().filter(Boolean).length / record.recentOutcomes.size
        : 1.0,
      rollingFailureRate: record.recentOutcomes.size > 0
        ? record.recentOutcomes.getAll().filter(o => !o).length / record.recentOutcomes.size
        : 0,
    },
  }).catch(() => {});
}
