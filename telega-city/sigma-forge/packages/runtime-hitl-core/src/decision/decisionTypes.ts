import type { HumanDecisionAction } from "../../runtime-hitl-contracts/src/decision.js";

export const ALL_DECISION_ACTIONS: HumanDecisionAction[] = [
  "approve",
  "edit",
  "reject",
  "reroute",
  "escalate",
  "takeover",
];

export function isValidDecisionAction(action: string): action is HumanDecisionAction {
  return ALL_DECISION_ACTIONS.includes(action as HumanDecisionAction);
}
