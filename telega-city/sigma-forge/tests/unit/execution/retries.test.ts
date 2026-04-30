import assert from "node:assert/strict";
import { shouldRetry, computeRetryDelay, buildRetryDecision } from "../../../packages/fsgr-runtime/src/execution/retries.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const retryPolicy = { max_attempts: 2, backoff_ms: 1000, retryable_errors: ["TIMEOUT", "NETWORK_ERROR"] };

console.log("\nRetries:");

test("retry allowed for retryable error within limit", () => {
  assert.equal(shouldRetry("TIMEOUT", retryPolicy, 0), true);
});

test("retry denied by limit", () => {
  assert.equal(shouldRetry("TIMEOUT", retryPolicy, 2), false);
});

test("retry denied by non-retryable code", () => {
  assert.equal(shouldRetry("VALIDATION_FAIL", retryPolicy, 0), false);
});

test("delay computed deterministically", () => {
  assert.equal(computeRetryDelay(retryPolicy, 0), 1000);
  assert.equal(computeRetryDelay(retryPolicy, 1), 2000);
  assert.equal(computeRetryDelay(retryPolicy, 2), 4000);
});

test("buildRetryDecision returns should_retry true", () => {
  const decision = buildRetryDecision("TIMEOUT", retryPolicy, 0);
  assert.equal(decision.should_retry, true);
  assert.equal(decision.delay_ms, 1000);
});

test("buildRetryDecision returns should_retry false for limit", () => {
  const decision = buildRetryDecision("TIMEOUT", retryPolicy, 2);
  assert.equal(decision.should_retry, false);
  assert.equal(decision.reason, "max_attempts_exceeded");
});

test("buildRetryDecision returns should_retry false for non-retryable", () => {
  const decision = buildRetryDecision("UNKNOWN", retryPolicy, 0);
  assert.equal(decision.should_retry, false);
  assert.equal(decision.reason, "non_retryable_error");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
