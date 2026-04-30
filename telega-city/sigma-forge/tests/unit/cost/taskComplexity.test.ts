import assert from "node:assert/strict";
import { classifyTaskComplexity } from "../../../packages/runtime-economics-core/src/cost/taskComplexity.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nTask Complexity:");

test("simple task is low complexity", () => {
  const result = classifyTaskComplexity({ goal: "Say hello", constraints: [] });
  assert.equal(result, "low");
});

test("multi-constraint task is medium complexity", () => {
  const result = classifyTaskComplexity({ goal: "Build something with constraints", constraints: ["must be fast", "must be secure", "must be tested"] });
  assert.equal(result, "medium");
});

test("build task with tools is high complexity", () => {
  const result = classifyTaskComplexity({ goal: "Build API endpoint with code", constraints: ["must be tested", "must have docs"], requires_tools: true, task_kind: "build" });
  assert.equal(result, "high");
});

test("research task is high complexity", () => {
  const result = classifyTaskComplexity({ goal: "Compare and analyze multiple research findings", constraints: ["must be thorough"], task_kind: "research" });
  assert.equal(result, "high");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
