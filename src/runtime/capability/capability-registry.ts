import {
  getOnlineProfiles as getOnlineAvailabilityProfiles,
  listTargetProfiles,
} from "../availability/availability-registry.js";
import type { CapabilityProfile } from "./capability.types.js";

/** @deprecated Compatibility shim — runtime availability now lives in runtime/availability. Kept until A5/A6 migration. */
export function getOnlineProfiles(): CapabilityProfile[] {
  return getOnlineAvailabilityProfiles();
}

/** @deprecated Compatibility shim — runtime availability now lives in runtime/availability. Kept until A5/A6 migration. */
export function listCapabilityProfiles(): CapabilityProfile[] {
  return listTargetProfiles();
}
