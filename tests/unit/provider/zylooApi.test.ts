import assert from "node:assert/strict";
import {
  ZYLOO_API_MODELS,
  ZYLOO_API_DEFAULT_MODEL,
  resolveZylooApiKey,
  resolveZylooApiKeySlot,
  resolveZylooApiKeyWithSlot,
  isZylooApiProvider,
  isZylooModel,
  isZylooUpstreamModel,
  getZylooApiConfig,
  ZYLOO_K3_SPECS,
} from "../../../src/providers/zyloo_api/index.js";

import { resolveModel } from "../../../src/core/provider-resolution.js";
import { ProviderVerification } from "../../../src/core/provider-verification.js";
import { CapabilityDiscovery } from "../../../src/provider-ops/capabilityDiscovery.js";
import { getTier } from "../../../src/provider-ops/providerTiering.js";
import { isIdeReady, getIdeCompatibility } from "../../../src/gateway/ide-compatibility.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result && typeof (result as any).then === "function") {
      return (result as Promise<void>).then(() => {
        passed++;
        console.log(`  ✓ ${name}`);
      }).catch((e: any) => {
        failed++;
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
      });
    }
    passed++;
    console.log(`  ✓ ${name}`);
    return Promise.resolve();
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    return Promise.resolve();
  }
}

console.log("\nZyloo Provider Definitions:");

test("ZYLOO_API_MODELS includes zyloo/kimi-k3", () => {
  assert.ok((ZYLOO_API_MODELS as readonly string[]).includes("zyloo/kimi-k3"));
});

test("ZYLOO_API_DEFAULT_MODEL is zyloo/kimi-k3", () => {
  assert.equal(ZYLOO_API_DEFAULT_MODEL, "zyloo/kimi-k3");
});

test("K3 specs: context window is 1M tokens", () => {
  assert.equal(ZYLOO_K3_SPECS.contextWindow, 1_000_000);
});

test("K3 specs: supports vision, streaming, tool calling", () => {
  assert.ok(ZYLOO_K3_SPECS.supportsVision);
  assert.ok(ZYLOO_K3_SPECS.supportsStreaming);
  assert.ok(ZYLOO_K3_SPECS.supportsToolCalling);
});

console.log("\nModel Identification:");

test("isZylooApiProvider identifies zyloo_api", () => {
  assert.ok(isZylooApiProvider("zyloo_api"));
});

test("isZylooApiProvider rejects kimi_api", () => {
  assert.equal(isZylooApiProvider("kimi_api"), false);
});

test("isZylooModel returns true for zyloo/kimi-k3", () => {
  assert.ok(isZylooModel("zyloo/kimi-k3"));
});

test("isZylooModel returns true for kimi-k3 (canonical form)", () => {
  assert.equal(isZylooModel("kimi-k3"), true);
});

test("isZylooModel returns false for gpt-4", () => {
  assert.equal(isZylooModel("gpt-4"), false);
});

test("isZylooUpstreamModel returns true for zyloo/kimi-k3", () => {
  assert.ok(isZylooUpstreamModel("zyloo/kimi-k3"));
});

test("isZylooUpstreamModel returns false for kimi-k3", () => {
  assert.equal(isZylooUpstreamModel("kimi-k3"), false);
});

console.log("\nAPI Key Resolution:");

test("resolveZylooApiKey returns null when no env set", () => {
  const saved = process.env.ZYLOO_API_KEY;
  const saved2 = process.env.ZYLOO_API_KEY_2;
  delete process.env.ZYLOO_API_KEY;
  delete process.env.ZYLOO_API_KEY_2;
  assert.equal(resolveZylooApiKey(), null);
  if (saved) process.env.ZYLOO_API_KEY = saved;
  if (saved2) process.env.ZYLOO_API_KEY_2 = saved2;
});

test("resolveZylooApiKey reads primary key", () => {
  const saved = process.env.ZYLOO_API_KEY;
  const saved2 = process.env.ZYLOO_API_KEY_2;
  process.env.ZYLOO_API_KEY = "test-primary-key";
  delete process.env.ZYLOO_API_KEY_2;
  assert.equal(resolveZylooApiKey(), "test-primary-key");
  if (saved) process.env.ZYLOO_API_KEY = saved; else delete process.env.ZYLOO_API_KEY;
  if (saved2) process.env.ZYLOO_API_KEY_2 = saved2;
});

test("resolveZylooApiKey falls back to secondary key", () => {
  const saved = process.env.ZYLOO_API_KEY;
  const saved2 = process.env.ZYLOO_API_KEY_2;
  delete process.env.ZYLOO_API_KEY;
  process.env.ZYLOO_API_KEY_2 = "test-secondary-key";
  assert.equal(resolveZylooApiKey(), "test-secondary-key");
  if (saved) process.env.ZYLOO_API_KEY = saved; else delete process.env.ZYLOO_API_KEY;
  if (saved2) process.env.ZYLOO_API_KEY_2 = saved2; else delete process.env.ZYLOO_API_KEY_2;
});

test("resolveZylooApiKeySlot returns primary when primary set", () => {
  const saved = process.env.ZYLOO_API_KEY;
  const saved2 = process.env.ZYLOO_API_KEY_2;
  process.env.ZYLOO_API_KEY = "key1";
  delete process.env.ZYLOO_API_KEY_2;
  assert.equal(resolveZylooApiKeySlot(), "primary");
  if (saved) process.env.ZYLOO_API_KEY = saved; else delete process.env.ZYLOO_API_KEY;
  if (saved2) process.env.ZYLOO_API_KEY_2 = saved2;
});

test("resolveZylooApiKeySlot returns secondary when only secondary set", () => {
  const saved = process.env.ZYLOO_API_KEY;
  const saved2 = process.env.ZYLOO_API_KEY_2;
  delete process.env.ZYLOO_API_KEY;
  process.env.ZYLOO_API_KEY_2 = "key2";
  assert.equal(resolveZylooApiKeySlot(), "secondary");
  if (saved) process.env.ZYLOO_API_KEY = saved;
  if (saved2) process.env.ZYLOO_API_KEY_2 = saved2; else delete process.env.ZYLOO_API_KEY_2;
});

test("resolveZylooApiKeyWithSlot returns key + slot", () => {
  const saved = process.env.ZYLOO_API_KEY;
  const saved2 = process.env.ZYLOO_API_KEY_2;
  process.env.ZYLOO_API_KEY = "primary-key";
  delete process.env.ZYLOO_API_KEY_2;
  const result = resolveZylooApiKeyWithSlot();
  assert.ok(result);
  assert.equal(result!.key, "primary-key");
  assert.equal(result!.slot, "primary");
  if (saved) process.env.ZYLOO_API_KEY = saved; else delete process.env.ZYLOO_API_KEY;
  if (saved2) process.env.ZYLOO_API_KEY_2 = saved2;
});

console.log("\nProvider Resolution:");

test("resolveModel('zyloo:zyloo/kimi-k3') → zyloo_api", () => {
  const result = resolveModel("zyloo:zyloo/kimi-k3");
  assert.equal(result.provider, "zyloo_api");
  assert.equal(result.model, "zyloo/kimi-k3");
});

test("resolveModel('zyloo') → zyloo_api + default model", () => {
  const result = resolveModel("zyloo");
  assert.equal(result.provider, "zyloo_api");
  assert.equal(result.model, "zyloo/kimi-k3");
});

test("getZylooApiConfig returns correct config", () => {
  const config = getZylooApiConfig();
  assert.equal(config.provider, "zyloo_api");
  assert.equal(config.baseURL, "https://api.zyloo.io/v1");
  assert.equal(config.apiKeyEnv, "ZYLOO_API_KEY");
});

console.log("\nProvider Verification:");

test("Verification rejects non-Zyloo model via zyloo_api", () => {
  const result = ProviderVerification.verify("zyloo_api", "zyloo_api", "gpt-4");
  assert.equal(result.verified, false);
  assert.equal(result.checks.modelFamilyMatch, false);
});

test("Verification passes valid zyloo_api execution", () => {
  const saved = process.env.ZYLOO_API_KEY;
  process.env.ZYLOO_API_KEY = "test-key";
  const result = ProviderVerification.verify("zyloo_api", "zyloo_api", "zyloo/kimi-k3");
  assert.equal(result.verified, true);
  assert.equal(result.executionLane, "external_api");
  assert.equal(result.authSource, "ZYLOO_API_KEY");
  if (saved) process.env.ZYLOO_API_KEY = saved; else delete process.env.ZYLOO_API_KEY;
});

test("Verification detects zyloo_api auth unavailable", () => {
  const saved = process.env.ZYLOO_API_KEY;
  const saved2 = process.env.ZYLOO_API_KEY_2;
  delete process.env.ZYLOO_API_KEY;
  delete process.env.ZYLOO_API_KEY_2;
  const result = ProviderVerification.verify("zyloo_api", "zyloo_api", "zyloo/kimi-k3");
  assert.equal(result.verified, false);
  assert.equal(result.checks.authMatch, false);
  if (saved) process.env.ZYLOO_API_KEY = saved;
  if (saved2) process.env.ZYLOO_API_KEY_2 = saved2;
});

test("Verification accepts kimi-k3 (canonical form) on zyloo_api", () => {
  const saved = process.env.ZYLOO_API_KEY;
  process.env.ZYLOO_API_KEY = "test-key";
  const result = ProviderVerification.verify("zyloo_api", "zyloo_api", "kimi-k3");
  assert.equal(result.verified, true);
  assert.equal(result.checks.modelFamilyMatch, true);
  if (saved) process.env.ZYLOO_API_KEY = saved; else delete process.env.ZYLOO_API_KEY;
});

console.log("\nCapability Discovery:");

test("CapabilityDiscovery.discover returns Zyloo K3 models", async () => {
  const result = await CapabilityDiscovery.discover("zyloo_api");
  assert.ok(result.availableModels.length > 0);
  const k3 = result.availableModels.find(m => m.canonicalId === "kimi-k3");
  assert.ok(k3, "should find kimi-k3 in discovered models");
  assert.equal(k3!.upstreamId, "zyloo/kimi-k3");
  assert.equal(k3!.isLegacy, false);
  console.log(`    → upstream: ${k3!.upstreamId}, canonical: ${k3!.canonicalId}`);
});

test("CapabilityDiscovery upstream model IDs map correctly", async () => {
  const result = await CapabilityDiscovery.discover("zyloo_api");
  assert.equal(result.upstreamModelIds["kimi-k3"], "zyloo/kimi-k3");
});

console.log("\nProvider Tiering:");

test("zyloo_api tier is experimental", () => {
  assert.equal(getTier("zyloo_api"), "experimental");
});

console.log("\nGateway Integration:");

test("getIdeCompatibility for kimi-k3 exists", () => {
  const entry = getIdeCompatibility("kimi-k3");
  assert.ok(entry);
  assert.equal(entry!.chatCapable, true);
});

test("resolveModel('zyloo:kimi-k3') does not crash", () => {
  const result = resolveModel("zyloo:kimi-k3");
  assert.equal(result.provider, "zyloo_api");
  assert.equal(result.model, "kimi-k3");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
