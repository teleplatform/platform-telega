// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE POLICY
//
// Capability enforcement for forge bridge.
//
// Rules:
// - forge_access: base forge bridge access
// - forge_remote_access: ForgeClientZero execution
// - kilo_mcp_access: Kilo MCP execution
//
// Vault NOT in business logic — only at client bootstrap.
// ─────────────────────────────────────────────────────────────

import { hasCapability, getRuntimeRole, type RuntimeRole } from "../../core/auth/runtime-access.js";

export type ForgeCapability = "forge_access" | "forge_remote_access" | "kilo_mcp_access";

export function assertForgeBridgeAllowed(userId: string | number | null): void {
  const role = getRuntimeRole(userId);
  if (!hasCapability(userId, "forge_access") && !role.startsWith("owner_")) {
    throw new Error("forge_access_forbidden");
  }
}

export function assertForgeRemoteAllowed(userId: string | number | null): void {
  const role = getRuntimeRole(userId);
  if (!hasCapability(userId, "forge_remote_access" as any) && !role.startsWith("owner_")) {
    throw new Error("forge_remote_access_forbidden");
  }
}

export function assertKiloMcpAllowed(userId: string | number | null): void {
  const role = getRuntimeRole(userId);
  if (!hasCapability(userId, "kilo_mcp_access" as any) && !role.startsWith("owner_")) {
    throw new Error("kilo_mcp_access_forbidden");
  }
}

export function checkForgeCapability(
  userId: string | number | null,
  capability: ForgeCapability
): { allowed: boolean; reason?: string } {
  const role = getRuntimeRole(userId);
  const allowed = hasCapability(userId, capability as any) || role.startsWith("owner_");
  return {
    allowed,
    reason: allowed ? undefined : `${capability}_forbidden`,
  };
}

export function getAllowedForgeTargets(userId: string | number | null): string[] {
  const role = getRuntimeRole(userId);
  if (!role.startsWith("owner_") && !hasCapability(userId, "forge_access")) {
    return [];
  }
  if (!role.startsWith("owner_") && !hasCapability(userId, "forge_remote_access" as any)) {
    return ["kilo_mcp"];
  }
  return ["forge_remote", "kilo_mcp"];
}

export function resolveDefaultForgeTarget(userId: string | number | null): "forge_remote" | "kilo_mcp" {
  const targets = getAllowedForgeTargets(userId);
  if (targets.includes("forge_remote")) {
    return "forge_remote";
  }
  if (targets.includes("kilo_mcp")) {
    return "kilo_mcp";
  }
  return "kilo_mcp";
}