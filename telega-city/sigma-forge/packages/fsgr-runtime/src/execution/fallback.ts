import type { ExecutionNode, SkillUnit } from "../../fsgr-contracts/src/index.js";

export function resolveFallbackSkill(node: ExecutionNode, skillRegistry: { getSkillById(skill_id: string): SkillUnit | undefined }): string | null {
  if (node.fallback_skill_id) return node.fallback_skill_id;
  const skill = skillRegistry.getSkillById(node.skill_id);
  if (skill?.fallback_skills && skill.fallback_skills.length > 0) {
    return skill.fallback_skills[0];
  }
  return null;
}

export function applyFallbackToNode(node: ExecutionNode, fallbackSkillId: string): void {
  node.skill_id = fallbackSkillId;
  node.retry_count = 0;
}
