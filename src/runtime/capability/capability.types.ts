export type RuntimeTarget =
  | "kilo_mcp"
  | "forge_http"
  | "local"
  | "openai"
  | "telegram"
  | string;

export interface CapabilityProfile {
  target: RuntimeTarget;
  status: "online" | "degraded" | "offline";
  local?: boolean;
  capabilities?: string[];
}
