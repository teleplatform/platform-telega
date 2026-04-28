// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE — PUBLIC FACADE
//
// ONLY entry point for forge execution.
//
// Menu/handlers call ForgeBridge.run()
// NOT ForgeClientZero
// NOT Kilo MCP directly
//
// ONE CORE, MANY SURFACES, ZERO SURFACE-OWNED LOGIC
// ─────────────────────────────────────────────────────────────

import type {
  ForgeTask,
  ForgeResult,
  ForgeTaskKind,
  ForgeExecutionTarget,
} from "./forge-bridge.types.js";
import { createForgeTask, createForgeResult } from "./forge-bridge.types.js";
import {
  assertForgeBridgeAllowed,
  resolveDefaultForgeTarget,
} from "./forge-bridge-policy.js";
import { ForgeBridgeExecutor } from "./forge-bridge-executor.js";
import { ForgeHttpAdapter } from "./adapters/forge-http.adapter.js";
import { KiloMcpAdapter } from "./adapters/kilo-mcp.adapter.js";

export class ForgeBridge {
  private executor: ForgeBridgeExecutor;

  constructor(executor: ForgeBridgeExecutor) {
    this.executor = executor;
  }

  async run(params: {
    userId: string;
    kind: ForgeTaskKind;
    target?: ForgeExecutionTarget;
    path?: string;
    input?: Record<string, unknown>;
  }): Promise<ForgeResult> {
    const { userId, kind, target, path, input } = params;

    assertForgeBridgeAllowed(userId);

    const resolvedTarget = target || resolveDefaultForgeTarget(userId);

    const task = createForgeTask({
      userId,
      role: "owner",
      target: resolvedTarget,
      kind,
      path,
      input,
    });

    return this.executor.execute(task);
  }

  async executeTask(task: ForgeTask): Promise<ForgeResult> {
    assertForgeBridgeAllowed(task.userId);
    return this.executor.execute(task);
  }
}

let forgeBridgeInstance: ForgeBridge | null = null;

export function initForgeBridge(config?: {
  forgeHttpAdapter?: ForgeHttpAdapter;
  kiloMcpAdapter?: KiloMcpAdapter;
}): ForgeBridge {
  const forgeHttp = config?.forgeHttpAdapter || new ForgeHttpAdapter(async () => ({}));
  const kiloMcp = config?.kiloMcpAdapter || new KiloMcpAdapter();

  const executor = new ForgeBridgeExecutor(forgeHttp, kiloMcp);
  forgeBridgeInstance = new ForgeBridge(executor);
  return forgeBridgeInstance;
}

export function getForgeBridge(): ForgeBridge {
  if (!forgeBridgeInstance) {
    initForgeBridge();
  }
  return forgeBridgeInstance!;
}

export function resetForgeBridge(): void {
  forgeBridgeInstance = null;
}

export async function runForgeTask(params: {
  userId: string;
  kind: ForgeTaskKind;
  target?: ForgeExecutionTarget;
  path?: string;
  input?: Record<string, unknown>;
}): Promise<ForgeResult> {
  const bridge = getForgeBridge();
  return bridge.run(params);
}

export {
  createForgeTask,
  createForgeResult,
  type ForgeTask,
  type ForgeResult,
  type ForgeTaskKind,
  type ForgeExecutionTarget,
} from "./forge-bridge.types.js";