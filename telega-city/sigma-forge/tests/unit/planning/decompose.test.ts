import assert from "node:assert/strict";
import { decomposeTask } from "../../../packages/fsgr-runtime/src/planning/decompose.js";
import { buildExecutionGraph, validateExecutionGraph, detectGraphCycle } from "../../../packages/fsgr-runtime/src/planning/dagBuilder.js";
import { createSkillRegistry } from "../../../packages/fsgr-runtime/src/skills/registry.js";
import { CORE_SKILLS } from "../../../packages/fsgr-skills-core/src/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const registry = createSkillRegistry();
registry.registerSkills(CORE_SKILLS);

console.log("\nDecomposition:");

test("single-family task → 1 work unit", () => {
  const task = { task_id: "t1", actor_id: "a1", actor_mode: "public", intent_key: "k1", task_kind: "ui_fix", goal: "Fix UI bug", constraints: [], execution_mode: "fast" };
  const classified = { task_kind: "ui_fix", primary_family_candidates: ["frontend", "ops"], inferred_tags: ["fix"], execution_hints: {} };
  const skills = registry.getAllSkills().filter((s) => s.family === "frontend");
  const units = decomposeTask(task, skills, classified as any, "fast");
  assert.ok(units.length >= 1);
  assert.ok(units.length <= 2);
});

test("landing_build decomposition shape", () => {
  const task = { task_id: "t2", actor_id: "a2", actor_mode: "creator", intent_key: "k2", task_kind: "landing_build", goal: "Build landing page", constraints: [], execution_mode: "quality" };
  const classified = { task_kind: "landing_build", primary_family_candidates: ["frontend", "content"], inferred_tags: ["build"], execution_hints: { multi_family: true } };
  const units = decomposeTask(task, registry.getAllSkills(), classified as any, "quality");
  assert.ok(units.length >= 3);
  assert.ok(units.length <= 5);
  assert.ok(units.some((u) => u.family === "content"));
  assert.ok(units.some((u) => u.family === "frontend"));
});

test("api_build decomposition shape", () => {
  const task = { task_id: "t3", actor_id: "a3", actor_mode: "creator", intent_key: "k3", task_kind: "api_build", goal: "Build API endpoint", constraints: [], execution_mode: "safe" };
  const classified = { task_kind: "api_build", primary_family_candidates: ["backend", "ops"], inferred_tags: ["build"], execution_hints: { multi_family: true } };
  const units = decomposeTask(task, registry.getAllSkills(), classified as any, "safe");
  assert.ok(units.length >= 2);
  assert.ok(units.some((u) => u.family === "backend"));
});

test("research_compare decomposition shape", () => {
  const task = { task_id: "t4", actor_id: "a4", actor_mode: "creator", intent_key: "k4", task_kind: "research_compare", goal: "Compare research findings", constraints: [], execution_mode: "quality" };
  const classified = { task_kind: "research_compare", primary_family_candidates: ["research", "content"], inferred_tags: ["research"], execution_hints: { multi_family: true } };
  const units = decomposeTask(task, registry.getAllSkills(), classified as any, "quality");
  assert.ok(units.length >= 2);
  assert.ok(units.some((u) => u.family === "research"));
});

test("deterministic output", () => {
  const task = { task_id: "t5", actor_id: "a5", actor_mode: "creator", intent_key: "k5", task_kind: "landing_build", goal: "Build landing", constraints: [], execution_mode: "quality" };
  const classified = { task_kind: "landing_build", primary_family_candidates: ["frontend", "content"], inferred_tags: ["build"], execution_hints: { multi_family: true } };
  const units1 = decomposeTask(task, registry.getAllSkills(), classified as any, "quality");
  const units2 = decomposeTask(task, registry.getAllSkills(), classified as any, "quality");
  assert.equal(units1.length, units2.length);
  assert.deepEqual(units1.map((u) => u.work_unit_id), units2.map((u) => u.work_unit_id));
});

console.log("\nDAG Builder:");

test("graph built from work units", () => {
  const task = { task_id: "t6", actor_id: "a6", actor_mode: "creator", intent_key: "k6", task_kind: "landing_build", goal: "Build landing", constraints: [], execution_mode: "quality" };
  const classified = { task_kind: "landing_build", primary_family_candidates: ["frontend", "content"], inferred_tags: ["build"], execution_hints: { multi_family: true } };
  const units = decomposeTask(task, registry.getAllSkills(), classified as any, "quality");
  const { graph, errors } = buildExecutionGraph("run_1", task, units, "quality");
  assert.equal(errors.length, 0);
  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.edges.length >= 0);
  assert.ok(graph.entry_nodes.length > 0);
  assert.ok(graph.terminal_nodes.length > 0);
});

test("entry nodes have ready status", () => {
  const task = { task_id: "t7", actor_id: "a7", actor_mode: "creator", intent_key: "k7", task_kind: "landing_build", goal: "Build landing", constraints: [], execution_mode: "quality" };
  const classified = { task_kind: "landing_build", primary_family_candidates: ["frontend", "content"], inferred_tags: ["build"], execution_hints: { multi_family: true } };
  const units = decomposeTask(task, registry.getAllSkills(), classified as any, "quality");
  const { graph, errors } = buildExecutionGraph("run_2", task, units, "quality");
  assert.equal(errors.length, 0);
  for (const entryId of graph.entry_nodes) {
    const node = graph.nodes.find((n) => n.node_id === entryId);
    assert.ok(node);
    assert.equal(node!.status, "ready");
  }
});

test("non-entry nodes have waiting_dependency status", () => {
  const task = { task_id: "t8", actor_id: "a8", actor_mode: "creator", intent_key: "k8", task_kind: "landing_build", goal: "Build landing", constraints: [], execution_mode: "quality" };
  const classified = { task_kind: "landing_build", primary_family_candidates: ["frontend", "content"], inferred_tags: ["build"], execution_hints: { multi_family: true } };
  const units = decomposeTask(task, registry.getAllSkills(), classified as any, "quality");
  const { graph, errors } = buildExecutionGraph("run_3", task, units, "quality");
  assert.equal(errors.length, 0);
  const entrySet = new Set(graph.entry_nodes);
  for (const node of graph.nodes) {
    if (!entrySet.has(node.node_id)) {
      assert.equal(node.status, "waiting_dependency");
    }
  }
});

test("cycle rejection", () => {
  const units = [
    { work_unit_id: "a", title: "A", skill_id: "s1", family: "frontend" as const, depends_on: ["b"] },
    { work_unit_id: "b", title: "B", skill_id: "s2", family: "frontend" as const, depends_on: ["a"] },
  ];
  const { graph, errors } = buildExecutionGraph("run_4", { task_id: "t", goal: "g" }, units, "safe");
  assert.ok(errors.length > 0);
  assert.ok(errors[0].includes("Cycle"));
});

test("missing dependency rejection", () => {
  const units = [
    { work_unit_id: "a", title: "A", skill_id: "s1", family: "frontend" as const, depends_on: ["missing"] },
  ];
  const { graph, errors } = buildExecutionGraph("run_5", { task_id: "t", goal: "g" }, units, "safe");
  assert.ok(errors.length > 0);
  assert.ok(errors[0].includes("Missing dependency"));
});

test("empty graph rejection", () => {
  const { graph, errors } = buildExecutionGraph("run_6", { task_id: "t", goal: "g" }, [], "safe");
  assert.ok(errors.length > 0);
});

test("validateExecutionGraph works", () => {
  const task = { task_id: "t9", actor_id: "a9", actor_mode: "creator", intent_key: "k9", task_kind: "ui_fix", goal: "Fix UI", constraints: [], execution_mode: "fast" };
  const classified = { task_kind: "ui_fix", primary_family_candidates: ["frontend", "ops"], inferred_tags: ["fix"], execution_hints: {} };
  const skills = registry.getAllSkills().filter((s) => s.family === "frontend");
  const units = decomposeTask(task, skills, classified as any, "fast");
  const { graph, errors } = buildExecutionGraph("run_7", task, units, "fast");
  assert.equal(errors.length, 0);
  const validationErrors = validateExecutionGraph(graph);
  assert.equal(validationErrors.length, 0);
});

test("detectGraphCycle returns true for cyclic graph", () => {
  const cyclicGraph = {
    graph_id: "g1", run_id: "r1", version: 1, plan_mode: "safe" as const,
    nodes: [
      { node_id: "a", skill_id: "s1", title: "A", status: "ready", input_refs: [], output_refs: [], dependency_ids: ["b"], validator_hooks: [], retry_count: 0, max_retries: 2, risk_class: "low" },
      { node_id: "b", skill_id: "s2", title: "B", status: "waiting_dependency", input_refs: [], output_refs: [], dependency_ids: ["a"], validator_hooks: [], retry_count: 0, max_retries: 2, risk_class: "low" },
    ],
    edges: [
      { from_node_id: "b", to_node_id: "a", kind: "dependency" as const },
      { from_node_id: "a", to_node_id: "b", kind: "dependency" as const },
    ],
    entry_nodes: [], terminal_nodes: [],
  };
  assert.equal(detectGraphCycle(cyclicGraph), true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
