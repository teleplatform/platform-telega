import assert from "node:assert/strict";
import { createAdapterRegistry } from "../../packages/runtime-channel-core/src/adapters/adapterRegistry.js";
import { createTelegramAdapter, createWebAdapter, createMiniappAdapter, createTgmAdapter, registerDefaultAdapters } from "../../packages/runtime-channel-core/src/adapters/defaultAdapters.js";
import { normalizeInboundEvent, bindChannelIdentity, replaySession, resolveFailover } from "../../packages/runtime-channel-core/src/api/channelApi.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIntegration: Channel Normalize Telegram:");

test("telegram payload normalizes to unified event", () => {
  const registry = createAdapterRegistry();
  registerDefaultAdapters(registry);
  const raw = { from: { id: 12345 }, chat: { id: 67890 }, text: "Hello bot", message_id: 42 };
  const event = normalizeInboundEvent({ transport: "telegram", raw }, registry);
  assert.equal(event.transport, "telegram");
  assert.equal(event.tele_user_id, "12345");
  assert.equal(event.text, "Hello bot");
});

test("unknown transport throws error", () => {
  const registry = createAdapterRegistry();
  assert.throws(() => normalizeInboundEvent({ transport: "unknown" as any, raw: {} }, registry));
});

console.log("\nIntegration: Channel Bind and Replay:");

test("bindChannelIdentity creates new binding", () => {
  const result = bindChannelIdentity({ tele_user_id: "user_1", transport: "telegram", transport_user_id: "tg_123" }, []);
  assert.equal(result.is_new, true);
  assert.equal(result.binding.tele_user_id, "user_1");
  assert.equal(result.binding.transport, "telegram");
});

test("bindChannelIdentity returns existing binding", () => {
  const existing = [{ binding_id: "b1", tele_user_id: "user_2", transport: "telegram", is_primary: true, created_at: "", updated_at: "" }];
  const result = bindChannelIdentity({ tele_user_id: "user_2", transport: "telegram" }, existing as any);
  assert.equal(result.is_new, false);
  assert.equal(result.binding.binding_id, "b1");
});

test("replaySession restores session", () => {
  const result = replaySession({ tele_user_id: "user_3", session_id: "sess_3", task_id: "task_3", last_transport: "telegram", continuity_summary: "Task in progress" });
  assert.equal(result.restored, true);
  assert.equal(result.via_transport, "telegram");
  assert.ok(result.summary.includes("sess_3"));
});

console.log("\nIntegration: Channel Failover to Web:");

test("resolveFailover switches to tgm when telegram down", () => {
  const result = resolveFailover({
    tele_user_id: "user_4",
    current_transport: "telegram",
    available_transports: [
      { transport: "telegram", available: false, reasons: ["webhook_error"] },
      { transport: "tgm", available: true, reasons: [] },
      { transport: "web", available: true, reasons: [] },
    ],
    session_id: "sess_4",
  });
  assert.equal(result.decision.allowed, true);
  assert.equal(result.decision.to_transport, "tgm");
  assert.equal(result.replay_required, true);
});

test("resolveFailover denies when all transports down", () => {
  const result = resolveFailover({
    tele_user_id: "user_5",
    current_transport: "telegram",
    available_transports: [
      { transport: "telegram", available: false, reasons: ["down"] },
      { transport: "web", available: false, reasons: ["down"] },
    ],
  });
  assert.equal(result.decision.allowed, false);
});

console.log("\nIntegration: Channel Session Recovery:");

test("full recovery path: normalize → bind → failover → replay", () => {
  const registry = createAdapterRegistry();
  registerDefaultAdapters(registry);

  // Step 1: Normalize inbound
  const raw = { from: { id: 12345 }, chat: { id: 67890 }, text: "Process my order" };
  const event = normalizeInboundEvent({ transport: "telegram", raw }, registry);
  assert.equal(event.transport, "telegram");

  // Step 2: Bind channel identity
  const bindResult = bindChannelIdentity({ tele_user_id: event.tele_user_id, transport: "telegram" }, []);
  assert.equal(bindResult.is_new, true);

  // Step 3: Simulate telegram down, resolve failover
  const failoverResult = resolveFailover({
    tele_user_id: event.tele_user_id,
    current_transport: "telegram",
    available_transports: [
      { transport: "telegram", available: false, reasons: ["down"] },
      { transport: "tgm", available: true, reasons: [] },
      { transport: "web", available: true, reasons: [] },
    ],
    session_id: "sess_recovery",
  });
  assert.equal(failoverResult.decision.allowed, true);
  assert.equal(failoverResult.decision.to_transport, "tgm");

  // Step 4: Replay session via fallback
  const replayResult = replaySession({
    tele_user_id: event.tele_user_id,
    session_id: "sess_recovery",
    last_transport: failoverResult.decision.to_transport,
    continuity_summary: "Recovered via failover",
  });
  assert.equal(replayResult.restored, true);
  assert.equal(replayResult.via_transport, "tgm");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
