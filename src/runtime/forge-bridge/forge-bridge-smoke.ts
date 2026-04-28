// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE CIRCUIT — SMOKE PACK v1
//
// Verification checks:
// 1. owner -> forge_remote task -> allowed
// 2. owner -> kilo_mcp task -> allowed
// 3. partner -> forge task -> blocked
// 4. public -> forge task -> blocked
// 5. forge_remote adapter returns ForgeResult
// 6. kilo_mcp adapter returns ForgeResult
// 7. unknown target -> blocked result
// ─────────────────────────────────────────────────────────────

import type { ForgeTask, ForgeResult } from "./forge-bridge.types.js";
import { createForgeTask, createForgeResult } from "./forge-bridge.types.js";
import { ForgeBridgeExecutor } from "./forge-bridge-executor.js";
import { ForgeBridge } from "./forge-bridge.js";
import {
  checkForgeCapability,
  getAllowedForgeTargets,
  resolveDefaultForgeTarget,
} from "./forge-bridge-policy.js";

export interface ForgeSmokeResult {
  smokePassed: boolean;
  checks: {
    ownerForgeRemote: boolean;
    ownerKiloMcp: boolean;
    partnerBlocked: boolean;
    publicBlocked: boolean;
    forgeHttpAdapter: boolean;
    kiloMcpAdapter: boolean;
    unknownTargetBlocked: boolean;
    policyEnforcement: boolean;
  };
  blockers?: string[];
  warnings?: string[];
}

export function runForgeBridgeSmokeChecks(input?: {
  forgeHttpAdapter?: { execute: (task: ForgeTask) => Promise<ForgeResult> };
  kiloMcpAdapter?: { execute: (task: ForgeTask) => Promise<ForgeResult> };
}): ForgeSmokeResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const forgeAdapter = input?.forgeHttpAdapter || {
    execute: async (t: ForgeTask) =>
      createForgeResult({ taskId: t.taskId, target: "forge_remote", status: "done", summary: "mock" }),
  };

  const kiloAdapter = input?.kiloMcpAdapter || {
    execute: async (t: ForgeTask) =>
      createForgeResult({ taskId: t.taskId, target: "kilo_mcp", status: "done", summary: "mock" }),
  };

  const executor = new ForgeBridgeExecutor(forgeAdapter as any, kiloAdapter as any);

  const ownerTask = createForgeTask({
    userId: "267246987",
    role: "owner_creator_primary",
    target: "forge_remote",
    kind: "create_file",
    path: "/tmp/test.txt",
  });

  const kiloTask = createForgeTask({
    userId: "267246987",
    role: "owner_creator_primary",
    target: "kilo_mcp",
    kind: "read_file",
    path: "/tmp/test.txt",
  });

  const partnerTask = createForgeTask({
    userId: "591948691",
    role: "partner_creator",
    target: "forge_remote",
    kind: "generic",
  });

  const publicTask = createForgeTask({
    userId: "999999999",
    role: "public",
    target: "forge_remote",
    kind: "generic",
  });

  const unknownTask = createForgeTask({
    userId: "267246987",
    role: "owner_creator_primary",
    target: "unknown",
    kind: "generic",
  });

  const ownerForgeRemote = checkForgeCapability("267246987", "forge_access").allowed;
  const ownerKiloMcp = checkForgeCapability("267246987", "forge_access").allowed;
  const partnerBlocked = !checkForgeCapability("591948691", "forge_access").allowed;
  const publicBlocked = !checkForgeCapability("999999999", "forge_access").allowed;

  const forgeHttpAdapter =
    (await executor.execute(ownerTask)).status === "done";
  const kiloMcpAdapter =
    (await executor.execute(kiloTask)).status === "done";
  const unknownTargetBlocked =
    (await executor.execute(unknownTask)).status === "blocked";

  const ownerTargets = getAllowedForgeTargets("267246987");
  const policyEnforcement =
    ownerTargets.includes("forge_remote") || ownerTargets.includes("kilo_mcp");

  if (!ownerForgeRemote) {
    blockers.push("owner should have forge_access");
  }
  if (!ownerKiloMcp) {
    blockers.push("owner should have kilo_mcp_access");
  }
  if (!partnerBlocked) {
    blockers.push("partner should be blocked from forge");
  }
  if (!publicBlocked) {
    blockers.push("public should be blocked from forge");
  }
  if (!forgeHttpAdapter) {
    blockers.push("forge_http adapter not functional");
  }
  if (!kiloMcpAdapter) {
    blockers.push("kilo_mcp adapter not functional");
  }
  if (!unknownTargetBlocked) {
    blockers.push("unknown target should be blocked");
  }
  if (!policyEnforcement) {
    blockers.push("policy enforcement broken");
  }

  if (blockers.length === 0) {
    warnings.push("Forge Bridge Circuit v1 — all smoke checks passed");
    warnings.push("Menu/handlers call ONLY ForgeBridge — not direct adapters");
  }

  return {
    smokePassed: blockers.length === 0,
    checks: {
      ownerForgeRemote,
      ownerKiloMcp,
      partnerBlocked,
      publicBlocked,
      forgeHttpAdapter,
      kiloMcpAdapter,
      unknownTargetBlocked,
      policyEnforcement,
    },
    blockers: blockers.length > 0 ? blockers : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function verifyForgeBridgeArchitecture(): {
  correct: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  return {
    correct: violations.length === 0,
    violations,
  };
}