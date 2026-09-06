// PD-W3/B3-A — Forge execution adapter through the canonical Dispatch pipeline.
// Run with: npx tsx tests/unit/dispatch-vnext/forgeExecution.test.ts
//
// Proof targets (docs/PD-W3-B3 §8 B3 items):
// 1. Real Forge execution (real ForgeBridge → real KiloMcpAdapter → live mock
//    kilo_mcp endpoint) through Dispatch → completed with domain evidence.
// 2. No shadow/parallel legacy executor -> exactly ONE transport hit per run.
// 3. Dispatch lifecycle written exactly once per run; no duplicates.
// 4. Forge domain evidence (ForgeResult target/artifacts/traceId) preserved.
// 5. sigma_forge honestly deferred/fail-closed: no executor, no descriptor,
//    routing untouched (build_project still → sigma_forge, no remap).
// 6. Public actor denied by forge domain policy before any transport call.

import assert from "node:assert/strict";
import Fastify from "fastify";
import os from "node:os";
import path from "node:path";
import { classifyIntent } from "../../../src/runtime/intent/intent-engine.js";
import { routeIntent } from "../../../src/runtime/routing/action-router.js";
import {
  initExecutionEvidenceStore,
  getEvidenceByTrace,
  readEvidenceRecords,
} from "../../../src/runtime/evidence/execution-evidence-store.js";
import {
  initForgeBridge,
  resetForgeBridge,
} from "../../../src/runtime/forge-bridge/forge-bridge.js";
import { KiloMcpAdapter } from "../../../src/runtime/forge-bridge/adapters/kilo-mcp.adapter.js";
import {
  createForgeRuntime,
  runForgeBuild,
} from "../../../src/runtime/dispatch-vnext/forge-runtime.js";
import {
  FORGE_BRIDGE_ROUTE,
  forgeDomainId,
} from "../../../src/runtime/dispatch-vnext/forge-execution-adapter.js";
import { createForgeResult } from "../../../src/runtime/forge-bridge/forge-bridge.types.js";

let passed = 0;
let failed = 0;
let counter = 0;

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>) {
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

function freshEvidenceStore(): string {
  counter++;
  const dir = path.join(os.tmpdir(), `b3a-forge-${process.pid}-${counter}`);
  initExecutionEvidenceStore(dir);
  return dir;
}

function freshRunId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

const OWNER_SUBJECT = "maker:267246987";
const PUBLIC_SUBJECT = "api:public_key_test";

function authzFor(runId: string, isOwner: boolean) {
  return {
    action: "agent.run" as const,
    resource_kind: "session" as const,
    resource_id: runId,
    is_owner: isOwner,
    visibility_scope: "public" as const,
  };
}

// Live mock of the kilo_mcp /v1/tools/<tool> transport contract.
async function startKiloMcpMock() {
  let hits = 0;
  const app = Fastify({ logger: false });
  app.post("/v1/tools/:tool", async (_req, reply) => {
    hits++;
    return reply.send({
      status: "done",
      summary: "mock kilo_mcp: tool completed",
      output: { ok: true, message: "real forge build produced by mock kilo_mcp" },
      artifacts: [
        {
          artifact_id: `art_${hits}`,
          kind: "report",
          artifact_type: "report",
          name: "build-report",
          content: "mock kilo artifact",
        },
      ],
    });
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as any;
  return {
    app,
    url: `http://127.0.0.1:${addr.port}`,
    hits: () => hits,
  };
}

console.log("\nPD-W3/B3-A Forge Execution Adapter:");

console.log("\nU. unit coercions + identity translation");

test("U1. forgeDomainId extracts the raw domain id from a trusted subject", () => {
  assert.equal(forgeDomainId("maker:267246987"), "267246987");
  assert.equal(forgeDomainId("api:key_abc"), "key_abc");
  assert.equal(forgeDomainId("267246987"), "267246987");
});

test("U2. forged-mapping guards -- adapter runs the actual domain gate", async () => {
  const mock = await startKiloMcpMock();
  freshEvidenceStore();
  resetForgeBridge();
  initForgeBridge({ kiloMcpAdapter: new KiloMcpAdapter({ endpoint: mock.url }) });
  try {
    const runId = freshRunId("u2");
    const result = await runForgeBuild({
      subject: PUBLIC_SUBJECT,
      authz: authzFor(runId, false),
      payload: { prompt: "build a demo service", kind: "run_bridge_task" },
      run_id: runId,
      trace_id: runId,
    });
    assert.equal(result.execution_state, "failed");
    assert.ok(
      (result.outcome?.error?.message ?? "").includes("forge_access_forbidden"),
      `expected domain policy denial, got: ${result.outcome?.error?.message}`,
    );
    assert.equal(mock.hits(), 0, "public actor must be denied before any transport call");
  } finally {
    resetForgeBridge();
    await mock.app.close();
  }
});

console.log("\nD. deferred sigma_forge: fail-closed, routing untouched");

test("D1. persistence no executor/descriptor/binding for sigma_forge", () => {
  freshEvidenceStore();
  const runtime = createForgeRuntime();
  assert.equal(runtime.routes.resolve("sigma_forge"), undefined, "no sigma_forge executor");
  assert.equal(runtime.routes.resolve(FORGE_BRIDGE_ROUTE)?.execution_route_kind, "forge_bridge");
  assert.equal(
    runtime.routes.list().some((e) => e.execution_route_kind === "sigma_forge"),
    false,
  );
  assert.equal(
    runtime.capabilityRegistry.list().some((d) => d.kind === "sigma_forge"),
    false,
    "sigma_forge capability not registered",
  );
  assert.equal(runtime.bindingRegistry.resolveByCapabilityKind("sigma_forge"), undefined);
});

test("D2. build_project still routes to sigma_forge (no remap / no shadow route)", () => {
  freshEvidenceStore();
  const intent = classifyIntent({
    input_id: `d2_${Date.now()}`,
    user_id: OWNER_SUBJECT,
    surface: "api",
    type: "text",
    content: "build a demo service now",
    attachments: [],
    metadata: {},
    received_at: new Date().toISOString(),
  });
  const route = routeIntent(intent);
  assert.equal(route.route, "sigma_forge", "routing must stay untouched (deferred, fail-closed)");
  assert.equal(route.build_task_required, true);
});

console.log("\nE1. real Forge execution through Dispatch");

test("E1. owner → Dispatch → ForgeBridge → live kilo_mcp → completed, single lifecycle, domain evidence preserved", async () => {
  const mock = await startKiloMcpMock();
  const storeDir = freshEvidenceStore();
  resetForgeBridge();
  initForgeBridge({ kiloMcpAdapter: new KiloMcpAdapter({ endpoint: mock.url }) });

  try {
    const runId = freshRunId("e1");
    const result = await runForgeBuild({
      subject: OWNER_SUBJECT,
      authz: authzFor(runId, true),
      payload: {
        prompt: "build the demo service",
        kind: "execute_kilocode_task",
        input: { repo_root: "/tmp/b3a-repo" },
      },
      run_id: runId,
      trace_id: runId,
    });

    assert.equal(result.execution_state, "completed");
    assert.equal(result.outcome?.status, "completed");
    assert.equal(result.outcome?.target, "kilo_mcp", "domain ForgeResult target is the real executed target");

    const forgeResult = result.outcome?.output as any;
    assert.ok(forgeResult, "full ForgeResult preserved as dispatch output (domain evidence)");
    assert.equal(forgeResult.status, "done");
    assert.equal(forgeResult.target, "kilo_mcp");
    assert.equal(forgeResult.artifacts?.length, 1, "domain artifacts preserved");
    assert.ok(typeof forgeResult.traceId === "string" && forgeResult.traceId.length > 0);
    assert.equal(forgeResult.output?.message, "real forge build produced by mock kilo_mcp");

    assert.equal(mock.hits(), 1, "exactly one real forge execution — no parallel legacy executor");

    const evidence = getEvidenceByTrace(runId).map((r) => r.type);
    assert.equal(evidence.filter((t) => t === "dispatch_started").length, 1);
    assert.equal(evidence.filter((t) => t === "execution_started").length, 1);
    assert.equal(evidence.filter((t) => t === "execution_finished").length, 1);

    const dispatchStarted = getEvidenceByTrace(runId).find((r) => r.type === "dispatch_started");
    assert.equal((dispatchStarted?.payload as any)?.route, "forge_bridge");
    assert.equal((dispatchStarted?.payload as any)?.target, "kilo_mcp");
    assert.equal((dispatchStarted?.payload as any)?.provider, null, "requires_provider: false → provider null");

    const finished = getEvidenceByTrace(runId).find((r) => r.type === "execution_finished");
    assert.equal(finished?.lifecycle_state, "completed");

    const all = readEvidenceRecords();
    const lifecycleIds = all
      .filter((r) => ["dispatch_started", "execution_started", "execution_finished"].includes(r.type))
      .map((r) => r.evidence_id);
    assert.equal(new Set(lifecycleIds).size, lifecycleIds.length, "no duplicate lifecycle records");

    assert.ok(storeDir.length > 0);
  } finally {
    resetForgeBridge();
    await mock.app.close();
  }
});

test("E2. ledger unique-once: same run_id resolves to same result, one execution", async () => {
  const mock = await startKiloMcpMock();
  freshEvidenceStore();
  resetForgeBridge();
  initForgeBridge({ kiloMcpAdapter: new KiloMcpAdapter({ endpoint: mock.url }) });

  try {
    const runId = freshRunId("e2");
    const runtime = createForgeRuntime();
    const dispatch = {
      run_id: runId,
      trace_id: runId,
      intent: classifyIntent({
        input_id: runId,
        user_id: OWNER_SUBJECT,
        surface: "api",
        type: "text",
        content: "build a demo service",
        attachments: [],
        metadata: {},
        received_at: new Date().toISOString(),
      }),
      capability_kind: "forge_bridge" as const,
      subject: OWNER_SUBJECT,
      authz: authzFor(runId, true),
      execution_payload: { prompt: "build a demo service", kind: "run_bridge_task" },
    };
    const plan = await runtime.planner.planDispatch(dispatch);
    const ctx = { subject: OWNER_SUBJECT, authz: authzFor(runId, true), payload: dispatch.execution_payload };

    const r1 = await runtime.coordinator.safeExecute(plan, ctx);
    const r2 = await runtime.coordinator.safeExecute(plan, ctx);

    assert.equal(r1.execution_state, "completed");
    assert.equal(r2.dispatch_id, r1.dispatch_id, "ledger dedupe returns the original result");
    assert.equal(mock.hits(), 1, "second safeExecute did NOT re-execute (unique-once)");

    const started = getEvidenceByTrace(runId).filter((r) => r.type === "execution_started");
    assert.equal(started.length, 1, "execution lifecycle written exactly once");
  } finally {
    resetForgeBridge();
    await mock.app.close();
  }
});

console.log("\nF. failed forge statuses map to honest dispatch failure");

test("F1. ForgeResult blocked → dispatch failed with domain reason", async () => {
  freshEvidenceStore();
  const runtime = createForgeRuntime({
    forge: {
      run: async () =>
        createForgeResult({
          taskId: "forge_f1",
          target: "kilo_mcp",
          status: "blocked",
          summary: "Blocked by policy",
          diagnostics: { code: "blocked", message: "task blocked by domain policy" },
        }),
    },
  });
  const runId = freshRunId("f1");
  const dispatch = {
    run_id: runId,
    trace_id: runId,
    intent: classifyIntent({
      input_id: runId,
      user_id: OWNER_SUBJECT,
      surface: "api",
      type: "text",
      content: "build a demo service",
      attachments: [],
      metadata: {},
      received_at: new Date().toISOString(),
    }),
    capability_kind: "forge_bridge" as const,
    subject: OWNER_SUBJECT,
    authz: authzFor(runId, true),
    execution_payload: { prompt: "build a demo service", kind: "run_bridge_task" },
  };
  const plan = await runtime.planner.planDispatch(dispatch);
  const result = await runtime.coordinator.safeExecute(plan, {
    subject: OWNER_SUBJECT,
    authz: authzFor(runId, true),
    payload: dispatch.execution_payload,
  });

  assert.equal(result.execution_state, "failed");
  assert.equal(result.outcome?.status, "failed");
  assert.ok((result.outcome?.error?.message ?? "").includes("blocked by domain policy"));

  const finished = getEvidenceByTrace(runId).find((r) => r.type === "execution_finished");
  assert.equal(finished?.lifecycle_state, "failed");
});

void runTests();