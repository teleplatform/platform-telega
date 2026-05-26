export type TelecoreVisibility = "public" | "creator" | "core";
export type BuildStatus = "queued" | "running" | "done" | "partial" | "blocked" | "failed" | "cancelled" | "timed_out" | "self_healing" | "needs_creator" | "retrying";

export type CreatorDecisionStatus = "none" | "pending" | "approved" | "rejected" | "cancelled" | "expired";

export type CreatorDecisionOption = "approve_retry" | "cancel_task" | "mark_blocked" | "resume_with_note";

export type CreatorDecisionContext = {
  reason: string;
  decision_options: CreatorDecisionOption[];
  resume_token?: string;
};

export type BuildTask = {
  type: "build_task";
  version: "1.0";
  meta: {
    task_id: string;
    created_at: number;
    priority: "low" | "normal" | "high";
    mode: "smart" | "deep";
    persona: string;
    ecosystem: "telega";
    visibility: TelecoreVisibility;
  };
  goal: { title: string; description?: string };
} & Record<string, unknown>;

export type BuildResult = {
  type: "build_result";
  version: "1.0";
  summary: {
    status: "done" | "partial" | "blocked" | "failed";
    task_id: string;
    mode_used: "smart" | "deep";
    iterations_used: number;
  };
} & Record<string, unknown>;

export type BuildTaskPriority = "low" | "normal" | "high" | "critical";
export type BuildTaskMode = "smart" | "deep" | "research";
export type BuildTaskKind = "forge.build" | "forge.plan" | "forge.patch" | "forge.review" | "forge.test" | string;
export type BuildTaskTarget = "kilo" | "sigmaforge" | "auto";

export type BuildTaskStreamEventType =
  | "execution_started"
  | "execution_progress"
  | "artifact_generated"
  | "validation_progress"
  | "execution_warning"
  | "execution_completed";

export interface BuildTaskStreamEvent {
  stream_id: string;
  task_id: string;
  sequence: number;
  event_type: BuildTaskStreamEventType;
  timestamp: number;
  payload: Record<string, unknown>;
}

export function createBuildTask(args: {
  title: string;
  kind: BuildTaskKind;
  target: BuildTaskTarget;
}): BuildTask {
  const now = Date.now();
  return {
    type: "build_task",
    version: "1.0",
    meta: {
      task_id: `task_${now}`,
      created_at: now,
      priority: "normal",
      mode: "smart",
      persona: "tele-gpt",
      ecosystem: "telega",
      visibility: "creator",
    },
    goal: {
      title: args.title,
    },
    kind: args.kind,
    target: args.target,
  } as BuildTask;
}

export type TaskGroupStreamEventType =
  | "group_created"
  | "group_dispatch_started"
  | "child_task_started"
  | "child_task_completed"
  | "group_progress"
  | "group_partial"
  | "group_done"
  | "group_failed"
  | "group_needs_creator"
  | "group_cancelled"
  | "dependency_added"
  | "dependency_blocked"
  | "dependency_ready"
  | "dependency_completed"
  | "dependency_failed"
  | "dag_created"
  | "dag_status_changed";

export interface TaskGroupStreamEvent {
  stream_id: string;
  group_id: string;
  sequence: number;
  event_type: TaskGroupStreamEventType;
  timestamp: number;
  payload: Record<string, unknown>;
}
