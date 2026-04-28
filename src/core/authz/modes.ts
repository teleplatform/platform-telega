// Actor Mode Model — Pack 2.1
// Mode resolution, parsing, precedence

import type { ActorMode, Actor, ActorRole } from "../../types/authz.js";

export const VALID_MODES: ActorMode[] = ["public", "creator", "internal", "system"];

export function parseMode(raw: string): ActorMode {
  const normalized = raw.toLowerCase().trim();
  if (VALID_MODES.includes(normalized as ActorMode)) {
    return normalized as ActorMode;
  }
  return "public";
}

export function inferModeFromRole(role: ActorRole): ActorMode {
  switch (role) {
    case "system":
      return "system";
    case "internal":
      return "internal";
    case "creator":
      return "creator";
    default:
      return "public";
  }
}

export function resolveActorMode(actor: Actor, requestedMode?: string): ActorMode {
  if (requestedMode) {
    const parsed = parseMode(requestedMode);
    return clampModeToRole(parsed, actor.role);
  }
  return inferModeFromRole(actor.role);
}

export function clampModeToRole(mode: ActorMode, role: ActorRole): ActorMode {
  const maxMode = inferModeFromRole(role);
  const modeOrder: ActorMode[] = ["public", "creator", "internal", "system"];
  const modeIdx = modeOrder.indexOf(mode);
  const maxIdx = modeOrder.indexOf(maxMode);
  if (modeIdx > maxIdx) return maxMode;
  return mode;
}

export function modeToString(mode: ActorMode): string {
  return mode;
}

export function isCreatorMode(mode: ActorMode): boolean {
  return mode === "creator";
}

export function isSystemMode(mode: ActorMode): boolean {
  return mode === "system";
}

export function isInternalMode(mode: ActorMode): boolean {
  return mode === "internal";
}

export function isPublicMode(mode: ActorMode): boolean {
  return mode === "public";
}
