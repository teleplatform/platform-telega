import type { ExecutionMode } from "./executionMode.js";

export interface ExecutionRouteDecision {
  task_id?: string;
  execution_mode: ExecutionMode;
  complexity: "low" | "medium" | "high";
  risk_level: "low" | "medium" | "high";
  latency_sensitivity: "low" | "medium" | "high";
  privacy_sensitivity: "low" | "medium" | "high";
  estimated_token_volume: "low" | "medium" | "high";
  needs_tools: boolean;
  needs_review: boolean;
  reasons: string[];
  cheaper_mode_available?: ExecutionMode;
}
