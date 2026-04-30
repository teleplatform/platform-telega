// AuthZ Provider/Tool Access Tests — Pack 2 — run with: npx tsx tests/unit/authz/providerTool.test.ts

import assert from "node:assert/strict";
import {
  checkProviderAccess,
  getAvailableProviders,
  getAvailableModels,
} from "../../../src/core/authz/providerAccess.js";
import {
  checkToolAccess,
  getAvailableTools,
} from "../../../src/core/authz/toolAccess.js";
import {
  checkBudget,
  checkRate,
  getBudget,
  getRate,
} from "../../../src/core/authz/budgetPolicy.js";

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

console.log("\nProvider Access:");

test("public can use local provider", () => {
  const result = checkProviderAccess("local", "public");
  assert.equal(result.allowed, true);
});

test("public CANNOT use openai provider", () => {
  const result = checkProviderAccess("openai", "public");
  assert.equal(result.allowed, false);
});

test("creator can use openai provider", () => {
  const result = checkProviderAccess("openai", "creator");
  assert.equal(result.allowed, true);
});

test("creator can use anthropic provider", () => {
  const result = checkProviderAccess("anthropic", "creator");
  assert.equal(result.allowed, true);
});

test("unknown provider is denied", () => {
  const result = checkProviderAccess("unknown", "system");
  assert.equal(result.allowed, false);
});

test("getAvailableProviders for public returns only local", () => {
  const providers = getAvailableProviders("public");
  assert.equal(providers.length, 1);
  assert.equal(providers[0].provider_id, "local");
});

test("getAvailableProviders for creator returns 4", () => {
  const providers = getAvailableProviders("creator");
  assert.equal(providers.length, 4);
});

test("getAvailableModels for openai+creator", () => {
  const models = getAvailableModels("openai", "creator");
  assert.ok(models.includes("gpt-4o-mini"));
  assert.ok(models.includes("gpt-4o"));
});

console.log("\nTool Access:");

test("creator can use fs.read", () => {
  const result = checkToolAccess("fs.read", "creator");
  assert.equal(result.allowed, true);
});

test("creator CANNOT use terminal.exec", () => {
  const result = checkToolAccess("terminal.exec", "creator");
  assert.equal(result.allowed, false);
});

test("internal can use terminal.exec", () => {
  const result = checkToolAccess("terminal.exec", "internal");
  assert.equal(result.allowed, true);
});

test("public CANNOT use any tools", () => {
  const result = checkToolAccess("fs.read", "public");
  assert.equal(result.allowed, false);
});

test("unknown tool is denied", () => {
  const result = checkToolAccess("unknown_tool", "system");
  assert.equal(result.allowed, false);
});

test("getAvailableTools for public returns empty", () => {
  const tools = getAvailableTools("public");
  assert.equal(tools.length, 0);
});

test("getAvailableTools for creator returns 6", () => {
  const tools = getAvailableTools("creator");
  assert.equal(tools.length, 6);
});

console.log("\nBudget Policy:");

test("public budget is 1 USD", () => {
  const budget = getBudget("public");
  assert.equal(budget.limit_usd, 1.0);
});

test("creator budget is 10 USD", () => {
  const budget = getBudget("creator");
  assert.equal(budget.limit_usd, 10.0);
});

test("system budget is unlimited", () => {
  const budget = getBudget("system");
  assert.equal(budget.limit_usd, Infinity);
});

test("checkBudget allows within limits", () => {
  const result = checkBudget("public", 0.5, 50000, 25);
  assert.equal(result.allowed, true);
});

test("checkBudget denies when USD exceeded", () => {
  const result = checkBudget("public", 1.5, 0, 0);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "budget_usd_exceeded");
});

test("checkBudget denies when sessions exceeded", () => {
  const result = checkBudget("public", 0, 0, 100);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "sessions_per_day_exceeded");
});

console.log("\nRate Policy:");

test("public rate is 10 rpm", () => {
  const rate = getRate("public");
  assert.equal(rate.max_requests_per_minute, 10);
});

test("creator rate is 60 rpm", () => {
  const rate = getRate("creator");
  assert.equal(rate.max_requests_per_minute, 60);
});

test("checkRate allows within limits", () => {
  const result = checkRate("public", 5, 1);
  assert.equal(result.allowed, true);
});

test("checkRate denies when rpm exceeded", () => {
  const result = checkRate("public", 15, 1);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "rpm_exceeded");
});

test("checkRate denies when concurrent exceeded", () => {
  const result = checkRate("public", 5, 5);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "concurrent_sessions_exceeded");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
