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

export function createBuildTask(input: {
  title: string;
  kind?: string;
  target?: string;
  description?: string;
}): BuildTask {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    type: "build_task",
    version: "1.0",
    task_id: taskId,
    meta: {
      task_id: taskId,
      created_at: Date.now(),
      priority: "normal",
      mode: "smart",
      persona: "runtime",
      ecosystem: "telega",
      visibility: "core",
    },
    goal: {
      title: input.title,
      description: input.description || input.kind,
    },
    execution: input.target ? { target: input.target } : undefined,
  };
}

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
