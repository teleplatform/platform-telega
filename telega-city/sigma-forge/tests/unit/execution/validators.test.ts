import assert from "node:assert/strict";
import { createValidatorRegistry, registerDefaultValidators, runValidators } from "../../../packages/fsgr-runtime/src/execution/validators.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nValidators:");

test("output-exists passes with outputs", () => {
  const registry = createValidatorRegistry();
  registerDefaultValidators(registry);
  const node = { node_id: "n1", validator_hooks: ["output-exists"] };
  const result = runValidators(node as any, { outputs: [{ ref: "out1", value: "test" }] }, registry);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "passed");
});

test("output-exists fails without outputs", () => {
  const registry = createValidatorRegistry();
  registerDefaultValidators(registry);
  const node = { node_id: "n1", validator_hooks: ["output-exists"] };
  const result = runValidators(node as any, { outputs: [] }, registry);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "failed");
});

test("output-non-empty warns on empty", () => {
  const registry = createValidatorRegistry();
  registerDefaultValidators(registry);
  const node = { node_id: "n1", validator_hooks: ["output-non-empty"] };
  const result = runValidators(node as any, { outputs: [{ ref: "out1", value: "" }] }, registry);
  assert.equal(result[0].status, "warning");
});

test("warning path allows completion", () => {
  const registry = createValidatorRegistry();
  registerDefaultValidators(registry);
  const node = { node_id: "n1", validator_hooks: ["output-non-empty"] };
  const result = runValidators(node as any, { outputs: [{ ref: "out1", value: "" }] }, registry);
  assert.ok(result.every((r) => r.status !== "failed"));
});

test("validator registry works", () => {
  const registry = createValidatorRegistry();
  registry.register("custom", () => ({ validator: "custom", status: "passed", summary: "OK" }));
  const validator = registry.get("custom");
  assert.ok(validator);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
