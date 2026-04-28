// ─────────────────────────────────────────────────────────────
// FORGE HTTP ADAPTER
//
// Wraps existing ForgeClientZero for forge-bridge circuit.
//
// Vault NOT in adapter — client injected at bootstrap.
// ─────────────────────────────────────────────────────────────

import type { ForgeTask, ForgeResult, ForgeAdapter } from "../forge-bridge.types.js";
import { createForgeResult } from "../forge-bridge.types.js";

export class ForgeHttpAdapter implements ForgeAdapter {
  constructor(
    private readonly executeFn: (task: ForgeTask) => Promise<ForgeTask["input"]>,
  ) {}

  async execute(task: ForgeTask): Promise<ForgeResult> {
    const t0 = Date.now();

    try {
      const response = await this.executeFn(task);

      return createForgeResult({
        taskId: task.taskId,
        target: "forge_remote",
        status: "done",
        summary: "Forge remote execution completed",
        output: response as Record<string, unknown>,
      });
    } catch (e: any) {
      return createForgeResult({
        taskId: task.taskId,
        target: "forge_remote",
        status: "failed",
        summary: "Forge remote execution failed",
        diagnostics: {
          code: "FORGE_HTTP_ERROR",
          message: e.message,
        },
      });
    }
  }
}

export function createForgeHttpAdapter(
  client: {
    run(request: {
      input: { task?: string; messages?: Array<{ role: string; content: string }> };
      options?: Record<string, unknown>;
      forge?: Record<string, unknown>;
    }): Promise<{
      ok: boolean;
      result?: { assistant_message?: string };
      error?: { code: string; message: string };
    }>;
  },
  options?: {
    model?: string;
    replyMode?: string;
  }
): ForgeAdapter {
  return new ForgeHttpAdapter(async (task) => {
    const response = await client.run({
      input: {
        task: task.input?.prompt as string || String(task.input),
        messages: [],
      },
      options: {
        model: options?.model,
        reply_mode: options?.replyMode,
      },
      forge: {
        workspace: {
          kind: "worktree",
          root: task.input?.repo_root as string || process.cwd(),
        },
      },
    });

    if (!response.ok) {
      throw new Error(response.error?.message || "Forge remote error");
    }

    return {
      assistant_message: response.result?.assistant_message,
    };
  });
}