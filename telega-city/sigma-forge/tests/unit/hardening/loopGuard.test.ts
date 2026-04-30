import assert from "node:assert/strict";
import { createLoopGuard, tickLoopGuard, recordProgress, assertLoopProgress } from "../../../packages/fsgr-runtime/src/hardening/loopGuard.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nLoop Guard:");

test("iteration counting works", () => {
  const guard = createLoopGuard(10);
  tickLoopGuard(guard);
  tickLoopGuard(guard);
  assert.equal(guard.iterations, 2);
});

test("limit reached detection", () => {
  const guard = createLoopGuard(2);
  tickLoopGuard(guard);
  tickLoopGuard(guard);
  const result = tickLoopGuard(guard);
  assert.equal(result.ok, false);
});

test("no-progress detection", () => {
  const guard = createLoopGuard(100);
  for (let i = 0; i < 25; i++) tickLoopGuard(guard);
  const result = assertLoopProgress(guard, 20);
  assert.equal(result.ok, false);
});

test("progress resets stall counter", () => {
  const guard = createLoopGuard(100);
  for (let i = 0; i < 10; i++) tickLoopGuard(guard);
  recordProgress(guard);
  for (let i = 0; i < 5; i++) tickLoopGuard(guard);
  const result = assertLoopProgress(guard, 20);
  assert.equal(result.ok, true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
