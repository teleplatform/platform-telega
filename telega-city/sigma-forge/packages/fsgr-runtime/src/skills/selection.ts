import type { TaskIntentEnvelope, SkillUnit } from "../../../fsgr-contracts/src/index.js";

export interface SkillSelectionResult {
  selected: SkillUnit[];
  rejected: Array<{
    skill_id: string;
    reason_code: string;
  }>;
}

export function selectSkillsForTask(
  task: TaskIntentEnvelope,
  candidates: SkillUnit[]
): SkillSelectionResult {
  const selected: SkillUnit[] = [];
  const rejected: Array<{ skill_id: string; reason_code: string }> = [];

  for (const skill of candidates) {
    if (skill.deprecated) {
      rejected.push({ skill_id: skill.skill_id, reason_code: "DEPRECATED" });
      continue;
    }
    if (!skill.mode_support.includes(task.actor_mode)) {
      rejected.push({ skill_id: skill.skill_id, reason_code: "MODE_DENIED" });
      continue;
    }
    if (task.privacy_preference === "require_local" && !skill.runtime_requirements.local_only) {
      rejected.push({ skill_id: skill.skill_id, reason_code: "POLICY_SCOPE_MISMATCH" });
      continue;
    }
    selected.push(skill);
  }

  selected.sort((a, b) => {
    if (a.risk_class === "low" && b.risk_class !== "low") return -1;
    if (a.risk_class !== "low" && b.risk_class === "low") return 1;
    return a.capability_tags.length - b.capability_tags.length;
  });

  return { selected: selected.slice(0, 8), rejected };
}
