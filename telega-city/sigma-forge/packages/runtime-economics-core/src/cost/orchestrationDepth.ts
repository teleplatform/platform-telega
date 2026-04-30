import type { ExecutionMode } from "../../runtime-economics-contracts/src/executionMode.js";

export interface TaskSignals {
  complexity: "low" | "medium" | "high";
  needs_tools: boolean;
  needs_review: boolean;
  needs_approval: boolean;
  risk_level: "low" | "medium" | "high";
}

export function resolveExecutionMode(signals: TaskSignals): ExecutionMode {
  if (signals.needs_approval) return "human_approval_required";
  if (signals.needs_review || signals.risk_level === "high") return "multi_agent_reviewed";
  if (signals.complexity === "high" || signals.needs_tools) return "multi_agent";
  if (signals.needs_tools) return "tool_augmented";
  if (signals.complexity === "medium") return "single_worker";
  return "single_call";
}
