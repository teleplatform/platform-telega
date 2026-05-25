// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE CIRCUIT v1 — INDEX
//
// Canonical entry point for forge execution.
//
// Sigma Forge = STABLE PRODUCT ENTRY POINT
// Kilo = TEMPORARY EXECUTOR
// SigmaForge = FUTURE TARGET
//
// ONE CORE, MANY SURFACES, ZERO SURFACE-OWNED LOGIC
// ─────────────────────────────────────────────────────────────

export * from "./forge-bridge.types.js";
export * from "./forge-bridge-policy.js";
export * from "./forge-bridge-executor.js";
export * from "./forge-bridge.js";
export * from "./forge-bridge-smoke.js";

export * from "./forge-live-invocation.js";
export * from "./forge-live-smoke.js";

export * from "./forge-invocation-evidence.types.js";
export * from "./forge-invocation-evidence.js";
export * from "./forge-invocation-audit.js";
export * from "./forge-evidence-smoke.js";

export * from "./forge-evidence-export.types.js";
export * from "./forge-evidence-store.js";
export * from "./forge-evidence-query.js";
export * from "./forge-evidence-export.js";
export * from "./forge-evidence-export-smoke.js";

export * from "./forge-evidence-retrieval.js";
export * from "./forge-evidence-views.js";
export * from "./forge-evidence-telegram.js";
export * from "./forge-evidence-operator-surface.js";
export * from "./forge-evidence-operator-smoke.js";

export * from "./adapters/forge-http.adapter.js";
export * from "./adapters/kilo-mcp.adapter.js";
export * from "./adapters/sigma-forge.adapter.js";

export * from "./retry-policy.js";

export const FORGE_BRIDGE_VERSION = "v1";

export type { ForgeTask, ForgeResult, ForgeAdapter } from "./forge-bridge.types.js";