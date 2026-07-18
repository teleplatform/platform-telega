/**
 * Provider Failure Policy — unified error classification, retry, credential cycling,
 * circuit breaker integration, fallback decision, and evidence emission.
 *
 * This module replaces provider-specific error handling with a single policy
 * that any provider (zyloo_api, kimi_api, openai_api, etc.) can use.
 *
 * Flow:
 *   classifyError(rawMessage, httpStatus)
 *       ↓
 *   FailureDecision { type, shouldRetrySameKey, shouldCycleCredential, shouldFallback, safeMessage }
 *       ↓
 *   circuitBreaker.recordFailure() / recordSuccess()
 *       ↓
 *   emitFailureEvidence()
 */

import { CircuitBreaker } from "./circuitBreaker.js";
import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";

// ─── Error Taxonomy ───────────────────────────────────────────────────────────

export type ProviderFailureType =
  | "auth"
  | "rate_limit"
  | "quota_exhausted"
  | "network_quota"
  | "invalid_request"
  | "network"
  | "unknown";

export interface FailureDecision {
  type: ProviderFailureType;
  shouldRetrySameKey: boolean;
  shouldCycleCredential: boolean;
  shouldFallback: boolean;
  safeMessage: string;
  rawMessage: string;
}

// ─── Classification Rules ─────────────────────────────────────────────────────

interface ClassificationRule {
  pattern: RegExp;
  type: ProviderFailureType;
  retrySameKey: boolean;
  cycleCredential: boolean;
  fallback: boolean;
  safeMessage: string;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    pattern: /401|unauthorized|invalid.*api.*key|invalid.*key/i,
    type: "auth",
    retrySameKey: false,
    cycleCredential: true,
    fallback: false,
    safeMessage: "Authentication failed. Trying alternative credentials.",
  },
  {
    pattern: /insufficient.*credit|insufficient.*quota|insufficient.*balance|add funds|billing/i,
    type: "quota_exhausted",
    retrySameKey: false,
    cycleCredential: false,
    fallback: true,
    safeMessage: "Quota exhausted. Falling back to alternative provider.",
  },
  {
    pattern: /one account per network|network.*quota|per.*network/i,
    type: "network_quota",
    retrySameKey: false,
    cycleCredential: false,
    fallback: true,
    safeMessage: "Network-level quota limit reached.",
  },
  {
    pattern: /rate.*limit|429|too many requests/i,
    type: "rate_limit",
    retrySameKey: false,
    cycleCredential: true,
    fallback: true,
    safeMessage: "Rate limit exceeded. Retrying with alternative credentials.",
  },
  {
    pattern: /ECONNREFUSED|ETIMEDOUT|ECONNRESET|network.*error|fetch.*failed/i,
    type: "network",
    retrySameKey: false,
    cycleCredential: false,
    fallback: true,
    safeMessage: "Network error. Trying alternative provider.",
  },
];

// ─── Core Classification ──────────────────────────────────────────────────────

export function classifyError(
  rawMessage: string,
  httpStatus?: number,
  remainingCredentialSlots?: number
): FailureDecision {
  const slotsLeft = remainingCredentialSlots ?? 1;

  // Check HTTP status first for unambiguous cases
  if (httpStatus === 401) {
    return {
      type: "auth",
      shouldRetrySameKey: false,
      shouldCycleCredential: slotsLeft > 0,
      shouldFallback: slotsLeft === 0,
      safeMessage: slotsLeft > 0
        ? "Authentication failed. Trying alternative credentials."
        : "All credentials exhausted. Falling back to alternative provider.",
      rawMessage,
    };
  }
  if (httpStatus === 429) {
    return {
      type: "rate_limit",
      shouldRetrySameKey: false,
      shouldCycleCredential: slotsLeft > 0,
      shouldFallback: true,
      safeMessage: "Rate limit exceeded. Retrying with alternative credentials.",
      rawMessage,
    };
  }

  // Check message patterns (first match wins)
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(rawMessage)) {
      const decision: FailureDecision = {
        type: rule.type,
        shouldRetrySameKey: rule.retrySameKey,
        shouldCycleCredential: rule.cycleCredential && slotsLeft > 0,
        shouldFallback: rule.fallback || (rule.type === "auth" && slotsLeft === 0),
        safeMessage: rule.safeMessage,
        rawMessage,
      };
      if (rule.type === "auth" && slotsLeft === 0) {
        decision.safeMessage = "All credentials exhausted. Falling back to alternative provider.";
      }
      return decision;
    }
  }

  // Default: unknown error, allow fallback
  return {
    type: "unknown",
    shouldRetrySameKey: false,
    shouldCycleCredential: false,
    shouldFallback: true,
    safeMessage: "An unexpected error occurred. Trying alternative provider.",
    rawMessage,
  };
}

// ─── Circuit Breaker Integration ──────────────────────────────────────────────

const DEFAULT_BREAKER_OPTIONS = {
  failureThreshold: 3,
  windowMs: 60_000,
  cooldownMs: 300_000,
};

const breakers = new Map<string, CircuitBreaker>();

function getBreaker(
  provider: string,
  options?: { failureThreshold?: number; windowMs?: number; cooldownMs?: number }
): CircuitBreaker {
  const key = provider;
  if (!breakers.has(key)) {
    breakers.set(
      key,
      new CircuitBreaker(options ?? DEFAULT_BREAKER_OPTIONS)
    );
  }
  return breakers.get(key)!;
}

export function recordProviderFailure(
  provider: string,
  model: string,
  decision: FailureDecision,
  options?: { failureThreshold?: number; windowMs?: number; cooldownMs?: number }
): { isOpen: boolean; state: string } {
  const breaker = getBreaker(provider, options);
  breaker.recordFailure(provider, model);
  const state = breaker.getState(provider, model);
  return { isOpen: state === "open", state };
}

export function recordProviderSuccess(provider: string, model: string): void {
  const breaker = getBreaker(provider);
  breaker.recordSuccess(provider, model);
}

export function isProviderOpen(provider: string, model: string): boolean {
  const breaker = getBreaker(provider);
  return breaker.isOpen(provider, model);
}

// ─── Evidence Emission ─────────────────────────────────────────────────────────

export function emitFailureEvidence(params: {
  provider: string;
  model: string;
  decision: FailureDecision;
  traceId?: string;
  credentialSlot?: string;
  circuitState?: string;
  additionalPayload?: Record<string, unknown>;
}): void {
  const eventType = `provider.${params.provider.replace(/_api|_web/g, "").replace(/-/g, "_")}.quota_exhausted`;

  appendEvidenceRecord({
    evidence_id: `${params.provider}.failure-${Date.now()}`,
    trace_id: params.traceId || `${params.provider}_failure`,
    job_id: `${params.provider}_failure`,
    type: eventType as any,
    timestamp: new Date().toISOString(),
    payload: {
      provider: params.provider,
      model: params.model,
      failureType: params.decision.type,
      shouldRetrySameKey: params.decision.shouldRetrySameKey,
      shouldCycleCredential: params.decision.shouldCycleCredential,
      shouldFallback: params.decision.shouldFallback,
      credentialSlot: params.credentialSlot,
      circuitState: params.circuitState,
      rawMessage: params.decision.rawMessage,
      ...params.additionalPayload,
    },
  }).catch(() => {});
}

// ─── Convenience: Full Failure Handling ────────────────────────────────────────

export interface HandleFailureParams {
  provider: string;
  model: string;
  rawMessage: string;
  httpStatus?: number;
  traceId?: string;
  credentialSlot?: string;
}

export interface HandleFailureResult {
  decision: FailureDecision;
  circuit: { isOpen: boolean; state: string };
}

export function handleProviderFailure(params: HandleFailureParams): HandleFailureResult {
  const decision = classifyError(params.rawMessage, params.httpStatus);
  const circuit = recordProviderFailure(params.provider, params.model, decision);

  emitFailureEvidence({
    provider: params.provider,
    model: params.model,
    decision,
    traceId: params.traceId,
    credentialSlot: params.credentialSlot,
    circuitState: circuit.state,
  });

  return { decision, circuit };
}

export function handleProviderSuccess(provider: string, model: string): void {
  recordProviderSuccess(provider, model);
}

// ─── Reset (for testing) ──────────────────────────────────────────────────────

export function resetBreakers(): void {
  breakers.clear();
}
