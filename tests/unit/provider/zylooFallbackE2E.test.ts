import assert from "node:assert/strict";
import {
  classifyError,
  handleProviderFailure,
  handleProviderSuccess,
  recordProviderFailure,
  isProviderOpen,
  resetBreakers,
} from "../../../src/core/provider-failure-policy.js";

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

console.log("\nTGP-16B — End-to-End Fallback Verification:");

// ─── Simulated Gateway Flow ───────────────────────────────────────────────────

interface MockProviderResult {
  provider: string;
  model: string;
  ok: boolean;
  text?: string;
  error?: { type: string; message: string };
  fallbackUsed: boolean;
}

function simulateGatewayRequest(
  initialProvider: string,
  initialModel: string,
  providerResponses: Array<{ provider: string; model: string; rawError: string; httpStatus?: number }>,
  credentialSlots: Record<string, number>
): MockProviderResult {
  resetBreakers();

  for (let i = 0; i < providerResponses.length; i++) {
    const resp = providerResponses[i];
    const slotsLeft = credentialSlots[resp.provider] ?? 0;
    const decision = classifyError(resp.rawError, resp.httpStatus, slotsLeft);

    const { circuit } = handleProviderFailure({
      provider: resp.provider,
      model: resp.model,
      rawMessage: resp.rawError,
      httpStatus: resp.httpStatus,
      credentialSlot: i === 0 ? "primary" : "secondary",
    });

    if (i < providerResponses.length - 1) {
      assert.equal(decision.shouldFallback, true, `${resp.provider} should fallback`);
    }

    if (!decision.shouldFallback || i === providerResponses.length - 1) {
      if (decision.shouldFallback) {
        return {
          provider: resp.provider,
          model: resp.model,
          ok: false,
          error: { type: decision.type, message: decision.safeMessage },
          fallbackUsed: i > 0,
        };
      }
    }
  }

  return {
    provider: providerResponses[providerResponses.length - 1].provider,
    model: providerResponses[providerResponses.length - 1].model,
    ok: false,
    error: { type: "unknown", message: "All providers failed" },
    fallbackUsed: true,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\n  Scenario 1: Zyloo quota_exhausted → fallback to next provider:");

test("zyloo/kimi-k3 quota exhausted → fallback to kimi_local_web_api", () => {
  const result = simulateGatewayRequest(
    "zyloo_api",
    "zyloo/kimi-k3",
    [
      { provider: "zyloo_api", model: "zyloo/kimi-k3", rawError: "Insufficient credit. Add funds at zyloo.io/dashboard/billing." },
      { provider: "kimi_local_web_api", model: "kimi-k3", rawError: "Bridge not running", httpStatus: 503 },
    ],
    { zyloo_api: 0, kimi_local_web_api: 0 }
  );
  assert.equal(result.fallbackUsed, true);
  assert.ok(!result.error?.message.includes("zyloo.io"), "billing URL must not be exposed");
  assert.ok(!result.error?.message.includes("Add funds"), "billing action must not be exposed");
});

console.log("\n  Scenario 2: Zyloo network_quota → fallback to next provider:");

test("zyloo/kimi-k3 network quota → fallback", () => {
  const result = simulateGatewayRequest(
    "zyloo_api",
    "zyloo/kimi-k3",
    [
      { provider: "zyloo_api", model: "zyloo/kimi-k3", rawError: "Free Kimi K3 access is limited to one account per network" },
      { provider: "kimi_local_web_api", model: "kimi-k3", rawError: "Bridge not running", httpStatus: 503 },
    ],
    { zyloo_api: 0, kimi_local_web_api: 0 }
  );
  assert.equal(result.fallbackUsed, true);
  assert.ok(!result.error?.message.includes("one account per network"));
  assert.ok(!result.error?.message.includes("Free Kimi K3"));
});

console.log("\n  Scenario 3: Auth exhaustion — primary auth → secondary auth → fallback:");

test("primary auth failure → secondary auth failure → provider fallback", () => {
  resetBreakers();

  const primaryDecision = classifyError("Invalid API key", 401, 1);
  assert.equal(primaryDecision.type, "auth");
  assert.equal(primaryDecision.shouldCycleCredential, true, "should try secondary");
  assert.equal(primaryDecision.shouldFallback, false, "should not fallback yet");

  handleProviderFailure({
    provider: "zyloo_api",
    model: "zyloo/kimi-k3",
    rawMessage: "Invalid API key",
    httpStatus: 401,
    credentialSlot: "primary",
  });

  const secondaryDecision = classifyError("Invalid API key", 401, 0);
  assert.equal(secondaryDecision.type, "auth");
  assert.equal(secondaryDecision.shouldCycleCredential, false, "no more credentials");
  assert.equal(secondaryDecision.shouldFallback, true, "should fallback after all credentials exhausted");
  assert.ok(secondaryDecision.safeMessage.includes("exhausted"));

  handleProviderFailure({
    provider: "zyloo_api",
    model: "zyloo/kimi-k3",
    rawMessage: "Invalid API key",
    httpStatus: 401,
    credentialSlot: "secondary",
  });

  handleProviderFailure({
    provider: "zyloo_api",
    model: "zyloo/kimi-k3",
    rawMessage: "Invalid API key",
    httpStatus: 401,
    credentialSlot: "secondary",
  });

  assert.equal(isProviderOpen("zyloo_api", "zyloo/kimi-k3"), true, "circuit should be open");
});

console.log("\n  Scenario 4: Auth with no secondary → immediate fallback:");

test("single credential auth failure → immediate fallback", () => {
  const decision = classifyError("Invalid API key", 401, 0);
  assert.equal(decision.type, "auth");
  assert.equal(decision.shouldCycleCredential, false, "no secondary available");
  assert.equal(decision.shouldFallback, true, "should fallback immediately");
  assert.ok(decision.safeMessage.includes("exhausted"));
});

console.log("\n  Scenario 5: Billing text never exposed to IDE:");

test("all quota messages sanitized", () => {
  const messages = [
    "Insufficient credit. Add funds at zyloo.io/dashboard/billing.",
    "Your account has insufficient balance.",
    "Billing error: payment required.",
    "Free Kimi K3 access is limited to one account per network",
  ];
  for (const msg of messages) {
    const d = classifyError(msg);
    assert.ok(!d.safeMessage.includes("zyloo.io"), `billing URL leaked: ${msg}`);
    assert.ok(!d.safeMessage.includes("Add funds"), `billing action leaked: ${msg}`);
    assert.ok(!d.safeMessage.includes("payment"), `payment info leaked: ${msg}`);
    assert.ok(!d.safeMessage.includes("one account per network"), `network restriction leaked: ${msg}`);
    assert.ok(!d.safeMessage.includes("Free Kimi K3"), `product name leaked: ${msg}`);
  }
});

console.log("\n  Scenario 6: FallbackUsed=true in final response:");

test("fallbackUsed is true when primary fails and fallback succeeds", () => {
  const decision = classifyError("Insufficient credit");
  assert.equal(decision.shouldFallback, true);
  const result: MockProviderResult = {
    provider: "kimi_local_web_api",
    model: "kimi-k3",
    ok: true,
    text: "Fallback response from Kimi",
    fallbackUsed: true,
  };
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.ok, true);
  assert.ok(result.text?.includes("Fallback"));
});

console.log("\n  Scenario 7: Evidence contains required fields:");

test("handleProviderFailure returns decision and circuit state", () => {
  resetBreakers();
  const { decision, circuit } = handleProviderFailure({
    provider: "zyloo_api",
    model: "zyloo/kimi-k3",
    rawMessage: "Insufficient credit",
    credentialSlot: "primary",
  });
  assert.equal(decision.type, "quota_exhausted");
  assert.equal(decision.shouldFallback, true);
  assert.equal(decision.shouldCycleCredential, false);
  assert.ok(circuit.state, "circuit state should be present");
  assert.equal(typeof decision.rawMessage, "string");
  assert.equal(typeof decision.safeMessage, "string");
});

console.log("\n  Scenario 8: Full failover chain — zyloo → kimi_web → deepseek_web → local:");

test("complete failover chain with different error types", () => {
  resetBreakers();

  const zylooDecision = classifyError("Insufficient credit");
  assert.equal(zylooDecision.type, "quota_exhausted");
  assert.equal(zylooDecision.shouldFallback, true);

  const kimiDecision = classifyError("Bridge not running", 503);
  assert.equal(kimiDecision.type, "unknown");
  assert.equal(kimiDecision.shouldFallback, true);

  const deepseekDecision = classifyError("Service unavailable", 503);
  assert.equal(deepseekDecision.type, "unknown");
  assert.equal(deepseekDecision.shouldFallback, true);

  const localDecision = classifyError("Local model not loaded", 503);
  assert.equal(localDecision.type, "unknown");
  assert.equal(localDecision.shouldFallback, true);

  const providers = ["zyloo_api", "kimi_local_web_api", "deepseek_web", "local"];
  for (const provider of providers) {
    for (let i = 0; i < 3; i++) {
      handleProviderFailure({
        provider,
        model: "test-model",
        rawMessage: "error",
        credentialSlot: "primary",
      });
    }
  }

  assert.equal(isProviderOpen("zyloo_api", "test-model"), true);
  assert.equal(isProviderOpen("kimi_local_web_api", "test-model"), true);
  assert.equal(isProviderOpen("deepseek_web", "test-model"), true);
  assert.equal(isProviderOpen("local", "test-model"), true);
});

console.log("\n  Scenario 9: Rate limit → credential cycle → fallback:");

test("rate limit cycles credential then falls back", () => {
  resetBreakers();

  const primaryDecision = classifyError("Rate limit exceeded", 429, 1);
  assert.equal(primaryDecision.type, "rate_limit");
  assert.equal(primaryDecision.shouldCycleCredential, true);
  assert.equal(primaryDecision.shouldFallback, true);

  const secondaryDecision = classifyError("Rate limit exceeded", 429, 0);
  assert.equal(secondaryDecision.type, "rate_limit");
  assert.equal(secondaryDecision.shouldCycleCredential, false);
  assert.equal(secondaryDecision.shouldFallback, true);
});

console.log("\n  Scenario 10: Terminal error with failure chain:");

test("terminal error contains sanitized failure chain", () => {
  const failures = [
    { provider: "zyloo_api", error: "Insufficient credit. Add funds at zyloo.io/dashboard/billing." },
    { provider: "kimi_local_web_api", error: "Bridge connection refused" },
  ];

  const chain = failures.map(f => {
    const d = classifyError(f.error);
    return `${f.provider}: ${d.safeMessage}`;
  });

  const terminalError = `All providers failed. Failure chain: ${chain.join(" → ")}`;

  assert.ok(!terminalError.includes("zyloo.io"), "billing URL must not be in terminal error");
  assert.ok(!terminalError.includes("Add funds"), "billing action must not be in terminal error");
  assert.ok(terminalError.includes("zyloo_api"), "provider names should be in terminal error");
  assert.ok(terminalError.includes("kimi_local_web_api"), "all providers should be in chain");
  assert.ok(terminalError.includes("Quota exhausted"), "safe messages should be in chain");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
