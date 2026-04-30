import assert from "node:assert/strict";
import { createSkillRegistry } from "../../../packages/fsgr-runtime/src/skills/registry.js";
import { CORE_SKILLS } from "../../../packages/fsgr-skills-core/src/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nSkill Registry:");

test("register and get skill by id", () => {
  const registry = createSkillRegistry();
  registry.registerSkill({
    skill_id: "test.skill", family: "frontend", name: "Test", description: "Test", version: "1.0.0",
    capability_tags: [], input_schema_ref: "", output_schema_ref: "", mode_support: ["public"],
    risk_class: "low", policy_scope: [], retry_policy: { max_attempts: 1, backoff_ms: 0, retryable_errors: [] },
    validator_hooks: [], timeout_ms: 1000,
  });
  const skill = registry.getSkillById("test.skill");
  assert.ok(skill);
  assert.equal(skill!.skill_id, "test.skill");
});

test("duplicate skill_id throws error", () => {
  const registry = createSkillRegistry();
  const skill = {
    skill_id: "dup.skill", family: "frontend" as const, name: "Dup", description: "Dup", version: "1.0.0",
    capability_tags: [], input_schema_ref: "", output_schema_ref: "", mode_support: ["public"] as const,
    risk_class: "low" as const, policy_scope: [], retry_policy: { max_attempts: 1, backoff_ms: 0, retryable_errors: [] },
    validator_hooks: [], timeout_ms: 1000,
  };
  registry.registerSkill(skill);
  assert.throws(() => registry.registerSkill(skill));
});

test("get skills by family", () => {
  const registry = createSkillRegistry();
  registry.registerSkills(CORE_SKILLS);
  const frontend = registry.getSkillsByFamily("frontend");
  assert.equal(frontend.length, 3);
});

test("list skill ids", () => {
  const registry = createSkillRegistry();
  registry.registerSkills(CORE_SKILLS);
  const ids = registry.listSkillIds();
  assert.equal(ids.length, 13);
});

test("core skills registration works", () => {
  const registry = createSkillRegistry();
  registry.registerSkills(CORE_SKILLS);
  assert.equal(registry.getAllSkills().length, 13);
  assert.ok(registry.getSkillById("frontend.react.component.build"));
  assert.ok(registry.getSkillById("ops.patch.validate"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
