/**
 * Phase 6C.1 — Dispatcher SHADOW integration tests.
 *
 * Covers acceptance gates 1–9 for the SHADOW stage only:
 *   1  no-op invariant (OFF / no observer → plan identical to pre-6C)
 *   2  fail-open (observer/evaluation failures → plan unchanged)
 *   3  eligibility respected (ineligible/unknown targets never influence plan)
 *   4  capability respected (override cannot introduce incapable providers)
 *   5  SHADOW purity (never changes selectedProviderId/selectedModel)
 *   6  audit correctness (one routing.dispatcher.shadow_decision per request
 *      with requestId, actual vs dispatcher, converged flag)
 *   7  kill switch (mid-run engage → baseline, emission stops)
 *   8  mode transitions OFF ↔ SHADOW (rollback drill, 6C-limited variant)
 *   9  divergence review records (agree / different_target / no_match)
 *
 * Used module-global simulators directly (no live traffic); routing rules are
 * a plain in-memory RoutingRegistry so nothing touches the real control plane.
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import Database from "better-sqlite3";
import { createRoutingRegistry } from "@tele-gpt/dispatcher-core";
import { CapabilityRegistry } from "../../src/core/provider-capability-registry.js";
import {
  planProviderSelectionV2,
  parseRouteIntent,
  setDispatcherRoutingObserver,
  getDispatcherRoutingObserver,
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
  createDispatcherShadowObserver,
} from "../../src/server/dispatcher/dispatcher-shadow-observer.js";
import {
  setDispatcher6CMode,
  setDispatcherRouterKillSwitch,
} from "../../src/server/dispatcher/dispatcher-mode.js";

const { registerDispatcherRoute } = await import(
  "../../src/server/routes/dispatcher.route.js"
);

const ROUTING_KINDS = [
  "routing.dispatcher.shadow_decision",
  "routing.dispatcher.divergence",
  "routing.dispatcher.error",
] as const;

let dataDir: string;
let bootCount = 0;

before(() => {
  dataDir = mkdtempSync(join(tmpdir(), "dispatcher-6c-"));
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

function singleProviderRegistry() {
  return new CapabilityRegistry({
    openai_api: {
      providerId: "openai_api",
      capabilities: { reasoning: "advanced" },
    },
  });
}

function healthyOpenai() {
  recordSuccess("openai_api", 100, Date.now());
}

function shadowRecords() {
  return queryAuditTrail({ kind: "routing.dispatcher.shadow_decision", order: "asc" });
}

function anyRoutingRecords() {
  return queryAuditTrail({ kinds: [...ROUTING_KINDS] });
}

function baselinePlan() {
  healthyOpenai();
  const intent = parseRouteIntent("auto");
  return planProviderSelectionV2(intent, "req-baseline", singleProviderRegistry());
}

function planWithObserver(observer: ReturnType<typeof createDispatcherShadowObserver> | { observe: () => { kind: "none" } }, requestId = "req-shadow") {
  setDispatcherRoutingObserver(observer);
  healthyOpenai();
  const intent = parseRouteIntent("auto");
  return planProviderSelectionV2(intent, requestId, singleProviderRegistry());
}

describe("Phase 6C.1 — Dispatcher SHADOW integration", () => {
  describe("gate 1 — no-op invariant", () => {
    it("no observer installed → plan identical to pre-6C, no routing records", () => {
      setDispatcherRoutingObserver(undefined);
      const plan = baselinePlan();
      assert.equal(plan.selectedProviderId, "openai_api");
      assert.deepEqual(plan.eligibleProviders, ["openai_api"]);
      assert.equal(anyRoutingRecords().length, 0);
    });

    it("observer installed but mode OFF → rules never evaluated, no records", () => {
      const routing = createRoutingRegistry();
      routing.create({
        id: "catch-all",
        name: "Catch all",
        priority: 100,
        enabled: true,
        condition: {},
        action: { routeTo: "zyloo_api" },
      });
      const observer = createDispatcherShadowObserver({ routing });
      const plan = planWithObserver(observer);
      assert.equal(plan.selectedProviderId, "openai_api");
      assert.equal(anyRoutingRecords().length, 0);
    });
  });

  describe("gate 5 — SHADOW purity", () => {
    it("SHADOW never changes the selection vs baseline, regardless of rule", () => {
      setDispatcher6CMode("shadow");
      const base = baselinePlan();
      const routing = createRoutingRegistry();
      routing.create({
        id: "different-target",
        name: "Different target",
        priority: 100,
        enabled: true,
        condition: {},
        action: { routeTo: "zyloo_api" },
      });
      const observer = createDispatcherShadowObserver({ routing });
      const plan = planWithObserver(observer, "req-purity");
      assert.equal(plan.selectedProviderId, base.selectedProviderId);
      assert.equal(plan.selectedModel, base.selectedModel);
      assert.deepEqual(plan.eligibleProviders, base.eligibleProviders);
      assert.deepEqual(plan.consideredProviders, base.consideredProviders);
      assert.equal(plan.fallbackOrder.length, base.fallbackOrder.length);
    });
  });

  describe("gate 6 — audit correctness", () => {
    it("emits exactly one shadow_decision per covered request with full diff", () => {
      setDispatcher6CMode("shadow");
      const routing = createRoutingRegistry();
      routing.create({
        id: "divert",
        name: "Divert to zyloo",
        priority: 100,
        enabled: true,
        condition: {},
        action: { routeTo: "zyloo_api", fallback: "openai_api" },
      });
      const observer = createDispatcherShadowObserver({ routing });
      planWithObserver(observer, "req-abc");

      const records = shadowRecords();
      assert.equal(records.length, 1);
      const event = records[0];
      assert.equal(event.kind, "routing.dispatcher.shadow_decision");
      assert.equal(event.traceId, "req-abc");
      assert.equal(event.actor, "dispatcher");

      const payload = event.payload as any;
      assert.equal(payload.mode, "shadow");
      assert.equal(payload.actual.provider_id, "openai_api");
      assert.equal(payload.dispatcher.outcome, "matched");
      assert.equal(payload.dispatcher.route_to, "zyloo_api");
      assert.equal(payload.dispatcher.winner_rule_id, "divert");
      assert.equal(payload.dispatcher.matched_rule_count, 1);
      assert.equal(payload.converged, false);
      assert.equal(payload.divergence.kind, "different_target");
      assert.ok(payload.decision_id);
      assert.ok(payload.timestamp);
    });

    it("one request → exactly one record (no duplicate shadow_decision)", () => {
      setDispatcher6CMode("shadow");
      const routing = createRoutingRegistry();
      routing.create({
        id: "catch",
        name: "Catch",
        priority: 10,
        enabled: true,
        condition: {},
        action: { routeTo: "openai_api" },
      });
      const observer = createDispatcherShadowObserver({ routing });
      planWithObserver(observer, "req-single");
      assert.equal(shadowRecords().length, 1);
    });
  });

  describe("gate 9 — divergence cases", () => {
    it("agree: rule target equals actual selection", () => {
      setDispatcher6CMode("shadow");
      const routing = createRoutingRegistry();
      routing.create({
        id: "agree",
        name: "Agree",
        priority: 10,
        enabled: true,
        condition: {},
        action: { routeTo: "openai_api" },
      });
      planWithObserver(createDispatcherShadowObserver({ routing }), "req-agree");
      const p = shadowRecords()[0].payload as any;
      assert.equal(p.dispatcher.outcome, "matched");
      assert.equal(p.converged, true);
      assert.equal(p.divergence.kind, "agree");
    });

    it("no_match: no enabled rule matches the request facts", () => {
      setDispatcher6CMode("shadow");
      const routing = createRoutingRegistry();
      routing.create({
        id: "vision-only",
        name: "Vision only",
        priority: 10,
        enabled: true,
        condition: { capability: "vision" },
        action: { routeTo: "openai_api" },
      });
      planWithObserver(createDispatcherShadowObserver({ routing }), "req-nomatch");
      const p = shadowRecords()[0].payload as any;
      assert.equal(p.dispatcher.outcome, "no_match");
      assert.equal(p.dispatcher.winner_rule_id, undefined);
      assert.equal(p.dispatcher.matched_rule_count, 0);
      assert.equal(p.converged, false);
      assert.equal(p.divergence.kind, "no_match");
    });

    it("deterministic: identical facts produce identical dispatcher verdicts", () => {
      setDispatcher6CMode("shadow");
      const routing = createRoutingRegistry();
      routing.create({
        id: "det",
        name: "Det",
        priority: 10,
        enabled: true,
        condition: {},
        action: { routeTo: "zyloo_api" },
      });
      const observer = createDispatcherShadowObserver({ routing });
      planWithObserver(observer, "req-det-1");
      planWithObserver(observer, "req-det-2");
      const [a, b] = shadowRecords();
      assert.deepEqual(
        (a.payload as any).dispatcher,
        (b.payload as any).dispatcher,
      );
      assert.equal(
        (a.payload as any).divergence.kind,
        (b.payload as any).divergence.kind,
      );
    });
  });

  describe("gates 3 & 4 — eligibility and capability respected", () => {
    it("rule target that is circuit-open cannot influence the plan", () => {
      setDispatcher6CMode("shadow");
      const registry = new CapabilityRegistry({
        openai_api: {
          providerId: "openai_api",
          capabilities: { reasoning: "advanced" },
        },
        zyloo_api: {
          providerId: "zyloo_api",
          capabilities: { reasoning: "advanced" },
        },
      });
      recordSuccess("openai_api", 100, Date.now());
      for (let k = 0; k < 5; k++) {
        recordFailure(
          "zyloo_api",
          {
            type: "network",
            shouldRetrySameKey: false,
            shouldCycleCredential: false,
            shouldFallback: true,
            safeMessage: "",
            rawMessage: "",
          },
          200,
          Date.now(),
        );
      }
      const routing = createRoutingRegistry();
      routing.create({
        id: "zyloo",
        name: "Zyloo target",
        priority: 10,
        enabled: true,
        condition: {},
        action: { routeTo: "zyloo_api" },
      });
      setDispatcherRoutingObserver(createDispatcherShadowObserver({ routing }));
      const intent = parseRouteIntent("auto");
      const plan = planProviderSelectionV2(intent, "req-ineligible", registry);
      assert.equal(plan.selectedProviderId, "openai_api");
      assert.ok(plan.healthRejected.some((h) => h.providerId === "zyloo_api"));
      const p = shadowRecords()[0].payload as any;
      assert.equal(p.dispatcher.route_to, "zyloo_api");
      assert.equal(p.divergence.kind, "different_target");
    });

    it("rule target not in the capability registry cannot influence the plan", () => {
      setDispatcher6CMode("shadow");
      const routing = createRoutingRegistry();
      routing.create({
        id: "ghost",
        name: "Ghost target",
        priority: 10,
        enabled: true,
        condition: {},
        action: { routeTo: "kimi_api" },
      });
      const plan = planWithObserver(
        createDispatcherShadowObserver({ routing }),
        "req-unknown",
      );
      assert.equal(plan.selectedProviderId, "openai_api");
      assert.deepEqual(plan.consideredProviders, ["openai_api"]);
    });
  });

  describe("gate 7 & 8 — kill switch and mode transitions", () => {
    it("engaging kill switch mid-run returns to baseline and stops emission", () => {
      setDispatcher6CMode("shadow");
      const routing = createRoutingRegistry();
      routing.create({
        id: "agree",
        name: "Agree",
        priority: 10,
        enabled: true,
        condition: {},
        action: { routeTo: "openai_api" },
      });
      const observer = createDispatcherShadowObserver({ routing });
      const planBefore = planWithObserver(observer, "req-switch-on");
      assert.equal(shadowRecords().length, 1);

      setDispatcherRouterKillSwitch(true);
      const planAfter = planWithObserver(observer, "req-switch-off");
      assert.equal(planAfter.selectedProviderId, planBefore.selectedProviderId);
      assert.equal(shadowRecords().length, 1, "no new records after kill switch");
    });

    it("mode shadow → off stops emission without code changes", () => {
      const routing = createRoutingRegistry();
      routing.create({
        id: "agree",
        name: "Agree",
        priority: 10,
        enabled: true,
        condition: {},
        action: { routeTo: "openai_api" },
      });
      const observer = createDispatcherShadowObserver({ routing });

      setDispatcher6CMode("shadow");
      planWithObserver(observer, "req-toggle-a");
      assert.equal(shadowRecords().length, 1);

      setDispatcher6CMode("off");
      planWithObserver(observer, "req-toggle-b");
      assert.equal(shadowRecords().length, 1, "no records while OFF");
    });
  });

  describe("gate 2 — fail-open", () => {
    it("observer throwing → plan unchanged, no crash", () => {
      const badObserver = {
        observe() {
          throw new Error("boom");
        },
      };
      const plan = planWithObserver(
        badObserver as any,
        "req-throw",
      );
      assert.equal(plan.selectedProviderId, "openai_api");
      assert.equal(anyRoutingRecords().length, 0);
    });

    it("rule evaluation failure → plan unchanged, error audited", () => {
      setDispatcher6CMode("shadow");
      const throwingRouting = {
        list() {
          throw new Error("registry unavailable");
        },
      } as ReturnType<typeof createRoutingRegistry>;
      const plan = planWithObserver(
        createDispatcherShadowObserver({ routing: throwingRouting }),
        "req-eval-fail",
      );
      assert.equal(plan.selectedProviderId, "openai_api");
      const errors = queryAuditTrail({ kind: "routing.dispatcher.error" });
      assert.equal(errors.length, 1);
      assert.equal((errors[0].payload as any).error, "registry unavailable");
    });
  });

  describe("HTTP surface — status and kill-switch guard", () => {
    it("GET /dispatcher/routing/status reports phase 6C.1 state", async () => {
      setDispatcher6CMode("shadow");
      const app = Fastify({ logger: false });
      const db = new Database(join(dataDir, `tele-gpt-${bootCount++}.sqlite`));
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      await registerDispatcherRoute(app, db);

      const res = await app.inject({ method: "GET", url: "/dispatcher/routing/status" });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.mode, "shadow");
      assert.equal(body.killSwitch, false);
      assert.equal(body.shadowEnabled, true);
      assert.equal(body.observerInstalled, true);
    });

    it("POST /dispatcher/routing/kill-switch rejects unauthenticated callers", async () => {
      const app = Fastify({ logger: false });
      const db = new Database(join(dataDir, `tele-gpt-${bootCount++}.sqlite`));
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      await registerDispatcherRoute(app, db);

      const res = await app.inject({
        method: "POST",
        url: "/dispatcher/routing/kill-switch",
        payload: { enabled: true },
      });
      assert.equal(res.statusCode, 401);
      assert.equal(getDispatcherRoutingObserver() !== undefined, true);
    });
  });
});