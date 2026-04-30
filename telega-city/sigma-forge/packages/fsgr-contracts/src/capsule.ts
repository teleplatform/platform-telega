export interface ContextCapsule {
  capsule_id: string;
  run_id: string;
  goal: string;
  active_plan_mode: string;
  current_focus: string[];
  completed_milestones: string[];
  open_risks: string[];
  last_decisions: Array<{
    kind: string;
    summary: string;
    at: string;
  }>;
  evidence_summary: string[];
  next_actions: string[];
  updated_at: string;
}
