// ─────────────────────────────────────────────────────────────
// SIGMA FORGE BRIDGE — UNIFIED EXECUTION ABSTRACTION
//
// ONE unified entry point for all forge execution.
//
// Flow:
//   Sigma Forge button (stable surface entry)
//     → executeForgeTask (unified abstraction)
//     → current executor = Kilo (temporary)
//     → future: SigmaForge (target executor)
//
// Principles:
// - Surface semantics stay the same when executor changes
// - ONE CORE, MANY SURFACES
// - ZERO surface-owned execution logic
// ─────────────────────────────────────────────────────────────

import {
  type ForgeTask,
  type ForgeResult,
  type ForgeBridge,
  type ForgeTaskType,
  createForgeTask,
  createForgeResult,
  FORGE_CAPABILITIES_BY_ROLE,
} from "./forge-bridge.types.js";
import { KiloBridgeExecutor } from "./kilo-bridge.js";
import { getRuntimeRole, type RuntimeRole } from "../auth/runtime-access.js";
import { createVaultResolver } from "../../server/vaultResolver.js";

let currentExecutor: ForgeBridge | null = null;
let currentExecutorType: "kilo" | "sigmaforge" = "kilo";

export function initForgeBridge(executor: "kilo" | "sigmaforge" = "kilo"): void {
  currentExecutorType = executor;
  if (executor === "kilo") {
    currentExecutor = new KiloBridgeExecutor();
  }
}

export function getCurrentExecutor(): ForgeBridge {
  if (!currentExecutor) {
    initForgeBridge("kilo");
  }
  return currentExecutor!;
}

export function getCurrentExecutorType(): "kilo" | "sigmaforge" {
  return currentExecutorType;
}

export function canUseForge(userId: string | number | null): {
  allowed: boolean;
  reason?: string;
} {
  const role = getRuntimeRole(userId);
  const capabilities = FORGE_CAPABILITIES_BY_ROLE[role];
  if (!capabilities) {
    return { allowed: false, reason: "unknown_role" };
  }
  if (!capabilities.code_generation) {
    return { allowed: false, reason: "code_generation_forbidden" };
  }
  return { allowed: true };
}

export async function executeForgeTask(params: {
  type: ForgeTaskType;
  input: string;
  userId: string;
  surface: "telegram" | "alice" | "web" | "api" | "bridge";
  context?: {
    repo_root?: string;
    language?: string;
  };
}): Promise<ForgeResult> {
  const { type, input, userId, surface, context } = params;

  const accessCheck = canUseForge(userId);
  if (!accessCheck.allowed) {
    return createForgeResult({
      id: `forge_${Date.now()}`,
      status: "blocked",
      error: {
        code: "FORGE_ACCESS_DENIED",
        message: accessCheck.reason || "Forge access forbidden",
      },
      executor: currentExecutorType,
    });
  }

  const task = createForgeTask({
    type,
    input: { task: input },
    userId,
    surface,
    mode: "creator",
    context,
  });

  const executor = getCurrentExecutor();
  return executor.execute(task);
}

export function registerForgeAction(params: {
  type: "code" | "ui" | "agent" | "analysis";
  prompt: string;
  userId: string;
  chatId?: string;
}): Promise<ForgeResult> {
  return executeForgeTask({
    type: params.type,
    input: params.prompt,
    userId: params.userId,
    surface: "telegram",
  });
}

export async function getForgeHealth(): Promise<{ ok: boolean; executor: string; error?: string }> {
  try {
    const bridge = getCurrentExecutor();
    if (bridge.health) {
      const healthResult = await bridge.health();
      return { ...healthResult, executor: currentExecutorType };
    }
    return { ok: true, executor: currentExecutorType };
  } catch (e: any) {
    return { ok: false, executor: currentExecutorType, error: e.message };
  }
}

export async function resolveForgeCredentials(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const vault = createVaultResolver({
      baseURL: process.env.VAULT_URL || "http://localhost:8200",
    });
    const result = await vault.resolve("forge:api_key");
    if (!result.found) {
      return { ok: false, error: "forge:api_key not found in Vault" };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export {
  createForgeTask,
  createForgeResult,
  type ForgeTask,
  type ForgeResult,
  type ForgeBridge,
  type ForgeTaskType,
} from "./forge-bridge.types.js";