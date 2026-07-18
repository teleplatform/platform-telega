import assert from "node:assert/strict";
import {
  classifyError,
  recordProviderFailure,
  recordProviderSuccess,
  isProviderOpen,
  resetBreakers,
  type FailureDecision,
} from "../../../src/core/provider-failure-policy.js";
import { CircuitBreaker } from "../../../src/core/circuitBreaker.js";

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

console.log("\nTGP-16B — Provider Failure Policy:");

// ─── classifyError ────────────────────────────────────────────────────────────

console.log("\n  classifyError — HTTP status priority:");

test("401 → auth", () => {
  const d = classifyError("anything", 401);
  assert.equal(d.type, "auth");
  assert.equal(d.shouldCycleCredential, true);
  assert.equal(d.shouldFallback, false);
});

test("429 → rate_limit", () => {
  const d = classifyError("anything", 429);
  assert.equal(d.type, "rate_limit");
  assert.equal(d.shouldCycleCredential, true);
  assert.equal(d.shouldFallback, true);
});

console.log("\n  classifyError — message patterns:");

test("invalid API key → auth", () => {
  const d = classifyError("Invalid API key provided.");
  assert.equal(d.type, "auth");
  assert.equal(d.shouldCycleCredential, true);
  assert.equal(d.shouldFallback, false);
  assert.ok(d.safeMessage.includes("Authentication"));
});

test("unauthorized → auth", () => {
  const d = classifyError("Unauthorized access");
  assert.equal(d.type, "auth");
});

test("insufficient credit → quota_exhausted", () => {
  const d = classifyError("Insufficient credit. Add funds at zyloo.io/dashboard/billing.");
  assert.equal(d.type, "quota_exhausted");
  assert.equal(d.shouldCycleCredential, false);
  assert.equal(d.shouldFallback, true);
  assert.ok(!d.safeMessage.includes("zyloo.io"));
  assert.ok(!d.safeMessage.includes("Add funds"));
  assert.ok(d.safeMessage.includes("Falling back"));
});

test("insufficient balance → quota_exhausted", () => {
  const d = classifyError("Your account has insufficient balance.");
  assert.equal(d.type, "quota_exhausted");
  assert.equal(d.shouldCycleCredential, false);
  assert.equal(d.shouldFallback, true);
});

test("insufficient quota → quota_exhausted", () => {
  const d = classifyError("Insufficient quota for this request.");
  assert.equal(d.type, "quota_exhausted");
});

test("add funds → quota_exhausted", () => {
  const d = classifyError("Please add funds to continue.");
  assert.equal(d.type, "quota_exhausted");
});

test("one account per network → network_quota", () => {
  const d = classifyError("Free Kimi K3 access is limited to one account per network");
  assert.equal(d.type, "network_quota");
  assert.equal(d.shouldCycleCredential, false);
  assert.equal(d.shouldFallback, true);
  assert.ok(!d.safeMessage.includes("one account per network"));
  assert.ok(d.safeMessage.includes("Network-level"));
});

test("rate limit exceeded → rate_limit", () => {
  const d = classifyError("Rate limit exceeded. Try again in 60 seconds.");
  assert.equal(d.type, "rate_limit");
  assert.equal(d.shouldCycleCredential, true);
  assert.equal(d.shouldFallback, true);
});

test("too many requests → rate_limit", () => {
  const d = classifyError("Too many requests");
  assert.equal(d.type, "rate_limit");
});

test("ECONNREFUSED → network", () => {
  const d = classifyError("connect ECONNREFUSED 127.0.0.1:443");
  assert.equal(d.type, "network");
  assert.equal(d.shouldFallback, true);
  assert.equal(d.shouldCycleCredential, false);
});

test("ETIMEDOUT → network", () => {
  const d = classifyError("connect ETIMEDOUT");
  assert.equal(d.type, "network");
});

test("unknown error → unknown with fallback", () => {
  const d = classifyError("Something went wrong");
  assert.equal(d.type, "unknown");
  assert.equal(d.shouldFallback, true);
  assert.equal(d.shouldCycleCredential, false);
});

console.log("\n  classifyError — safe messages:");

test("billing text never exposed in safeMessage", () => {
  const billingMessages = [
    "Insufficient credit. Add funds at zyloo.io/dashboard/billing.",
    "Your account has insufficient balance.",
    "Billing error: payment required.",
  ];
  for (const msg of billingMessages) {
    const d = classifyError(msg);
    assert.ok(!d.safeMessage.includes("zyloo.io"), `should not expose billing URL in: ${msg}`);
    assert.ok(!d.safeMessage.includes("Add funds"), `should not expose billing action in: ${msg}`);
    assert.ok(!d.safeMessage.includes("payment"), `should not expose payment info in: ${msg}`);
  }
});

test("network restriction text never exposed in safeMessage", () => {
  const d = classifyError("Free Kimi K3 access is limited to one account per network");
  assert.ok(!d.safeMessage.includes("one account per network"));
  assert.ok(!d.safeMessage.includes("Free Kimi K3"));
});

test("rawMessage is preserved for diagnostics", () => {
  const raw = "Insufficient credit. Add funds at zyloo.io/dashboard/billing.";
  const d = classifyError(raw);
  assert.equal(d.rawMessage, raw);
});

console.log("\n  classifyError — priority order:");

test("HTTP 401 takes priority over message pattern", () => {
  const d = classifyError("Insufficient credit", 401);
  assert.equal(d.type, "auth");
});

test("HTTP 429 takes priority over message pattern", () => {
  const d = classifyError("Insufficient credit", 429);
  assert.equal(d.type, "rate_limit");
});

test("First matching pattern wins (quota before rate_limit)", () => {
  const d = classifyError("Insufficient quota: rate limit exceeded");
  assert.equal(d.type, "quota_exhausted");
});

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

console.log("\n  Circuit Breaker:");

test("recordProviderFailure opens after threshold", () => {
  resetBreakers();
  recordProviderFailure("test_provider", "test-model", classifyError("error 1"));
  recordProviderFailure("test_provider", "test-model", classifyError("error 2"));
  assert.equal(isProviderOpen("test_provider", "test-model"), false);
  recordProviderFailure("test_provider", "test-model", classifyError("error 3"));
  assert.equal(isProviderOpen("test_provider", "test-model"), true);
});

test("recordProviderSuccess closes half-open circuit", async () => {
  resetBreakers();
  const shortCooldown = { failureThreshold: 2, windowMs: 60_000, cooldownMs: 1 };
  recordProviderFailure("test_provider2", "test-model", classifyError("error 1"), shortCooldown);
  recordProviderFailure("test_provider2", "test-model", classifyError("error 2"), shortCooldown);
  assert.equal(isProviderOpen("test_provider2", "test-model"), true);
  await new Promise(r => setTimeout(r, 5));
  assert.equal(isProviderOpen("test_provider2", "test-model"), false, "should be half-open after cooldown");
  recordProviderSuccess("test_provider2", "test-model");
  assert.equal(isProviderOpen("test_provider2", "test-model"), false, "should be closed after success");
});

test("Different providers have independent circuits", () => {
  resetBreakers();
  recordProviderFailure("provider_a", "model", classifyError("error"));
  recordProviderFailure("provider_a", "model", classifyError("error"));
  recordProviderFailure("provider_a", "model", classifyError("error"));
  assert.equal(isProviderOpen("provider_a", "model"), true);
  assert.equal(isProviderOpen("provider_b", "model"), false);
});

test("Different models have independent circuits", () => {
  resetBreakers();
  recordProviderFailure("provider_c", "model-1", classifyError("error"));
  recordProviderFailure("provider_c", "model-1", classifyError("error"));
  recordProviderFailure("provider_c", "model-1", classifyError("error"));
  assert.equal(isProviderOpen("provider_c", "model-1"), true);
  assert.equal(isProviderOpen("provider_c", "model-2"), false);
});

test("resetBreakers clears all circuits", () => {
  resetBreakers();
  recordProviderFailure("provider_d", "model", classifyError("error"));
  recordProviderFailure("provider_d", "model", classifyError("error"));
  recordProviderFailure("provider_d", "model", classifyError("error"));
  assert.equal(isProviderOpen("provider_d", "model"), true);
  resetBreakers();
  assert.equal(isProviderOpen("provider_d", "model"), false);
});

// ─── Decision Consistency ─────────────────────────────────────────────────────

console.log("\n  Decision Consistency:");

test("quota_exhausted: no retry, no cycle, fallback", () => {
  const d = classifyError("Insufficient credit");
  assert.equal(d.shouldRetrySameKey, false);
  assert.equal(d.shouldCycleCredential, false);
  assert.equal(d.shouldFallback, true);
});

test("network_quota: no retry, no cycle, fallback", () => {
  const d = classifyError("one account per network");
  assert.equal(d.shouldRetrySameKey, false);
  assert.equal(d.shouldCycleCredential, false);
  assert.equal(d.shouldFallback, true);
});

test("auth: no retry, cycle, no fallback", () => {
  const d = classifyError("Invalid API key");
  assert.equal(d.shouldRetrySameKey, false);
  assert.equal(d.shouldCycleCredential, true);
  assert.equal(d.shouldFallback, false);
});

test("rate_limit: no retry, cycle, fallback", () => {
  const d = classifyError("Rate limit exceeded");
  assert.equal(d.shouldRetrySameKey, false);
  assert.equal(d.shouldCycleCredential, true);
  assert.equal(d.shouldFallback, true);
});

test("network: no retry, no cycle, fallback", () => {
  const d = classifyError("ECONNREFUSED");
  assert.equal(d.shouldRetrySameKey, false);
  assert.equal(d.shouldCycleCredential, false);
  assert.equal(d.shouldFallback, true);
});

test("unknown: no retry, no cycle, fallback", () => {
  const d = classifyError("Something went wrong");
  assert.equal(d.shouldRetrySameKey, false);
  assert.equal(d.shouldCycleCredential, false);
  assert.equal(d.shouldFallback, true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
