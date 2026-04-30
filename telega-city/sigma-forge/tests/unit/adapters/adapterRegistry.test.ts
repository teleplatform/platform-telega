import assert from "node:assert/strict";
import { createAdapterRegistry } from "../../../packages/runtime-channel-core/src/adapters/adapterRegistry.js";
import { createChannelBinding, resolvePrimaryBinding, resolveBindingsByUser, resolveBindingByTransport } from "../../../packages/runtime-channel-core/src/binding/channelBinding.js";
import { decideTransportFailover, buildReplaySummary, FAILOVER_PRIORITY } from "../../../packages/runtime-channel-core/src/failover/transportFailover.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nAdapter Registry:");

test("register and get adapter", () => {
  const registry = createAdapterRegistry();
  const adapter = { transport: "telegram" as const, normalizeInbound: () => ({}), buildOutbound: () => ({}), isAvailable: () => true };
  registry.registerAdapter(adapter);
  const got = registry.getAdapter("telegram");
  assert.ok(got);
  assert.equal(got!.transport, "telegram");
});

test("duplicate transport registration throws", () => {
  const registry = createAdapterRegistry();
  const adapter = { transport: "web" as const, normalizeInbound: () => ({}), buildOutbound: () => ({}), isAvailable: () => true };
  registry.registerAdapter(adapter);
  assert.throws(() => registry.registerAdapter(adapter));
});

test("list adapters returns all", () => {
  const registry = createAdapterRegistry();
  registry.registerAdapter({ transport: "telegram" as const, normalizeInbound: () => ({}), buildOutbound: () => ({}), isAvailable: () => true });
  registry.registerAdapter({ transport: "web" as const, normalizeInbound: () => ({}), buildOutbound: () => ({}), isAvailable: () => true });
  assert.equal(registry.listAdapters().length, 2);
});

test("missing adapter returns undefined", () => {
  const registry = createAdapterRegistry();
  assert.equal(registry.getAdapter("telegram"), undefined);
});

console.log("\nChannel Binding:");

test("createChannelBinding creates valid binding", () => {
  const binding = createChannelBinding({ tele_user_id: "user_1", transport: "telegram" });
  assert.ok(binding.binding_id.startsWith("binding_"));
  assert.equal(binding.tele_user_id, "user_1");
  assert.equal(binding.transport, "telegram");
  assert.equal(binding.is_primary, true);
});

test("resolvePrimaryBinding returns primary", () => {
  const bindings = [
    { binding_id: "b1", tele_user_id: "u1", transport: "web" as const, is_primary: false, created_at: "", updated_at: "" },
    { binding_id: "b2", tele_user_id: "u1", transport: "telegram" as const, is_primary: true, created_at: "", updated_at: "" },
  ];
  const primary = resolvePrimaryBinding(bindings as any);
  assert.ok(primary);
  assert.equal(primary!.transport, "telegram");
});

test("resolveBindingsByUser filters correctly", () => {
  const bindings = [
    { binding_id: "b1", tele_user_id: "u1", transport: "telegram" as const, is_primary: true, created_at: "", updated_at: "" },
    { binding_id: "b2", tele_user_id: "u2", transport: "web" as const, is_primary: true, created_at: "", updated_at: "" },
  ];
  const result = resolveBindingsByUser(bindings as any, "u1");
  assert.equal(result.length, 1);
  assert.equal(result[0].tele_user_id, "u1");
});

console.log("\nTransport Failover:");

test("current transport available → no failover", () => {
  const decision = decideTransportFailover({
    tele_user_id: "u1",
    current_transport: "telegram",
    available_transports: [{ transport: "telegram", available: true, reasons: [] }],
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.replay_required, false);
});

test("current transport unavailable → failover to next priority", () => {
  const decision = decideTransportFailover({
    tele_user_id: "u1",
    current_transport: "telegram",
    available_transports: [
      { transport: "telegram", available: false, reasons: ["down"] },
      { transport: "tgm", available: true, reasons: [] },
      { transport: "web", available: true, reasons: [] },
    ],
    session_id: "s1",
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.to_transport, "tgm");
  assert.equal(decision.replay_required, true);
});

test("no available transport → failover denied", () => {
  const decision = decideTransportFailover({
    tele_user_id: "u1",
    current_transport: "telegram",
    available_transports: [{ transport: "telegram", available: false, reasons: ["down"] }],
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons[0].includes("no_available"));
});

test("replay summary built correctly", () => {
  const state = { replay_id: "r1", tele_user_id: "u1", session_id: "s1", task_id: "t1", last_transport: "telegram" as const, continuity_summary: "2 events processed", created_at: "", updated_at: "" };
  const summary = buildReplaySummary(state, [{ type: "inbound" }, { type: "outbound" }]);
  assert.ok(summary.includes("s1"));
  assert.ok(summary.includes("2 events"));
});

test("FAILOVER_PRIORITY has 5 transports", () => {
  assert.equal(FAILOVER_PRIORITY.length, 5);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
