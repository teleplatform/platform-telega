import assert from "node:assert/strict";
import { validateRunNodeConsistency, validateArtifactRunConsistency, validateCapsuleRunConsistency } from "../../../packages/fsgr-runtime/src/hardening/storageConsistency.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nStorage Consistency:");

test("valid run/node consistency accepted", () => {
  const run = { run_id: "r1" };
  const nodes = [{ run_id: "r1" }, { run_id: "r1" }];
  const result = validateRunNodeConsistency(run as any, nodes as any);
  assert.equal(result.ok, true);
});

test("run/node mismatch rejected", () => {
  const run = { run_id: "r1" };
  const nodes = [{ run_id: "r1" }, { run_id: "r2" }];
  const result = validateRunNodeConsistency(run as any, nodes as any);
  assert.equal(result.ok, false);
});

test("valid artifact consistency accepted", () => {
  const run = { run_id: "r1" };
  const artifacts = [{ run_id: "r1" }];
  const result = validateArtifactRunConsistency(run as any, artifacts as any);
  assert.equal(result.ok, true);
});

test("artifact mismatch rejected", () => {
  const run = { run_id: "r1" };
  const artifacts = [{ run_id: "r2" }];
  const result = validateArtifactRunConsistency(run as any, artifacts as any);
  assert.equal(result.ok, false);
});

test("valid capsule consistency accepted", () => {
  const run = { run_id: "r1" };
  const capsule = { capsule_id: "c1", run_id: "r1", capsule_json: JSON.stringify({ run_id: "r1" }) };
  const result = validateCapsuleRunConsistency(run as any, capsule as any);
  assert.equal(result.ok, true);
});

test("capsule mismatch rejected", () => {
  const run = { run_id: "r1" };
  const capsule = { capsule_id: "c1", run_id: "r1", capsule_json: JSON.stringify({ run_id: "r2" }) };
  const result = validateCapsuleRunConsistency(run as any, capsule as any);
  assert.equal(result.ok, false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
