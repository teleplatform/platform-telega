// Provider Registry Tests — Pack 3 — run with: npx tsx tests/unit/router/providerRegistry.test.ts

import assert from "node:assert/strict";
import {
  buildDefaultProviderRegistry,
  filterProvidersByMode,
  filterProvidersByLane,
  filterProvidersByPrivacy,
  filterProvidersByBudget,
  getProviderById,
  isProviderEnabled,
} from "../../../src/core/router/providerRegistry.js";

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

const registry = buildDefaultProviderRegistry();

console.log("\nProvider Registry:");

test("registry has 4 providers", () => {
  assert.equal(registry.length, 4);
});

test("local provider is enabled", () => {
  const local = getProviderById(registry, "local");
  assert.ok(local);
  assert.equal(local!.enabled, true);
});

test("openai supports reasoning and tools", () => {
  const openai = getProviderById(registry, "openai");
  assert.ok(openai);
  assert.equal(openai!.supports_reasoning, true);
  assert.equal(openai!.supports_tools, true);
});

test("creator-only has only creator lane", () => {
  const creatorOnly = getProviderById(registry, "creator-only");
  assert.ok(creatorOnly);
  assert.deepEqual(creatorOnly!.lanes, ["creator"]);
});

console.log("\nFilter by mode:");

test("public gets only local provider", () => {
  const providers = filterProvidersByMode(registry, "public");
  assert.equal(providers.length, 1);
  assert.equal(providers[0].provider_id, "local");
});

test("creator gets 4 providers", () => {
  const providers = filterProvidersByMode(registry, "creator");
  assert.equal(providers.length, 4);
});

test("system gets all providers", () => {
  const providers = filterProvidersByMode(registry, "system");
  assert.equal(providers.length, 4);
});

console.log("\nFilter by lane:");

test("cheap lane has local + openai", () => {
  const providers = filterProvidersByLane(registry, "cheap");
  assert.ok(providers.find((p) => p.provider_id === "local"));
  assert.ok(providers.find((p) => p.provider_id === "openai"));
});

test("creator lane has only creator-only + openai + anthropic", () => {
  const providers = filterProvidersByLane(registry, "creator");
  assert.equal(providers.length, 3);
});

console.log("\nFilter by privacy:");

test("require_local returns only local", () => {
  const providers = filterProvidersByPrivacy(registry, "require_local");
  assert.equal(providers.length, 1);
  assert.equal(providers[0].provider_id, "local");
});

test("allow_remote returns all", () => {
  const providers = filterProvidersByPrivacy(registry, "allow_remote");
  assert.equal(providers.length, 4);
});

console.log("\nFilter by budget:");

test("low budget returns only local", () => {
  const providers = filterProvidersByBudget(registry, "low");
  assert.equal(providers.length, 1);
  assert.equal(providers[0].provider_id, "local");
});

test("high budget returns all", () => {
  const providers = filterProvidersByBudget(registry, "high");
  assert.equal(providers.length, 4);
});

console.log("\nProvider helpers:");

test("isProviderEnabled for local", () => {
  assert.equal(isProviderEnabled(registry, "local"), true);
});

test("isProviderEnabled for unknown", () => {
  assert.equal(isProviderEnabled(registry, "unknown"), false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
