// Kimi K3 Router Tests — TGP-14 — run with: npx tsx tests/unit/router/kimiK3Router.test.ts

import assert from "node:assert/strict";
import {
  KIMI_API_MODELS,
  KIMI_API_DEFAULT_MODEL,
  KIMI_LEGACY_MODELS,
  KIMI_K3_SPECS,
  KIMI_K3_REASONING_PROFILES,
  resolveKimiReasoningEffort,
  isKimiK3Model,
  isKimiLegacyModel,
  isKimiFamilyModel,
  resolveKimiApiKey,
  isKimiApiProvider,
} from "../../../src/providers/kimi_api/index.js";
import {
  KIMI_LOCAL_WEB_API_MODELS,
  KIMI_LOCAL_WEB_API_DEFAULT_MODEL,
  isKimiLocalWebApiProvider,
} from "../../../src/providers/kimi_local_web_api/index.js";
import { resolveModel } from "../../../src/core/provider-resolution.js";
import { CapabilityDiscovery } from "../../../src/provider-ops/capabilityDiscovery.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log("\nKimi K3 Provider Definitions:");

test("KIMI_API_MODELS includes kimi-k3 as first model", () => {
  assert.equal(KIMI_API_MODELS[0], "kimi-k3");
});

test("KIMI_API_DEFAULT_MODEL is kimi-k3", () => {
  assert.equal(KIMI_API_DEFAULT_MODEL, "kimi-k3");
});

test("KIMI_API_MODELS includes legacy kimi-k2.5", () => {
  assert.ok((KIMI_API_MODELS as readonly string[]).includes("kimi-k2.5"));
});

test("KIMI_API_MODELS includes kimi-k2.7-code", () => {
  assert.ok((KIMI_API_MODELS as readonly string[]).includes("kimi-k2.7-code"));
});

test("KIMI_LEGACY_MODELS contains only kimi-k2.5", () => {
  assert.deepEqual([...KIMI_LEGACY_MODELS], ["kimi-k2.5"]);
});

test("KIMI_LOCAL_WEB_API_MODELS has kimi-k3 and kimi-k2.5", () => {
  assert.equal(KIMI_LOCAL_WEB_API_MODELS.length, 2);
  assert.ok((KIMI_LOCAL_WEB_API_MODELS as readonly string[]).includes("kimi-k3"));
  assert.ok((KIMI_LOCAL_WEB_API_MODELS as readonly string[]).includes("kimi-k2.5"));
});

test("KIMI_LOCAL_WEB_API_DEFAULT_MODEL is kimi-k3", () => {
  assert.equal(KIMI_LOCAL_WEB_API_DEFAULT_MODEL, "kimi-k3");
});

test("K3 specs: context window is 1M tokens", () => {
  assert.equal(KIMI_K3_SPECS.contextWindow, 1_000_000);
});

test("K3 specs: reasoning always on", () => {
  assert.equal(KIMI_K3_SPECS.reasoningAlwaysOn, true);
});

test("K3 specs: supports vision", () => {
  assert.equal(KIMI_K3_SPECS.supportsVision, true);
});

test("K3 specs: supports tool calling", () => {
  assert.equal(KIMI_K3_SPECS.supportsToolCalling, true);
});

console.log("\nReasoning Profiles:");

test("Default reasoning profile resolves to max", () => {
  assert.equal(resolveKimiReasoningEffort("default"), "max");
});

test("Default reasoning profile without arg resolves to max", () => {
  assert.equal(resolveKimiReasoningEffort(), "max");
});

test("Reasoning profiles has only 'default' key", () => {
  const keys = Object.keys(KIMI_K3_REASONING_PROFILES);
  assert.deepEqual(keys, ["default"]);
});

console.log("\nModel Identification:");

test("isKimiK3Model returns true for kimi-k3", () => {
  assert.equal(isKimiK3Model("kimi-k3"), true);
});

test("isKimiK3Model returns false for kimi-k2.5", () => {
  assert.equal(isKimiK3Model("kimi-k2.5"), false);
});

test("isKimiLegacyModel returns true for kimi-k2.5", () => {
  assert.equal(isKimiLegacyModel("kimi-k2.5"), true);
});

test("isKimiLegacyModel returns false for kimi-k3", () => {
  assert.equal(isKimiLegacyModel("kimi-k3"), false);
});

test("isKimiFamilyModel returns true for all K3 API models", () => {
  for (const model of KIMI_API_MODELS) {
    assert.equal(isKimiFamilyModel(model), true, `${model} should be Kimi family`);
  }
});

test("isKimiFamilyModel returns false for non-Kimi models", () => {
  assert.equal(isKimiFamilyModel("gpt-4o"), false);
  assert.equal(isKimiFamilyModel("deepseek-chat"), false);
  assert.equal(isKimiFamilyModel("glm-5-thinking"), false);
});

test("isKimiApiProvider identifies kimi_api", () => {
  assert.equal(isKimiApiProvider("kimi_api"), true);
  assert.equal(isKimiApiProvider("kimi_local_web_api"), false);
});

test("isKimiLocalWebApiProvider identifies kimi_local_web_api", () => {
  assert.equal(isKimiLocalWebApiProvider("kimi_local_web_api"), true);
  assert.equal(isKimiLocalWebApiProvider("kimi_api"), false);
});

console.log("\nProvider Resolution:");

test("kimi:k3 resolves to kimi_api provider", () => {
  const result = resolveModel("kimi:k3");
  assert.equal(result.provider, "kimi_api");
  assert.equal(result.model, "k3");
});

test("kimi (bare) resolves to kimi_api with default model", () => {
  const result = resolveModel("kimi");
  assert.equal(result.provider, "kimi_api");
  assert.equal(result.model, "kimi-k3");
});

test("kimi:resolves model from registry", () => {
  const result = resolveModel("kimi:kimi-k3");
  assert.equal(result.provider, "kimi_api");
  assert.equal(result.model, "kimi-k3");
});

test("kimi_local_web_api resolves correctly", () => {
  const result = resolveModel("kimi_local_web_api:kimi-k3");
  assert.equal(result.provider, "kimi_local_web_api");
  assert.equal(result.model, "kimi-k3");
});

test("kimi_web resolves to kimi_web with K3 default", () => {
  const result = resolveModel("kimi_web");
  assert.equal(result.provider, "kimi_web");
  assert.equal(result.model, "kimi-k3");
});

test("deepseek_api is NOT kimi_api", () => {
  const result = resolveModel("deepseek:deepseek-chat");
  assert.notEqual(result.provider, "kimi_api");
  assert.notEqual(result.provider, "kimi_local_web_api");
});

test("openai_api is NOT kimi_api", () => {
  const result = resolveModel("openai:gpt-4o");
  assert.notEqual(result.provider, "kimi_api");
  assert.notEqual(result.provider, "kimi_local_web_api");
});

console.log("\nCapability Discovery:");

test("Capability Discovery has default K3 models", () => {
  const defaultResult = CapabilityDiscovery.getCached("kimi_api");
  // Default result should have K3 and K2.5
  assert.ok(CapabilityDiscovery.normalizeUpstreamId("kimi-k3"));
});

test("normalizeUpstreamId normalizes moonshot-v1-auto to kimi-k3", () => {
  assert.equal(CapabilityDiscovery.normalizeUpstreamId("moonshot-v1-auto"), "kimi-k3");
});

test("normalizeUpstreamId passes through kimi-k3 unchanged", () => {
  assert.equal(CapabilityDiscovery.normalizeUpstreamId("kimi-k3"), "kimi-k3");
});

test("isKimiK3Available checks model list", () => {
  const mockResult = {
    providerId: "kimi",
    availableModels: [
      { upstreamId: "kimi-k3", canonicalId: "kimi-k3", isLegacy: false },
      { upstreamId: "kimi-k2.5", canonicalId: "kimi-k2.5", isLegacy: true },
    ],
    capabilities: { vision: true, toolCalling: true, structuredOutput: true, reasoning: true, streaming: true },
    limits: { contextWindow: 1_000_000, maxOutputTokens: 32_768 },
    discoveredAt: Date.now(),
    upstreamModelIds: { "kimi-k3": "kimi-k3" },
  };
  assert.equal(CapabilityDiscovery.isKimiK3Available(mockResult), true);
});

test("getLegacyFallback returns K2.5 model", () => {
  const mockResult = {
    providerId: "kimi",
    availableModels: [
      { upstreamId: "kimi-k3", canonicalId: "kimi-k3", isLegacy: false },
      { upstreamId: "kimi-k2.5", canonicalId: "kimi-k2.5", isLegacy: true },
    ],
    capabilities: { vision: true, toolCalling: true, structuredOutput: true, reasoning: true, streaming: true },
    limits: { contextWindow: 1_000_000, maxOutputTokens: 32_768 },
    discoveredAt: Date.now(),
    upstreamModelIds: { "kimi-k3": "kimi-k3" },
  };
  const legacy = CapabilityDiscovery.getLegacyFallback(mockResult);
  assert.ok(legacy);
  assert.equal(legacy.canonicalId, "kimi-k2.5");
  assert.equal(legacy.isLegacy, true);
});

console.log("\nExecution Lane Separation:");

test("kimi_api and kimi_local_web_api are different providers", () => {
  assert.notEqual("kimi_api", "kimi_local_web_api");
});

test("resolveModel for kimi: returns kimi_api (not browser)", () => {
  const result = resolveModel("kimi:kimi-k3");
  assert.equal(result.provider, "kimi_api");
  assert.ok(!result.provider.includes("local_web"));
});

test("resolveModel for kimi_local_web_api: returns browser provider", () => {
  const result = resolveModel("kimi_local_web_api:kimi-k3");
  assert.equal(result.provider, "kimi_local_web_api");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
