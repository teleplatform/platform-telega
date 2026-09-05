import type { ForgeExecutionTarget, ForgeTaskKind } from "./forge-bridge.types.js";

export interface ExecutorRouter {
  resolveExecutor(task: {
    taskId: string;
    target?: string;
    kind: string;
    userId?: string;
    path?: string;
    input?: Record<string, unknown>;
  }): { target: ForgeExecutionTarget };
}

class DefaultExecutorRouter implements ExecutorRouter {
  constructor(private config: {
    kiloMcpAvailable: boolean;
    forgeRemoteAvailable: boolean;
    defaultMode: "sandbox" | "creator_only" | "full";
  }) {}

  resolveExecutor(task: {
    taskId: string;
    target?: string;
    kind: string;
    userId?: string;
    path?: string;
    input?: Record<string, unknown>;
  }): { target: ForgeExecutionTarget } {
    // If target is explicitly requested, honor it if possible
    if (task.target === "kilo_mcp" && this.config.kiloMcpAvailable) {
      return { target: "kilo_mcp" };
    }
    if (task.target === "forge_remote" && this.config.forgeRemoteAvailable) {
      return { target: "forge_remote" };
    }
    if (task.target === "sigma_forge") {
      return { target: "sigma_forge" };
    }

    // TGR-6.47 — KiloCode Execution Bridge logic
    // We route most complex tasks to sigma_forge, which will then use KiloCode as fallback
    const complexKinds: ForgeTaskKind[] = [
      "create_file",
      "update_file",
      "delete_file",
      "run_code",
      "generic",
      "execute_kilocode_task"
    ];

    if (complexKinds.includes(task.kind as ForgeTaskKind)) {
      return { target: "sigma_forge" };
    }

    // Default to sigma_forge (sandbox) for analysis tasks
    return { target: "sigma_forge" };
  }
}

let routerInstance: ExecutorRouter | null = null;

export function getExecutorRouter(): ExecutorRouter | null {
  return routerInstance;
}

export function initExecutorRouter(config?: {
  sigmaForgeRegistry?: unknown;
  kiloMcpAvailable?: boolean;
  forgeRemoteAvailable?: boolean;
  defaultMode?: "sandbox" | "creator_only" | "full";
}): void {
  routerInstance = new DefaultExecutorRouter({
    kiloMcpAvailable: config?.kiloMcpAvailable ?? true,
    forgeRemoteAvailable: config?.forgeRemoteAvailable ?? true,
    defaultMode: config?.defaultMode ?? "sandbox",
  });
}

export type ForgeTask = {
  taskId: string;
  target?: string;
  kind: string;
  userId?: string;
  path?: string;
  input?: Record<string, unknown>;
};