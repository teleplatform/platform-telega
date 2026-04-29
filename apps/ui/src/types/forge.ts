export interface WorkflowStageRecord {
  stage: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at?: number;
  completed_at?: number;
  result?: string;
  error?: string;
  gate_results?: Record<string, any>;
}

export interface ForgeWorkflow {
  workflow_id: string;
  user_id: string;
  account_label: string;
  title: string;
  task: string;
  current_stage: string;
  stages: Record<string, WorkflowStageRecord>;
  patch_plan_id?: string;
  apply_id?: string;
  can_continue: boolean;
  stop_at?: string;
  error?: string;
  created_at: number;
  updated_at: number;
}

export interface ForgeTask {
  task_id: string;
  user_id: string;
  account_label: string;
  task: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface ForgeTimeline {
  timeline_id: string;
  workflow_id: string;
  stage: string;
  event: string;
  actor: string;
  detail: string;
  timestamp: number;
}

export interface ForgeGraph {
  graph_id: string;
  workflow_id: string;
  tasks: Array<{
    task_id: string;
    parent_ids: string[];
    status: string;
  }>;
  created_at: number;
}

export interface ForgeCheckpoint {
  checkpoint_id: string;
  workflow_id: string;
  stage: string;
  state_snapshot: any;
  created_at: number;
}

export interface ForgeHealPlan {
  plan_id: string;
  workflow_id: string;
  failure_type: string;
  diagnosis: string;
  actions: Array<{
    action: string;
    target: string;
    diff?: string;
  }>;
  status: "created" | "pending" | "applied" | "failed";
  created_at: number;
}

export interface ForgeDashboard {
  stats: {
    totalWorkflows: number;
    activeWorkflows: number;
    stalledWorkflows: number;
    awaitingApproval: number;
    totalTasks: number;
    totalCheckpoints: number;
    pendingHeals: number;
  };
  recentWorkflows: ForgeWorkflow[];
}

export interface KiloPatchPlan {
  plan_id: string;
  user_id: string;
  account_label: string;
  task: string;
  files: string[];
  diffs: Record<string, string>;
  status: "pending" | "approved" | "applied" | "failed" | "rolled_back";
  risk_level?: "low" | "medium" | "high";
  blocked_files?: string[];
  created_at: number;
  applied_at?: number;
  error?: string;
}