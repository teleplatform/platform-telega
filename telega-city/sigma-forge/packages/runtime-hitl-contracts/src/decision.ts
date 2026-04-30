export type HumanDecisionAction =
  | "approve"
  | "edit"
  | "reject"
  | "reroute"
  | "escalate"
  | "takeover";

export interface HumanDecision {
  decision_id: string;
  handoff_id: string;
  task_id: string;
  action: HumanDecisionAction;
  editor_notes?: string;
  replacement_output?: string;
  reroute_target?: string;
  created_at: string;
}
