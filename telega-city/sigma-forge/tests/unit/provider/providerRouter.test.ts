import assert from "node:assert/strict";
import { createProviderCatalog, registerDefaultProviders } from "../../../packages/runtime-economics-core/src/provider/providerCatalog.js";
import { scoreProvider } from "../../../packages/runtime-economics-core/src/provider/providerScoring.js";
import { filterProvidersByPolicy } from "../../../packages/runtime-economics-core/src/provider/providerPolicy.js";
import { selectProvider } from "../../../packages/runtime-economics-core/src/provider/providerRouter.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nProvider Catalog:");

test("register and get provider", () => {
  const catalog = createProviderCatalog();
  catalog.registerProvider({ provider_id: "test", provider_type: "local", supports_tools: false, supports_structured_output: false, supports_reasoning: false, supports_long_context: false, privacy_class: "local_only", cost_tier: "low" });
  const p = catalog.getProvider("test");
  assert.ok(p);
  assert.equal(p!.provider_id, "test");
});

test("list providers includes defaults", () => {
  const catalog = createProviderCatalog();
  registerDefaultProviders(catalog);
  const providers = catalog.listProviders();
  assert.ok(providers.length >= 3);
});

console.log("\nProvider Scoring:");

test("tool-capable provider scores higher when tools needed", () => {
  const catalog = createProviderCatalog();
  registerDefaultProviders(catalog);
  const local = catalog.getProvider("local")!;
  const openai = catalog.getProvider("openai")!;
  const localScore = scoreProvider(local, { needs_tools: true }).score;
  const openaiScore = scoreProvider(openai, { needs_tools: true }).score;
  assert.ok(openaiScore > localScore);
});

test("local provider wins for local_only requirement", () => {
  const catalog = createProviderCatalog();
  registerDefaultProviders(catalog);
  const local = catalog.getProvider("local")!;
  const openai = catalog.getProvider("openai")!;
  const localScore = scoreProvider(local, { privacy_requirement: "local_only" }).score;
  const openaiScore = scoreProvider(openai, { privacy_requirement: "local_only" }).score;
  assert.ok(localScore > openaiScore);
});

console.log("\nProvider Policy:");

test("local_only_required filters out non-local", () => {
  const catalog = createProviderCatalog();
  registerDefaultProviders(catalog);
  const filtered = filterProvidersByPolicy(catalog.listProviders(), { local_only_required: true });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].provider_id, "local");
});

test("denied_providers filters correctly", () => {
  const catalog = createProviderCatalog();
  registerDefaultProviders(catalog);
  const filtered = filterProvidersByPolicy(catalog.listProviders(), { denied_providers: ["openai"] });
  assert.ok(!filtered.find((p) => p.provider_id === "openai"));
});

console.log("\nProvider Router:");

test("selects best provider for tools task", () => {
  const catalog = createProviderCatalog();
  registerDefaultProviders(catalog);
  const result = selectProvider(catalog.listProviders(), { needs_tools: true, cost_preference: "medium" });
  assert.ok(result.selected);
  assert.ok(result.selected!.supports_tools);
});

test("selects local provider for local_only requirement", () => {
  const catalog = createProviderCatalog();
  registerDefaultProviders(catalog);
  const result = selectProvider(catalog.listProviders(), { local_only_required: true });
  assert.ok(result.selected);
  assert.equal(result.selected!.provider_id, "local");
});

test("returns null when no providers available", () => {
  const result = selectProvider([], { needs_tools: true });
  assert.equal(result.selected, null);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
