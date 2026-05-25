import type { ForgeAdapter, ForgeTask, ForgeResult, SigmaForgeCapabilityManifest } from "../forge-bridge.types.js";
import { createForgeResult } from "../forge-bridge.types.js";

export interface SigmaForgeCapabilityRegistry {
  last_sigma_forge_manifest: SigmaForgeCapabilityManifest | null;
  last_handshake_at: number;
  last_handshake_status: "success" | "unavailable" | "protocol_mismatch" | "degraded";
  last_protocol_version: string | null;
  last_runtime_id: string | null;
  last_capabilities: string[];
}

export class SigmaForgeCapabilityRegistryImpl implements SigmaForgeCapabilityRegistry {
  last_sigma_forge_manifest: SigmaForgeCapabilityManifest | null = null;
  last_handshake_at: number = 0;
  last_handshake_status: "success" | "unavailable" | "protocol_mismatch" | "degraded" = "unavailable";
  last_protocol_version: string | null = null;
  last_runtime_id: string | null = null;
  last_capabilities: string[] = [];

  setManifest(manifest: SigmaForgeCapabilityManifest): void {
    this.last_sigma_forge_manifest = manifest;
    this.last_handshake_at = Date.now();
    this.last_handshake_status = manifest.health === "unavailable" ? "unavailable" : manifest.health === "degraded" ? "degraded" : "success";
    this.last_protocol_version = manifest.protocol_version;
    this.last_runtime_id = manifest.runtime_id;
    this.last_capabilities = manifest.capabilities;
  }
}

export const sigmaForgeRegistry = new SigmaForgeCapabilityRegistryImpl();

export class SigmaForgeAdapter implements ForgeAdapter {
  private manifest: SigmaForgeCapabilityManifest | null = null;

  async handshake(): Promise<SigmaForgeCapabilityManifest> {
    if (this.manifest && Date.now() - sigmaForgeRegistry.last_handshake_at < 30000) {
      return this.manifest;
    }
    const manifest: SigmaForgeCapabilityManifest = {
      runtime_id: "sigma_forge_stub",
      runtime_name: "sigma_forge",
      version: "0.0.0-stub",
      protocol_version: "telecore-build-v1",
      health: "unavailable",
      capabilities: [],
      supported_targets: [],
      checked_at: new Date().toISOString(),
    };
    this.manifest = manifest;
    sigmaForgeRegistry.setManifest(manifest);
    return manifest;
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
          details: { taskKind: task.kind, runtimeHealth: manifest.health, lastHandshakeAt: sigmaForgeRegistry.last_handshake_at },
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
          details: { taskKind: task.kind, runtimeHealth: manifest.health, lastHandshakeAt: sigmaForgeRegistry.last_handshake_at },
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
        details: { taskKind: task.kind, runtimeId: manifest.runtime_id, lastHandshakeAt: sigmaForgeRegistry.last_handshake_at },
      },
    });
  }
}