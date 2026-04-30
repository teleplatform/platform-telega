import assert from "node:assert/strict";
import { validateExplainAgainstLedger, ensureExplainIncludesExecutionTruth } from "../../../packages/fsgr-runtime/src/hardening/explainConsistency.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nExplain Consistency:");

test("valid explain passes", () => {
  const explain = { ok: true, run_summary: { status: "completed" }, node_transitions: [] };
  const ledger = { run_id: "r1", status: "completed" };
  const result = validateExplainAgainstLedger(explain as any, ledger as any, [], {});
  assert.equal(result.ok, true);
});

test("explain not ok rejected", () => {
  const explain = { ok: false };
  const ledger = { run_id: "r1" };
  const result = validateExplainAgainstLedger(explain as any, ledger as any, [], {});
  assert.equal(result.ok, false);
});

test("missing run_summary rejected", () => {
  const explain = { ok: true };
  const ledger = { run_id: "r1" };
  const result = validateExplainAgainstLedger(explain as any, ledger as any, [], {});
  assert.equal(result.ok, false);
});

test("ensureExplainIncludesExecutionTruth passes with valid explain", () => {
  const explain = { run_summary: { status: "completed" }, node_transitions: [] };
  const result = ensureExplainIncludesExecutionTruth(explain as any);
  assert.equal(result.ok, true);
});

test("ensureExplainIncludesExecutionTruth rejects missing summary", () => {
  const explain = { node_transitions: [] };
  const result = ensureExplainIncludesExecutionTruth(explain as any);
  assert.equal(result.ok, false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
