import type { HandoffResolution } from "../../runtime-hitl-contracts/src/resolution.js";

export interface TaskLike {
  status: string;
  task_id: string;
}

export function resumeTaskFromDecision(task: TaskLike, resolution: HandoffResolution, transitionFn: (task: TaskLike, status: string) => boolean): { resumed: boolean; new_status: string } {
  const resumed = transitionFn(task, resolution.next_task_status);
  return { resumed, new_status: task.status };
}
