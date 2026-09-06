// PD-W2/A4 — Dispatch vNext: canonical orchestration planner.
// Run with: npx tsx tests/unit/dispatch-vnext/dispatch-planner.test.ts
//
// Dispatch composes authorities (capability, authz, availability, provider)
// but owns none of their truth. Planning only — no execution.

import assert from "node:assert/strict";
import { CapabilityRegistry } from "../../../src/runtime/capability-vnext/capability-registry.js";
import { DEFAULT_TARGETS } from "../../../src/runtime/availability/availability-defaults.js";
import { ExecutionBindingRegistry } from "../../../src/runtime/dispatch-vnext/dispatch-bindings.js";
import {
  DispatchPlanner,
  type DispatchProviderSelector,
} from "../../../src/runtime/dispatch-vnext/dispatch-planner.js";
import { DispatchError } from "../../../src/runtime/dispatch-vnext/dispatch-errors.js";
import type { DispatchRequest } from "../../../src/runtime/dispatch-vnext/dispatch.types.js";
import type { ProviderDecision } from "../../../src/runtime/provider/provider-decision.js";

let passed = 0;
let failed = 0;

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

function capabilityFixture(id: string) {
  return {
    capability_id: id,
    kind: "model" as const,
    trust_level: "core" as const,
    title: "fixture",
    description: "test fixture",
    permissions: {
      filesystem: "none" as const,
      network: "none" as const,
      browser: "none" as const,
      terminal: "none" as const,
      secrets: "none" as const,
    },
  };
}

function baseRequest(partial: Partial<DispatchRequest> = {}): DispatchRequest {
  return {
    run_id: "run-1",
    trace_id: "trace-1",
    intent: {
      intent: "answer",
      confidence: 0.9,
      goal: "fixture goal",
      risk_level: "low",
      requires_execution: true,
      recommended_route: "direct_answer",
      evidence_required: false,
    },
    capability_kind: "model",
    subject: "tg:123",
    authz: {
      action: "agent.run",
      resource_kind: "session",
      resource_id: "session-1",
      is_owner: true,
      visibility_scope: "public",
    },
    ...partial,
  };
}

function providerRequirements() {
  return {
    runtime_mode: "public" as const,
    task_kind: "reasoning" as const,
    context: { used_tokens: 10, max_tokens: 4096, has_files: false, has_images: false },
    constraints: {
      quality: "normal" as const,
      latency: "normal" as const,
      cost: "any" as const,
      privacy: "normal" as const,
    },
  };
}

class FakeProviderSelector implements DispatchProviderSelector {
  calls: Array<Pick<ProviderDecision, "provider_id" | "reason">> = [];
  async select(): Promise<ProviderDecision> {
    this.calls.push({ provider_id: "local:llm", reason: "fake" });
    return {
      provider_id: "local:llm",
      capability_id: "capability.provider_bridge.api",
      reason: "fake decision",
      score: 42,
      fallback_provider_ids: ["qwen:web"],
      blocked_providers: [],
    };
  }
}

function wiredPlanner(overrides: { selector?: FakeProviderSelector } = {}) {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.model.core"));
  const bindings = new ExecutionBindingRegistry();
  bindings.register({
    capability_kind: "model",
    execution_route_kind: "direct_answer",
    runtime_target: "kilo_mcp",
    requires_provider: false,
  });
  const selector = overrides.selector ?? new FakeProviderSelector();
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: bindings, providerSelector: selector });
  return { registry, bindings, selector, planner };
}

console.log("\nDispatch planner authority composition:");

console.log("\nA. capability missing → fail closed");

test("missing capability kind → CAPABILITY_NOT_FOUND", async () => {
  const { registry, bindings, planner } = wiredPlanner();
  registry.register(capabilityFixture("cap.voice.a")); // keep registry non-empty
  registry.register(capabilityFixture("cap.voice.b")); // different kinds below
  bindings.register({ capability_kind: "voice_runtime", execution_route_kind: "voice_runtime", requires_provider: false });
  await assert.rejects(
    planner.planDispatch(baseRequest({ capability_kind: "deployment" })),
    (e: unknown) => e instanceof DispatchError && e.code === "CAPABILITY_NOT_FOUND",
  );
});

console.log("\nB. capability ambiguous → fail closed");

test("multiple capabilities for kind → CAPABILITY_AMBIGUOUS", async () => {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.a"));
  registry.register(capabilityFixture("cap.b"));
  const bindings = new ExecutionBindingRegistry();
  bindings.register({ capability_kind: "model", execution_route_kind: "direct_answer", requires_provider: false });
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: bindings });
  await assert.rejects(
    planner.planDispatch(baseRequest()),
    (e: unknown) => e instanceof DispatchError && e.code === "CAPABILITY_AMBIGUOUS",
  );
});

console.log("\nC. authorization");

test("unresolvable subject → AUTH_REQUIRED", async () => {
  const { planner } = wiredPlanner();
  await assert.rejects(
    planner.planDispatch(baseRequest({ subject: "not-a-valid-subject" })),
    (e: unknown) => e instanceof DispatchError && e.code === "AUTH_REQUIRED",
  );
});

test("authz deny → FORBIDDEN (no plan)", async () => {
  const { planner } = wiredPlanner();
  await assert.rejects(
    planner.planDispatch(
      baseRequest({
        authz: {
          action: "task.read",
          resource_kind: "task",
          resource_id: "task-1",
          is_owner: false,
          visibility_scope: "shared",
        },
      }),
    ),
    (e: unknown) => e instanceof DispatchError && e.code === "FORBIDDEN" && e.diagnostics?.reason_code === "NOT_OWNER",
  );
});

test("invalid request → DISPATCH_INVALID_REQUEST", async () => {
  const { planner } = wiredPlanner();
  await assert.rejects(
    planner.planDispatch(baseRequest({ run_id: "" })),
    (e: unknown) => e instanceof DispatchError && e.code === "DISPATCH_INVALID_REQUEST",
  );
});

test("no execution binding → NO_EXECUTION_BINDING", async () => {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.model.core"));
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: new ExecutionBindingRegistry() });
  await assert.rejects(
    planner.planDispatch(baseRequest()),
    (e: unknown) => e instanceof DispatchError && e.code === "NO_EXECUTION_BINDING",
  );
});

console.log("\nD. offline target");

test("unknown/offline target → TARGET_OFFLINE", async () => {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.model.core"));
  const bindings = new ExecutionBindingRegistry();
  bindings.register({ capability_kind: "model", execution_route_kind: "direct_answer", runtime_target: "local", requires_provider: false });
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: bindings });
  await assert.rejects(
    planner.planDispatch(baseRequest()),
    (e: unknown) => e instanceof DispatchError && e.code === "TARGET_OFFLINE",
  );
});

console.log("\nE. degraded target");

test("degraded target → TARGET_DEGRADED (explicit deterministic)", async () => {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.model.core"));
  const bindings = new ExecutionBindingRegistry();
  bindings.register({ capability_kind: "model", execution_route_kind: "direct_answer", runtime_target: "forge_http", requires_provider: false });
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: bindings });
  await assert.rejects(
    planner.planDispatch(baseRequest()),
    (e: unknown) => e instanceof DispatchError && e.code === "TARGET_DEGRADED",
  );
});

console.log("\nF. online target → plan created");

test("online target produces a plan (no provider)", async () => {
  const { planner } = wiredPlanner();
  const plan = await planner.planDispatch(baseRequest());
  assert.equal(plan.status, "planned");
  assert.equal(plan.binding.execution_route_kind, "direct_answer");
  assert.deepEqual(plan.availability, { target: "kilo_mcp", status: "online" });
  assert.equal(plan.provider, null);
});

console.log("\nG. provider-backed route delegates to Provider OS");

test("provider route consumes Provider OS decision", async () => {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.model.core"));
  const bindings = new ExecutionBindingRegistry();
  bindings.register({ capability_kind: "model", execution_route_kind: "provider_bridge", requires_provider: true });
  const selector = new FakeProviderSelector();
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: bindings, providerSelector: selector });
  const plan = await planner.planDispatch(baseRequest({ provider: providerRequirements() }));
  assert.deepEqual(plan.provider, { provider_id: "local:llm", score: 42, fallback_provider_ids: ["qwen:web"] });
  assert.equal(selector.calls.length, 1);
  assert.equal(plan.availability, null);
});

test("provider route without requirements → PROVIDER_SELECTION_FAILED", async () => {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.model.core"));
  const bindings = new ExecutionBindingRegistry();
  bindings.register({ capability_kind: "model", execution_route_kind: "provider_bridge", requires_provider: true });
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: bindings, providerSelector: new FakeProviderSelector() });
  await assert.rejects(
    planner.planDispatch(baseRequest()),
    (e: unknown) => e instanceof DispatchError && e.code === "PROVIDER_SELECTION_FAILED",
  );
});

test("provider route without selector wired → PROVIDER_SELECTION_FAILED", async () => {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.model.core"));
  const bindings = new ExecutionBindingRegistry();
  bindings.register({ capability_kind: "model", execution_route_kind: "provider_bridge", requires_provider: true });
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: bindings });
  await assert.rejects(
    planner.planDispatch(baseRequest({ provider: providerRequirements() })),
    (e: unknown) => e instanceof DispatchError && e.code === "PROVIDER_SELECTION_FAILED",
  );
});

console.log("\nH/I. no mutation of authorities");

test("Dispatch does not mutate CapabilityRegistry", async () => {
  const { registry, planner } = wiredPlanner();
  const before = JSON.stringify(registry.list());
  await planner.planDispatch(baseRequest());
  assert.equal(JSON.stringify(registry.list()), before);
});

test("Dispatch does not mutate Availability", async () => {
  const before = JSON.stringify(DEFAULT_TARGETS);
  const { planner } = wiredPlanner();
  await planner.planDispatch(baseRequest());
  assert.equal(JSON.stringify(DEFAULT_TARGETS), before);
});

console.log("\nJ. Dispatch does not score providers itself");

test("provider plan passes Provider OS decision through verbatim", async () => {
  const registry = new CapabilityRegistry();
  registry.register(capabilityFixture("cap.model.core"));
  const bindings = new ExecutionBindingRegistry();
  bindings.register({ capability_kind: "model", execution_route_kind: "provider_bridge", requires_provider: true });
  const selector = new FakeProviderSelector();
  const planner = new DispatchPlanner({ capabilityRegistry: registry, bindingRegistry: bindings, providerSelector: selector });
  const plan = await planner.planDispatch(baseRequest({ provider: providerRequirements() }));
  assert.equal(plan.provider!.provider_id, "local:llm");
  assert.equal(plan.provider!.score, 42);
  assert.deepEqual(plan.provider!.fallback_provider_ids, ["qwen:web"]);
  assert.equal(selector.calls.length, 1);
  assert.equal(plan.provider!.fallback_provider_ids.join(), "qwen:web");
});

console.log("\nK. deterministic plan");

test("same inputs produce identical plans", async () => {
  const { planner } = wiredPlanner();
  const request = baseRequest();
  const first = await planner.planDispatch(request);
  const second = await planner.planDispatch(request);
  assert.deepEqual(second, first);
});

console.log("\nL. no execution success claim");

test("a plan never claims execution", async () => {
  const { planner } = wiredPlanner();
  const plan = await planner.planDispatch(baseRequest());
  assert.equal(plan.status, "planned");
  assert.deepEqual(Object.keys(plan), [
    "run_id",
    "trace_id",
    "status",
    "capability",
    "authorization",
    "binding",
    "availability",
    "provider",
    "evidence_refs",
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(plan, "output"), false);
});

void runTests();
