export type RuntimeTarget =
  | "kilo_mcp"
  | "forge_http"
  | "local"
  | "openai"
  | "telegram"
  | string;

export type AvailabilityStatus = "online" | "degraded" | "offline";

export interface TargetProfile {
  target: RuntimeTarget;
  status: AvailabilityStatus;
  local?: boolean;
  capabilities?: string[];
}
