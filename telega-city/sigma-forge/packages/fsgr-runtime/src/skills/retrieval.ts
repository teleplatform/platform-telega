import type { TaskIntentEnvelope, SkillUnit, ActorMode, SkillFamily } from "../../../fsgr-contracts/src/index.js";
import { getFamiliesForTaskKind } from "./families.js";
import type { SkillRegistry } from "./registry.js";

export function retrieveCandidateSkills(task: TaskIntentEnvelope, registry: SkillRegistry): SkillUnit[] {
  const candidateFamilies = getFamiliesForTaskKind(task.task_kind);
  let candidates = registry.getAllSkills().filter((s) => candidateFamilies.includes(s.family));
  candidates = candidates.filter((s) => !s.deprecated);
  candidates = candidates.filter((s) => s.mode_support.includes(task.actor_mode));
  return candidates;
}

export function filterSkillsByCapabilityTags(skills: SkillUnit[], tags: string[]): SkillUnit[] {
  if (tags.length === 0) return skills;
  return skills.filter((s) => tags.some((t) => s.capability_tags.includes(t)));
}

export function filterSkillsByMode(skills: SkillUnit[], actorMode: ActorMode): SkillUnit[] {
  return skills.filter((s) => s.mode_support.includes(actorMode));
}
