import type { ExecutionMode } from "../../runtime-economics-contracts/src/executionMode.js";

export interface TaskInput {
  task_id?: string;
  goal: string;
  constraints?: string[];
  task_kind?: string;
  requires_tools?: boolean;
  requires_review?: boolean;
  requires_approval?: boolean;
}

export function classifyTaskComplexity(input: TaskInput): "low" | "medium" | "high" {
  const goal = input.goal.toLowerCase();
  const constraints = input.constraints ?? [];
  let score = 0;

  if (goal.split(/\s+/).length > 30) score++;
  if (constraints.length > 2) score++;
  if (input.requires_tools) score++;
  if (input.task_kind?.includes("build") || input.task_kind?.includes("research")) score++;
  if (goal.includes("code") || goal.includes("api") || goal.includes("build")) score++;
  if (goal.includes("compare") || goal.includes("analyze") || goal.includes("multi") || goal.includes("research")) score++;
  if (input.task_kind?.includes("research")) score++;

  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}
