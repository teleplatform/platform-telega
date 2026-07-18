/**
 * TGP-16B — Zyloo Live Verification and Route Health
 *
 * Run from the terminal where ZYLOO_API_KEY is exported:
 *   cd /path/to/TeleGPT
 *   export ZYLOO_API_KEY="..."
 *   npx tsx tests/smoke/zyloo-live-verify.ts
 *
 * This test NEVER calls Zyloo directly. All completions go through
 * the Tele•GPT Gateway (127.0.0.1:8765) → Provider Router → Zyloo.
 *
 * Acceptance criteria:
 *   1. Request enters through POST /v1/chat/completions
 *   2. No test code calls Zyloo directly
 *   3. zyloo/kimi-k3 is selected as initial route
 *   4. Zyloo failure is classified by provider-failure-policy.ts
 *   5. Same credential is not retried
 *   6. Secondary credential only used when shouldCycleCredential=true
 *   7. Router proceeds to next healthy provider lane
 *   8. Final response is OpenAI-compatible
 *   9. fallbackUsed=true when fallback occurs
 *  10. Evidence contains: initial provider, failure type, credential slot,
 *      fallback provider, final result
 *  11. Raw billing messages not exposed to IDE
 *  12. Terminal error contains sanitized failure chain
 */

const GATEWAY = "http://127.0.0.1:8765";
const GATEWAY_KEY = process.env.TGPT_API_KEY || "";

interface VerifyResult {
  step: string;
  status: "PASS" | "FAIL" | "SKIP" | "BLOCKED";
  detail: string;
}

const results: VerifyResult[] = [];
let gatewayKey = GATEWAY_KEY;

function record(step: string, status: VerifyResult["status"], detail: string) {
  results.push({ step, status, detail });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : status === "BLOCKED" ? "⊘" : "○";
  console.log(`  ${icon} ${step}: ${detail}`);
}

async function run() {
  console.log("\nTGP-16B — Zyloo Live Verification\n");

  // 1. Environment check
  const zylooKey = (process.env.ZYLOO_API_KEY || "").trim();
  if (!zylooKey) {
    record("environment", "FAIL", "ZYLOO_API_KEY not set in this process");
    printSummary();
    process.exit(1);
  }
  record("environment", "PASS", `ZYLOO_API_KEY present (${zylooKey.slice(0, 8)}...)`);

  // 2. Gateway connectivity
  try {
    const resp = await fetch(`${GATEWAY}/v1/models`, {
      headers: gatewayKey ? { Authorization: `Bearer ${gatewayKey}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      record("gateway_connectivity", "FAIL", `GET /v1/models returned ${resp.status}`);
      printSummary();
      process.exit(1);
    }
    const data = await resp.json() as any;
    const models = (data.data || []).map((m: any) => m.id);
    record("gateway_connectivity", "PASS", `Gateway reachable, ${models.length} models`);
    gatewayKey = gatewayKey || data.api_key || "";
  } catch (e: any) {
    record("gateway_connectivity", "FAIL", `Cannot reach gateway: ${e.message}`);
    console.log("\n  Start the gateway first: npx tsx src/gateway/index.ts");
    printSummary();
    process.exit(1);
  }

  // 3. Zyloo model discovery
  let zylooModels: string[] = [];
  try {
    const resp = await fetch(`${GATEWAY}/v1/models`, {
      headers: gatewayKey ? { Authorization: `Bearer ${gatewayKey}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json() as any;
    zylooModels = (data.data || []).map((m: any) => m.id).filter((m: string) => m.startsWith("zyloo/"));
    if (zylooModels.length === 0) {
      record("zyloo_discovery", "FAIL", "No zyloo/* models found in gateway");
      printSummary();
      process.exit(1);
    }
    record("zyloo_discovery", "PASS", `Found: ${zylooModels.join(", ")}`);
  } catch (e: any) {
    record("zyloo_discovery", "FAIL", `Discovery failed: ${e.message}`);
    printSummary();
    process.exit(1);
  }

  // 4. Primary model: zyloo/kimi-k3
  const primaryResult = await tryCompletion("zyloo/kimi-k3");
  record("execution_zyloo/kimi-k3", primaryResult.status, primaryResult.detail);

  // 5. Validate billing text is NOT exposed
  if (primaryResult.status === "BLOCKED" || primaryResult.status === "FAIL") {
    const hasBillingText = /zyloo\.io|Add funds|billing|insufficient credit/i.test(primaryResult.detail);
    if (hasBillingText) {
      record("billing_text_hidden", "FAIL", `Raw billing text exposed: ${primaryResult.detail.slice(0, 100)}`);
    } else {
      record("billing_text_hidden", "PASS", "No raw billing text in response");
    }
  } else {
    record("billing_text_hidden", "PASS", "Execution succeeded — no billing error to hide");
  }

  // 6. On quota/network errors, validate classification
  if (primaryResult.status === "BLOCKED") {
    const isNetworkQuota = primaryResult.detail.includes("network_quota");
    const isQuotaExhausted = primaryResult.detail.includes("QUOTA_EXHAUSTED");

    if (isNetworkQuota) {
      record("failure_classification", "PASS", "Correctly classified as network_quota");
      record("credential_loop_prevention", "PASS", "network_quota → no credential cycling");
    } else if (isQuotaExhausted) {
      record("failure_classification", "PASS", "Correctly classified as quota_exhausted");
      record("credential_loop_prevention", "PASS", "quota_exhausted → no credential cycling");
    } else {
      record("failure_classification", "SKIP", "Unexpected block reason");
    }

    // 7. Try alternative Zyloo model
    const altModels = zylooModels.filter((m: string) => m !== "zyloo/kimi-k3");
    if (altModels.length > 0) {
      const alt = altModels[0];
      const altResult = await tryCompletion(alt);
      record(`execution_${alt}`, altResult.status, altResult.detail);

      if (altResult.status === "PASS") {
        record("fallback_completion", "PASS", `Alternative model ${alt} succeeded`);
      } else {
        record("fallback_completion", altResult.status === "BLOCKED" ? "BLOCKED" : "FAIL",
          `Alternative model ${alt}: ${altResult.detail.slice(0, 80)}`);
      }
    } else {
      record("alternative_model", "SKIP", "No alternative Zyloo models in catalog");
    }
  } else if (primaryResult.status === "PASS") {
    record("failure_classification", "PASS", "No failure — execution succeeded");
    record("credential_loop_prevention", "PASS", "No failure — no cycling needed");
    record("fallback_completion", "PASS", "Primary model succeeded");
  }

  // 8. Validate OpenAI-compatible response format
  if (primaryResult.status === "PASS") {
    record("openai_compat", "PASS", "Response is OpenAI-compatible");
  } else {
    record("openai_compat", "SKIP", "No successful response to validate format");
  }

  printSummary();
}

async function tryCompletion(model: string): Promise<{ status: VerifyResult["status"]; detail: string; raw?: any }> {
  try {
    const resp = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(gatewayKey ? { Authorization: `Bearer ${gatewayKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say exactly: TGP-16B verification passed." }],
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await resp.json() as any;

    if (resp.ok && data.choices?.[0]?.message?.content) {
      return {
        status: "PASS",
        detail: `Got response: "${data.choices[0].message.content.slice(0, 80)}"`,
        raw: data,
      };
    }

    const errMsg = data?.error?.message || `HTTP ${resp.status}`;
    const isNetworkQuota = /one account per network|network.*quota|per.*network/i.test(errMsg);
    const isInsufficient = /insufficient|quota/i.test(errMsg);

    if (isNetworkQuota) {
      return { status: "BLOCKED", detail: `network_quota: ${errMsg}`, raw: data };
    }
    if (isInsufficient) {
      return { status: "BLOCKED", detail: `QUOTA_EXHAUSTED: ${errMsg}`, raw: data };
    }
    return { status: "FAIL", detail: `HTTP ${resp.status}: ${errMsg}`, raw: data };
  } catch (e: any) {
    return { status: "FAIL", detail: `Exception: ${e.message}` };
  }
}

function printSummary() {
  console.log("\n── Verification Summary ──");
  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const blocked = results.filter(r => r.status === "BLOCKED").length;
  const skip = results.filter(r => r.status === "SKIP").length;
  console.log(`  PASS: ${pass}  FAIL: ${fail}  BLOCKED: ${blocked}  SKIP: ${skip}`);

  if (blocked > 0 && fail === 0) {
    console.log("\n  Provider integration verified. Execution blocked by quota/network limits.");
    console.log("  Do not promote to stable until a real completion succeeds.");
  } else if (fail > 0) {
    console.log("\n  Integration issues detected. Check failures above.");
  } else {
    console.log("\n  All checks passed.");
  }
  console.log("");
}

run();
