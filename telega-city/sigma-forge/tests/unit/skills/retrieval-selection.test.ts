import assert from "node:assert/strict";
import { createSkillRegistry } from "../../../packages/fsgr-runtime/src/skills/registry.js";
import { CORE_SKILLS } from "../../../packages/fsgr-skills-core/src/index.js";
import { retrieveCandidateSkills, filterSkillsByCapabilityTags, filterSkillsByMode } from "../../../packages/fsgr-runtime/src/skills/retrieval.js";
import { selectSkillsForTask } from "../../../packages/fsgr-runtime/src/skills/selection.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const registry = createSkillRegistry();
registry.registerSkills(CORE_SKILLS);

console.log("\nRetrieval + Selection:");

test("family-first retrieval for ui_fix", () => {
  const task = { task_id: "t1", actor_id: "a1", actor_mode: "public" as const, intent_key: "k1", task_kind: "ui_fix", goal: "Fix UI", constraints: [], execution_mode: "fast" as const };
  const candidates = retrieveCandidateSkills(task, registry);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((s) => s.family === "frontend" || s.family === "ops"));
});

test("mode filtering excludes creator-only skills for public", () => {
  const task = { task_id: "t2", actor_id: "a2", actor_mode: "public" as const, intent_key: "k2", task_kind: "component_build", goal: "Build", constraints: [], execution_mode: "fast" as const };
  const candidates = retrieveCandidateSkills(task, registry);
  assert.ok(candidates.every((s) => s.mode_support.includes("public")));
});

test("creator gets more skills than public", () => {
  const pubTask = { task_id: "t3", actor_id: "a3", actor_mode: "public" as const, intent_key: "k3", task_kind: "ui_fix", goal: "Fix", constraints: [], execution_mode: "fast" as const };
  const creatorTask = { task_id: "t4", actor_id: "a4", actor_mode: "creator" as const, intent_key: "k4", task_kind: "ui_fix", goal: "Fix", constraints: [], execution_mode: "fast" as const };
  const pubCandidates = retrieveCandidateSkills(pubTask, registry);
  const creatorCandidates = retrieveCandidateSkills(creatorTask, registry);
  assert.ok(creatorCandidates.length >= pubCandidates.length);
});

test("filterSkillsByCapabilityTags works", () => {
  const all = registry.getAllSkills();
  const filtered = filterSkillsByCapabilityTags(all, ["react"]);
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((s) => s.capability_tags.includes("react")));
});

test("filterSkillsByMode works", () => {
  const all = registry.getAllSkills();
  const internal = filterSkillsByMode(all, "internal");
  assert.ok(internal.length > 0);
  assert.ok(internal.every((s) => s.mode_support.includes("internal")));
});

test("selection returns selected and rejected", () => {
  const task = { task_id: "t5", actor_id: "a5", actor_mode: "public" as const, intent_key: "k5", task_kind: "ui_fix", goal: "Fix", constraints: [], execution_mode: "fast" as const };
  const candidates = retrieveCandidateSkills(task, registry);
  const result = selectSkillsForTask(task, candidates);
  assert.ok(Array.isArray(result.selected));
  assert.ok(Array.isArray(result.rejected));
});

test("deprecated skills are rejected", () => {
  const task = { task_id: "t6", actor_id: "a6", actor_mode: "public" as const, intent_key: "k6", task_kind: "ui_fix", goal: "Fix", constraints: [], execution_mode: "fast" as const };
  const depSkill = { ...CORE_SKILLS[0], deprecated: true };
  const result = selectSkillsForTask(task, [depSkill]);
  assert.equal(result.selected.length, 0);
  assert.ok(result.rejected.some((r) => r.reason_code === "DEPRECATED"));
});

test("mode denied skills are rejected", () => {
  const task = { task_id: "t7", actor_id: "a7", actor_mode: "public" as const, intent_key: "k7", task_kind: "ui_fix", goal: "Fix", constraints: [], execution_mode: "fast" as const };
  const internalOnly = { ...CORE_SKILLS.find((s) => s.mode_support.includes("internal") && !s.mode_support.includes("public"))! };
  const result = selectSkillsForTask(task, [internalOnly]);
  assert.ok(result.rejected.some((r) => r.reason_code === "MODE_DENIED"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
