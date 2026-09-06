export type CapabilityKind =
  | "model"
  | "web_provider"
  | "sigma_forge"
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
