import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createAdapterRegistry } from "../../packages/runtime-channel-core/src/adapters/adapterRegistry.js";
import { createTelegramAdapter, createWebAdapter, createMiniappAdapter, createTgmAdapter, registerDefaultAdapters } from "../../packages/runtime-channel-core/src/adapters/defaultAdapters.js";
import { createChannelBinding, resolvePrimaryBinding, resolveBindingsByUser } from "../../packages/runtime-channel-core/src/binding/channelBinding.js";
import { decideTransportFailover, buildReplaySummary, createReplayState } from "../../packages/runtime-channel-core/src/failover/transportFailover.js";

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
  console.log("\nIntegration: Channel Normalize Telegram:");

  await test("telegram inbound normalizes to unified event", () => {
    const adapter = createTelegramAdapter();
    const raw = { from: { id: 12345 }, chat: { id: 12345 }, text: "Hello bot" };
    const event = adapter.normalizeInbound(raw);
    assert.equal(event.transport, "telegram");
    assert.equal(event.tele_user_id, "12345");
    assert.equal(event.text, "Hello bot");
  });

  await test("telegram outbound builds correct envelope", () => {
    const adapter = createTelegramAdapter();
    const outbound = adapter.buildOutbound({ tele_user_id: "12345", text: "Response" });
    assert.equal((outbound as any).chat_id, "12345");
    assert.equal((outbound as any).text, "Response");
  });

  await test("web adapter normalizes correctly", () => {
    const adapter = createWebAdapter();
    const raw = { user_id: "user_1", session_id: "sess_1", text: "Hello" };
    const event = adapter.normalizeInbound(raw);
    assert.equal(event.transport, "web");
    assert.equal(event.tele_user_id, "user_1");
  });

  await test("miniapp adapter normalizes correctly", () => {
    const adapter = createMiniappAdapter();
    const raw = { initData: { user: { id: 999 } }, text: "Test" };
    const event = adapter.normalizeInbound(raw);
    assert.equal(event.tele_user_id, "999");
  });

  await test("tgm adapter normalizes correctly", () => {
    const adapter = createTgmAdapter();
    const raw = { user_id: "tgm_user", text: "TGM message" };
    const event = adapter.normalizeInbound(raw);
    assert.equal(event.tele_user_id, "tgm_user");
  });

  console.log("\nIntegration: Channel Bind and Replay:");

  await test("binding created and resolved", () => {
    const binding = createChannelBinding({ tele_user_id: "user_1", transport: "telegram" });
    assert.ok(binding.binding_id);
    assert.equal(binding.is_primary, true);
  });

  await test("multiple bindings resolve to primary", () => {
    const bindings = [
      createChannelBinding({ tele_user_id: "user_2", transport: "web", is_primary: false }),
      createChannelBinding({ tele_user_id: "user_2", transport: "telegram", is_primary: true }),
    ];
    const primary = resolvePrimaryBinding(bindings);
    assert.equal(primary!.transport, "telegram");
  });

  await test("replay state created and summary built", () => {
    const state = createReplayState({ tele_user_id: "user_3", session_id: "sess_3", task_id: "task_3", last_transport: "telegram", continuity_summary: "Task in progress" });
    assert.ok(state.replay_id);
    assert.equal(state.tele_user_id, "user_3");
    const summary = buildReplaySummary(state, []);
    assert.ok(summary.includes("sess_3"));
    assert.ok(summary.includes("Task in progress"));
  });

  console.log("\nIntegration: Channel Failover to Web:");

  await test("telegram down → failover to tgm", () => {
    const decision = decideTransportFailover({
      tele_user_id: "user_4",
      current_transport: "telegram",
      available_transports: [
        { transport: "telegram", available: false, reasons: ["webhook_error"] },
        { transport: "tgm", available: true, reasons: [] },
        { transport: "web", available: true, reasons: [] },
      ],
      session_id: "sess_4",
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.to_transport, "tgm");
    assert.equal(decision.replay_required, true);
  });

  await test("all channels down → failover denied", () => {
    const decision = decideTransportFailover({
      tele_user_id: "user_5",
      current_transport: "telegram",
      available_transports: [
        { transport: "telegram", available: false, reasons: ["down"] },
        { transport: "tgm", available: false, reasons: ["down"] },
        { transport: "web", available: false, reasons: ["down"] },
      ],
    });
    assert.equal(decision.allowed, false);
  });

  console.log("\nIntegration: Channel Session Recovery:");

  await test("default adapters register without error", () => {
    const registry = createAdapterRegistry();
    registerDefaultAdapters(registry);
    assert.equal(registry.listAdapters().length, 4);
    assert.ok(registry.getAdapter("telegram"));
    assert.ok(registry.getAdapter("web"));
    assert.ok(registry.getAdapter("miniapp"));
    assert.ok(registry.getAdapter("tgm"));
  });

  await test("adapter isAvailable returns true", () => {
    const registry = createAdapterRegistry();
    registerDefaultAdapters(registry);
    for (const adapter of registry.listAdapters()) {
      assert.equal(adapter.isAvailable(), true);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
