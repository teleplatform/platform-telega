import type { TargetProfile } from "./availability.types.js";

export const DEFAULT_TARGETS: TargetProfile[] = [
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
