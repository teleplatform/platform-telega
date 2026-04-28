// ─────────────────────────────────────────────────────────────
// KILO BRIDGE — TEMPORARY FORGE EXECUTOR
//
// Kilo Code MCP as temporary executor for Sigma Forge.
//
// IMPORTANT:
// - This is a TEMPORARY executor
// - SigmaForge runtime will replace it seamlessly
// - Surface semantics must NOT change when executor changes
//
// Architecture:
//   Sigma Forge button
//     → ForgeBridge abstraction
//     → KiloBridge (current)
//     → SigmaForge (future)
// ─────────────────────────────────────────────────────────────

import {
  type ForgeTask,
  type ForgeResult,
  type ForgeBridge,
  createForgeResult,
} from "./forge-bridge.types.js";

interface KiloBridgeConfig {
  endpoint?: string;
  timeoutMs?: number;
}

const DEFAULT_CONFIG: Required<KiloBridgeConfig> = {
  endpoint: process.env.KILO_ENDPOINT || "http://localhost:8080",
  timeoutMs: Number(process.env.KILO_TIMEOUT_MS || "60000"),
};

export class KiloBridgeExecutor implements ForgeBridge {
  provider: "kilo" = "kilo";
  private config: Required<KiloBridgeConfig>;

  constructor(config: KiloBridgeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute(task: ForgeTask): Promise<ForgeResult> {
    const t0 = Date.now();
    const { id, type, input, context, userId } = task;

    try {
      console.log(`[kilo-bridge] executing task=${id} type=${type} user=${userId}`);

      const result = await this.executeViaKilo({
        taskId: id,
        type,
        input: input.task,
        context: context as Record<string, unknown> | undefined,
      });

      return createForgeResult({
        id,
        status: "done",
        outputs: {
          text: result.text || result.output || "",
          code: result.code,
          files: result.files,
          logs: result.logs,
        },
        executor: "kilo",
        durationMs: Date.now() - t0,
      });
    } catch (e: any) {
      console.error(`[kilo-bridge] task=${id} error:`, e.message);

      return createForgeResult({
        id,
        status: "error",
        error: {
          code: "KILO_EXECUTION_ERROR",
          message: e.message || "Kilo execution failed",
          recoverable: true,
        },
        executor: "kilo",
        durationMs: Date.now() - t0,
      });
    }
  }

  async health(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return { ok: response.ok };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  private async executeViaKilo(params: {
    taskId: string;
    type: string;
    input: string;
    context?: Record<string, unknown>;
  }): Promise<{
    text?: string;
    output?: string;
    code?: string;
    files?: Array<{ name: string; content: string }>;
    logs?: string[];
  }> {
    const { taskId, type, input, context } = params;

    try {
      const response = await fetch(`${this.config.endpoint}/v1/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_id: taskId,
          type,
          input,
          context,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Kilo API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        text: data.text,
        output: data.output,
        code: data.code,
        files: data.files,
        logs: data.logs,
      };
    } catch (e: any) {
      if (e.name === "TimeoutError") {
        throw new Error("Kilo execution timeout");
      }
      throw e;
    }
  }
}

let kbridgesInstance: KiloBridgeExecutor | null = null;

export function getKiloBridge(config?: KiloBridgeConfig): ForgeBridge {
  if (!kbridgesInstance) {
    kbridgesInstance = new KiloBridgeExecutor(config);
  }
  return kbridgesInstance;
}

export function canUseForgeExecution(userId: string): {
  allowed: boolean;
  reason?: string;
} {
  return { allowed: true };
}

export function getForgeExecutor(): ForgeBridge {
  return getKiloBridge();
}

export { KiloBridgeExecutor as KiloForgeBridge };