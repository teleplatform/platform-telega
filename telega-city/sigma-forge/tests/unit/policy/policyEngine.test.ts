import assert from "node:assert/strict";
import { createPolicyRegistry, resolvePolicy, runPolicyEngine } from "../../../packages/runtime-safety-core/src/policy/policyEngine.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const registry = createPolicyRegistry();
registry.registerPolicy({
  agent_id: "agent_1",
  allowed_tools: ["fs.read", "net.fetch"],
  denied_tools: ["terminal.exec"],
  allowed_memory_scopes: ["run:agent_1"],
  write_requires_approval: true,
  external_send_requires_sanitization: true,
  max_parallel_jobs: 3,
});

console.log("\nPolicy Engine:");

test("allowed tool passes policy check", () => {
  const decision = resolvePolicy(registry.getPolicy("agent_1")!, { agent_id: "agent_1", tool_id: "fs.read" });
  assert.equal(decision.allowed, true);
});

test("denied tool fails policy check", () => {
  const decision = resolvePolicy(registry.getPolicy("agent_1")!, { agent_id: "agent_1", tool_id: "terminal.exec" });
  assert.equal(decision.allowed, false);
});

test("tool not in allowlist fails", () => {
  const decision = resolvePolicy(registry.getPolicy("agent_1")!, { agent_id: "agent_1", tool_id: "unknown.tool" });
  assert.equal(decision.allowed, false);
});

test("write requires approval", () => {
  const decision = resolvePolicy(registry.getPolicy("agent_1")!, { agent_id: "agent_1", action_type: "write" });
  assert.equal(decision.approval_required, true);
});

test("no policy returns denied", () => {
  const decision = runPolicyEngine({ agent_id: "unknown_agent" }, { registry });
  assert.equal(decision.allowed, false);
});

test("registry getPolicy returns undefined for unknown", () => {
  assert.equal(registry.getPolicy("unknown"), undefined);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
