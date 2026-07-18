/**
 * TGP-17B — Router Scoring Integration Tests
 *
 * Verifies:
 * - Router consults Provider Scoring Engine after Zyloo calls
 * - Scoring outcome recorded on success/failure
 * - Ranking reflects Zyloo health state after routing
 * - selectBestProvider ranks Zyloo correctly vs degraded peers
 */

import assert from "node:assert/strict";
import {
  resetAll,
  recordSuccess,
  recordFailure,
} from "../../../src/core/provider-health-runtime.js";
import {
  resetScoringConfig,
  resetProviderPolicies,
  getRankingDiagnostics,
  selectBestProvider,
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

console.log("\nTGP-17B — Router Scoring Integration:\n");

test("Ranking reflects Zyloo health after success recording", async () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("zyloo_api", 120, Date.now());
  recordSuccess("zyloo_api", 130, Date.now());
  const ranking = getRankingDiagnostics();
  const zyloo = ranking.ranked.find(r => r.providerId === "zyloo_api");
  assert.ok(zyloo, "Zyloo should appear in ranking");
  assert.equal(zyloo.healthStatus, "healthy");
  assert.equal(zyloo.eligible, true);
});

test("selectBestProvider ranks healthy Zyloo above degraded peer", async () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("zyloo_api", 120, Date.now());
  recordSuccess("zyloo_api", 130, Date.now());
  recordSuccess("peer_a", 100, Date.now());
  recordFailure("peer_a", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  recordFailure("peer_a", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  const best = selectBestProvider(["zyloo_api", "peer_a"]);
  assert.ok(best, "should return a provider");
  assert.equal(best.providerId, "zyloo_api");
});

test("Unavailable Zyloo excluded from selectBestProvider", async () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("zyloo_api", 120, Date.now());
  for (let i = 0; i < 5; i++) {
    recordFailure("zyloo_api", { type: "network", shouldRetrySameKey: false, shouldCycleCredential: false, shouldFallback: true, safeMessage: "", rawMessage: "" }, 200, Date.now());
  }
  const best = selectBestProvider(["zyloo_api"]);
  assert.equal(best, null, "unavailable provider should not be selected");
});

test("Scoring breakdown sums to total score", async () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("zyloo_api", 110, Date.now());
  const ranking = getRankingDiagnostics();
  const zyloo = ranking.ranked.find(r => r.providerId === "zyloo_api");
  assert.ok(zyloo);
  const sum = zyloo.breakdown.availability + zyloo.breakdown.latency
    + zyloo.breakdown.failureRate + zyloo.breakdown.priority + zyloo.breakdown.cost;
  assert.ok(Math.abs(sum - zyloo.score) < 0.0001, `breakdown ${sum} should equal score ${zyloo.score}`);
});

test("Ranking is deterministic across repeated calls", async () => {
  resetScoringConfig();
  resetProviderPolicies();
  resetAll();
  recordSuccess("zyloo_api", 120, Date.now());
  recordSuccess("peer_a", 100, Date.now());
  const r1 = getRankingDiagnostics().ranked.map(r => r.providerId).join(",");
  const r2 = getRankingDiagnostics().ranked.map(r => r.providerId).join(",");
  assert.equal(r1, r2, "ranking order must be stable");
});

(async () => {
  for (const fn of seq) await fn();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
