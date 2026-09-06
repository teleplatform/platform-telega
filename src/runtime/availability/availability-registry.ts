import { DEFAULT_TARGETS } from "./availability-defaults.js";
import type { AvailabilityStatus, RuntimeTarget, TargetProfile } from "./availability.types.js";

export function listTargetProfiles(): TargetProfile[] {
  return [...DEFAULT_TARGETS];
}

export function getTargetProfile(target: RuntimeTarget): TargetProfile | undefined {
  return DEFAULT_TARGETS.find((profile) => profile.target === target);
}

export function getTargetStatus(target: RuntimeTarget): AvailabilityStatus | undefined {
  return getTargetProfile(target)?.status;
}

export function isTargetOnline(target: RuntimeTarget): boolean {
  return getTargetProfile(target)?.status === "online";
}

export function getOnlineProfiles(): TargetProfile[] {
  return DEFAULT_TARGETS.filter((profile) => profile.status === "online");
}
