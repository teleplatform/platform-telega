import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRedundancyRepos } from "../../packages/runtime-redundancy-core/src/storage/sqlite/redundancyRepo.js";
import { createRedundancyApi } from "../../packages/runtime-redundancy-core/src/api/redundancyApi.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIntegration: R16-S2 Transport Redundancy:");

const db = new Database(":memory:");
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-redundancy-core/src/storage/sqlite/schema.sql");
db.exec(readFileSync(schemaPath, "utf-8"));
const repos = createRedundancyRepos(db);
const api = createRedundancyApi({ repos });

// 1. Channel registration
test("register transport channel", () => {
  const ch = api.registerTransportChannel({ transport: "telegram", identity_key: "tg_user_1", priority: 2 });
  assert.ok(ch.channel_id);
  assert.equal(ch.status, "active");
  assert.equal(ch.priority, 2);
});

test("register second channel", () => {
  const ch = api.registerTransportChannel({ transport: "web", identity_key: "web_user_1", priority: 1 });
  assert.ok(ch.channel_id);
});

test("list active channels", () => {
  const channels = api.listActiveChannels();
  assert.equal(channels.length, 2);
});

test("get channel by transport", () => {
  const ch = api.getChannelStatus("telegram");
  assert.ok(ch);
  assert.equal(ch!.identity_key, "tg_user_1");
});

// 2. Identity continuity
test("bind identity continuity", () => {
  const record = api.bindIdentityContinuity({
    transport_identity_key: "tg_user_1",
    transport: "telegram",
    canonical_user_id: "canon_user_1",
    session_id: "sess_1",
  });
  assert.ok(record.identity_id);
  assert.equal(record.canonical_user_id, "canon_user_1");
});

test("duplicate bind returns existing record", () => {
  const record1 = api.bindIdentityContinuity({
    transport_identity_key: "tg_user_2",
    transport: "telegram",
    canonical_user_id: "canon_user_2",
  });
  const record2 = api.bindIdentityContinuity({
    transport_identity_key: "tg_user_2",
    transport: "telegram",
    canonical_user_id: "canon_user_2",
  });
  assert.equal(record1.identity_id, record2.identity_id);
});

// 3. Transport loss detection
test("record transport loss", () => {
  const event = api.recordTransportLoss({
    transport: "telegram",
    severity: "high",
    reason: "webhook_error",
    affected_missions: ["mission_1"],
  });
  assert.ok(event.event_id);
  assert.equal(event.severity, "high");
});

// 4. Failover execution
test("execute failover from telegram to web", () => {
  const event = api.executeFailover({
    mission_id: "mission_1",
    from_transport: "telegram",
    to_transport: "web",
    reason: "telegram_unavailable",
  });
  assert.equal(event.status, "completed");
  assert.equal(event.from_transport, "telegram");
  assert.equal(event.to_transport, "web");
});

// 5. Recovery recording
test("record recovery", () => {
  const record = api.recordRecovery({
    mission_id: "mission_1",
    transport: "web",
    method: "replay",
    evidence_refs: ["evidence_1", "evidence_2"],
  });
  assert.equal(record.status, "completed");
  assert.equal(record.method, "replay");
  assert.equal(record.evidence_refs.length, 2);
});

// 6. Operational degradation
test("activate operational degradation", () => {
  const state = api.activateOperationalDegradation({
    scope: "transport",
    scope_id: "telegram",
    active_transport: "web",
    lost_transports: ["telegram"],
    affected_operations: ["live_missions"],
    reason: "telegram_transport_failure",
  });
  assert.equal(state.status, "active");
  assert.equal(state.degradation_mode, "reduced_capacity");
  assert.ok(state.affected_operations.includes("live_missions"));
});

// 7. Delivery envelope
test("create delivery envelope", () => {
  const envelope = api.createDeliveryEnvelope({
    mission_id: "mission_1",
    target_transport: "telegram",
    fallback_transport: "web",
    payload_ref: "payload_1",
    payload_summary: "Mission result delivered",
  });
  assert.equal(envelope.status, "pending");
  assert.equal(envelope.target_transport, "telegram");
  assert.equal(envelope.fallback_transport, "web");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
