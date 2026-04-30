// Explain Builder Tests — Pack 3 — run with: npx tsx tests/unit/trace/explainBuilder.test.ts

import assert from "node:assert/strict";
import { buildExplainForDecision, buildFallbackExplain } from "../../../src/core/trace/explainBuilder.js";

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

console.log("\nbuildExplainForDecision — success:");

test("returns valid explain payload", () => {
  const explain = buildExplainForDecision({
    decision_id: "dec_test_001",
    decision_type: "router.model.select",
    actor_id: "maker:creator1",
    actor_mode: "creator",
    selected: {
      lane: "smart",
      provider_id: "openai",
      model_id: "gpt-4o",
    },
    rejected: [],
    policy_factors: {
      actor_mode: "creator",
      budget_class: "medium",
      privacy_preference: "allow_remote",
    },
    score: 85.5,
    fallback_count: 2,
  });

  assert.equal(explain.decision_id, "dec_test_001");
  assert.equal(explain.decision_type, "router.model.select");
  assert.ok(explain.decision_summary);
  assert.ok(explain.explain.length > 0);
  assert.equal(explain.selected?.provider_id, "openai");
  assert.equal(explain.selected?.model_id, "gpt-4o");
  assert.equal(explain.selected?.lane, "smart");
});

test("explain includes score", () => {
  const explain = buildExplainForDecision({
    decision_id: "dec_test_002",
    decision_type: "router.model.select",
    actor_id: "tg:123",
    actor_mode: "public",
    selected: {
      lane: "cheap",
      provider_id: "local",
      model_id: "local-model",
    },
    rejected: [],
    policy_factors: {
      actor_mode: "public",
    },
    score: 72.3,
  });
  assert.ok(explain.explain.some((e) => e.includes("score=72.3")));
});

test("explain includes rejected alternatives", () => {
  const explain = buildExplainForDecision({
    decision_id: "dec_test_003",
    decision_type: "router.model.select",
    actor_id: "maker:creator1",
    actor_mode: "creator",
    selected: {
      lane: "smart",
      provider_id: "openai",
      model_id: "gpt-4o",
    },
    rejected: [
      {
        kind: "provider",
        id: "local",
        reason_code: "INSUFFICIENT_REASONING",
        explain: ["local provider has low reasoning score"],
      },
    ],
    policy_factors: {
      actor_mode: "creator",
    },
    score: 85.5,
    fallback_count: 1,
  });
  assert.ok(explain.explain.some((e) => e.includes("rejected_alternatives=1")));
});

test("explain shows requested_provider as hint", () => {
  const explain = buildExplainForDecision({
    decision_id: "dec_test_004",
    decision_type: "router.model.select",
    actor_id: "maker:creator1",
    actor_mode: "creator",
    selected: {
      lane: "smart",
      provider_id: "openai",
      model_id: "gpt-4o",
    },
    rejected: [],
    policy_factors: {
      actor_mode: "creator",
      requested_provider: "openai",
      requested_model: "gpt-4o",
    },
    score: 90,
  });
  assert.ok(explain.explain.some((e) => e.includes("hint")));
});

console.log("\nbuildExplainForDecision — reject:");

test("reject decision has correct reason_code", () => {
  const explain = buildExplainForDecision({
    decision_id: "dec_test_005",
    decision_type: "router.reject",
    actor_id: "tg:123",
    actor_mode: "public",
    selected: null,
    rejected: [],
    policy_factors: {
      actor_mode: "public",
    },
    score: 0,
    fallback_count: 0,
    reject_reason: "No providers available for this policy",
  });
  assert.equal(explain.reason_code, "ROUTING_REJECTED");
  assert.ok(explain.reject_reason);
});

console.log("\nbuildFallbackExplain:");

test("fallback explain has correct structure", () => {
  const explain = buildFallbackExplain(
    "dec_test_001",
    "openai",
    "gpt-4o",
    "local",
    "local-model",
    "timeout"
  );
  assert.equal(explain.decision_type, "router.fallback");
  assert.ok(explain.decision_summary.includes("fallback"));
  assert.equal(explain.selected?.provider_id, "local");
  assert.equal(explain.rejected.length, 1);
  assert.equal(explain.rejected[0].id, "openai");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
