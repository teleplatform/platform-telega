import assert from "node:assert/strict";
import { resolveFallbackSkill, applyFallbackToNode } from "../../../packages/fsgr-runtime/src/execution/fallback.js";
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

console.log("\nFallback:");

test("fallback resolved from node.fallback_skill_id", () => {
  const node = { node_id: "n1", skill_id: "test.skill", fallback_skill_id: "fallback.skill" };
  const fallback = resolveFallbackSkill(node as any, registry);
  assert.equal(fallback, "fallback.skill");
});

test("fallback resolved from skill definition", () => {
  const node = { node_id: "n2", skill_id: "frontend.ui.fix", fallback_skill_id: undefined };
  const fallback = resolveFallbackSkill(node as any, registry);
  assert.equal(fallback, "frontend.react.component.build");
});

test("no fallback returns null", () => {
  const node = { node_id: "n3", skill_id: "frontend.react.component.build", fallback_skill_id: undefined };
  const fallback = resolveFallbackSkill(node as any, registry);
  assert.equal(fallback, null);
});

test("applyFallbackToNode updates node", () => {
  const node = { node_id: "n4", skill_id: "original.skill", retry_count: 2, fallback_skill_id: "fallback.skill" };
  applyFallbackToNode(node as any, "fallback.skill");
  assert.equal(node.skill_id, "fallback.skill");
  assert.equal(node.retry_count, 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
