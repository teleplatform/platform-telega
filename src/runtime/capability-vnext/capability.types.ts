export type CapabilityKind =
  | "model"
  | "web_provider"
  | "sigma_forge"
  | "forge_bridge"
  | "browser_agent"
  | "voice_runtime"
  | "mission_control"
  | "repo"
  | "terminal"
  | "validator"
  | "memory"
  | "deployment";

export type CapabilityTrustLevel =
  | "core"
  | "trusted"
  | "external"
  | "experimental";
