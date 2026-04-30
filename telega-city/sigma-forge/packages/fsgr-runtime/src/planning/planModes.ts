import type { TaskIntentEnvelope, PlanMode } from "../../../fsgr-contracts/src/index.js";
import type { ClassifiedTask } from "../intake/classifyTask.js";

export function resolvePlanMode(task: TaskIntentEnvelope, classified?: ClassifiedTask): PlanMode {
  if (task.execution_mode) return task.execution_mode;
  if (classified?.execution_hints.multi_family) return "quality";
  if (task.actor_mode === "creator") return "quality";
  if (task.actor_mode === "internal" || task.actor_mode === "system") return "safe";
  return "safe";
}
