// PD-W2/A2 — Runtime Availability model + legacy capability compatibility.
// Run with: npx tsx tests/unit/availability/availability.test.ts
//
// Asserts:
//  A. Availability registry/defaults are the single truth (baseline semantics).
//  B. The legacy runtime/capability API is an exact compat shim delegating to
//     Availability (same profiles, same online filtering, same RuntimeTarget).

import assert from "node:assert/strict";
import { DEFAULT_TARGETS } from "../../../src/runtime/availability/availability-defaults.js";
import {
  listTargetProfiles,
  getTargetProfile,
  getTargetStatus,
  isTargetOnline,
  getOnlineProfiles,
} from "../../../src/runtime/availability/availability-registry.js";
import type { RuntimeTarget } from "../../../src/runtime/availability/availability.types.js";
import {
  listCapabilityProfiles as legacyList,
  getOnlineProfiles as legacyOnline,
} from "../../../src/runtime/capability/capability-registry.js";
import type { RuntimeTarget as LegacyRuntimeTarget } from "../../../src/runtime/capability/capability.types.js";
import * as legacyBarrel from "../../../src/runtime/capability/index.js";

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
    console.error(`    ${e?.message ?? e}`);
  }
}

const BASELINE_LIST = [
  {
    target: "kilo_mcp",
    status: "online",
    local: true,
    capabilities: ["build_task", "replay", "local_execution"],
  },
  {
    target: "forge_http",
    status: "degraded",
    local: false,
    capabilities: ["remote_execution"],
  },
];
const BASELINE_ONLINE = [
  {
    target: "kilo_mcp",
    status: "online",
    local: true,
    capabilities: ["build_task", "replay", "local_execution"],
  },
];

console.log("\nA. Availability registry / defaults:");

test("DEFAULT_TARGETS keeps baseline targets verbatim", () => {
  assert.deepEqual(DEFAULT_TARGETS, BASELINE_LIST);
});

test("listTargetProfiles returns baseline semantic profiles", () => {
  assert.deepEqual(listTargetProfiles(), BASELINE_LIST);
});

test("getTargetProfile returns known target", () => {
  assert.deepEqual(getTargetProfile("kilo_mcp"), BASELINE_LIST[0]);
});

test("getTargetProfile returns undefined for unknown target", () => {
  assert.equal(getTargetProfile("unknown_runtime"), undefined);
});

test("getTargetStatus matches baseline status values", () => {
  assert.equal(getTargetStatus("kilo_mcp"), "online");
  assert.equal(getTargetStatus("forge_http"), "degraded");
  assert.equal(getTargetStatus("local"), undefined);
});

test("isTargetOnline only true for online targets", () => {
  assert.equal(isTargetOnline("kilo_mcp"), true);
  assert.equal(isTargetOnline("forge_http"), false);
  assert.equal(isTargetOnline("missing"), false);
});

test("getOnlineProfiles returns only online profiles", () => {
  assert.deepEqual(getOnlineProfiles(), BASELINE_ONLINE);
});

test("listTargetProfiles returns a fresh copy (no shared mutable state)", () => {
  const copy = listTargetProfiles();
  copy.splice(0, copy.length);
  assert.deepEqual(listTargetProfiles(), BASELINE_LIST);
  assert.deepEqual(DEFAULT_TARGETS, BASELINE_LIST);
});

test("RuntimeTarget accepts literals and arbitrary targets", () => {
  const a: RuntimeTarget = "kilo_mcp";
  const b: RuntimeTarget = "some_custom_target";
  assert.equal(a, "kilo_mcp");
  assert.equal(b, "some_custom_target");
});

console.log("\nB. Legacy capability compatibility shim:");

test("listCapabilityProfiles identical to baseline snapshot", () => {
  assert.deepEqual(legacyList(), BASELINE_LIST);
});

test("getOnlineProfiles keeps baseline online-filtering semantics", () => {
  assert.deepEqual(legacyOnline(), BASELINE_ONLINE);
});

test("legacy shim delegates to Availability (single authority)", () => {
  assert.deepEqual(legacyList(), listTargetProfiles());
  assert.deepEqual(legacyOnline(), getOnlineProfiles());
});

test("legacy shim returns fresh copies (no duplicate store)", () => {
  const copy = legacyList();
  copy.splice(0, copy.length);
  assert.deepEqual(legacyList(), BASELINE_LIST);
});

test("legacy CapabilityProfile stays structurally compatible", () => {
  const profiles = legacyList();
  for (const p of profiles) {
    assert.ok(typeof p.target === "string");
    assert.ok(["online", "degraded", "offline"].includes(p.status));
    assert.ok(typeof p.local === "boolean");
    assert.ok(Array.isArray(p.capabilities));
  }
});

test("legacy RuntimeTarget type is preserved", () => {
  const a: LegacyRuntimeTarget = "forge_http";
  const b: LegacyRuntimeTarget = "telegram";
  const c: LegacyRuntimeTarget = "custom_target";
  assert.equal(a, "forge_http");
  assert.equal(b, "telegram");
  assert.equal(c, "custom_target");
});

test("legacy barrel index still exports the compatibility surface", () => {
  assert.equal(typeof legacyBarrel.getOnlineProfiles, "function");
  assert.equal(typeof legacyBarrel.listCapabilityProfiles, "function");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
