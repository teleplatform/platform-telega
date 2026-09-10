/**
 * Phase 6C.3A — Soft-Hint SHADOW integration tests.
 *
 * Proves the post-selection observer computes hypothetical policy influence
 * against the EXACT production base ranking (`DispatcherRoutingFacts.
 * rankedProviders`), emits evidence, and never changes actual selection.
 *
 *  1. eligible target → hint applied, +0.03, base_score equals plan ranking
 *  2. ineligible target (circuit-open) → hint applied:false (no-op)
 *  3. kill switch / mode OFF → no policy evaluation, no evidence
 *  4. actual plan identical to baseline (no routing authority)
 *  5. no second scoring pass (evidence scores reuse the plan ranking)
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRoutingRegistry } from "@tele-gpt/dispatcher-core";
import { CapabilityRegistry } from "../../src/core/provider-capability-registry.js";
import {
  planProviderSelectionV2,
  parseRouteIntent,
  setDispatcherRoutingObserver,
} from "../../src/core/provider-selection-orchestrator.js";
import {
  resetAll,
  recordSuccess,
  recordFailure,
} from "../../src/core/provider-health-runtime.js";
import {
  resetScoringConfig,
  resetProviderPolicies,
} from "../../src/core/provider-scoring-engine.js";
import {
  clearAuditTrail,
  queryAuditTrail,
} from "../../src/runtime/audit/audit-store.js";
import {
  POLICY_HINT_BONUS,
} from "../../src/core/policy-hint.js";
import {
  createDispatcherShadowObserver,
} from "../../src/server/dispatcher/dispatcher-shadow-observer.js";
import {
  setDispatcher6CMode,
  setDispatcherRouterKillSwitch,
} from "../../src/server/dispatcher/dispatcher-mode.js";

let dataDir: string;

before(() => {
  dataDir = mkdtempSync(join(tmpdir(), "dispatcher-6c3a-"));
  process.env.TELEGPT_DATA_DIR = dataDir;
  clearAuditTrail();
});

after(() => {
  setDispatcherRoutingObserver(undefined);
  setDispatcher6CMode("off");
  setDispatcherRouterKillSwitch(false);
  clearAuditTrail();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  delete process.env.TELEGPT_DATA_DIR;
});

beforeEach(() => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  clearAuditTrail();
  setDispatcher6CMode("off");
  setDispatcherRouterKillSwitch(false);
});

function twoProviderRegistry() {
  return new CapabilityRegistry({
    openai_api: {
      providerId: "openai_api",
      capabilities: { reasoning: "advanced" },
    },
    kimi_api: {
      providerId: "kimi_api",
      capabilities: { reasoning: "advanced" },
    },
  });
}

function seedHealthy(providers: string[]) {
  for (const p of providers) recordSuccess(p, 100, Date.now());
}

function seedCircuitOpen(provider: string) {
  const fail = {
    type: "network",
    shouldRetrySameKey: false,
    shouldCycleCredential: false,
    shouldFallback: true,
    safeMessage: "",
    rawMessage: "",
  } as const;
  for (let k = 0; k < 5; k++) {
    recordFailure(provider, fail, 200, Date.now());
  }
}

function shadowRecords() {
  return queryAuditTrail({ kind: "routing.dispatcher.shadow_decision", order: "asc" });
}

function runShadowPlan(registry: ReturnType<typeof twoProviderRegistry>, requestId: string) {
  const intent = parseRouteIntent("auto");
  return planProviderSelectionV2(intent, requestId, registry);
}

describe("Phase 6C.3A — Soft-Hint SHADOW observer", () => {
  it("eligible target: +0.03 hint, evidence reuses the exact plan ranking", () => {
    setDispatcher6CMode("shadow");
    seedHealthy(["openai_api", "kimi_api"]);
    const registry = twoProviderRegistry();
    const routing = createRoutingRegistry();
    routing.create({
      id: "rule-kimi",
      name: "Kimi target",
      priority: 10,
      enabled: true,
      condition: {},
      action: { routeTo: "kimi_api" },
    });
    setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));

    const plan = runShadowPlan(registry, "req-6c3a-eligible");
    assert.equal(plan.selectedProviderId, "kimi_api");
    const base = plan.rankedProviders[0];
    assert.equal(base.providerId, "kimi_api");

    const records = shadowRecords();
    assert.equal(records.length, 1);
    const p = records[0].payload as any;
    assert.equal(p.policy?.hint_applied, true);
    assert.equal(p.policy?.strength, "low");
    assert.equal(p.policy?.preferred_provider_id, "kimi_api");
    // Exact base ranking reuse — no second scoring pass.
    assert.equal(p.policy?.base_score, base.score);
    assert.equal(p.policy?.policy_bonus, POLICY_HINT_BONUS.low);
    assert.equal(p.policy?.adjusted_score, Math.min(base.score + POLICY_HINT_BONUS.low, 1.0));
    assert.equal(p.policy?.base_rank, 0);
    assert.equal(p.policy?.adjusted_rank, 0);
    assert.equal(p.policy?.hypothetical_provider, "kimi_api");
    assert.equal(p.policy?.actual_provider, "kimi_api");
    assert.equal(p.policy?.decision_changed, false);
    assert.equal(p.policy?.ranking_changed, false);
    assert.equal(p.policy?.preference_defeated, false);
    assert.equal(p.policy?.eligible_provider_count, plan.rankedProviders.length);
    // Preferred already equals production base winner → gap is 0.
    assert.equal(p.policy?.base_winner_provider, "kimi_api");
    assert.equal(p.policy?.base_winner_score, base.score);
    assert.equal(p.policy?.base_score_gap, 0);
  });

  it("defeated target: hint can be overcome by scoring (no artificial win)", () => {
    setDispatcher6CMode("shadow");
    seedHealthy(["openai_api", "kimi_api"]);
    // openai_api ranks below kimi_api (premium cost), gap ~0.04 → +0.03 cannot flip.
    const routing = createRoutingRegistry();
    routing.create({
      id: "rule-openai",
      name: "OpenAI target",
      priority: 10,
      enabled: true,
      condition: {},
      action: { routeTo: "openai_api" },
    });
    setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));

    const plan = runShadowPlan(twoProviderRegistry(), "req-6c3a-defeated");
    assert.equal(plan.selectedProviderId, "kimi_api");
    const p = shadowRecords()[0].payload as any;
    assert.equal(p.policy?.preferred_provider_id, "openai_api");
    assert.equal(p.policy?.hint_applied, true);
    assert.equal(p.policy?.base_rank, 1);
    assert.equal(p.policy?.adjusted_rank, 1); // still below kimi_api
    assert.equal(p.policy?.hypothetical_provider, "kimi_api");
    assert.equal(p.policy?.decision_changed, false);
    assert.equal(p.policy?.ranking_changed, false);
    assert.equal(p.policy?.preference_defeated, true);
    // openai_api sits ~0.04 behind the production base winner → +0.03 cannot flip.
    assert.equal(p.policy?.base_winner_provider, "kimi_api");
    assert.ok(
      Math.abs(p.policy?.base_score_gap - 0.04) < 0.005,
      `gap ~0.04, got ${p.policy?.base_score_gap}`,
    );
  });

  it("ineligible target (circuit-open): hint no-op, evidence marks hint_applied=false", () => {
    setDispatcher6CMode("shadow");
    seedHealthy(["openai_api"]);
    seedCircuitOpen("zyloo_api");
    const registry = new CapabilityRegistry({
      openai_api: { providerId: "openai_api", capabilities: { reasoning: "advanced" } },
      zyloo_api: { providerId: "zyloo_api", capabilities: { reasoning: "advanced" } },
    });
    const routing = createRoutingRegistry();
    routing.create({
      id: "rule-zyloo",
      name: "Zyloo target",
      priority: 10,
      enabled: true,
      condition: {},
      action: { routeTo: "zyloo_api" },
    });
    setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));

    const plan = runShadowPlan(registry, "req-6c3a-ineligible");
    assert.equal(plan.selectedProviderId, "openai_api");
    const p = shadowRecords()[0].payload as any;
    assert.equal(p.policy?.preferred_provider_id, "zyloo_api");
    assert.equal(p.policy?.hint_applied, false);
    assert.equal(p.policy?.base_rank, null);
    assert.equal(p.policy?.adjusted_rank, null);
    assert.equal(p.policy?.decision_changed, false);
    assert.equal(p.policy?.preference_defeated, false);
  });

  it("no winning rule → no policy evidence", () => {
    setDispatcher6CMode("shadow");
    seedHealthy(["openai_api", "kimi_api"]);
    const routing = createRoutingRegistry();
    routing.create({
      id: "vision-only",
      name: "Vision only",
      priority: 10,
      enabled: true,
      condition: { capability: "vision" },
      action: { routeTo: "kimi_api" },
    });
    setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));

    runShadowPlan(twoProviderRegistry(), "req-6c3a-nomatch");
    const p = shadowRecords()[0].payload as any;
    assert.equal(p.policy, null);
  });

  it("actual plan unchanged by hint evaluation (no routing authority)", () => {
    setDispatcher6CMode("shadow");
    seedHealthy(["openai_api", "kimi_api"]);
    const routing = createRoutingRegistry();
    routing.create({
      id: "rule-openai",
      name: "OpenAI target",
      priority: 10,
      enabled: true,
      condition: {},
      action: { routeTo: "openai_api" },
    });
    setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));

    const withObserver = runShadowPlan(twoProviderRegistry(), "req-with");
    setDispatcherRoutingObserver(undefined);
    const baseline = runShadowPlan(twoProviderRegistry(), "req-base");
    assert.equal(withObserver.selectedProviderId, baseline.selectedProviderId);
    assert.equal(withObserver.selectedModel, baseline.selectedModel);
    assert.deepEqual(withObserver.eligibleProviders, baseline.eligibleProviders);
    assert.deepEqual(withObserver.consideredProviders, baseline.consideredProviders);
    assert.deepEqual(withObserver.fallbackOrder, baseline.fallbackOrder);
    assert.deepEqual(withObserver.rankedProviders, baseline.rankedProviders);
  });

  it("kill switch disables policy evaluation and evidence", () => {
    setDispatcher6CMode("shadow");
    seedHealthy(["openai_api", "kimi_api"]);
    const routing = createRoutingRegistry();
    routing.create({
      id: "rule-kimi",
      name: "Kimi target",
      priority: 10,
      enabled: true,
      condition: {},
      action: { routeTo: "kimi_api" },
    });
    setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));

    runShadowPlan(twoProviderRegistry(), "req-1");
    assert.equal(shadowRecords().length, 1);

    setDispatcherRouterKillSwitch(true);
    runShadowPlan(twoProviderRegistry(), "req-2");
    assert.equal(shadowRecords().length, 1, "no new evidence after kill switch");
  });

  it("mode OFF disables policy evaluation and evidence", () => {
    seedHealthy(["openai_api", "kimi_api"]);
    const routing = createRoutingRegistry();
    routing.create({
      id: "rule-kimi",
      name: "Kimi target",
      priority: 10,
      enabled: true,
      condition: {},
      action: { routeTo: "kimi_api" },
    });
    setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));

    runShadowPlan(twoProviderRegistry(), "req-off");
    assert.equal(shadowRecords().length, 0);
  });
});