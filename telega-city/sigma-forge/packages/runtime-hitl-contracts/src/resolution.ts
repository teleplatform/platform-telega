export interface HandoffResolution {
  resolution_id: string;
  handoff_id: string;
  task_id: string;
  next_task_status: "running" | "paused" | "blocked" | "cancelled" | "completed" | "planning" | "waiting_human";
  next_action: "resume" | "cancel" | "reroute" | "manual_takeover" | "stay_waiting";
  notes: string[];
  created_at: string;
}
