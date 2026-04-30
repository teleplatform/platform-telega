import type { SkillFamily, ActorMode } from "../../../fsgr-contracts/src/index.js";

export type { SkillFamily, ActorMode } from "../../../fsgr-contracts/src/index.js";

export const ALL_SKILL_FAMILIES: SkillFamily[] = ["frontend", "backend", "content", "research", "ops"];

export const TASK_KIND_TO_FAMILIES: Record<string, SkillFamily[]> = {
  ui_fix: ["frontend", "ops"],
  component_build: ["frontend"],
  landing_build: ["frontend", "content"],
  api_build: ["backend", "ops"],
  auth_patch: ["backend"],
  db_patch: ["backend"],
  doc_write: ["content"],
  copy_generate: ["content"],
  research_scan: ["research"],
  research_compare: ["research", "content"],
  test_run: ["ops"],
  trace_explain: ["ops"],
  patch_validate: ["ops"],
};

export function getFamiliesForTaskKind(taskKind: string): SkillFamily[] {
  const normalized = taskKind.toLowerCase().trim();
  return TASK_KIND_TO_FAMILIES[normalized] ?? ["content", "ops"];
}

export function isFamilyAllowedForTaskKind(taskKind: string, family: SkillFamily): boolean {
  return getFamiliesForTaskKind(taskKind).includes(family);
}
