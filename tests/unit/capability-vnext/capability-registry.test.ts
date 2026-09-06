// PD-W2/A3 — CapabilityRegistry vNext: additive action-capability domain.
// Run with: npx tsx tests/unit/capability-vnext/capability-registry.test.ts
//
// Asserts the registry is the single authority for ACTION CAPABILITY EXISTENCE
// only: no availability, no auth/authz grant, no provider selection, no dispatch.

import assert from "node:assert/strict";
import { CapabilityRegistry } from "../../../src/runtime/capability-vnext/capability-registry.js";
import type {
  CapabilityDescriptor,
  CapabilityPermissions,
} from "../../../src/runtime/capability-vnext/capability-descriptor.js";
import type {
  CapabilityKind,
  CapabilityTrustLevel,
} from "../../../src/runtime/capability-vnext/capability.types.js";
import * as registryBarrel from "../../../src/runtime/capability-vnext/index.js";

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

function fixture(id: string, overrides: Partial<CapabilityDescriptor> = {}): CapabilityDescriptor {
  return {
    capability_id: id,
    kind: "model",
    trust_level: "trusted",
    title: "fixture",
    description: "test fixture",
    permissions: {
      filesystem: "none",
      network: "none",
      browser: "none",
      terminal: "none",
      secrets: "none",
    },
    ...overrides,
  };
}

console.log("\nA. register");

test("registers a capability", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.simple"));
  assert.equal(registry.has("cap.simple"), true);
});

test("duplicate registration is rejected (fail closed)", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.dup"));
  assert.throws(() => registry.register(fixture("cap.dup")), /already registered/);
  assert.equal(registry.has("cap.dup"), true);
  assert.equal(registry.list().length, 1);
});

console.log("\nB. resolve");

test("resolves a capability by stable kind", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.voice", { kind: "voice_runtime" }));
  const resolved = registry.resolve("voice_runtime");
  assert.equal(resolved.capability_id, "cap.voice");
});

test("resolves a capability by stable id", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.byid", { kind: "memory" }));
  const resolved = registry.resolveById("cap.byid");
  assert.equal(resolved.kind, "memory");
});

test("resolve throws when a kind has no descriptor", () => {
  const registry = new CapabilityRegistry();
  assert.throws(() => registry.resolve("deployment"), /No capability registered/);
});

test("resolve throws when a kind is ambiguous (non-unique)", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.a", { kind: "model" }));
  registry.register(fixture("cap.b", { kind: "model" }));
  assert.throws(() => registry.resolve("model"), /Ambiguous/);
});

test("resolveById throws for unknown id", () => {
  const registry = new CapabilityRegistry();
  assert.throws(() => registry.resolveById("cap.missing"), /Unknown capability/);
});

console.log("\nC. list is deterministic");

test("list returns registered capabilities in registration order", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.one"));
  registry.register(fixture("cap.two", { kind: "terminal" }));
  assert.deepEqual(
    registry.list().map((d) => d.capability_id),
    ["cap.one", "cap.two"],
  );
});

test("list returns a defensive copy (mutation cannot alter registry truth)", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.imm"));
  const copy = registry.list();
  copy.splice(0, copy.length);
  assert.equal(registry.list().length, 1);
});

console.log("\nD. duplicate policy");

test("registration is idempotent-safe (reject, never silently overwrite)", () => {
  const registry = new CapabilityRegistry();
  const original = fixture("cap.rep", { trust_level: "core" });
  registry.register(original);
  assert.throws(() => registry.register(fixture("cap.rep", { trust_level: "external" })));
  assert.equal(registry.resolveById("cap.rep").trust_level, "core");
});

console.log("\nE. missing capability behavior");

test("has() is false for unknown id, true after registration", () => {
  const registry = new CapabilityRegistry();
  assert.equal(registry.has("cap.nope"), false);
  registry.register(fixture("cap.yep"));
  assert.equal(registry.has("cap.yep"), true);
});

console.log("\nF. trust level preserved verbatim");

test("trust level round-trips exactly", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.trust", { trust_level: "external" }));
  assert.equal(registry.resolveById("cap.trust").trust_level, "external");
});

console.log("\nG. permissions preserved verbatim");

test("permissions round-trip exactly", () => {
  const registry = new CapabilityRegistry();
  const permissions: CapabilityPermissions = {
    filesystem: "write_scoped",
    network: "allowlisted",
    browser: "interact",
    terminal: "scoped",
    secrets: "masked",
  };
  registry.register(fixture("cap.perms", { permissions }));
  assert.deepEqual(registry.resolveById("cap.perms").permissions, permissions);
});

console.log("\nH. no Availability concepts in registry authority");

test("descriptors carry no availability fields", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.avail"));
  const serialized = JSON.stringify(registry.resolve("model"));
  for (const forbidden of ["status", "target", "online", "offline", "degraded", "local"]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, `forbidden field: ${forbidden}`);
  }
});

test("registry runtime surface exposes only the registry class", () => {
  assert.deepEqual(Object.keys(registryBarrel).sort(), ["CapabilityRegistry"]);
  assert.equal(typeof registryBarrel.CapabilityRegistry, "function");
});

test("registry instances expose no availability-style authority", () => {
  const registry = new CapabilityRegistry();
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(registry)).sort();
  assert.deepEqual(methods, ["constructor", "has", "list", "register", "resolve", "resolveById"]);
});

console.log("\nI. registry does not grant actor authorization");

test("descriptors expose no actor/role/grant/permission-grant fields", () => {
  const registry = new CapabilityRegistry();
  registry.register(fixture("cap.authz"));
  const serialized = JSON.stringify(registry.resolveById("cap.authz"));
  for (const forbidden of ["actor", "role", "grant", "subject", "allow"]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, `forbidden field: ${forbidden}`);
  }
});

test("registry has no auth/authz integration surface", () => {
  const registry = new CapabilityRegistry();
  assert.equal(typeof (registry as any).authorize, "undefined");
  assert.equal(typeof (registry as any).allow, "undefined");
});

console.log("\nType-level contract assertions");

test("CapabilityKind is a stable closed union", () => {
  const kinds: CapabilityKind[] = [
    "model",
    "web_provider",
    "sigma_forge",
    "browser_agent",
    "voice_runtime",
    "mission_control",
    "repo",
    "terminal",
    "validator",
    "memory",
    "deployment",
  ];
  assert.equal(kinds.length, 11);
});

test("CapabilityTrustLevel is a stable closed union", () => {
  const trust: CapabilityTrustLevel[] = ["core", "trusted", "external", "experimental"];
  assert.equal(trust.length, 4);
});

test("CapabilityDescriptor is structurally stable", () => {
  const descriptor: CapabilityDescriptor = fixture("cap.type", {
    kind: "sigma_forge",
    trust_level: "core",
  });
  assert.equal(descriptor.capability_id, "cap.type");
  assert.equal(descriptor.kind, "sigma_forge");
  assert.equal(descriptor.trust_level, "core");
  assert.ok(descriptor.permissions);
  assert.ok(descriptor.title);
  assert.ok(descriptor.description);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
