// UI-4G/G1.9 — Runtime Identity Trust: authMiddleware trust-gate unit tests.
// Run:  npx tsx tests/unit/runtime-identity/authMiddleware.test.ts
//
// Drives the exported authMiddleware over mocked Fastify req/reply so the
// SERVER-VERIFIED trust boundary is asserted without a live server or the
// dirty platform layer. A provisioned key is created via the committed
// api-keys store API inside an isolated temp CWD so no state lands in this
// repo or the .tgpt default location.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authMiddleware } from "../../../src/server/middleware/auth.js";
import { createApiKey } from "../../../src/api-keys/store.js";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`  ok  ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  FAIL ${name}`);
      console.error(`       ${e && e.message ? e.message : e}`);
    }
  })();
}

function makeReply() {
  const calls: Array<{ code: number; body: unknown }> = [];
  return {
    code: (c: number) => ({
      send: (body: unknown) => {
        calls.push({ code: c, body });
        return undefined as never;
      },
    }),
    calls,
  };
}

type ReqLike = {
  headers: Record<string, string | undefined>;
  authContext?: { subject: string };
  authZContext?: unknown;
};
function makeReq(headers: Record<string, string | undefined>, authContext?: { subject: string }): ReqLike {
  return { headers, authContext };
}

async function expect401(label: string, headers: Record<string, string | undefined>) {
  const req: any = makeReq(headers);
  const reply: any = makeReply();
  await authMiddleware(req, reply);
  assert.equal(reply.calls.length, 1, `${label}: expected authMiddleware to send one response`);
  assert.equal(reply.calls[0].code, 401, `${label}: expected HTTP 401`);
  const body = reply.calls[0].body as { error?: { code?: string } };
  assert.equal(body?.error?.code, "UNAUTHORIZED", `${label}: code UNAUTHORIZED`);
}

async function main() {
  // Isolate .tgpt store writes away from the repo.
  const cwd = mkdtempSync(join(tmpdir(), "tgpt-g19-"));
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    // Provision one valid key through the committed store API.
    const provisioned = createApiKey({ name: "g1.9-test", allowedModels: [] });
    const good = provisioned.fullKey; // format tgpt_sk_<64 hex>

    const cases: Array<[string, Record<string, string | undefined>]> = [
      ["no credential -> 401", {}],
      ["invalid tgpt_sk_ (unknown) -> 401", { authorization: "Bearer tgpt_sk_0000000000000000000000000000000000000000000000000000000000000000" }],
      ["malformed opaque Bearer -> 401", { authorization: "Bearer not-a-real-key" }],
      ["x-maker-role only -> 401", { "x-maker-role": "admin" }],
      ["x-telegram-user-id only -> 401", { "x-telegram-user-id": "12345" }],
      ["x-maker-role + x-telegram-user-id, no key -> 401", { "x-maker-role": "admin", "x-telegram-user-id": "12345" }],
    ];
    for (const [label, headers] of cases) {
      await test(label, () => expect401(label, headers));
    }

    // Valid provisioned credential -> trusted api subject, proceeds (no 401).
    await test("valid issued tgpt_sk_* -> trusted api subject (no 401)", async () => {
      const req: any = makeReq({ authorization: `Bearer ${good}` });
      const reply: any = makeReply();
      await authMiddleware(req, reply);
      assert.equal(reply.calls.length, 0, "valid key should NOT 401");
      assert.ok(req.authContext, "authContext attached");
      assert.ok(req.authContext.subject.startsWith("api:"), `subject api:*, got ${req.authContext.subject}`);
      assert.ok(req.authZContext, "authZContext resolved (actor present)");
    });

    // valid cred via API-Key scheme form also accepted.
    await test("valid issued key via API-Key scheme -> trusted (no 401)", async () => {
      const req: any = makeReq({ authorization: `API-Key ${good}` });
      const reply: any = makeReply();
      await authMiddleware(req, reply);
      assert.equal(reply.calls.length, 0, "API-Key valid should NOT 401");
      assert.ok(req.authContext.subject.startsWith("api:"));
    });
  } finally {
    process.chdir(prev);
    rmSync(cwd, { recursive: true, force: true });
  }

  console.log(`\nResult: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
