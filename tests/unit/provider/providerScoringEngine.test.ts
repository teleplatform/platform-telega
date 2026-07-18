/**
 * TGP-17B — Provider Scoring Engine Tests
 *
 * Comprehensive tests covering:
 * - Deterministic ranking
 * - Identical inputs produce same ordering
 * - Weight changes affect ranking
 * - Degraded provider loses score
 * - Unavailable provider excluded
 * - Latency influence
 * - Availability influence
 * - Failure-rate influence
 * - Priority influence
 * - Cost influence
 * - Score breakdown correctness
 * - Ranking stability
 * - Diagnostics
 * - Sanitized responses
 * - No regression
 */

import assert from "node:assert/strict";
import {
  scoreProvider,
  rankProviders,
  selectBestProvider,
  setScoringConfig,
  getScoringConfig,
  resetScoringConfig,
  setProviderPolicies,
  resetProviderPolicies,
  getRankingDiagnostics,
  DEFAULT_SCORING_CONFIG,
  type ProviderScoringConfig,
  type RankedProvider,
} from "../../../src/core/provider-scoring-engine.js";
import {
  resetAll,
  recordSuccess,
  recordFailure,
  resetProvider,
  HEALTH_CONFIG,
} from "../../../src/core/provider-health-runtime.js";

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

function setupFresh() {
  resetAll();
  resetScoringConfig();
  resetProviderPolicies();
}

function makeHealthy(id: string) {
  recordSuccess(id, 100, Date.now());
  recordSuccess(id, 120, Date.now());
  recordSuccess(id, 110, Date.now());
}

function makeDegraded(id: string) {
  recordSuccess(id, 100, Date.now());
  recordFailure(id, { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "test", rawMessage: "test" }, 200, Date.now());
  recordFailure(id, { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "test", rawMessage: "test" }, 200, Date.now());
}

function makeUnavailable(id: string) {
  recordSuccess(id, 100, Date.now());
  for (let i = 0; i < 5; i++) {
    recordFailure(id, { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "test", rawMessage: "test" }, 200, Date.now());
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\nTGP-17B — Provider Scoring Engine:\n");

setupFresh();
makeHealthy("score_a");
makeHealthy("score_b");

test("scoreProvider returns valid score for healthy provider", () => {
  const result = scoreProvider("score_a");
  assert.ok(result, "should return a result");
  assert.ok(result.score > 0, `score should be > 0, got ${result.score}`);
  assert.ok(result.score <= 1, `score should be <= 1, got ${result.score}`);
  assert.equal(result.eligible, true);
  assert.equal(result.healthStatus, "healthy");
});

test("scoreProvider returns null-like for unavailable provider", () => {
  makeUnavailable("unavail_test");
  const result = scoreProvider("unavail_test");
  assert.ok(result, "should return result object");
  assert.equal(result.eligible, false);
});

test("score breakdown sums to total score", () => {
  const result = scoreProvider("score_a");
  assert.ok(result);
  const sum = result.breakdown.availability + result.breakdown.latency
    + result.breakdown.failureRate + result.breakdown.priority + result.breakdown.cost;
  assert.ok(Math.abs(sum - result.score) < 0.0001, `breakdown sum ${sum} should equal score ${result.score}`);
});

test("weights sum to 1.0 by default", () => {
  const config = DEFAULT_SCORING_CONFIG;
  const sum = config.availabilityWeight + config.latencyWeight + config.failureRateWeight
    + config.priorityWeight + config.costWeight;
  assert.ok(Math.abs(sum - 1.0) < 0.0001, `weights sum ${sum} should be 1.0`);
});

// ─── Deterministic Ranking ────────────────────────────────────────────────────

console.log("\nDeterministic Ranking:");

test("identical inputs produce same ranking", () => {
  setupFresh();
  makeHealthy("det_a");
  makeHealthy("det_b");
  const r1 = rankProviders(["det_a", "det_b"]);
  const r2 = rankProviders(["det_a", "det_b"]);
  assert.equal(r1.ranked.length, r2.ranked.length);
  for (let i = 0; i < r1.ranked.length; i++) {
    assert.equal(r1.ranked[i].providerId, r2.ranked[i].providerId);
    assert.equal(r1.ranked[i].score, r2.ranked[i].score);
  }
});

test("ranking is stable for equal scores", () => {
  setupFresh();
  makeHealthy("eq_x");
  makeHealthy("eq_y");
  makeHealthy("eq_z");
  const r1 = rankProviders(["eq_x", "eq_y", "eq_z"]);
  const r2 = rankProviders(["eq_z", "eq_y", "eq_x"]);
  // Same providers should appear, sorted by providerId for ties
  assert.equal(r1.ranked.length, r2.ranked.length);
  for (let i = 0; i < r1.ranked.length; i++) {
    assert.equal(r1.ranked[i].providerId, r2.ranked[i].providerId);
  }
});

// ─── Weight Changes ───────────────────────────────────────────────────────────

console.log("\nWeight Changes:");

test("higher availability weight favors high-availability provider", () => {
  setupFresh();
  makeHealthy("wt_a");
  makeDegraded("wt_b");
  setScoringConfig({ availabilityWeight: 0.8, latencyWeight: 0.05, failureRateWeight: 0.05, priorityWeight: 0.05, costWeight: 0.05 });
  const r = rankProviders(["wt_a", "wt_b"]);
  assert.equal(r.ranked[0].providerId, "wt_a");
  assert.ok(r.ranked[0].score > r.ranked[1].score);
});

test("higher latency weight penalizes slow provider", () => {
  setupFresh();
  recordSuccess("fast_p", 50, Date.now());
  recordSuccess("fast_p", 60, Date.now());
  recordSuccess("slow_p", 4000, Date.now());
  recordSuccess("slow_p", 4500, Date.now());
  setScoringConfig({ availabilityWeight: 0.1, latencyWeight: 0.7, failureRateWeight: 0.05, priorityWeight: 0.05, costWeight: 0.1 });
  const r = rankProviders(["fast_p", "slow_p"]);
  assert.equal(r.ranked[0].providerId, "fast_p");
});

// ─── Health Impact ────────────────────────────────────────────────────────────

console.log("\nHealth Impact:");

test("degraded provider scores lower than healthy", () => {
  setupFresh();
  makeHealthy("hlth_good");
  makeDegraded("hlth_bad");
  const rGood = scoreProvider("hlth_good");
  const rBad = scoreProvider("hlth_bad");
  assert.ok(rGood && rBad);
  assert.ok(rGood.score > rBad.score, `healthy ${rGood.score} should > degraded ${rBad.score}`);
});

test("unavailable provider is excluded from ranking", () => {
  setupFresh();
  makeHealthy("hlth_ok");
  makeUnavailable("hlth_gone");
  const r = rankProviders(["hlth_ok", "hlth_gone"]);
  assert.equal(r.ranked.length, 1);
  assert.equal(r.ranked[0].providerId, "hlth_ok");
  assert.equal(r.totalExcluded, 1);
});

test("recovered provider regains score", () => {
  setupFresh();
  recordSuccess("rec_a", 100, Date.now());
  // Degrade then recover
  recordFailure("rec_a", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  recordFailure("rec_a", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  assert.equal(scoreProvider("rec_a")?.healthStatus, "degraded");
  recordSuccess("rec_a", 100, Date.now());
  recordSuccess("rec_a", 100, Date.now());
  recordSuccess("rec_a", 100, Date.now());
  assert.equal(scoreProvider("rec_a")?.healthStatus, "healthy");
});

// ─── Dimension Influence ──────────────────────────────────────────────────────

console.log("\nDimension Influence:");

test("availability influences score correctly", () => {
  setupFresh();
  // 100% availability
  for (let i = 0; i < 10; i++) recordSuccess("avail_full", 100, Date.now());
  // 50% availability
  for (let i = 0; i < 5; i++) recordSuccess("avail_half", 100, Date.now());
  for (let i = 0; i < 5; i++) recordFailure("avail_half", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  const sFull = scoreProvider("avail_full");
  const sHalf = scoreProvider("avail_half");
  assert.ok(sFull && sHalf);
  assert.ok(sFull.breakdown.availability > sHalf.breakdown.availability);
});

test("failure rate influences score correctly", () => {
  setupFresh();
  for (let i = 0; i < 10; i++) recordSuccess("fr_low", 100, Date.now());
  for (let i = 0; i < 10; i++) recordSuccess("fr_high", 100, Date.now());
  for (let i = 0; i < 8; i++) recordFailure("fr_high", { type: "unknown", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  const sLow = scoreProvider("fr_low");
  const sHigh = scoreProvider("fr_high");
  assert.ok(sLow && sHigh);
  assert.ok(sLow.breakdown.failureRate > sHigh.breakdown.failureRate);
});

test("priority influences score correctly", () => {
  setupFresh();
  setProviderPolicies({
    pri_high: { providerId: "pri_high", priority: 10, costClass: "standard" },
    pri_low: { providerId: "pri_low", priority: 1, costClass: "standard" },
  });
  makeHealthy("pri_high");
  makeHealthy("pri_low");
  const sHigh = scoreProvider("pri_high");
  const sLow = scoreProvider("pri_low");
  assert.ok(sHigh && sLow);
  assert.ok(sHigh.breakdown.priority > sLow.breakdown.priority);
  resetProviderPolicies();
});

test("cost class influences score correctly", () => {
  setupFresh();
  setProviderPolicies({
    cost_free: { providerId: "cost_free", priority: 5, costClass: "free" },
    cost_prem: { providerId: "cost_prem", priority: 5, costClass: "premium" },
  });
  makeHealthy("cost_free");
  makeHealthy("cost_prem");
  const sFree = scoreProvider("cost_free");
  const sPrem = scoreProvider("cost_prem");
  assert.ok(sFree && sPrem);
  assert.ok(sFree.breakdown.cost > sPrem.breakdown.cost);
  resetProviderPolicies();
});

// ─── Ranking Stability ────────────────────────────────────────────────────────

console.log("\nRanking Stability:");

test("ranking positions are assigned correctly", () => {
  setupFresh();
  makeHealthy("pos_a");
  makeHealthy("pos_b");
  makeHealthy("pos_c");
  const r = rankProviders(["pos_a", "pos_b", "pos_c"]);
  for (let i = 0; i < r.ranked.length; i++) {
    assert.equal(r.ranked[i].rankingPosition, i + 1);
  }
});

test("maxResults limits output", () => {
  setupFresh();
  for (let i = 0; i < 15; i++) makeHealthy(`mr_${i}`);
  setScoringConfig({ maxResults: 5 });
  const r = rankProviders(Array.from({ length: 15 }, (_, i) => `mr_${i}`));
  assert.equal(r.ranked.length, 5);
  assert.equal(r.totalEligible, 15);
});

// ─── Configuration ────────────────────────────────────────────────────────────

console.log("\nConfiguration:");

test("setScoringConfig merges with defaults", () => {
  resetScoringConfig();
  setScoringConfig({ latencyWeight: 0.5 });
  const config = getScoringConfig();
  assert.equal(config.latencyWeight, 0.5);
  assert.equal(config.availabilityWeight, DEFAULT_SCORING_CONFIG.availabilityWeight);
});

test("resetScoringConfig restores defaults", () => {
  setScoringConfig({ latencyWeight: 0.99 });
  resetScoringConfig();
  const config = getScoringConfig();
  assert.equal(config.latencyWeight, DEFAULT_SCORING_CONFIG.latencyWeight);
});

// ─── Diagnostics ──────────────────────────────────────────────────────────────

console.log("\nDiagnostics:");

test("getRankingDiagnostics returns all registered providers", () => {
  setupFresh();
  makeHealthy("diag_a");
  makeHealthy("diag_b");
  const r = getRankingDiagnostics();
  assert.ok(r.ranked.length >= 2);
  assert.equal(typeof r.timestamp, "number");
  assert.ok(typeof r.totalEligible === "number");
});

test("diagnostics response is sanitized", () => {
  setupFresh();
  makeHealthy("san_a");
  const r = getRankingDiagnostics();
  const json = JSON.stringify(r);
  assert.ok(!json.includes("sk-"), "must not contain API keys");
  assert.ok(!json.includes("Bearer"), "must not contain auth headers");
});

// ─── selectBestProvider ───────────────────────────────────────────────────────

console.log("\nselectBestProvider:");

test("selectBestProvider returns highest-scoring provider", () => {
  setupFresh();
  makeHealthy("best_a");
  makeHealthy("best_b");
  setProviderPolicies({
    best_a: { providerId: "best_a", priority: 10, costClass: "free" },
    best_b: { providerId: "best_b", priority: 5, costClass: "premium" },
  });
  const best = selectBestProvider(["best_a", "best_b"]);
  assert.ok(best);
  assert.equal(best.providerId, "best_a");
  resetProviderPolicies();
});

test("selectBestProvider returns null when all excluded", () => {
  setupFresh();
  makeUnavailable("none_a");
  const best = selectBestProvider(["none_a"]);
  assert.equal(best, null);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
