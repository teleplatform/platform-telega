import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { routeTaskEconomically } from "../../packages/runtime-economics-core/src/cost/costAwareRouter.js";
import { createProviderCatalog, registerDefaultProviders } from "../../packages/runtime-economics-core/src/provider/providerCatalog.js";
import { selectProvider } from "../../packages/runtime-economics-core/src/provider/providerRouter.js";
import { estimateExecutionBudget, checkExecutionBudget } from "../../packages/runtime-economics-core/src/budget/budgetGuard.js";
import { createRouteDecisionsRepo, createProviderSelectionsRepo, createBudgetEventsRepo } from "../../packages/runtime-economics-core/src/storage/sqlite/routeDecisionsRepo.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => { passed++; console.log(`  ✓ ${name}`); }).catch((e) => { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); });
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

async function runTests() {
  console.log("\nIntegration: Economics Route Single Call:");

  await test("simple task routes to cheap mode", () => {
    const decision = routeTaskEconomically({ goal: "Say hello", task_id: "t1" });
    assert.equal(decision.execution_mode, "single_call");
    assert.equal(decision.complexity, "low");
  });

  await test("route decision persisted to DB", () => {
    const db = new Database(":memory:");
    const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-economics-core/src/storage/sqlite/schema.sql");
    db.exec(readFileSync(schemaPath, "utf-8"));
    const repo = createRouteDecisionsRepo(db);
    const decision = routeTaskEconomically({ goal: "Say hello", task_id: "t1" });
    repo.saveRouteDecision(decision);
    const saved = repo.getRouteDecision("t1");
    assert.ok(saved);
    assert.equal(saved.execution_mode, "single_call");
  });

  console.log("\nIntegration: Economics Route Multi-Agent:");

  await test("complex task routes to deeper mode", () => {
    const decision = routeTaskEconomically({ goal: "Build API with code and analysis", task_id: "t2", requires_tools: true, task_kind: "build" });
    assert.ok(decision.execution_mode === "multi_agent" || decision.execution_mode === "tool_augmented");
    assert.equal(decision.complexity, "high");
  });

  console.log("\nIntegration: Economics Provider Selection:");

  await test("provider selection respects tool requirements", () => {
    const catalog = createProviderCatalog();
    registerDefaultProviders(catalog);
    const result = selectProvider(catalog.listProviders(), { needs_tools: true });
    assert.ok(result.selected);
    assert.ok(result.selected!.supports_tools);
  });

  await test("provider selection persisted to DB", () => {
    const db = new Database(":memory:");
    const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-economics-core/src/storage/sqlite/schema.sql");
    db.exec(readFileSync(schemaPath, "utf-8"));
    const repo = createProviderSelectionsRepo(db);
    const catalog = createProviderCatalog();
    registerDefaultProviders(catalog);
    const result = selectProvider(catalog.listProviders(), { needs_tools: true });
    repo.saveProviderSelection({ task_id: "t3", selected_provider_id: result.selected?.provider_id ?? "none", selected_provider_type: result.selected?.provider_type ?? "none", reasons: result.reasons, rejected: result.rejected });
    const saved = repo.getProviderSelection("t3");
    assert.ok(saved);
  });

  console.log("\nIntegration: Economics Budget Stop:");

  await test("budget guard blocks runaway execution", () => {
    const estimate = estimateExecutionBudget({ estimated_tokens: 100000, estimated_cost: 50.0 }, { complexity: "high", execution_mode: "multi_agent_reviewed" }, { cost_tier: "high" });
    const budget = { max_tokens_per_task: 20000, max_tools_per_task: 5, max_retries: 3, max_fanout: 3, max_agent_chain_depth: 5, max_total_cost_estimate: 1.0 };
    const decision = checkExecutionBudget({ estimated_tokens: estimate.estimated_tokens, estimated_cost: estimate.estimated_cost }, budget);
    assert.equal(decision.allowed, false);
  });

  await test("budget event persisted to DB", () => {
    const db = new Database(":memory:");
    const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-economics-core/src/storage/sqlite/schema.sql");
    db.exec(readFileSync(schemaPath, "utf-8"));
    const repo = createBudgetEventsRepo(db);
    repo.appendBudgetEvent({ task_id: "t4", allowed: false, reasons: ["tokens_exceeded"], estimated_cost: 50.0, estimated_tokens: 100000 });
    const events = repo.getBudgetEvents("t4");
    assert.ok(events.length > 0);
    assert.equal(events[0].allowed, 0);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
