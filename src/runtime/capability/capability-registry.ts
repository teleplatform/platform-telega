import type { CapabilityProfile } from "./capability.types.js";

const DEFAULT_PROFILES: CapabilityProfile[] = [
  {
    target: "kilo_mcp",
    status: "online",
    local: true,
    capabilities: ["build_task", "replay", "local_execution"],
  },
  {
    target: "forge_http",
    status: "degraded",
    local: false,
    capabilities: ["remote_execution"],
  },
];

export function getOnlineProfiles(): CapabilityProfile[] {
  return DEFAULT_PROFILES.filter((profile) => profile.status === "online");
}

export function listCapabilityProfiles(): CapabilityProfile[] {
  return [...DEFAULT_PROFILES];
}
