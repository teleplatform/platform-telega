// PD-W3/B4-B — Authenticated local chat Dispatch slice (runtime level).
// Run with: npx tsx tests/unit/dispatch-vnext/providerChat-runtime.test.ts
//
// Proof targets:
// 1. provider_chat capability + provider_http route are additive and do NOT
//    alter the semantics of the existing generic "model" capability binding.
// 2. Provider OS (ProviderRouterV2) selects local:llm; the decision is
//    preserved into the plan and never re-derived inside the executor.
// 3. LocalChatExecutor invokes the canonical localChat transport leaf and
//    preserves real provider/model/usage/output facts.
// 4. Deterministic offline execution; honest failure when transport errors.
// 5. Execution dedupe: one run_id → exactly one canonical evidence lifecycle.
// 6. No registry/availability mutation for the slice.

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chat } from "../../../src/providers/local/chat.js";
import {
  createProviderChatRuntime,
  createDemoReplyRuntime,
  PROVIDER_CHAT_BINDING,
  PROVIDER_CHAT_CAPABILITY,
} from "../../../src/runtime/dispatch-vnext/runtime.js";
import { LocalChatExecutor } from "../../../src/runtime/dispatch-vnext/local-chat-executor.js";
import {
  initExecutionEvidenceStore,
  getEvidenceByType,
  getEvidenceByTrace,
  readEvidenceRecords,
} from "../../../src/runtime/evidence/execution-evidence-store.js";

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
  const dir = path.join(os.tmpdir(), `b4b-runtime-${process.pid}-${counter}`);
  initExecutionEvidenceStore(dir);
  return dir;
}

const AUTHZ = {
  action: "agent.run",
  resource_kind: "session",
  resource_id: "run-test",
  is_owner: false,
  visibility_scope: "public",
} as const;

console.log("\nPD-W3/B4-B Local Provider Chat runtime:");

console.log("\nC. capability/binding are additive, generic model binding untouched");

test("C1. provider_chat binding maps to provider_http with no runtime target", () => {
  assert.equal(PROVIDER_CHAT_CAPABILITY.kind, "provider_chat");
  assert.equal(PROVIDER_CHAT_CAPABILITY.capability_id, "cap.provider_chat");
  assert.equal(PROVIDER_CHAT_BINDING.capability_kind, "provider_chat");
  assert.equal(PROVIDER_CHAT_BINDING.execution_route_kind, "provider_http");
  assert.equal(PROVIDER_CHAT_BINDING.runtime_target, undefined, "no RuntimeTarget for provider availability");
  assert.equal(PROVIDER_CHAT_BINDING.requires_provider, true);
});

test("C2. separate registries: provider_chat and model coexist without conflict", () => {
  const chatRuntime = createProviderChatRuntime();
  const demoRuntime = createDemoReplyRuntime();

  const chatBinding = chatRuntime.bindingRegistry.resolveByCapabilityKind("provider_chat");
  assert.equal(chatBinding?.execution_route_kind, "provider_http");

  const demoBinding = chatRuntime.bindingRegistry.resolveByCapabilityKind("model");
  assert.equal(demoBinding, undefined, "provider_chat runtime does not hijack the generic model binding");

  const demoBindingInDemo = demoRuntime.bindingRegistry.resolveByCapabilityKind("model");
  assert.equal(demoBindingInDemo?.execution_route_kind, "provider_bridge", "demo binding semantics unchanged");

  assert.equal(
    demoRuntime.bindingRegistry.resolveByCapabilityKind("provider_chat"),
    undefined,
    "demo runtime never registers provider_chat",
  );
});

test("C3. only the LocalChatExecutor is registered under provider_http", () => {
  const runtime = createProviderChatRuntime();
  const executor = runtime.routes.resolve("provider_http");
  assert.ok(executor instanceof LocalChatExecutor);
  assert.equal(executor.execution_route_kind, "provider_http");
  assert.equal(runtime.routes.resolve("provider_bridge"), undefined, "no cross-registration into demo route");
  assert.equal(runtime.routes.list().length, 1);
});

console.log("\nP. Provider OS decision is used and preserved");

test("P1. plan carries provider_http binding, null availability, local:llm decision", async () => {
  freshEvidenceStore();
  const runtime = createProviderChatRuntime();
  const dispatch = {
    run_id: "run-p1",
    trace_id: "trace-p1",
    intent: {
      intent: "text" as const,
      risk_level: "normal" as const,
    },
    capability_kind: "provider_chat" as const,
    subject: "api:key_1_abc",
    authz: AUTHZ,
    provider: {
      runtime_mode: "public" as const,
      task_kind: "reasoning" as const,
      context: { used_tokens: 0, max_tokens: 4096, has_files: false, has_images: false },
      constraints: { quality: "normal" as const, latency: "normal" as const, cost: "free" as const, privacy: "local_only" as const },
    },
  };
  const plan = await runtime.planner.planDispatch(dispatch);
  assert.equal(plan.binding.execution_route_kind, "provider_http");
  assert.equal(plan.binding.runtime_target, undefined);
  assert.equal(plan.availability, null, "provider availability remains Provider OS authority");
  assert.equal(plan.provider?.provider_id, "local:llm", "Provider OS selects the committed local:llm profile");
  assert.equal(plan.authorization.decision, "allow");
});

test("P2. ProviderRouterV2 decision evidence is written (provider_decision_created)", async () => {
  freshEvidenceStore();
  await createProviderChatRuntime().planner.planDispatch({
    run_id: "run-p2",
    trace_id: "trace-p2",
    intent: { intent: "text" as const, risk_level: "normal" as const },
    capability_kind: "provider_chat" as const,
    subject: "api:key_1_abc",
    authz: AUTHZ,
    provider: {
      runtime_mode: "public" as const,
      task_kind: "reasoning" as const,
      context: { used_tokens: 0, max_tokens: 4096, has_files: false, has_images: false },
      constraints: { quality: "normal" as const, latency: "normal" as const, cost: "free" as const, privacy: "local_only" as const },
    },
  });
  const decisions = getEvidenceByType("provider_decision_created");
  assert.equal(decisions.length, 1);
  assert.equal((decisions[0].payload as any).provider_id, "local:llm");
});

console.log("\nE. executor invokes the canonical transport leaf and maps facts");

test("E1. executor output equals direct localChat offline call (deterministic)", async () => {
  freshEvidenceStore();
  const runtime = createProviderChatRuntime();
  const plan = await runtime.planner.planDispatch({
    run_id: "run-e1",
    trace_id: "trace-e1",
    intent: { intent: "text" as const, risk_level: "normal" as const },
    capability_kind: "provider_chat" as const,
    subject: "api:key_1_abc",
    authz: AUTHZ,
    provider: {
      runtime_mode: "public" as const,
      task_kind: "reasoning" as const,
      context: { used_tokens: 0, max_tokens: 4096, has_files: false, has_images: false },
      constraints: { quality: "normal" as const, latency: "normal" as const, cost: "free" as const, privacy: "local_only" as const },
    },
  });
  const result = await runtime.coordinator.safeExecute(plan, {
    subject: "api:key_1_abc",
    authz: AUTHZ,
    payload: { message: "offline determinism", model: "local:local-chat" },
  });
  assert.equal(result.execution_state, "completed");
  assert.equal(result.outcome?.status, "completed");
  assert.equal(result.outcome?.provider_result_ref, "local:llm", "decision preserved into execution");

  const transport = result.outcome?.output as any;
  const direct = await chat({ message: "offline determinism", model: "local:local-chat" });
  assert.equal(transport.output, direct.output);
  assert.equal(transport.model, direct.model);
  assert.equal(transport.meta?.provider, "local");
});

test("E2. single canonical evidence lifecycle per run (dedupe)", async () => {
  freshEvidenceStore();
  const runtime = createProviderChatRuntime();
  const dispatch = {
    run_id: "run-e2",
    trace_id: "trace-e2",
    intent: { intent: "text" as const, risk_level: "normal" as const },
    capability_kind: "provider_chat" as const,
    subject: "api:key_1_abc",
    authz: AUTHZ,
    provider: {
      runtime_mode: "public" as const,
      task_kind: "reasoning" as const,
      context: { used_tokens: 0, max_tokens: 4096, has_files: false, has_images: false },
      constraints: { quality: "normal" as const, latency: "normal" as const, cost: "free" as const, privacy: "local_only" as const },
    },
  };
  const plan = await runtime.planner.planDispatch(dispatch);
  const ctx = { subject: "api:key_1_abc", authz: AUTHZ, payload: { message: "dedupe", model: "local:local-chat" } };
  const a = await runtime.coordinator.safeExecute(plan, ctx);
  const b = await runtime.coordinator.safeExecute(plan, ctx);
  assert.equal(a.dispatch_id, b.dispatch_id, "memoized result returned for same run_id");

  const trace = getEvidenceByTrace("trace-e2");
  const types = trace.map((r) => r.type);
  assert.ok(types.includes("provider_decision_created"));
  assert.ok(types.includes("dispatch_started"));
  assert.ok(types.includes("execution_started"));
  assert.ok(types.includes("execution_finished"));
  assert.equal(getEvidenceByType("dispatch_started").length, 1, "one lifecycle for one run_id");
});

test("E3. transport failure is an honest failed outcome, no synthesized completion", async () => {
  freshEvidenceStore();
  const beforeBase = process.env.LOCAL_OPENAI_BASE_URL;
  process.env.LOCAL_OPENAI_BASE_URL = "http://127.0.0.1:1"; // closed port → transport error
  const beforeKey = process.env.LOCAL_OPENAI_API_KEY;
  process.env.LOCAL_OPENAI_API_KEY = "";
  try {
    const runtime = createProviderChatRuntime();
    const plan = await runtime.planner.planDispatch({
      run_id: "run-e3",
      trace_id: "trace-e3",
      intent: { intent: "text" as const, risk_level: "normal" as const },
      capability_kind: "provider_chat" as const,
      subject: "api:key_1_abc",
      authz: AUTHZ,
      provider: {
        runtime_mode: "public" as const,
        task_kind: "reasoning" as const,
        context: { used_tokens: 0, max_tokens: 4096, has_files: false, has_images: false },
        constraints: { quality: "normal" as const, latency: "normal" as const, cost: "free" as const, privacy: "local_only" as const },
      },
    });
    const result = await runtime.coordinator.safeExecute(plan, {
      subject: "api:key_1_abc",
      authz: AUTHZ,
      payload: { message: "should fail honestly", model: "local:local-chat" },
    });
    assert.equal(result.execution_state, "failed");
    assert.ok(result.outcome?.error?.message, "failure carries the transport error");
    const finished = getEvidenceByType("execution_finished");
    assert.equal(finished.at(-1)?.lifecycle_state, "failed");
  } finally {
    if (beforeBase === undefined) delete process.env.LOCAL_OPENAI_BASE_URL;
    else process.env.LOCAL_OPENAI_BASE_URL = beforeBase;
    if (beforeKey === undefined) delete process.env.LOCAL_OPENAI_API_KEY;
    else process.env.LOCAL_OPENAI_API_KEY = beforeKey;
  }
});

void runTests();