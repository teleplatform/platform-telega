import type { TaskIntentEnvelope, SkillFamily } from "../../../fsgr-contracts/src/index.js";
import { getFamiliesForTaskKind } from "../skills/families.js";

export interface ClassifiedTask {
  task_kind: string;
  primary_family_candidates: SkillFamily[];
  inferred_tags: string[];
  execution_hints: {
    needs_content?: boolean;
    needs_ops?: boolean;
    multi_family?: boolean;
  };
}

export function classifyTaskIntent(envelope: TaskIntentEnvelope): ClassifiedTask {
  const families = getFamiliesForTaskKind(envelope.task_kind);
  const goal = envelope.goal.toLowerCase();
  const tags: string[] = [];

  if (goal.includes("build") || goal.includes("create")) tags.push("build");
  if (goal.includes("fix") || goal.includes("patch")) tags.push("fix");
  if (goal.includes("test") || goal.includes("validate")) tags.push("validate");
  if (goal.includes("doc") || goal.includes("write")) tags.push("doc");
  if (goal.includes("research") || goal.includes("analyze")) tags.push("research");

  const needsContent = families.includes("content");
  const needsOps = families.includes("ops");
  const multiFamily = families.length > 1;

  return {
    task_kind: envelope.task_kind,
    primary_family_candidates: families,
    inferred_tags: tags,
    execution_hints: { needs_content: needsContent, needs_ops: needsOps, multi_family: multiFamily },
  };
}
