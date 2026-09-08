// PD-W3/B4-D1 — local:auto recursive routing is fail-closed (legacy routeChat seam).
// Run with: npx tsx tests/unit/router/local-auto-failclosed.test.ts
//
// Proof targets (per B4-D1 gate):
// 1. routeChat({ model: "local:auto" }) rejects with a controlled fail-closed
//    error (code LOCAL_AUTO_UNAVAILABLE, statusCode 503) — NOT a RangeError /
//    stack overflow / hang.
// 2. Guard is TERMINAL: no fallback to another provider (failureType set,
//    shouldFallback=false → executeWithOrchestrator rethrows immediately).
// 3. Positive control: concrete model "local-demo" still succeeds through the
//    same routeChat seam.
// 4. Secondary path: model="auto" on the legacy seam with Auto Router v2
//    disabled re-enters as local:auto and hits the same fail-closed guard.
//
// No recursion counters, no reset hooks, no test-only production branches.
// Evidence echo is redirected outside the repo (cwd is swapped to a tmp dir
// BEFORE the router module graph is imported, because localEvidence.ts
// resolves its event file against cwd at module load).

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
    }
  })();
}

async function main(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "local-auto-failclosed-"));
  process.chdir(tmpDir);

  const { routeChat } = await import("../../../src/core/router.js");
  const { setAutoRouterConfig } = await import("../../../src/provider-auto-router-v2/config.js");
  const { initExecutionEvidenceStore } = await import(
    "../../../src/runtime/evidence/execution-evidence-store.js"
  );
  initExecutionEvidenceStore(path.join(tmpDir, ".data", "execution-evidence"));

  console.log("\nB4-D1 — local:auto fail-closed guard:");

  await test("local:auto rejects with controlled fail-closed error, not RangeError", async () => {
    const t0 = Date.now();
    const err: any = await routeChat({
      request_id: "b4d1-local-auto",
      model: "local:auto",
      message: "trigger recursion seam",
    }).then(
      () => null,
      (e: unknown) => e,
    );
    const elapsed = Date.now() - t0;

    assert.ok(err, "expected routeChat(local:auto) to reject");
    assert.ok(!(err instanceof RangeError), `must not be RangeError: ${err.message}`);
    assert.ok(!/call stack|Maximum call stack/i.test(err.message), `no stack-overflow message: ${err.message}`);
    assert.equal(err.code, "LOCAL_AUTO_UNAVAILABLE", "controlled fail-closed error code");
    assert.equal(err.statusCode, 503, "service unavailable");
    assert.equal(err.failureType, "invalid_request", "classified for terminal rethrow");
    assert.equal(err.shouldFallback, false, "must be terminal — no provider fallback");
    assert.ok(elapsed < 10_000, `must terminate promptly, took ${elapsed}ms`);
  });

  await test("guard error propagates unwrapped (terminal, no SELECTION_PLAN_EXHAUSTED wrapper)", async () => {
    const err: any = await routeChat({
      request_id: "b4d1-local-auto-unwrapped",
      model: "local:auto",
      message: "terminal rethrow proof",
    }).then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err, "expected routeChat(local:auto) to reject");
    // The exact guard object surfaces unchanged: if the orchestrator loop had
    // swallowed the throw and continued, we would see its SELECTION_PLAN_EXHAUSTED
    // wrapper (or a real provider result) instead of the original diagnostics.
    assert.equal(err.code, "LOCAL_AUTO_UNAVAILABLE");
    assert.equal(err.diagnostics?.requested_model, "local:auto", "guard diagnostics preserved");
    assert.ok(Array.isArray(err.diagnostics?.available_providers), "available providers listed");
    assert.ok(Array.isArray(err.diagnostics?.disabled_providers), "disabled providers listed");
  });

  await test("positive control: concrete local-demo still succeeds on the same seam", async () => {
    const out: any = await routeChat({
      request_id: "b4d1-local-demo",
      model: "local-demo",
      message: "привет b4-d1",
    });
    assert.equal(out.meta.provider, "local", "provider preserved");
    assert.ok(String(out.output).includes("привет b4-d1"), `output delivered by localDemo leaf: ${out.output}`);
  });

  await test('model="auto" with Auto Router v2 disabled hits the same guard', async () => {
    setAutoRouterConfig({ enabled: false });
    try {
      const err: any = await routeChat({
        request_id: "b4d1-auto",
        model: "auto",
        message: "auto with disabled auto-router",
      }).then(
        () => null,
        (e: unknown) => e,
      );
      assert.ok(err, "expected routeChat(auto) to reject");
      assert.ok(!(err instanceof RangeError), `must not be RangeError: ${err.message}`);
      assert.equal(err.code, "LOCAL_AUTO_UNAVAILABLE", "re-entrant local:auto fail-closed");
      assert.equal(err.statusCode, 503, "service unavailable");
      assert.equal(err.shouldFallback, false, "terminal — no fallback from auto seam either");
    } finally {
      setAutoRouterConfig({ enabled: true });
    }
  });
}

void main()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((e: unknown) => {
    console.error("test harness failed:", e);
    process.exit(1);
  });