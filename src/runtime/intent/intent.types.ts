export type RuntimeIntent =
  | "answer"
  | "build_project"
  | "modify_repo"
  | "research"
  | "analyze_file"
  | "generate_media"
  | "publish_content"
  | "control_runtime"
  | "unknown";

export type RuntimeRiskLevel = "low" | "medium" | "high" | "critical";

export interface IntentResult {
  intent: RuntimeIntent;
  confidence: number;
  goal: string;
  risk_level: RuntimeRiskLevel;
  requires_execution: boolean;
  recommended_route: string;
  evidence_required: boolean;
}
