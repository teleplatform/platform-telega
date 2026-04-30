import type { ExecutionMode } from "../../runtime-economics-contracts/src/executionMode.js";

export function suggestCheaperMode(currentMode: ExecutionMode): ExecutionMode | undefined {
  const cheaperMap: Record<ExecutionMode, ExecutionMode | undefined> = {
    human_approval_required: "multi_agent_reviewed",
    multi_agent_reviewed: "multi_agent",
    multi_agent: "tool_augmented",
    tool_augmented: "single_worker",
    single_worker: "single_call",
    single_call: undefined,
  };
  return cheaperMap[currentMode];
}
