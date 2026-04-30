export type AsyncTaskStatus =
  | "queued"
  | "planning"
  | "running"
  | "waiting_human"
  | "paused"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export interface AsyncTask {
  task_id: string;
  tele_user_id: string;
  workspace_id?: string;
  session_id?: string;
  run_id?: string;
  goal: string;
  task_class?: string;
  status: AsyncTaskStatus;
  execution_mode?: string;
  risk_level: "low" | "medium" | "high";
  budget_estimate?: number;
  delivery_targets: string[];
  created_at: string;
  updated_at: string;
}
