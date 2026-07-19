/**
 * TGP-17D — Provider Selection Orchestrator Tests
 *
 * Covers: route intent parsing, candidate construction, immutable selection
 * plan, preferred vs required semantics, fallback order, deterministic plans,
 * sanitized errors, evidence fields.
 */

import assert from "node:assert/strict";
import {
  parseRouteIntent,
  buildProviderCandidates,
  planProviderSelectionV2,
  selectProvider,
  ProviderSelectionError,
  SELECTION_ERROR_HTTP,
  type ProviderRouteIntent,
} from "../../../src/core/provider-selection-orchestrator.js";
import { CapabilityRegistry } from "../../../src/core/provider-capability-registry.js";
import {
  resetAll,
  recordSuccess,
  recordFailure,
} from "../../../src/core/provider-health-runtime.js";
import {
  resetScoringConfig,
  resetProviderPolicies,
} from "../../../src/core/provider-scoring-engine.js";
import { capabilityRegistry } from "../../../src/core/provider-capability-registry.js";

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

console.log("\nTGP-17D — Provider Selection Orchestrator:\n");

// ─── 17D.1 Route intent parsing ───────────────────────────────────────────────

test("auto intent parsing", () => {
  const i = parseRouteIntent("auto");
  assert.equal(i.mode, "auto");
  assert.equal(i.allowFallback, true);
  assert.equal(i.source, "auto");
});

test("empty model → auto mode", () => {
  const i = parseRouteIntent(undefined);
  assert.equal(i.mode, "auto");
});

test("preferred prefix parsing (kimi:)", () => {
  const i = parseRouteIntent("kimi:kimi-k3");
  assert.equal(i.mode, "preferred_provider");
  assert.equal(i.requestedProviderId, "kimi_api");
  assert.equal(i.requestedModel, "kimi-k3");
  assert.equal(i.requestedProviderFamily, "kimi");
  assert.equal(i.source, "model_prefix");
});

test("preferred prefix parsing (zyloo:)", () => {
  const i = parseRouteIntent("zyloo:zyloo/kimi-k3");
  assert.equal(i.mode, "preferred_provider");
  assert.equal(i.requestedProviderId, "zyloo_api");
  assert.equal(i.requestedModel, "zyloo/kimi-k3");
});

test("local prefix parsing", () => {
  const i = parseRouteIntent("local:auto");
  assert.equal(i.mode, "preferred_provider");
  assert.equal(i.requestedProviderId, "local");
});

test("unknown prefix → deterministic local fallback", () => {
  const i = parseRouteIntent("weirdmodel:xyz");
  assert.equal(i.mode, "preferred_provider");
  assert.equal(i.requestedProviderId, "local");
  assert.equal(i.requestedProviderFamily, "weirdmodel");
});

test("strict flag produces required_provider mode", () => {
  const i = parseRouteIntent("kimi:kimi-k3", { strict: true });
  assert.equal(i.mode, "required_provider");
});

test("noFallback disables fallback on preferred route", () => {
  const i = parseRouteIntent("kimi:kimi-k3", { noFallback: true });
  assert.equal(i.allowFallback, false);
});

test("required capabilities passed through from metadata", () => {
  const i = parseRouteIntent("auto", { requiredCapabilities: ["reasoning", "vision"] as any });
  assert.deepEqual(i.requiredCapabilities, ["reasoning", "vision"]);
});

// ─── 17D.2 Candidate construction ─────────────────────────────────────────────

test("auto candidates = all registered providers", () => {
  const i = parseRouteIntent("auto");
  const c = buildProviderCandidates(i);
  assert.ok(c.includes("openai_api"));
  assert.ok(c.includes("kimi_api"));
  assert.ok(c.includes("local"));
  // no duplicates
  assert.equal(new Set(c).size, c.length);
});

test("preferred candidates put requested first, dedupe", () => {
  const i: ProviderRouteIntent = {
    mode: "preferred_provider", requestedProviderId: "kimi_api",
    allowFallback: true, requiredCapabilities: [], source: "model_prefix",
  };
  const c = buildProviderCandidates(i);
  assert.equal(c[0], "kimi_api");
  assert.equal(new Set(c).size, c.length, "no duplicates");
});

test("required candidates = single requested provider", () => {
  const i: ProviderRouteIntent = {
    mode: "required_provider", requestedProviderId: "zyloo_api",
    allowFallback: false, requiredCapabilities: [], source: "model_prefix",
  };
  const c = buildProviderCandidates(i);
  assert.deepEqual(c, ["zyloo_api"]);
});

// ─── 17D.2/3 selection plan behavior ──────────────────────────────────────────

test("preferred provider capable+healthy → selected", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  const i = parseRouteIntent("kimi:kimi-k3");
  const plan = planProviderSelectionV2(i);
  assert.equal(plan.selectedProviderId, "kimi_api");
  assert.equal(plan.selectedModel, "kimi-k3");
  assert.ok(plan.fallbackOrder.length > 0);
});

test("preferred provider incapable → fallback to capable", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  // deepseek has no vision; require vision so kimi (no vision) falls back
  const i = parseRouteIntent("kimi:kimi-k3", { requiredCapabilities: ["vision"] as any });
  const plan = planProviderSelectionV2(i);
  assert.notEqual(plan.selectedProviderId, "kimi_api", "kimi lacks vision");
  assert.ok(plan.capabilityRejected.some(r => r.providerId === "kimi_api" && r.reason === "missing_capability"));
});

test("preferred provider unavailable → fallback", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  for (let k = 0; k < 5; k++) {
    recordFailure("kimi_api", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  }
  const i = parseRouteIntent("kimi:kimi-k3");
  const plan = planProviderSelectionV2(i);
  assert.notEqual(plan.selectedProviderId, "kimi_api");
  assert.ok(plan.healthRejected.some(r => r.providerId === "kimi_api"));
});

test("preferred provider open circuit → fallback", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  // 5 failures within window opens circuit (default threshold)
  for (let k = 0; k < 5; k++) {
    recordFailure("zyloo_api", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  }
  recordSuccess("kimi_api", 100, Date.now());
  const i = parseRouteIntent("zyloo:zyloo/kimi-k3");
  const plan = planProviderSelectionV2(i);
  assert.notEqual(plan.selectedProviderId, "zyloo_api");
  assert.ok(plan.healthRejected.some(r => r.providerId === "zyloo_api" && r.reason === "circuit_open"));
});

test("strict provider incapable → terminal error", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  const i = parseRouteIntent("kimi:kimi-k3", { strict: true, requiredCapabilities: ["vision"] as any });
  try {
    planProviderSelectionV2(i);
    assert.fail("should throw");
  } catch (e: any) {
    assert.equal(e.code, "REQUIRED_PROVIDER_UNAVAILABLE");
    assert.equal(e.statusCode, 503);
  }
});

test("strict provider unavailable → terminal error", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  for (let k = 0; k < 5; k++) {
    recordFailure("kimi_api", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  }
  const i = parseRouteIntent("kimi:kimi-k3", { strict: true });
  try {
    planProviderSelectionV2(i);
    assert.fail("should throw");
  } catch (e: any) {
    assert.equal(e.code, "REQUIRED_PROVIDER_UNAVAILABLE");
    assert.equal(e.statusCode, 503);
  }
});

test("strict route with fallback explicitly enabled still pins", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  const i = parseRouteIntent("kimi:kimi-k3", { strict: true, noFallback: false });
  const plan = planProviderSelectionV2(i);
  assert.equal(plan.selectedProviderId, "kimi_api");
  // fallback order should be empty for strict even if allowFallback true
  assert.deepEqual(plan.fallbackOrder, []);
});

test("required provider unknown → 400", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  const i: ProviderRouteIntent = {
    mode: "required_provider", requestedProviderId: "ghost_provider" as any,
    allowFallback: false, requiredCapabilities: [], source: "runtime_policy",
  };
  try {
    planProviderSelectionV2(i);
    assert.fail("should throw");
  } catch (e: any) {
    assert.equal(e.code, "REQUIRED_PROVIDER_UNKNOWN");
    assert.equal(e.statusCode, 400);
  }
});

test("auto route unchanged (selects best eligible)", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  recordSuccess("zyloo_api", 100, Date.now());
  const i = parseRouteIntent("auto");
  const plan = planProviderSelectionV2(i);
  assert.ok(plan.selectedProviderId, "should select someone");
  assert.equal(plan.intent.mode, "auto");
});

test("all candidates exhausted → NO_ELIGIBLE_PROVIDER", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  // Use a restricted registry with only these providers to ensure exhaustion
  const restrictedRegistry = new CapabilityRegistry({
    kimi_api: { providerId: "kimi_api", capabilities: { reasoning: "advanced" } },
    zyloo_api: { providerId: "zyloo_api", capabilities: { reasoning: "advanced" } },
    local: { providerId: "local", capabilities: { reasoning: "basic" } },
  });
  for (const p of ["kimi_api", "zyloo_api", "local"]) {
    recordSuccess(p, 100, Date.now());
    for (let k = 0; k < 5; k++) {
      recordFailure(p, { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
    }
  }
  const i = parseRouteIntent("auto");
  try {
    planProviderSelectionV2(i, undefined, restrictedRegistry);
    assert.fail("should throw");
  } catch (e: any) {
    assert.equal(e.code, "NO_ELIGIBLE_PROVIDER");
    assert.equal(e.statusCode, 503);
  }
});

test("deterministic selection plan", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  recordSuccess("zyloo_api", 100, Date.now());
  const i = parseRouteIntent("auto");
  const a = planProviderSelectionV2(i);
  const b = planProviderSelectionV2(i);
  assert.equal(a.selectedProviderId, b.selectedProviderId);
  assert.deepEqual(a.fallbackOrder, b.fallbackOrder);
});

test("fallbackOrder excludes selected provider", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  recordSuccess("zyloo_api", 100, Date.now());
  const i = parseRouteIntent("auto");
  const plan = planProviderSelectionV2(i);
  assert.ok(!plan.fallbackOrder.includes(plan.selectedProviderId!));
});

test("capability rejection recorded in plan", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  const i = parseRouteIntent("auto", { requiredCapabilities: ["vision"] as any });
  const plan = planProviderSelectionV2(i);
  assert.ok(plan.capabilityRejected.length > 0);
  assert.ok(plan.capabilityRejected.every(r => r.reason === "missing_capability"));
});

test("health rejection recorded in plan", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  for (let k = 0; k < 5; k++) {
    recordFailure("zyloo_api", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  }
  const i = parseRouteIntent("auto");
  const plan = planProviderSelectionV2(i);
  assert.ok(plan.healthRejected.some(r => r.providerId === "zyloo_api"));
});

test("selectProvider convenience returns plan", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  const plan = selectProvider("kimi:kimi-k3", { requestId: "req-1" });
  assert.equal(plan.requestId, "req-1");
  assert.equal(plan.selectedProviderId, "kimi_api");
});

test("selection plan JSON is sanitized (no keys)", () => {
  resetScoringConfig(); resetProviderPolicies(); resetAll();
  recordSuccess("kimi_api", 100, Date.now());
  const plan = planProviderSelectionV2(parseRouteIntent("kimi:kimi-k3"));
  const json = JSON.stringify(plan);
  assert.ok(!json.includes("sk-"));
  assert.ok(!json.includes("Bearer"));
});

test("HTTP mapping defined for all selection errors", () => {
  for (const code of ["NO_CAPABLE_PROVIDER","NO_ELIGIBLE_PROVIDER","REQUIRED_PROVIDER_UNKNOWN","REQUIRED_PROVIDER_UNAVAILABLE","SELECTION_PLAN_EXHAUSTED"] as const) {
    assert.ok(typeof SELECTION_ERROR_HTTP[code] === "number");
    assert.notEqual(SELECTION_ERROR_HTTP[code], 500, `${code} must not map to 500`);
  }
});

(async () => {
  for (const fn of seq) await fn();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
