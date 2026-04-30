import type { SkillUnit, SkillFamily } from "../../../fsgr-contracts/src/index.js";

export function createSkillRegistry() {
  const registry = new Map<string, SkillUnit>();

  return {
    registerSkill(skill: SkillUnit): void {
      if (registry.has(skill.skill_id)) {
        throw new Error(`Duplicate skill_id: ${skill.skill_id}`);
      }
      registry.set(skill.skill_id, skill);
    },
    registerSkills(skills: SkillUnit[]): void {
      for (const skill of skills) {
        this.registerSkill(skill);
      }
    },
    getSkillById(skillId: string): SkillUnit | undefined {
      return registry.get(skillId);
    },
    getAllSkills(): SkillUnit[] {
      return Array.from(registry.values());
    },
    getSkillsByFamily(family: SkillFamily): SkillUnit[] {
      return this.getAllSkills().filter((s) => s.family === family);
    },
    listSkillIds(): string[] {
      return Array.from(registry.keys());
    },
  };
}

export type SkillRegistry = ReturnType<typeof createSkillRegistry>;
