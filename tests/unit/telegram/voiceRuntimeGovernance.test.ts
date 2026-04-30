/**
 * Tests for V12.4–V12.8: Runtime Governance Integration
 *
 * V12.4 — VoiceRuntimeGovernanceGate
 * V12.5 — VoiceFeatureFlagGovernance
 * V12.6 — VoiceSafeRoutingFailover
 * V12.7 — VoiceSecretInjectionGuard
 * V12.8 — VoiceRuntimeTraceLayer
 *
 * Integration: voiceRuntimeGovernanceIntegration.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ============================================================================
// V12.4 — Governance Gate
// ============================================================================

import {
  evaluateGovernanceGate,
  classifyMessageType,
  validateGovernanceGate,
} from "../../../src/telegram/voiceRuntimeGovernanceGate.js";

describe("V12.4 — Runtime Governance Gate", () => {
  it("classifies vault commands correctly", () => {
    assert.equal(classifyMessageType("/get key"), "vault_command");
    assert.equal(classifyMessageType("/status"), "vault_command");
  });

  it("classifies sensitive requests correctly", () => {
    assert.equal(classifyMessageType("какой ключ для chat?"), "sensitive_request");
    assert.equal(classifyMessageType("покажи secret"), "sensitive_request");
  });

  it("classifies health queries correctly", () => {
    assert.equal(classifyMessageType("статус"), "health_query");
    assert.equal(classifyMessageType("health check"), "health_query");
  });

  it("classifies AI requests correctly", () => {
    assert.equal(classifyMessageType("объясни как работает"), "ai_request");
    assert.equal(classifyMessageType("помоги с кодом"), "ai_request");
  });

  it("passes vault commands through gate", () => {
    const gate = evaluateGovernanceGate({
      message: "/get key",
      bridgeEnabled: false,
      allowVaultInjection: false,
    });

    assert.equal(gate.allowed, true);
    assert.equal(gate.messageType, "vault_command");
  });

  it("blocks AI requests when bridge is disabled", () => {
    const gate = evaluateGovernanceGate({
      message: "объясни мне всё",
      bridgeEnabled: false,
      allowVaultInjection: false,
    });

    assert.equal(gate.allowed, false);
    assert.ok(gate.reason?.includes("disabled"));
  });

  it("allows AI requests when bridge is enabled", () => {
    const gate = evaluateGovernanceGate({
      message: "объясни мне всё",
      bridgeEnabled: true,
      allowVaultInjection: true,
    });

    assert.equal(gate.allowed, true);
  });
});

// ============================================================================
// V12.5 — Feature Flag Governance
// ============================================================================

import {
  loadFeatureFlagsFromEnv,
  validateFeatureFlags,
  getCurrentFeatureFlags,
  setFeatureFlags,
  updateFeatureFlag,
  resetFeatureFlags,
  DEFAULT_FEATURE_FLAGS,
} from "../../../src/telegram/voiceFeatureFlagGovernance.js";

describe("V12.5 — Feature Flag Governance", () => {
  it("loads default feature flags", () => {
    const flags = loadFeatureFlagsFromEnv();
    assert.ok(typeof flags.bridgeEnabled === "boolean");
    assert.ok(typeof flags.failOpenLocal === "boolean");
    assert.ok(typeof flags.allowVaultInjection === "boolean");
  });

  it("validates valid feature flags", () => {
    const errors = validateFeatureFlags(DEFAULT_FEATURE_FLAGS);
    assert.equal(errors.length, 0);
  });

  it("rejects invalid auto-delete value", () => {
    const errors = validateFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      autoDeleteSecretAfterSec: 500,
    });
    assert.ok(errors.includes("invalid_auto_delete_value"));
  });

  it("rejects invalid max message length", () => {
    const errors = validateFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      maxMessageLength: 50,
    });
    assert.ok(errors.includes("invalid_max_message_length"));
  });

  it("updates individual feature flag", () => {
    resetFeatureFlags();
    updateFeatureFlag("bridgeEnabled", false);
    const flags = getCurrentFeatureFlags();
    assert.equal(flags.bridgeEnabled, false);
    resetFeatureFlags();
  });
});

// ============================================================================
// V12.6 — Safe Routing & Failover
// ============================================================================

import {
  makeRoutingDecision,
  getFallbackMessage,
  setHealthCacheForTest,
  resetHealthCache,
} from "../../../src/telegram/voiceSafeRoutingFailover.js";

describe("V12.6 — Safe Routing & Failover", () => {
  it("routes vault commands to local", () => {
    const gate = evaluateGovernanceGate({
      message: "/get key",
      bridgeEnabled: false,
      allowVaultInjection: false,
    });

    const result = makeRoutingDecision({
      gate,
      flags: DEFAULT_FEATURE_FLAGS,
      teleGPTHealthy: false,
    });

    assert.equal(result.route, "local_fallback");
    assert.equal(result.reason, "vault_command_local");
  });

  it("routes AI requests to Tele GPT when healthy", () => {
    setHealthCacheForTest(true);
    const gate = evaluateGovernanceGate({
      message: "объясни мне",
      bridgeEnabled: true,
      allowVaultInjection: true,
    });

    const result = makeRoutingDecision({
      gate,
      flags: DEFAULT_FEATURE_FLAGS,
      teleGPTHealthy: true,
    });

    assert.equal(result.route, "telegpt");
    assert.equal(result.reason, "teleGPT_healthy");
    resetHealthCache();
  });

  it("fails open to local when Tele GPT is down", () => {
    const gate = evaluateGovernanceGate({
      message: "объясни мне",
      bridgeEnabled: true,
      allowVaultInjection: true,
    });

    const result = makeRoutingDecision({
      gate,
      flags: { ...DEFAULT_FEATURE_FLAGS, failOpenLocal: true },
      teleGPTHealthy: false,
    });

    assert.equal(result.route, "local_fallback");
    assert.equal(result.reason, "teleGPT_down_failopen");
  });

  it("blocks when Tele GPT is down and no fail-open", () => {
    const gate = evaluateGovernanceGate({
      message: "объясни мне",
      bridgeEnabled: true,
      allowVaultInjection: true,
    });

    const result = makeRoutingDecision({
      gate,
      flags: { ...DEFAULT_FEATURE_FLAGS, failOpenLocal: false },
      teleGPTHealthy: false,
    });

    assert.equal(result.route, "blocked");
    assert.equal(result.reason, "teleGPT_down_blocked");
  });

  it("provides fallback message for fail-open", () => {
    const msg = getFallbackMessage("teleGPT_down_failopen", DEFAULT_FEATURE_FLAGS);
    assert.ok(msg.includes("Tele GPT"));
    assert.ok(msg.includes("Vault commands"));
  });
});

// ============================================================================
// V12.7 — Secret Injection Guard
// ============================================================================

import {
  evaluateSecretInjectionGuard,
  maskSecretValue,
  validateInjectionGuard,
} from "../../../src/telegram/voiceSecretInjectionGuard.js";

describe("V12.7 — Secret Injection Guard", () => {
  it("allows injection when enabled", () => {
    const guard = evaluateSecretInjectionGuard({
      alias: "openai:api_key",
      allowInjection: true,
    });

    assert.equal(guard.allowed, true);
    assert.ok(guard.constraints.includes("audit_log_required"));
  });

  it("blocks injection when disabled", () => {
    const guard = evaluateSecretInjectionGuard({
      alias: "openai:api_key",
      allowInjection: false,
    });

    assert.equal(guard.allowed, false);
    assert.ok(guard.reason?.includes("disabled"));
  });

  it("applies mask for sensitive categories", () => {
    const guard = evaluateSecretInjectionGuard({
      alias: "db:password",
      allowInjection: true,
    });

    assert.equal(guard.maskPattern, "first4_last4");
    assert.ok(guard.constraints.includes("mask_output"));
    assert.ok(guard.constraints.includes("no_full_exposure"));
  });

  it("masks secret values correctly", () => {
    assert.equal(maskSecretValue("sk-1234567890abcdef", "first4_last4"), "sk-1...cdef");
    assert.equal(maskSecretValue("short", "first4_last4"), "***");
    assert.equal(maskSecretValue("anything", "all_masked"), "***");
    assert.equal(maskSecretValue("visible", "none"), "visible");
  });

  it("enforces rate limit", () => {
    const guard = evaluateSecretInjectionGuard({
      alias: "test:key",
      allowInjection: true,
      rateLimit: 5,
      currentRate: 6,
    });

    assert.equal(guard.allowed, false);
    assert.ok(guard.reason?.includes("Rate limit"));
  });
});

// ============================================================================
// V12.8 — Runtime Trace Layer
// ============================================================================

import {
  recordTrace,
  getRuntimeTraces,
  clearRuntimeTraces,
  getTraceStatistics,
  getTracesByUser,
  getTracesByRoute,
  getTracesByResultStatus,
  createTrace,
  validateTrace,
} from "../../../src/telegram/voiceRuntimeTraceLayer.js";

describe("V12.8 — Runtime Trace Layer", () => {
  it("records and retrieves traces", () => {
    clearRuntimeTraces();

    const trace = createTrace({
      userId: "user_1",
      message: "test message",
      routedTo: "telegpt",
      resultStatus: "success",
    });

    recordTrace(trace);

    const traces = getRuntimeTraces(1);
    assert.equal(traces.length, 1);
    assert.equal(traces[0].userId, "user_1");

    clearRuntimeTraces();
  });

  it("filters traces by user", () => {
    clearRuntimeTraces();

    recordTrace(createTrace({
      userId: "user_a",
      message: "msg1",
      routedTo: "telegpt",
      resultStatus: "success",
    }));

    recordTrace(createTrace({
      userId: "user_b",
      message: "msg2",
      routedTo: "local",
      resultStatus: "success",
    }));

    const userATraces = getTracesByUser("user_a");
    assert.equal(userATraces.length, 1);
    assert.equal(userATraces[0].userId, "user_a");

    clearRuntimeTraces();
  });

  it("filters traces by route", () => {
    clearRuntimeTraces();

    recordTrace(createTrace({
      userId: "user_1",
      message: "msg1",
      routedTo: "telegpt",
      resultStatus: "success",
    }));

    recordTrace(createTrace({
      userId: "user_1",
      message: "msg2",
      routedTo: "vault",
      resultStatus: "success",
    }));

    const vaultTraces = getTracesByRoute("vault");
    assert.equal(vaultTraces.length, 1);

    clearRuntimeTraces();
  });

  it("computes trace statistics", () => {
    clearRuntimeTraces();

    recordTrace(createTrace({
      userId: "user_1",
      message: "msg1",
      routedTo: "telegpt",
      resultStatus: "success",
      latencyMs: 100,
    }));

    recordTrace(createTrace({
      userId: "user_1",
      message: "msg2",
      routedTo: "local",
      resultStatus: "error",
      latencyMs: 50,
    }));

    const stats = getTraceStatistics();
    assert.equal(stats.totalTraces, 2);
    assert.equal(stats.successCount, 1);
    assert.equal(stats.errorCount, 1);
    assert.equal(stats.avgLatencyMs, 75);

    clearRuntimeTraces();
  });

  it("validates trace with missing fields", () => {
    const errors = validateTrace({});
    assert.ok(errors.includes("missing_trace_id"));
    assert.ok(errors.includes("missing_user_id"));
    assert.ok(errors.includes("missing_timestamp"));
  });
});

// ============================================================================
// Integration: V12.4–V12.8 Pipeline
// ============================================================================

import {
  executeRuntimeGovernancePipeline,
  buildRuntimeGovernanceSummary,
} from "../../../src/telegram/voiceRuntimeGovernanceIntegration.js";

describe("Integration: V12.4–V12.8 Pipeline", () => {
  it("executes full governance pipeline for AI request", () => {
    clearRuntimeTraces();
    resetFeatureFlags();

    const result = executeRuntimeGovernancePipeline({
      message: "объясни как работает",
      userId: "user_1",
      flags: DEFAULT_FEATURE_FLAGS,
      teleGPTHealthyOverride: true,
    });

    assert.ok(result.gate);
    assert.ok(result.routing);
    assert.equal(result.gate.messageType, "ai_request");
    assert.equal(result.routing.route, "telegpt");
    assert.equal(result.shouldInjectSecrets, false);
    assert.ok(result.traceId);

    clearRuntimeTraces();
    resetFeatureFlags();
  });

  it("executes full governance pipeline for vault command", () => {
    clearRuntimeTraces();
    resetFeatureFlags();

    const result = executeRuntimeGovernancePipeline({
      message: "/get openai:api_key",
      userId: "user_1",
      flags: DEFAULT_FEATURE_FLAGS,
      teleGPTHealthyOverride: false,
    });

    assert.equal(result.gate.messageType, "vault_command");
    assert.equal(result.routing.route, "local_fallback");

    clearRuntimeTraces();
    resetFeatureFlags();
  });

  it("builds governance summary", () => {
    clearRuntimeTraces();
    resetFeatureFlags();

    // Record some traces
    recordTrace(createTrace({
      userId: "user_1",
      message: "msg1",
      routedTo: "telegpt",
      resultStatus: "success",
      latencyMs: 100,
    }));

    recordTrace(createTrace({
      userId: "user_1",
      message: "msg2",
      routedTo: "local",
      resultStatus: "fallback",
      latencyMs: 10,
    }));

    const summary = buildRuntimeGovernanceSummary();
    assert.equal(summary.traceStatistics.totalTraces, 2);
    assert.equal(summary.successRate, 50);
    assert.equal(summary.fallbackRate, 50);

    clearRuntimeTraces();
    resetFeatureFlags();
  });
});
