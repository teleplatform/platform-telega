// PD-W2/A5 — Safe execution integration: planning → safe execution matrix.
// Run with: npx tsx tests/unit/dispatch-vnext/safe-execution.test.ts
//
// Every execution in this file goes through the canonical pipeline with the
// real committed authorities (CapabilityRegistry, DispatchPlanner, Provider OS
// over the real local:llm profile, DemoReplyExecutor → real localDemo provider)
// and a real evidence store.

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { CapabilityRegistry } from "../../../src/runtime/capability-vnext/capability-registry.js";
import { getTargetStatus } from "../../../src/runtime/availability/availability-registry.js";
import { DEFAULT_TARGETS } from "../../../src/runtime/availability/availability-defaults.js";
import {
  initExecutionEvidenceStore,
  getEvidenceByTrace,
} from "../../../src/runtime/evidence/execution-evidence-store.js";
import { localDemo } from "../../../src/providers/local/demo.js";
import { ProviderRegistry } from "../../../src/runtime/provider/provider-registry.js";
import { ProviderRouterV2 } from "../../../src/runtime/provider/provider-router-v2.js";
import type { ProviderDecision } from "../../../src/runtime/provider/provider-decision.js";
import type { ActionRouteKind } from "../../../src/runtime/routing/action-route.types.js";
import {
  createDemoReplyRuntime,
  DEMO_REPLY_CAPABILITY,
  DEMO_REPLY_BINDING,
  LOCAL_LLM_PROVIDER_PROFILE,
} from "../../../src/runtime/dispatch-vnext/runtime.js";
import { ExecutionBindingRegistry } from "../../../src/runtime/dispatch-vnext/dispatch-bindings.js";
import { DispatchPlanner } from "../../../src/runtime/dispatch-vnext/dispatch-planner.js";
import type { DispatchProviderSelector } from "../../../src/runtime/dispatch-vnext/dispatch-planner.js";
import { DispatchError } from "../../../src/runtime/dispatch-vnext/dispatch-errors.js";
import { DispatchExecutionCoordinator } from "../../../src/runtime/dispatch-vnext/dispatch-execution.js";
import { ExecutionRouteRegistry } from "../../../src/runtime/dispatch-vnext/dispatch-executor.js";
import type { DispatchExecutor } from "../../../src/runtime/dispatch-vnext/dispatch-executor.js";
import type {
  DispatchExecutionOutcome,
  DispatchExecutionContext,
} from "../../../src/runtime/dispatch-vnext/dispatch-execution.types.js";
import type {
  DispatchAuthzContext,
  DispatchPlan,
  DispatchProviderRequirements,
  DispatchRequest,
} from "../../../src/runtime/dispatch-vnext/dispatch.types.js";
import type { IntentResult } from "../../../src/runtime/intent/intent.types.js";

let passed = 0;
let failed = 0;
let counter = 0;

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

async function runTests() {
  initExecutionEvidenceStore(path.join(os.tmpdir(), "a5-safe-execution-evidence"));
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

function nextRun(): { run_id: string; trace_id: string } {
  counter++;
  return { run_id: `run-${counter}`, trace_id: `trace-${counter}` };
}

function fixedIntent(): IntentResult {
  return {
    intent: "answer",
    confidence: 0.9,
    goal: "fixture goal",
    risk_level: "low",
    requires_execution: true,
    recommended_route: "provider_bridge",
    evidence_required: false,
  };
}

function allowedAuthz(resourceId: string): DispatchAuthzContext {
  return {
    action: "agent.run",
    resource_kind: "session",
    resource_id: resourceId,
    is_owner: true,
    visibility_scope: "public",
  };
}

function deniedAuthz(): DispatchAuthzContext {
  return {
    action: "task.read",
    resource_kind: "task",
    resource_id: "task-1",
    is_owner: false,
    visibility_scope: "shared",
  };
}

function demoProvider(): DispatchProviderRequirements {
  return {
    runtime_mode: "public",
    task_kind: "reasoning",
    context: { used_tokens: 0, max_tokens: 4096, has_files: false, has_images: false },
    constraints: { quality: "normal", latency: "normal", cost: "free", privacy: "local_only" },
  };
}

function demoRequest(over: Partial<DispatchRequest> = {}): DispatchRequest {
  return {
    run_id: "run-x",
    trace_id: "trace-x",
    intent: fixedIntent(),
    capability_kind: "model",
    subject: "tg:123",
    authz: allowedAuthz("run-x"),
    provider: demoProvider(),
    ...over,
  };
}

async function planFor(
  runtime: ReturnType<typeof createDemoReplyRuntime>,
  over: Partial<DispatchRequest> = {},
): Promise<DispatchPlan> {
  const { run_id, trace_id } = nextRun();
  return runtime.planner.planDispatch(demoRequest({ run_id, trace_id, ...over }));
}

function ctx(plan: DispatchPlan, message: string, subject = "tg:123"): DispatchExecutionContext {
  return { subject, authz: allowedAuthz(plan.run_id), payload: { message } };
}

class CountingExecutor implements DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind = "provider_bridge";
  calls = 0;
  async execute<R>(plan: DispatchPlan, context: DispatchExecutionContext): Promise<DispatchExecutionOutcome<R>> {
    this.calls++;
    const reply = await localDemo({ message: (context.payload?.message as string) ?? "", model: "local-demo" });
    const now = new Date().toISOString();
    return {
      status: "completed",
      execution_id: plan.run_id,
      target: plan.binding.runtime_target,
      provider_result_ref: plan.provider?.provider_id,
      output_ref: plan.run_id,
      output: reply.output as unknown as R,
      started_at: now,
      completed_at: now,
    };
  }
}

class ThrowingExecutor implements DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind = "provider_bridge";
  async execute<R>(): Promise<DispatchExecutionOutcome<R>> {
    throw new Error("boom");
  }
}

class AmbiguousExecutor implements DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind = "provider_bridge";
  async execute<R>(plan: DispatchPlan): Promise<DispatchExecutionOutcome<R>> {
    const now = new Date().toISOString();
    return { status: "completed", execution_id: plan.run_id, started_at: now, completed_at: now };
  }
}

class GatedExecutor implements DispatchExecutor {
  readonly execution_route_kind: ActionRouteKind = "provider_bridge";
  entered = false;
  exited = false;
  constructor(private readonly gate: { promise: Promise<void> }) {}
  async execute<R>(plan: DispatchPlan, context: DispatchExecutionContext): Promise<DispatchExecutionOutcome<R>> {
    this.entered = true;
    await this.gate.promise;
    this.exited = true;
    const now = new Date().toISOString();
    return {
      status: "completed",
      execution_id: plan.run_id,
      output_ref: plan.run_id,
      output: (((context.payload?.message as string) ?? "") + "-real") as unknown as R,
      started_at: now,
      completed_at: now,
    };
  }
}

class NoneProviderSelector implements DispatchProviderSelector {
  async select(): Promise<ProviderDecision> {
    return {
      provider_id: "none",
      capability_id: "capability.provider_bridge.api",
      reason: "no suitable provider",
      score: 0,
      fallback_provider_ids: [],
      blocked_providers: [],
    };
  }
}

console.log("\nA/B. plan → execute safe happy path (real outcome, not fabricated)");

test("A. safe execution completes with the real demo reply", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const result = await runtime.coordinator.safeExecute<string>(plan, ctx(plan, "hello"));
  assert.equal(result.execution_state, "completed");
  assert.equal(result.outcome?.output, "Tele•GPT говорит: hello");
  assert.equal(result.outcome?.execution_id, plan.run_id);
  assert.equal(result.outcome?.provider_result_ref, "local:llm");
  assert.equal(plan.status, "planned");
  const records = getEvidenceByTrace(plan.trace_id);
  const types = records.map((r) => r.type);
  assert.ok(types.includes("provider_decision_created"), "real Provider OS decision evidence");
  assert.ok(types.includes("dispatch_started"));
  assert.ok(types.includes("execution_started"));
  assert.ok(types.includes("execution_finished"));
  assert.equal(records.find((r) => r.type === "execution_finished")?.lifecycle_state, "completed");
});

test("B. actual result equals the real localDemo provider output", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const result = await runtime.coordinator.safeExecute<string>(plan, ctx(plan, "ping"));
  const direct = await localDemo({ message: "ping", model: "local-demo" });
  assert.equal(result.outcome?.output, direct.output);
  assert.equal(result.outcome?.output, "Tele•GPT говорит: ping");
});

console.log("\nC. auth missing → no execution");

test("C. unverifiable identity at execution → denied, executor untouched", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const routes = new ExecutionRouteRegistry();
  const counter = new CountingExecutor();
  routes.register(counter);
  const coordinator = new DispatchExecutionCoordinator(routes);
  const result = await coordinator.safeExecute(plan, ctx(plan, "x", "not-a-valid-subject"));
  assert.equal(result.execution_state, "denied");
  assert.equal(result.reason_code, "AUTH_REQUIRED");
  assert.equal(counter.calls, 0);
  assert.equal(getEvidenceByTrace(plan.trace_id).filter((r) => r.type === "execution_started").length, 0);
});

test("C2. identity drift (different valid subject) → no execution", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const routes = new ExecutionRouteRegistry();
  const counter = new CountingExecutor();
  routes.register(counter);
  const coordinator = new DispatchExecutionCoordinator(routes);
  const result = await coordinator.safeExecute(plan, ctx(plan, "x", "tg:999"));
  assert.equal(result.execution_state, "denied");
  assert.equal(result.reason_code, "AUTH_REQUIRED");
  assert.equal(counter.calls, 0);
});

console.log("\nD. forbidden at execution recheck → no execution");

test("D. authz denied after planning → denied, executor untouched", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime, { authz: allowedAuthz("run-1") });
  const routes = new ExecutionRouteRegistry();
  const counter = new CountingExecutor();
  routes.register(counter);
  const coordinator = new DispatchExecutionCoordinator(routes);
  const result = await coordinator.safeExecute(plan, { subject: "tg:123", authz: deniedAuthz(), payload: { message: "x" } });
  assert.equal(result.execution_state, "denied");
  assert.equal(result.reason_code, "FORBIDDEN");
  assert.equal(counter.calls, 0);
  assert.equal(getEvidenceByTrace(plan.trace_id).filter((r) => r.type === "execution_started").length, 0);
});

console.log("\nE. approval required → no execution");

test("E. approval_required state stops before the executor", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const routes = new ExecutionRouteRegistry();
  const counter = new CountingExecutor();
  routes.register(counter);
  const coordinator = new DispatchExecutionCoordinator(routes, {
    authorizationRecheck: { recheck: () => "needs_approval" },
  });
  const result = await coordinator.safeExecute(plan, ctx(plan, "x"));
  assert.equal(result.execution_state, "approval_required");
  assert.equal(result.reason_code, "APPROVAL_REQUIRED");
  assert.equal(counter.calls, 0);
});

console.log("\nF. availability recheck → execution blocked");

test("F. target offline at execution → unavailable, executor untouched", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  assert.equal(plan.availability?.target, "kilo_mcp");
  const routes = new ExecutionRouteRegistry();
  const counter = new CountingExecutor();
  routes.register(counter);
  const coordinator = new DispatchExecutionCoordinator(routes, {
    availabilityRecheck: { check: () => "offline" },
  });
  const result = await coordinator.safeExecute(plan, ctx(plan, "x"));
  assert.equal(result.execution_state, "unavailable");
  assert.equal(result.reason_code, "TARGET_BLOCKED");
  assert.equal(counter.calls, 0);
});

test("F2. target degraded at execution → blocked per A4 deterministic policy", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const routes = new ExecutionRouteRegistry();
  const counter = new CountingExecutor();
  routes.register(counter);
  const coordinator = new DispatchExecutionCoordinator(routes, {
    availabilityRecheck: { check: () => "degraded" },
  });
  const result = await coordinator.safeExecute(plan, ctx(plan, "x"));
  assert.equal(result.execution_state, "unavailable");
  assert.equal(result.reason_code, "TARGET_BLOCKED");
  assert.equal(counter.calls, 0);
});

console.log("\nG. provider selection failure → no execution");

test("G. Provider OS returns none → plan rejected, no execution", async () => {
  const capabilities = new CapabilityRegistry();
  capabilities.register({ ...DEMO_REPLY_CAPABILITY });
  const bindings = new ExecutionBindingRegistry();
  bindings.register({ ...DEMO_REPLY_BINDING });
  const planner = new DispatchPlanner({
    capabilityRegistry: capabilities,
    bindingRegistry: bindings,
    providerSelector: new NoneProviderSelector(),
  });
  const routes = new ExecutionRouteRegistry();
  const counter = new CountingExecutor();
  routes.register(counter);
  const coordinator = new DispatchExecutionCoordinator(routes);
  const { run_id, trace_id } = nextRun();
  await assert.rejects(
    planner.planDispatch(demoRequest({ run_id, trace_id })),
    (e: unknown) => e instanceof DispatchError && e.code === "PROVIDER_SELECTION_FAILED",
  );
  assert.equal(counter.calls, 0);
});

console.log("\nH. executor failure semantics");

test("H. executor throws → failed result + failed evidence", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const routes = new ExecutionRouteRegistry();
  routes.register(new ThrowingExecutor());
  const coordinator = new DispatchExecutionCoordinator(routes);
  const result = await coordinator.safeExecute(plan, ctx(plan, "x"));
  assert.equal(result.execution_state, "failed");
  assert.equal(result.outcome?.error?.message, "boom");
  const fin = getEvidenceByTrace(plan.trace_id).find((r) => r.type === "execution_finished");
  assert.equal(fin?.lifecycle_state, "failed");
});

test("H2. completed-without-output is ambiguous → failed", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const routes = new ExecutionRouteRegistry();
  routes.register(new AmbiguousExecutor());
  const coordinator = new DispatchExecutionCoordinator(routes);
  const result = await coordinator.safeExecute(plan, ctx(plan, "x"));
  assert.equal(result.execution_state, "failed");
  assert.ok((result.outcome?.error?.message ?? "").includes("ambiguous outcome"));
});

console.log("\nI. duplicate execution protection");

test("I. a plan executes at most once; repeats return the authoritative result", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  const routes = new ExecutionRouteRegistry();
  const counter = new CountingExecutor();
  routes.register(counter);
  const coordinator = new DispatchExecutionCoordinator(routes);
  const first = await coordinator.safeExecute<string>(plan, ctx(plan, "dup"));
  const second = await coordinator.safeExecute<string>(plan, ctx(plan, "dup"));
  assert.deepEqual(second, first);
  assert.equal(counter.calls, 1);
});

console.log("\nJ/K. Dispatch never mutates authorities");

test("J. capability registry unchanged after plan + execution", async () => {
  const runtime = createDemoReplyRuntime();
  const before = JSON.stringify(runtime.capabilityRegistry.list());
  const plan = await planFor(runtime);
  await runtime.coordinator.safeExecute(plan, ctx(plan, "x"));
  assert.equal(JSON.stringify(runtime.capabilityRegistry.list()), before);
});

test("K. availability unchanged after plan + execution", async () => {
  const runtime = createDemoReplyRuntime();
  const before = JSON.stringify(DEFAULT_TARGETS);
  const plan = await planFor(runtime);
  await runtime.coordinator.safeExecute(plan, ctx(plan, "x"));
  assert.equal(JSON.stringify(DEFAULT_TARGETS), before);
  assert.equal(getTargetStatus("kilo_mcp"), "online");
});

console.log("\nL. Dispatch never scores providers — Provider OS decision verbatim");

test("L. plan provider mirrors the real Provider OS decision exactly", async () => {
  const runtime = createDemoReplyRuntime();
  const request = demoRequest();
  const plan = await runtime.planner.planDispatch(request);

  const providerRegistry = new ProviderRegistry();
  providerRegistry.register({ ...LOCAL_LLM_PROVIDER_PROFILE });
  const router = new ProviderRouterV2(providerRegistry);
  const decision = await router.select({
    run_id: request.run_id,
    trace_id: request.trace_id,
    runtime_mode: request.provider!.runtime_mode,
    task_kind: request.provider!.task_kind,
    intent: request.intent.intent,
    risk_level: request.intent.risk_level,
    context: request.provider!.context,
    constraints: request.provider!.constraints,
  });

  assert.equal(plan.provider!.provider_id, decision.provider_id);
  assert.equal(plan.provider!.score, decision.score);
  assert.deepEqual(plan.provider!.fallback_provider_ids, decision.fallback_provider_ids);
  assert.equal(plan.provider!.provider_id, "local:llm");

  const result = await runtime.coordinator.safeExecute(plan, ctx(plan, "x"));
  assert.equal(result.outcome?.provider_result_ref, "local:llm");
});

console.log("\nM. no optimistic success");

test("M. no completion is observable before the executor returns a real outcome", async () => {
  const runtime = createDemoReplyRuntime();
  const plan = await planFor(runtime);
  assert.equal(plan.status, "planned");
  assert.equal(Object.prototype.hasOwnProperty.call(plan, "output"), false);

  let gateResolve!: () => void;
  const gate = new Promise<void>((resolve) => {
    gateResolve = resolve;
  });
  const routes = new ExecutionRouteRegistry();
  const gated = new GatedExecutor({ promise: gate });
  routes.register(gated);
  const coordinator = new DispatchExecutionCoordinator(routes);

  let pendingResult: unknown = null;
  const pending = coordinator.safeExecute<string>(plan, ctx(plan, "x")).then((r) => {
    pendingResult = r;
    return r;
  });

  while (!gated.entered) {
    await Promise.resolve();
  }

  assert.equal(gated.exited, false, "executor must not have returned yet");
  assert.ok(
    getEvidenceByTrace(plan.trace_id).filter((r) => r.type === "execution_finished").length === 0,
    "no success evidence before real outcome",
  );
  assert.equal(pendingResult, null, "no result surfaced before executor returned");

  gateResolve();
  const result = (await pending) as { execution_state: string; outcome?: { output?: string } };
  assert.equal(result.execution_state, "completed");
  assert.equal(result.outcome?.output, "x-real");
  assert.equal(gated.exited, true);
  assert.equal(getEvidenceByTrace(plan.trace_id).find((r) => r.type === "execution_finished")?.lifecycle_state, "completed");
});

void runTests();