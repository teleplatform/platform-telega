import type { CapabilityKind, CapabilityTrustLevel } from "./capability.types.js";

export interface CapabilityPermissions {
  readonly filesystem: "none" | "read" | "write_scoped";
  readonly network: "none" | "allowlisted" | "open";
  readonly browser: "none" | "read" | "interact";
  readonly terminal: "none" | "safe" | "scoped" | "dangerous_requires_approval";
  readonly secrets: "none" | "masked" | "scoped";
}

export interface CapabilityDescriptor {
  readonly capability_id: string;
  readonly kind: CapabilityKind;
  readonly trust_level: CapabilityTrustLevel;
  readonly title: string;
  readonly description: string;
  readonly permissions: CapabilityPermissions;
}
