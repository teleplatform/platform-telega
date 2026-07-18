/**
 * TGP-14 Smoke Test — Kimi K3 Provider Lanes
 *
 * Two-phase smoke:
 *   1. Official lane:  kimi_api / kimi-k3  (direct Moonshot API)
 *   2. Browser lane:   kimi_local_web_api / kimi-k3  (FreeGLMKimiAPI bridge)
 *
 * Usage:
 *   npx tsx tests/smoke/kimiK3-smoke.ts              # dry-run (no credentials)
 *   MOONSHOT_API_KEY=... npx tsx tests/smoke/kimiK3-smoke.ts --live   # official lane
 *   BRIDGE_URL=http://localhost:3456 npx tsx tests/smoke/kimiK3-smoke.ts --live --browser  # browser lane
 */

import assert from "node:assert/strict";

const LIVE = process.argv.includes("--live");
const BROWSER = process.argv.includes("--browser");

import {
  KIMI_API_MODELS,
  KIMI_API_DEFAULT_MODEL,
  KIMI_LEGACY_MODELS,
  isKimiK3Model,
  isKimiLegacyModel,
  isKimiFamilyModel,
  resolveKimiApiKey,
  resolveKimiReasoningEffort,
} from "../../src/providers/kimi_api/index.js";

import {
  KIMI_LOCAL_WEB_API_MODELS,
  KIMI_LOCAL_WEB_API_DEFAULT_MODEL,
} from "../../src/providers/kimi_local_web_api/index.js";

import { CapabilityDiscovery } from "../../src/provider-ops/capabilityDiscovery.js";
import { ProviderVerification } from "../../src/core/provider-verification.js";
import { resolveModel } from "../../src/core/provider-resolution.js";

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      if (e.message.includes("SKIP")) {
        skipped++;
        console.log(`  ⊘ ${name} — ${e.message}`);
      } else {
        failed++;
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
      }
    }
  };
}

function skip(msg: string) {
  throw new Error(`SKIP: ${msg}`);
}

// ── Phase 1: Official lane ──────────────────────────────────────────────────
async function officialLane() {
  console.log("\n═══ Phase 1: Official Lane (kimi_api / kimi-k3) ═══\n");

  const tests = [
    test("KIMI_API_DEFAULT_MODEL is kimi-k3", () => {
      assert.equal(KIMI_API_DEFAULT_MODEL, "kimi-k3");
    }),

    test("isKimiK3Model(kimi-k3) = true", () => {
      assert.ok(isKimiK3Model("kimi-k3"));
    }),

    test("isKimiLegacyModel(kimi-k2.5) = true", () => {
      assert.ok(isKimiLegacyModel("kimi-k2.5"));
    }),

    test("isKimiFamilyModel rejects non-Kimi", () => {
      assert.equal(isKimiFamilyModel("gpt-4"), false);
      assert.equal(isKimiFamilyModel("deepseek-r1"), false);
      assert.equal(isKimiFamilyModel("qwen-max"), false);
    }),

    test("resolveKimiApiKey reads MOONSHOT_API_KEY as alias", () => {
      if (!LIVE) skip("dry-run");
      const key = resolveKimiApiKey();
      assert.ok(key, "API key should be resolved");
      assert.ok(key!.length > 10, "API key should be non-trivial");
    }),

    test("resolveKimiReasoningEffort returns value", () => {
      const effort = resolveKimiReasoningEffort("default");
      assert.ok(effort, "reasoning_effort should resolve");
    }),

    test("resolveModel('kimi:kimi-k3') → kimi_api", () => {
      const result = resolveModel("kimi:kimi-k3");
      assert.equal(result.provider, "kimi_api");
      assert.equal(result.model, "kimi-k3");
    }),

    test("resolveModel('kimi') → kimi_api + default model", () => {
      const result = resolveModel("kimi");
      assert.equal(result.provider, "kimi_api");
      assert.equal(result.model, "kimi-k3");
    }),

    test("normalizeUpstreamId maps moonshot-v1-auto → kimi-k3", () => {
      const result = CapabilityDiscovery.normalizeUpstreamId("moonshot-v1-auto");
      assert.equal(result, "kimi-k3");
    }),

    test("normalizeUpstreamId passes through kimi-k3", () => {
      const result = CapabilityDiscovery.normalizeUpstreamId("kimi-k3");
      assert.equal(result, "kimi-k3");
    }),

    test("Provider Verification rejects non-Kimi model via kimi_api", () => {
      const result = ProviderVerification.verify("kimi_api", "kimi_api", "gpt-4");
      assert.equal(result.verified, false);
      assert.equal(result.checks.modelFamilyMatch, false);
    }),

    test("Provider Verification passes valid kimi_api execution", () => {
      if (!LIVE) skip("dry-run — needs live key for auth check");
      const result = ProviderVerification.verify("kimi_api", "kimi_api", "kimi-k3");
      assert.equal(result.verified, true);
    }),

    test("LIVE: direct Moonshot API call returns content + reasoning_content", async () => {
      if (!LIVE) skip("dry-run");
      if (BROWSER) skip("official lane only");
      const apiKey = resolveKimiApiKey();
      if (!apiKey) skip("MOONSHOT_API_KEY not set");

      const resp = await fetch("https://api.moonshot.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "kimi-k3",
          messages: [
            { role: "user", content: "What is 2+2? Answer with just the number." },
          ],
          reasoning_effort: "low",
        }),
        signal: AbortSignal.timeout(30_000),
      });

      assert.equal(resp.ok, true, `HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json() as any;
      const choice = data.choices?.[0];
      assert.ok(choice, "should have at least one choice");

      const text = choice.message?.content || "";
      assert.ok(text.length > 0, "content should be non-empty");

      console.log(`    → content: "${text.slice(0, 80)}"`);
      console.log(`    → model: ${data.model}`);
      console.log(`    → usage: ${JSON.stringify(data.usage)}`);

      if (choice.message?.reasoning_content) {
        console.log(`    → reasoning_content: "${String(choice.message.reasoning_content).slice(0, 120)}"`);
      }
    }),

    test("LIVE: streaming returns SSE chunks with delta", async () => {
      if (!LIVE) skip("dry-run");
      if (BROWSER) skip("official lane only");
      const apiKey = resolveKimiApiKey();
      if (!apiKey) skip("MOONSHOT_API_KEY not set");

      const resp = await fetch("https://api.moonshot.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "kimi-k3",
          messages: [{ role: "user", content: "Say hi." }],
          stream: true,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      assert.equal(resp.ok, true, `HTTP ${resp.status}`);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;
      let hasContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter(l => l.startsWith("data:"));
        for (const line of lines) {
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            const delta = obj.choices?.[0]?.delta;
            if (delta?.content) hasContent = true;
            chunks++;
          } catch {}
        }
      }

      console.log(`    → chunks received: ${chunks}`);
      assert.ok(chunks > 0, "should receive streaming chunks");
      assert.ok(hasContent, "at least one chunk should contain content");
    }),
  ];

  for (const t of tests) await t();
}

// ── Phase 2: Browser lane ───────────────────────────────────────────────────
async function browserLane() {
  console.log("\n═══ Phase 2: Browser Lane (kimi_local_web_api / kimi-k3) ═══\n");

  const tests = [
    test("KIMI_LOCAL_WEB_API_DEFAULT_MODEL is kimi-k3", () => {
      assert.equal(KIMI_LOCAL_WEB_API_DEFAULT_MODEL, "kimi-k3");
    }),

    test("KIMI_LOCAL_WEB_API_MODELS includes kimi-k3", () => {
      assert.ok(KIMI_LOCAL_WEB_API_MODELS.includes("kimi-k3"));
    }),

    test("KIMI_LOCAL_WEB_API_MODELS includes kimi-k2.5 (legacy)", () => {
      assert.ok(KIMI_LOCAL_WEB_API_MODELS.includes("kimi-k2.5"));
    }),

    test("resolveModel('kimi_local_web_api:kimi-k3') → kimi_local_web_api", () => {
      const result = resolveModel("kimi_local_web_api:kimi-k3");
      assert.equal(result.provider, "kimi_local_web_api");
      assert.equal(result.model, "kimi-k3");
    }),

    test("CapabilityDiscovery.discover returns K3 models", async () => {
      const result = await CapabilityDiscovery.discover("kimi_local_web_api");
      assert.ok(result.availableModels.length > 0, "should have discovered models");
      const k3 = result.availableModels.find(m => m.canonicalId === "kimi-k3");
      assert.ok(k3, "should find kimi-k3 in discovered models");
      console.log(`    → models: ${result.availableModels.map(m => m.canonicalId).join(", ")}`);
    }),

    test("isKimiK3Available checks upstream model list", async () => {
      const result = await CapabilityDiscovery.discover("kimi_local_web_api");
      const available = CapabilityDiscovery.isKimiK3Available(result);
      assert.equal(available, true);
    }),

    test("getLegacyFallback returns kimi-k2.5", async () => {
      const result = await CapabilityDiscovery.discover("kimi_local_web_api");
      const legacy = CapabilityDiscovery.getLegacyFallback(result);
      assert.ok(legacy, "legacy fallback should exist");
      assert.equal(legacy!.canonicalId, "kimi-k2.5");
    }),

    test("Provider Verification rejects kimi_local_web_api with official_api auth", () => {
      const result = ProviderVerification.verify("kimi_local_web_api", "kimi_local_web_api", "kimi-k3");
      assert.equal(result.executionLane, "browser_bridge");
      assert.equal(result.verified, true);
    }),

    test("Provider Verification rejects non-Kimi model on kimi_local_web_api", () => {
      const result = ProviderVerification.verify("kimi_local_web_api", "kimi_local_web_api", "gpt-4");
      assert.equal(result.verified, false);
      assert.equal(result.checks.modelFamilyMatch, false);
    }),

    test("LIVE: browser bridge responds to health check", async () => {
      if (!LIVE) skip("dry-run");
      if (!BROWSER) skip("browser lane only");
      const bridgeUrl = process.env.BRIDGE_URL || "http://localhost:3456";
      const resp = await fetch(`${bridgeUrl}/health`, { signal: AbortSignal.timeout(5_000) });
      assert.equal(resp.ok, true, `Bridge health check failed: HTTP ${resp.status}`);
    }),

    test("LIVE: browser bridge /v1/models lists kimi-k3 upstream", async () => {
      if (!LIVE) skip("dry-run");
      if (!BROWSER) skip("browser lane only");
      const bridgeUrl = process.env.BRIDGE_URL || "http://localhost:3456";
      const resp = await fetch(`${bridgeUrl}/v1/models`, { signal: AbortSignal.timeout(10_000) });
      assert.equal(resp.ok, true, `Models endpoint failed: HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const models = data.data?.map((m: any) => m.id) || [];
      console.log(`    → upstream models: ${models.join(", ")}`);

      const hasKimi = models.some((m: string) => m.includes("kimi"));
      assert.ok(hasKimi, "upstream should list at least one kimi model");
    }),

    test("LIVE: browser bridge chat returns content", async () => {
      if (!LIVE) skip("dry-run");
      if (!BROWSER) skip("browser lane only");
      const bridgeUrl = process.env.BRIDGE_URL || "http://localhost:3456";
      const resp = await fetch(`${bridgeUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "kimi-k3",
          messages: [{ role: "user", content: "Say hello in one word." }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      assert.equal(resp.ok, true, `Bridge chat failed: HTTP ${resp.status}`);
      const data = await resp.json() as any;
      const text = data.choices?.[0]?.message?.content || "";
      assert.ok(text.length > 0, "bridge should return content");
      console.log(`    → content: "${text.slice(0, 80)}"`);
    }),
  ];

  for (const t of tests) await t();
}

// ── run ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`TGP-14 Kimi K3 Smoke Test — ${LIVE ? "LIVE" : "DRY-RUN"} ${BROWSER ? "(browser lane)" : "(official lane)"}`);
  console.log("═".repeat(60));

  await officialLane();
  await browserLane();

  console.log("\n" + "═".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log("═".repeat(60));

  if (failed > 0) process.exit(1);
}

main();
