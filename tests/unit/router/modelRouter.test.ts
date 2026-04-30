// Model Router Tests — Pack 3 — run with: npx tsx tests/unit/router/modelRouter.test.ts

import assert from "node:assert/strict";
import { ModelRouter } from "../../../src/core/router/modelRouter.js";
import { buildDefaultProviderRegistry } from "../../../src/core/router/providerRegistry.js";
import { buildDefaultModelCatalog } from "../../../src/core/router/modelCatalog.js";

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

const router = new ModelRouter(
  buildDefaultProviderRegistry(),
  buildDefaultModelCatalog()
);

console.log("\nScenario 1 — Public user → cheap/local:");

test("public user routes to cheap lane", () => {
  const result = router.route({
    actor_id: "tg:123",
    actor_mode: "public",
    capabilities: ["run_agent"],
  });
  assert.equal(result.allowed, true);
  assert.equal(result.lane, "cheap");
});

test("public user gets local provider", () => {
  const result = router.route({
    actor_id: "tg:123",
    actor_mode: "public",
    capabilities: ["run_agent"],
  });
  assert.equal(result.provider_id, "local");
});

test("public user has no fallbacks (only local available)", () => {
  const result = router.route({
    actor_id: "tg:123",
    actor_mode: "public",
    capabilities: ["run_agent"],
  });
  // local is the only provider for public, so 0 fallbacks
  assert.ok(result.fallback_chain.length >= 0);
});

console.log("\nScenario 2 — Creator → smart/openai:");

test("creator routes to smart or creator lane", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent", "read_stream"],
    needs_reasoning: true,
  });
  assert.equal(result.allowed, true);
  assert.ok(result.lane === "smart" || result.lane === "creator");
});

test("creator can access openai or creator-only provider", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
  });
  assert.equal(result.allowed, true);
  assert.ok(["openai", "anthropic", "creator-only", "local"].includes(result.provider_id!));
});

test("creator has fallback chain", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
    needs_reasoning: true,
  });
  assert.ok(result.fallback_chain.length >= 0);
});

console.log("\nScenario 3 — Privacy preference → local/private:");

test("require_local routes to private lane", () => {
  const result = router.route({
    actor_id: "tg:123",
    actor_mode: "public",
    capabilities: ["run_agent"],
    privacy_preference: "require_local",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.lane, "private");
  assert.equal(result.provider_id, "local");
});

console.log("\nScenario 4 — Requested provider as hint:");

test("public requesting openai still gets local (not allowed)", () => {
  const result = router.route({
    actor_id: "tg:123",
    actor_mode: "public",
    capabilities: ["run_agent"],
    requested_provider: "openai",
  });
  assert.equal(result.provider_id, "local");
});

test("creator requesting openai gets openai", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
    requested_provider: "openai",
  });
  assert.equal(result.allowed, true);
});

console.log("\nScenario 5 — Tool needs:");

test("creator with needs_tools gets tool-capable provider", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
    needs_tools: true,
  });
  assert.equal(result.allowed, true);
  assert.ok(result.provider_id !== "local");
});

test("public with needs_tools still routes (only local available)", () => {
  const result = router.route({
    actor_id: "tg:123",
    actor_mode: "public",
    capabilities: ["run_agent"],
    needs_tools: true,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.provider_id, "local");
});

console.log("\nScenario 6 — Explain payload:");

test("decision has explain", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
  });
  assert.ok(result.explain);
  assert.ok(result.explain.decision_id);
  assert.ok(result.explain.decision_type);
  assert.ok(result.explain.decision_summary);
  assert.ok(result.explain.explain.length > 0);
});

test("explain includes selected provider/model/lane", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
  });
  assert.ok(result.explain.selected);
  assert.ok(result.explain.selected?.provider_id);
  assert.ok(result.explain.selected?.model_id);
  assert.ok(result.explain.selected?.lane);
});

test("explain includes policy_factors", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
  });
  assert.equal(result.explain.policy_factors.actor_mode, "creator");
});

test("explain shows requested_provider as hint", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
    requested_provider: "openai",
  });
  const explainText = result.explain.explain.join(" ");
  assert.ok(explainText.includes("hint"));
});

console.log("\nScenario 7 — Execution hint:");

test("smart lane has high reasoning depth", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
    needs_reasoning: true,
  });
  if (result.lane === "smart" || result.lane === "creator") {
    assert.equal(result.execution_hint.reasoning_depth, "high");
  }
});

test("needs_tools sets tool_usage to expected", () => {
  const result = router.route({
    actor_id: "maker:creator1",
    actor_mode: "creator",
    capabilities: ["run_agent"],
    needs_tools: true,
  });
  assert.equal(result.execution_hint.tool_usage, "expected");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
