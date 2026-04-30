import type { HandoffResolution } from "../../runtime-hitl-contracts/src/resolution.js";

export interface TaskLike {
  status: string;
  task_id: string;
}

export function resolveResumePath(task: TaskLike, resolution: HandoffResolution): { new_status: string; action: string } {
  return {
    new_status: resolution.next_task_status,
    action: resolution.next_action,
  };
}
