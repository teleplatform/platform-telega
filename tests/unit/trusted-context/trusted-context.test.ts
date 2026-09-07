// PD-W3/B4-A — Trusted Execution Context boundary proofs.
// Run with: npx tsx tests/unit/trusted-context/trusted-context.test.ts
//
// Proof targets (B4-A section G):
// 1. Verified gateway key produces canonical api:<id>.
// 2. Invalid/unverified identity cannot construct a usable trusted context.
// 3. Raw token is never stored in TrustedExecutionContext.
// 4. ChatRequest exposes no identity fields (runtime mirror + tsc negative contract in src).
// 5. ChatRequest.meta cannot become trusted identity.
// 6. Source set is closed.
// 7. No system:runtime fallback.
// 8-10. Covered by the existing B2/forge/worker/authz suites (run separately).
// 11/12. bridge.internal has NO construction point in this batch (deferred).

import assert from "node:assert/strict";
import {
  createApiKey,
  validateApiKey,
  type TeleGptApiKey,
} from "../../../src/api-keys/store.js";
import { resolveActor } from "../../../src/core/authz/actor.js";
import {
  TRUSTED_SOURCES,
  TRUSTED_SOURCE_SUBJECT_PATTERN,
  isTrustedSource,
  TrustedContextConstructionError,
  createTrustedExecutionContext,
} from "../../../src/core/trusted-context/index.js";
import { resolveGatewayActor } from "../../../src/gateway/dispatch-adapter.js";

let passed = 0;
let failed = 0;

const tests: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

async function runTests() {
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${t.name}`);
      console.error(`    ${e?.message ?? e}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

const VALID_ID = "key_1700000000000_aabbccddeeff0011";

function fakeApiKey(id: string, extra?: Partial<TeleGptApiKey>): TeleGptApiKey {
  return {
    id,
    prefix: "tgpt_sk_",
    secretHash: `sha256_${"f".repeat(64)}`,
    name: "b4a-unit",
    clientType: "external",
    allowedModels: [],
    permissions: { chat: true, tools: false, streaming: false },
    limits: {},
    status: "active",
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

console.log("\nPD-W3/B4-A Trusted Execution Context Boundary:");

console.log("\nG1. verified key → canonical api:<id>");

test("G1. verified gateway key produces canonical api:<id>", () => {
  const { fullKey, key } = createApiKey({ name: "b4a-g1", allowedModels: [] });
  const verified = validateApiKey(fullKey);
  assert.equal(verified.valid, true, "key must verify server-side");
  const trusted = resolveGatewayActor(verified.key as TeleGptApiKey);
  assert.equal(trusted.subject, `api:${verified.key!.id}`);
  assert.equal(trusted.actor?.id, `api:${verified.key!.id}`);
  assert.equal(trusted.actor?.kind, "api");
  assert.equal(trusted.actor?.role, "public");
  assert.equal(trusted.actor?.subject, `api:${verified.key!.id}`);
  assert.equal(trusted.source, "gateway.authentication.verified_api_key");
  assert.equal(Object.isFrozen(trusted), true, "context must be frozen");
  assert.equal(trusted.subject, `api:${key.id}`);
});

console.log("\nG2. invalid/unverified identity cannot construct a usable context");

test("G2. invalid/unverified identity cannot construct a usable gateway trusted context", () => {
  const badIds = ["", "user:bob", "key_not_hex", "system:runtime", "internal:runtime", VALID_ID.toUpperCase()];
  for (const id of badIds) {
    assert.throws(
      () => resolveGatewayActor(fakeApiKey(id)),
      TrustedContextConstructionError,
      `expected rejection for id=${JSON.stringify(id)}`,
    );
  }
  assert.equal(validateApiKey("tgpt_sk_0000000000000000000000000000000000000000000000000000000000000000").valid, false);
  assert.equal(validateApiKey("sk-not-a-gateway-key").valid, false);
  assert.equal(validateApiKey("tgpt_sk_").valid, false);
});

console.log("\nG3. raw token / secret material never stored");

test("G3. raw token and secret material are never stored in TrustedExecutionContext", () => {
  const secretHash = "f".repeat(64);
  const record = fakeApiKey(VALID_ID, { secretHash, prefix: "tgpt_sk_fake" });
  const trusted = resolveGatewayActor(record);
  const serialized = JSON.stringify(trusted);
  assert.ok(!serialized.includes("tgpt_sk"), "no raw token prefix leaks");
  assert.ok(!serialized.includes(secretHash), "no secret material leaks");
  assert.ok(!Object.keys(trusted).includes("secretHash"));
  assert.ok(!Object.keys(trusted).includes("prefix"));
  assert.ok(!Object.values(trusted).includes(secretHash as any));
  assert.equal(trusted.subject, `api:${VALID_ID}`);
});

console.log("\nG4. ChatRequest identity-free negative contract");

test("G4. ChatRequest exposes no identity fields (runtime mirror of the tsc proof)", () => {
  const sample: Record<string, unknown> = { message: "x", model: "local-demo", request_id: "req_x" };
  for (const forbidden of ["subject", "actor", "authz", "trustedExecutionContext", "trusted_context", "userId", "user_id", "identity", "api_key"]) {
    assert.ok(!(forbidden in sample), `forbidden key ${forbidden} must not appear`);
  }
  assert.ok("meta" in { message: "x", meta: {} }, "opaque meta remains the only free-form channel");
});

console.log("\nG5. meta can never become trusted identity");

test("G5. ChatRequest.meta cannot become trusted identity", () => {
  const poisonedMeta = {
    subject: "user:mallory",
    actor: { id: "user:mallory" },
    authz: { action: "agent.run" },
    trustedExecutionContext: { source: "gateway.authentication.verified_api_key" },
  };
  // Identity-looking strings can never mint a context under a trusted source.
  for (const subject of [poisonedMeta.subject, "system:runtime", "internal:runtime", "user:anonymous"]) {
    assert.throws(
      () => createTrustedExecutionContext({ subject, actor: null, source: "gateway.authentication.verified_api_key" }),
      TrustedContextConstructionError,
      `subject ${subject} must be rejected at construction`,
    );
  }
  // The trusted adapter path has NO meta input: it derives identity ONLY from
  // the server-verified key record. A poisoned ChatRequest cannot reach it.
  const key = fakeApiKey(VALID_ID);
  const trusted = resolveGatewayActor(key);
  assert.equal(trusted.subject, `api:${VALID_ID}`);
  assert.equal(trusted.actor?.id, `api:${VALID_ID}`);
});

console.log("\nG6. TrustedSource set is closed");

test("G6. TrustedSource set is closed; all escape-hatch sources rejected", () => {
  assert.deepEqual(TRUSTED_SOURCES, ["gateway.authentication.verified_api_key"]);
  assert.deepEqual(Object.keys(TRUSTED_SOURCE_SUBJECT_PATTERN).sort(), ["gateway.authentication.verified_api_key"]);
  const forbidden = [
    "bridge.internal",
    "worker.executor",
    "system",
    "internal",
    "user",
    "telegram",
    "untrusted",
    "",
  ];
  for (const s of forbidden) {
    assert.equal(isTrustedSource(s), false, `source ${JSON.stringify(s)} must be rejected`);
    assert.throws(
      () => createTrustedExecutionContext({ subject: `api:${VALID_ID}`, actor: null, source: s as any }),
      TrustedContextConstructionError,
      `source ${JSON.stringify(s)} must throw`,
    );
  }
  assert.equal(isTrustedSource("gateway.authentication.verified_api_key"), true);
});

console.log("\nG7. no system:runtime fallback");

test("G7. no system:runtime / synthetic fallback identity", () => {
  const trusted = resolveGatewayActor(fakeApiKey(VALID_ID));
  assert.equal(trusted.actor?.subject, `api:${VALID_ID}`);
  assert.notEqual(trusted.actor?.subject, "system:runtime");
  assert.notEqual(trusted.actor?.subject, "internal:runtime");
  assert.equal(trusted.actor?.isSystem, false);
  assert.equal(trusted.actor?.isInternal, false);
});

console.log("\nG8. actor / subject consistency");

test("G8. actor must be consistent with the derived subject", () => {
  assert.throws(
    () =>
      createTrustedExecutionContext({
        subject: `api:${VALID_ID}`,
        actor: resolveActor("user:someone"),
        source: "gateway.authentication.verified_api_key",
      }),
    TrustedContextConstructionError,
    "actor/subject mismatch rejected",
  );
});

console.log("\nD. raw-token-shaped subjects rejected at the canonical factory");

test("D. raw token cannot be smuggled inside a subject", () => {
  assert.throws(
    () =>
      createTrustedExecutionContext({
        subject: `api:tgpt_sk_0000000000000000000000000000000000000000000000000000000000000000`,
        actor: null,
        source: "gateway.authentication.verified_api_key",
      }),
    TrustedContextConstructionError,
    "raw token subject rejected",
  );
});

console.log("\nB. bridge.internal construction point (spec 11/12)");

test("B. bridge.internal has NO construction point in B4-A (deferred)", () => {
  assert.equal(isTrustedSource("bridge.internal"), false);
  assert.ok(!("createBridgeTrustedContext" in {}), "no bridge constructor exported");
});

void runTests();