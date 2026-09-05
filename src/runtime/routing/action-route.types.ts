export type ActionRouteKind =
  | "direct_answer"
  | "sigma_forge"
  | "provider_bridge"
  | "browser_agent"
  | "voice_runtime"
  | "mission_control"
  | "manual_review";

export interface ActionRoute {
  route: ActionRouteKind;
  reason: string;
  requires_approval: boolean;
  build_task_required: boolean;
}
