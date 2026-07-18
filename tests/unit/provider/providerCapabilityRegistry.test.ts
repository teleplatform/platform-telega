/**
 * TGP-17C — Capability Registry & Routing Tests
 *
 * Covers:
 * - Declarative capability matrix (default profiles)
 * - hasCapability / levelOf
 * - resolve() filters out incapable providers
 * - fail-open for unknown providers
 * - runtime profile override
 * - filterCapableProviders convenience
 * - planProviderSelection chains capability → health → scoring
 * - excluded providers never reach ranking
 * - determinism
 * - sanitization (no keys in diagnostics)
 */

import assert from "node:assert/strict";
import {
  CapabilityRegistry,
  DEFAULT_CAPABILITY_MATRIX,
  filterCapableProviders,
  planProviderSelection,
  ALL_CAPABILITIES,
  type Capability,
} from "../../../src/core/provider-capability-registry.js";
import {
  resetAll,
  recordSuccess,
  recordFailure,
} from "../../../src/core/provider-health-runtime.js";
import {
  resetScoringConfig,
  resetProviderPolicies,
} from "../../../src/core/provider-scoring-engine.js";

let passed = 0;
let failed = 0;
const seq: (() => Promise<void>)[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  seq.push(async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
    }
  });
}

console.log("\nTGP-17C — Capability Registry & Routing:\n");

test("Default matrix covers all known providers", () => {
  const reg = new CapabilityRegistry();
  const providers = reg.listProviders();
  assert.ok(providers.length > 0, "should have providers");
  for (const p of providers) {
    const profile = reg.getProfile(p);
    assert.ok(profile, `profile for ${p} should exist`);
  }
});

test("ALL_CAPABILITIES are valid keys", () => {
  for (const c of ALL_CAPABILITIES) {
    assert.ok(typeof c === "string");
  }
  assert.ok(ALL_CAPABILITIES.includes("reasoning" as Capability));
});

test("hasCapability returns true for known capability", () => {
  const reg = new CapabilityRegistry();
  assert.equal(reg.hasCapability("kimi_api", "long_context"), true);
  assert.equal(reg.hasCapability("deepseek_api", "code"), true);
  assert.equal(reg.hasCapability("openai_api", "vision"), true);
});

test("hasCapability returns false for missing capability", () => {
  const reg = new CapabilityRegistry();
  // deepseek_api has no 'vision'
  assert.equal(reg.hasCapability("deepseek_api", "vision"), false);
  // local has no 'vision'
  assert.equal(reg.hasCapability("local", "vision"), false);
});

test("levelOf returns correct proficiency", () => {
  const reg = new CapabilityRegistry();
  assert.equal(reg.levelOf("kimi_api", "long_context"), "advanced");
  assert.equal(reg.levelOf("openai_api", "reasoning"), "advanced");
  assert.equal(reg.levelOf("local", "vision"), "none");
});

test("resolve excludes providers missing required capability", () => {
  const reg = new CapabilityRegistry();
  const result = reg.resolve(["openai_api", "deepseek_api", "local"], ["vision"]);
  assert.deepEqual(result.eligible.sort(), ["openai_api"]);
  assert.equal(result.excluded.length, 2);
  const missingLocal = result.excluded.find((e) => e.providerId === "local");
  assert.ok(missingLocal, "local should be excluded");
  assert.deepEqual(missingLocal!.missing, ["vision"]);
});

test("resolve requires ALL capabilities (AND semantics)", () => {
  const reg = new CapabilityRegistry();
  const result = reg.resolve(["openai_api", "deepseek_api"], ["vision", "tools"]);
  // deepseek lacks vision; openai has both
  assert.deepEqual(result.eligible, ["openai_api"]);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].providerId, "deepseek_api");
  assert.ok(result.excluded[0].missing.includes("vision"));
});

test("resolve fail-open for unknown provider", () => {
  const reg = new CapabilityRegistry();
  const result = reg.resolve(["openai_api", "ghost_provider" as any], ["vision"]);
  assert.ok(result.eligible.includes("ghost_provider" as any), "unknown provider treated as capable");
  assert.ok(result.eligible.includes("openai_api"));
});

test("runtime profile override adds capability", () => {
  const reg = new CapabilityRegistry();
  reg.setProfile({ providerId: "local", capabilities: { vision: "basic" } });
  assert.equal(reg.hasCapability("local", "vision"), true);
  assert.equal(reg.levelOf("local", "vision"), "basic");
});

test("reset restores default matrix", () => {
  const reg = new CapabilityRegistry();
  reg.setProfile({ providerId: "local", capabilities: { vision: "advanced" } });
  reg.reset();
  assert.equal(reg.hasCapability("local", "vision"), false);
});

test("filterCapableProviders convenience works", () => {
  const reg = new CapabilityRegistry();
  const filtered = filterCapableProviders(["openai_api", "deepseek_api"], ["vision"], reg);
  assert.deepEqual(filtered, ["openai_api"]);
});

test("filterCapableProviders fail-open on error", () => {
  const broken = { resolve: () => { throw new Error("boom"); } } as any;
  const filtered = filterCapableProviders(["openai_api"], ["vision"], broken);
  assert.deepEqual(filtered, ["openai_api"]);
});

// ─── planProviderSelection (capability → health → scoring) ────────────────────

test("planProviderSelection excludes incapable providers from ranking", () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("openai_api", 100, Date.now());
  recordSuccess("deepseek_api", 100, Date.now());
  const plan = planProviderSelection(["openai_api", "deepseek_api"], ["vision"]);
  assert.ok(!plan.capabilityEligible.includes("deepseek_api"), "deepseek has no vision");
  assert.deepEqual(plan.capabilityEligible, ["openai_api"]);
  assert.ok(plan.ranked.includes("openai_api"));
  assert.equal(plan.selected, "openai_api");
});

test("planProviderSelection ranks capable providers by health+scoring", () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  recordSuccess("zyloo_api", 100, Date.now());
  recordSuccess("zyloo_api", 110, Date.now());
  const plan = planProviderSelection(["kimi_api", "zyloo_api"], ["long_context"]);
  assert.ok(plan.capabilityEligible.includes("kimi_api"));
  assert.ok(plan.capabilityEligible.includes("zyloo_api"));
  assert.ok(plan.ranked.length === 2);
});

test("planProviderSelection degrades to capable-only when all unhealthy", () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("zyloo_api", 100, Date.now());
  for (let i = 0; i < 5; i++) {
    recordFailure("zyloo_api", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  }
  // Only zyloo in candidates, but it's now unavailable → selected null
  const plan = planProviderSelection(["zyloo_api"], ["long_context"]);
  assert.ok(plan.capabilityEligible.includes("zyloo_api"));
  assert.equal(plan.selected, null);
});

test("planProviderSelection is deterministic", () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("openai_api", 100, Date.now());
  recordSuccess("kimi_api", 100, Date.now());
  const p1 = planProviderSelection(["openai_api", "kimi_api"], ["reasoning"]);
  const p2 = planProviderSelection(["openai_api", "kimi_api"], ["reasoning"]);
  assert.deepEqual(p1.ranked, p2.ranked);
  assert.equal(p1.selected, p2.selected);
});

test("planProviderSelection diagnostics are sanitized", () => {
  const plan = planProviderSelection(["openai_api", "kimi_api"], ["reasoning"]);
  const json = JSON.stringify(plan);
  assert.ok(!json.includes("sk-"), "no API keys");
  assert.ok(!json.includes("Bearer"), "no auth headers");
});

test("Empty required capabilities passes all candidates", () => {
  const reg = new CapabilityRegistry();
  const result = reg.resolve(["openai_api", "deepseek_api", "local"], []);
  assert.equal(result.eligible.length, 3);
  assert.equal(result.excluded.length, 0);
});

(async () => {
  for (const fn of seq) await fn();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
