import type { TaskIntentEnvelope, SkillUnit, SkillFamily } from "../../../fsgr-contracts/src/index.js";
import type { ClassifiedTask } from "../intake/classifyTask.js";
import type { PlanMode } from "../../../fsgr-contracts/src/index.js";

export interface WorkUnit {
  work_unit_id: string;
  title: string;
  skill_id: string;
  family: SkillFamily;
  depends_on: string[];
  optional?: boolean;
  artifact_hint?: string;
}

const LANDING_DECOMPOSITION: WorkUnit[] = [
  { work_unit_id: "wu_1", title: "Plan sections and content blocks", skill_id: "content.doc.spec.write", family: "content", depends_on: [], artifact_hint: "section-plan" },
  { work_unit_id: "wu_2", title: "Compose layout sections", skill_id: "frontend.layout.section.compose", family: "frontend", depends_on: ["wu_1"], artifact_hint: "layout" },
  { work_unit_id: "wu_3", title: "Build React components", skill_id: "frontend.react.component.build", family: "frontend", depends_on: ["wu_2"], artifact_hint: "components" },
  { work_unit_id: "wu_4", title: "Validate and polish", skill_id: "ops.test.run", family: "ops", depends_on: ["wu_3"], optional: true, artifact_hint: "validation" },
];

const API_BUILD_DECOMPOSITION: WorkUnit[] = [
  { work_unit_id: "wu_1", title: "Build API routes", skill_id: "backend.api.route.build", family: "backend", depends_on: [], artifact_hint: "routes" },
  { work_unit_id: "wu_2", title: "Run validation tests", skill_id: "ops.test.run", family: "ops", depends_on: ["wu_1"], artifact_hint: "test-results" },
  { work_unit_id: "wu_3", title: "Write API documentation", skill_id: "content.doc.spec.write", family: "content", depends_on: ["wu_1"], optional: true, artifact_hint: "docs" },
];

const RESEARCH_DECOMPOSITION: WorkUnit[] = [
  { work_unit_id: "wu_1", title: "Scan and summarize sources", skill_id: "research.scan.summarize", family: "research", depends_on: [], artifact_hint: "summary" },
  { work_unit_id: "wu_2", title: "Compare and synthesize findings", skill_id: "research.compare.synthesize", family: "research", depends_on: ["wu_1"], artifact_hint: "synthesis" },
  { work_unit_id: "wu_3", title: "Package output artifact", skill_id: "content.doc.spec.write", family: "content", depends_on: ["wu_2"], artifact_hint: "artifact" },
];

export function decomposeTask(
  task: TaskIntentEnvelope,
  selectedSkills: SkillUnit[],
  classified: ClassifiedTask,
  planMode: PlanMode
): WorkUnit[] {
  const kind = task.task_kind.toLowerCase();

  if (kind === "landing_build") return structuredClone(LANDING_DECOMPOSITION);
  if (kind === "api_build") return structuredClone(API_BUILD_DECOMPOSITION);
  if (kind === "research_compare") return structuredClone(RESEARCH_DECOMPOSITION);

  if (classified.execution_hints.multi_family) {
    const primarySkill = selectedSkills[0];
    return [
      { work_unit_id: "wu_1", title: `Primary: ${task.goal.substring(0, 50)}`, skill_id: primarySkill?.skill_id ?? "unknown", family: primarySkill?.family ?? "content", depends_on: [], artifact_hint: "primary" },
      { work_unit_id: "wu_2", title: "Secondary family work", skill_id: selectedSkills[1]?.skill_id ?? "unknown", family: selectedSkills[1]?.family ?? "ops", depends_on: ["wu_1"], artifact_hint: "secondary" },
      { work_unit_id: "wu_3", title: "Validation", skill_id: "ops.test.run", family: "ops", depends_on: ["wu_2"], optional: true, artifact_hint: "validation" },
    ];
  }

  if (selectedSkills.length === 0) {
    return [{ work_unit_id: "wu_1", title: `Execute: ${task.goal.substring(0, 50)}`, skill_id: "unknown", family: "content", depends_on: [], artifact_hint: "output" }];
  }

  const primary = selectedSkills[0];
  return [
    { work_unit_id: "wu_1", title: `Execute: ${task.goal.substring(0, 50)}`, skill_id: primary.skill_id, family: primary.family, depends_on: [], artifact_hint: "output" },
  ];
}
