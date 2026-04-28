// ─────────────────────────────────────────────────────────────
// SIGMA FORGE BRIDGE — INDEX
//
// Canonical entry point for forge execution.
//
// Sigma Forge = STABLE PRODUCT ENTRY POINT (NOT Kilo Code button)
// Kilo = TEMPORARY FORGE EXECUTOR
// SigmaForge = FUTURE TARGET EXECUTOR
//
// ONE CORE, MANY SURFACES, ZERO SURFACE-OWNED LOGIC
// ─────────────────────────────────────────────────────────────

export * from "./forge-bridge.types.js";
export * from "./forge-bridge.js";
export * from "./kilo-bridge.js";

export const SIGMA_FORGE_VERSION = "v1";

export const SIGMA_FORGE_ENTRY_ACTIONS = [
  "sigma_forge_execute",
  "sigma_forge_code",
  "sigma_forge_ui",
] as const;

export type SigmaForgeEntryAction = typeof SIGMA_FORGE_ENTRY_ACTIONS[number];