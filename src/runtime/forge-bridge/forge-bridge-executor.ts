// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE EXECUTOR
//
// Unified dispatch layer for forge execution.
//
// Menu/handlers call ONLY ForgeBridge
// ForgeBridge calls executor
// Executor dispatches to correct adapter
// Adapters call transport clients
// ─────────────────────────────────────────────────────────────

import type { ForgeTask, ForgeResult, ForgeAdapter } from "./forge-bridge.types.js";
import { createForgeResult } from "./forge-bridge.types.js";

export class ForgeBridgeExecutor {
  constructor(
    private readonly forgeHttpAdapter: ForgeAdapter,
    private readonly kiloMcpAdapter: ForgeAdapter,
  ) {}

  async execute(task: ForgeTask): Promise<ForgeResult> {
    switch (task.target) {
      case "forge_remote":
        return this.forgeHttpAdapter.execute(task);

      case "kilo_mcp":
        return this.kiloMcpAdapter.execute(task);

      default:
        return createForgeResult({
          taskId: task.taskId,
          target: task.target,
          status: "blocked",
          summary: "Unknown forge target",
          diagnostics: {
            code: "unknown_target",
            message: `Target ${task.target} not supported`,
          },
        });
    }
  }
}

let executorInstance: ForgeBridgeExecutor | null = null;

export function getForgeBridgeExecutor(
  forgeHttpAdapter: ForgeAdapter,
  kiloMcpAdapter: ForgeAdapter
): ForgeBridgeExecutor {
  if (!executorInstance) {
    executorInstance = new ForgeBridgeExecutor(forgeHttpAdapter, kiloMcpAdapter);
  }
  return executorInstance;
}

export function resetForgeBridgeExecutor(): void {
  executorInstance = null;
}