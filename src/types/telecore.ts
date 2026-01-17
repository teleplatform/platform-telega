export type TelecoreVisibility = "public" | "creator" | "core";
export type BuildStatus = "queued" | "running" | "done" | "partial" | "blocked";

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
    status: "done" | "partial" | "blocked";
    task_id: string;
    mode_used: "smart" | "deep";
    iterations_used: number;
  };
} & Record<string, unknown>;
