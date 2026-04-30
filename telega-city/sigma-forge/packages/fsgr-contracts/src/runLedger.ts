import type { PlanMode, RunStatus } from "./skillUnit.js";

export interface RunLedger {
  run_id: string;
  task_id: string;
  actor_id: string;
  actor_mode: string;
  status: RunStatus;
  graph_id: string;
  plan_mode: PlanMode;
  selected_skill_ids: string[];
  current_node_ids: string[];
  completed_node_ids: string[];
  failed_node_ids: string[];
  artifact_ids: string[];
  last_error?: {
    code: string;
    message: string;
    node_id?: string;
  };
  trace_id?: string;
  resume_token?: string;
  created_at: string;
  updated_at: string;
}
