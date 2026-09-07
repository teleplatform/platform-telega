export type CapabilityKind =
  | "model"
  | "provider_chat"
  | "web_provider"
  | "sigma_forge"
  | "forge_bridge"
  | "worker_runtime"
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
