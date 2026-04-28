// ─────────────────────────────────────────────────────────────
// KILO MCP ADAPTER
//
// Kilo Code MCP as temporary forge executor.
//
// IMPORTANT:
// - This is TEMPORARY executor
// - SigmaForge runtime will replace it
// - Surface semantics MUST NOT change when executor changes
// ─────────────────────────────────────────────────────────────

import type {
  ForgeTask,
  ForgeResult,
  ForgeAdapter,
  ForgeTaskKind,
} from "../forge-bridge.types.js";
import { createForgeResult, mapTaskKindToKiloTool } from "../forge-bridge.types.js";

interface KiloMcpConfig {
  endpoint?: string;
  timeoutMs?: number;
}

const DEFAULT_CONFIG: Required<KiloMcpConfig> = {
  endpoint: process.env.KILO_MCP_ENDPOINT || "http://localhost:8080",
  timeoutMs: Number(process.env.KILO_TIMEOUT_MS || "120000"),
};

export class KiloMcpAdapter implements ForgeAdapter {
  private config: Required<KiloMcpConfig>;

  constructor(config?: KiloMcpConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute(task: ForgeTask): Promise<ForgeResult> {
    const t0 = Date.now();
    const toolName = mapTaskKindToKiloTool(task.kind);

    try {
      const response = await this.callKiloTool(toolName, {
        task_id: task.taskId,
        path: task.path,
        kind: task.kind,
        ...task.input,
      });

      return createForgeResult({
        taskId: task.taskId,
        target: "kilo_mcp",
        status: "done",
        summary: `Kilo MCP: ${task.kind} completed`,
        output: response as Record<string, unknown>,
      });
    } catch (e: any) {
      return createForgeResult({
        taskId: task.taskId,
        target: "kilo_mcp",
        status: "failed",
        summary: "Kilo MCP execution failed",
        diagnostics: {
          code: "KILO_MCP_ERROR",
          message: e.message,
        },
      });
    }
  }

  private async callKiloTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${this.config.endpoint}/v1/tools/${toolName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Kilo MCP error: ${response.status}`);
    }

    return response.json();
  }
}

let kiloAdapterInstance: KiloMcpAdapter | null = null;

export function getKiloMcpAdapter(config?: KiloMcpConfig): ForgeAdapter {
  if (!kiloAdapterInstance) {
    kiloAdapterInstance = new KiloMcpAdapter(config);
  }
  return kiloAdapterInstance;
}