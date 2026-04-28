// Lane Definitions — Pack 3.1
// Canonical lane model for provider/model routing

import type { ActorMode } from "../../types/authz.js";

export type LaneId = "cheap" | "smart" | "private" | "creator";

export interface LaneDescriptor {
  id: LaneId;
  description: string;
  default_for: ActorMode[];
  allowed_for: ActorMode[];
  reasoning_depth: "low" | "medium" | "high";
  cost_class: "low" | "medium" | "high";
  privacy_class: "local_only" | "remote_allowed";
}

export const LANES: Record<LaneId, LaneDescriptor> = {
  cheap: {
    id: "cheap",
    description: "Fast, low-cost tasks: short answers, simple generation, lightweight flows",
    default_for: ["public"],
    allowed_for: ["public", "creator", "internal", "system"],
    reasoning_depth: "low",
    cost_class: "low",
    privacy_class: "remote_allowed",
  },
  smart: {
    id: "smart",
    description: "Reasoning, planning, complex explanations, multi-step tasks",
    default_for: ["creator"],
    allowed_for: ["creator", "internal", "system"],
    reasoning_depth: "high",
    cost_class: "high",
    privacy_class: "remote_allowed",
  },
  private: {
    id: "private",
    description: "Local-first, privacy-sensitive, restricted remote policy",
    default_for: ["public"],
    allowed_for: ["public", "creator", "internal", "system"],
    reasoning_depth: "medium",
    cost_class: "low",
    privacy_class: "local_only",
  },
  creator: {
    id: "creator",
    description: "Creator-only models, expanded execution profiles, enhanced budget",
    default_for: [],
    allowed_for: ["creator", "internal", "system"],
    reasoning_depth: "high",
    cost_class: "high",
    privacy_class: "remote_allowed",
  },
};

export function isLaneAllowedForMode(lane: LaneId, mode: ActorMode): boolean {
  return LANES[lane].allowed_for.includes(mode);
}

export function getDefaultLaneForMode(mode: ActorMode): LaneId {
  for (const [id, desc] of Object.entries(LANES)) {
    if (desc.default_for.includes(mode)) {
      return id as LaneId;
    }
  }
  return "cheap";
}

export function getCandidateLanesForMode(mode: ActorMode): LaneId[] {
  return (Object.keys(LANES) as LaneId[]).filter((lane) =>
    isLaneAllowedForMode(lane, mode)
  );
}

export function laneMatchesPrivacy(
  lane: LaneId,
  privacy: "prefer_local" | "allow_remote" | "require_local"
): boolean {
  if (privacy === "require_local") {
    return LANES[lane].privacy_class === "local_only";
  }
  if (privacy === "prefer_local") {
    return LANES[lane].privacy_class === "local_only" || LANES[lane].cost_class === "low";
  }
  return true;
}

export function laneMatchesBudget(
  lane: LaneId,
  budget: "low" | "medium" | "high"
): boolean {
  const laneCost = LANES[lane].cost_class;
  if (budget === "low") return laneCost === "low";
  if (budget === "medium") return laneCost === "low" || laneCost === "medium";
  return true;
}
