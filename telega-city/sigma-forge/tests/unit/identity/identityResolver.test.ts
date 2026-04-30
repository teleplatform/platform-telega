import assert from "node:assert/strict";
import { resolveRuntimeIdentity, buildRuntimeIdentity, createScopeBinding } from "../../../packages/runtime-safety-core/src/identity/identityResolver.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIdentity Resolver:");

test("buildRuntimeIdentity creates valid identity", () => {
  const identity = buildRuntimeIdentity({ tele_user_id: "user_1", session_id: "sess_1" });
  assert.equal(identity.tele_user_id, "user_1");
  assert.equal(identity.session_id, "sess_1");
});

test("buildRuntimeIdentity includes channel identity", () => {
  const identity = buildRuntimeIdentity({ tele_user_id: "user_1", channel_transport: "telegram", channel_chat_id: "chat_1" });
  assert.ok(identity.channel_identity);
  assert.equal(identity.channel_identity!.transport, "telegram");
});

test("createScopeBinding creates valid binding", () => {
  const identity = buildRuntimeIdentity({ tele_user_id: "user_1", session_id: "sess_1" });
  const binding = createScopeBinding(identity);
  assert.ok(binding.scope_id);
  assert.equal(binding.tele_user_id, "user_1");
});

test("resolveRuntimeIdentity returns identity + scope", () => {
  const result = resolveRuntimeIdentity({ tele_user_id: "user_1", session_id: "sess_1" });
  assert.ok(result.identity);
  assert.ok(result.scope_binding);
  assert.equal(result.identity.tele_user_id, "user_1");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
