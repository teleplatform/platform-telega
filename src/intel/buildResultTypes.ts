// @ts-nocheck
export type BuildResultStatus = "done" | "failed";

export type TelecoreBuildResultV1 = {
  kind: "TELECORE_BUILD_RESULT_V1";
  id: string;
  task_id: string;
  trace_id?: string;
  created_at: string;
  status: BuildResultStatus;
  summary: string[];
  artifacts: Array<{
    type: "markdown" | "json" | "log" | "patch";
    path: string;
    note?: string;
  }>;
  logs: {
    lines: string[];
  };
  error?: {
    message: string;
    stack?: string;
  };
};
