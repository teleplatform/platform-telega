import type { ForgeAdapter, ForgeTask, ForgeResult, SigmaForgeCapabilityManifest } from "../forge-bridge.types.js";
import { createForgeResult } from "../forge-bridge.types.js";

export class SigmaForgeAdapter implements ForgeAdapter {
  private manifest: SigmaForgeCapabilityManifest | null = null;

  async handshake(): Promise<SigmaForgeCapabilityManifest> {
    return this.manifest || {
      runtime_id: "sigma_forge_stub",
      runtime_name: "sigma_forge",
      version: "0.0.0-stub",
      protocol_version: "telecore-build-v1",
      health: "unavailable",
      capabilities: [],
      supported_targets: [],
      checked_at: new Date().toISOString(),
    };
  }

  async execute(task: ForgeTask): Promise<ForgeResult> {
    const manifest = await this.handshake();

    if (manifest.health === "unavailable") {
      return createForgeResult({
        taskId: task.taskId,
        target: "sigma_forge",
        status: "blocked",
        summary: "Sigma Forge runtime unavailable",
        diagnostics: {
          code: "sigma_forge_unavailable",
          message: "Sigma Forge runtime is not reachable. Enable when executor is ready.",
          details: { taskKind: task.kind, runtimeHealth: manifest.health },
        },
      });
    }

    if (manifest.health === "degraded") {
      return createForgeResult({
        taskId: task.taskId,
        target: "sigma_forge",
        status: "blocked",
        summary: "Sigma Forge runtime degraded",
        diagnostics: {
          code: "sigma_forge_degraded",
          message: "Sigma Forge runtime is degraded. Try again later.",
          details: { taskKind: task.kind, runtimeHealth: manifest.health },
        },
      });
    }

    return createForgeResult({
      taskId: task.taskId,
      target: "sigma_forge",
      status: "blocked",
      summary: "Sigma Forge execution not yet enabled",
      diagnostics: {
        code: "sigma_forge_execution_not_enabled_yet",
        message: "Sigma Forge handshake successful but execution is stubbed.",
        details: { taskKind: task.kind, runtimeId: manifest.runtime_id },
      },
    });
  }
}