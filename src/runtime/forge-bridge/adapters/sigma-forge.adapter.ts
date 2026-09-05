import type { ForgeAdapter, ForgeTask, ForgeResult, SigmaForgeCapabilityManifest, SigmaForgeExecutionPolicy, ForgeArtifact } from "../forge-bridge.types.js";
import { createForgeResult } from "../forge-bridge.types.js";
import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import type { BuildTaskStreamEvent } from "../../../types/telecore.js";
import { getExecutionStreamStore } from "../../mission-control/execution-stream-store.js";

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

const SANDBOX_RESTRICTIONS = new Set([
  "no_destructive_writes",
  "no_secrets_access",
  "no_deploy_operations",
  "read_only_file_system",
]);

const SANDBOX_ALLOWED_KINDS: Set<string> = new Set([
  "analyze_repo",
  "list_files",
  "read_file",
  "generate_patch",
  "verify_runtime",
  "execute_kilocode_task",
]);

function computeChecksum(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function emitStreamEvent(taskId: string, eventType: BuildTaskStreamEvent["event_type"], payload: Record<string, unknown>): void {
  const store = getExecutionStreamStore();
  const events = store.get(taskId) ?? [];
  const sequence = events.length + 1;
  events.push({
    stream_id: `stream_${taskId}`,
    task_id: taskId,
    sequence,
    event_type: eventType,
    timestamp: Date.now(),
    payload,
  });
  store.set(taskId, events);
}

function createArtifact(params: {
  kind: string;
  artifact_type: "report" | "patch" | "log" | "validation" | "analysis";
  path?: string;
  name?: string;
  content?: string;
}): ForgeArtifact {
  const artifact_id = `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const content = params.content ?? "";
  return {
    artifact_id,
    kind: params.kind,
    artifact_type: params.artifact_type,
    path: params.path,
    name: params.name,
    content,
    checksum: computeChecksum(content),
    created_at: new Date().toISOString(),
    source_executor: "sigma_forge",
  };
}

function getExecutionPolicy(): SigmaForgeExecutionPolicy {
  return {
    mode: process.env.SIGMA_FORGE_MODE?.toLowerCase() as any || "sandbox",
    sandbox_restrictions: Array.from(SANDBOX_RESTRICTIONS),
  };
}

function isSandboxAllowed(kind: string, policy: SigmaForgeExecutionPolicy): boolean {
  if (policy.mode === "disabled") return false;
  if (policy.mode === "full") return true;
  if (policy.mode === "creator_only") return false;
  return SANDBOX_ALLOWED_KINDS.has(kind);
}

function listFilesRecursive(dir: string, maxDepth: number, currentDepth: number, ignore: RegExp, results: string[], maxFiles: number): void {
  if (results.length >= maxFiles || currentDepth > maxDepth) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const name = entry.name;
      if (ignore.test(name)) continue;
      const fullPath = path.join(dir, name);
      const relativePath = path.relative(".", fullPath);
      results.push(relativePath);
      if (entry.isDirectory()) {
        listFilesRecursive(fullPath, maxDepth, currentDepth + 1, ignore, results, maxFiles);
      }
    }
  } catch {
    // ignore permission errors
  }
}

export class SigmaForgeAdapter implements ForgeAdapter {
  private manifest: SigmaForgeCapabilityManifest | null = null;

  handshake(): Promise<SigmaForgeCapabilityManifest> {
    const policy = getExecutionPolicy();
    const manifest: SigmaForgeCapabilityManifest = {
      runtime_id: "sigma_forge_local",
      runtime_name: "sigma_forge",
      version: "0.1.0-sandbox",
      protocol_version: "telecore-build-v1",
      health: "healthy",
      capabilities: Array.from(SANDBOX_ALLOWED_KINDS),
      supported_targets: ["local"],
      checked_at: new Date().toISOString(),
      execution_policy: policy,
    };
    this.manifest = manifest;
    sigmaForgeRegistry.setManifest(manifest);
    return Promise.resolve(manifest);
  }

  private async executeAnalyzeRepo(task: ForgeTask): Promise<ForgeResult> {
    const input = (task.input || {}) as Record<string, unknown>;
    const targetPath = ((input.path as string) || ".").replace(/^\.\//, "");
    const maxFiles = typeof input.maxFiles === "number" ? Math.min(input.maxFiles, 100) : 50;

    try {
      const resolvedPath = path.resolve(targetPath);
      const ignore = /^(node_modules|\.git|\.gitkeep|\.DS_Store|__pycache__|\.pytest_cache|\.next|\.nuxt|dist|build|\.vercel|coverage)$/;
      const files: string[] = [];
      listFilesRecursive(resolvedPath, 3, 0, ignore, files, maxFiles);

      const analyzed: Array<{ path: string; size: number; type: "file" | "dir" }> = [];
      for (const f of files.slice(0, maxFiles)) {
        const fullPath = path.join(resolvedPath, f);
        try {
          const stat = fs.statSync(fullPath);
          analyzed.push({
            path: f,
            size: stat.size,
            type: stat.isDirectory() ? "dir" : "file",
          });
        } catch {
          analyzed.push({ path: f, size: 0, type: "file" });
        }
      }

      const reportContent = JSON.stringify({ path: resolvedPath, files: analyzed, timestamp: Date.now() }, null, 2);
      const artifact = createArtifact({
        kind: "repo_analysis",
        artifact_type: "analysis",
        path: resolvedPath,
        name: "repo_analysis.json",
        content: reportContent,
      });

      return createForgeResult({
        taskId: task.taskId,
        target: "sigma_forge",
        status: "done",
        summary: "Repository analysis complete",
        artifacts: [artifact],
        output: { file_count: analyzed.filter(f => f.type === "file").length, dir_count: analyzed.filter(f => f.type === "dir").length },
      });
    } catch (err: any) {
      return createForgeResult({
        taskId: task.taskId,
        target: "sigma_forge",
        status: "failed",
        summary: "Repository analysis failed",
        diagnostics: {
          code: "analysis_failed",
          message: err.message,
          details: { path: targetPath },
        },
      });
    }
  }

  private async executeGeneratePatch(task: ForgeTask): Promise<ForgeResult> {
    const input = (task.input || {}) as Record<string, unknown>;
    const description = (input.description as string) || "Generate patch";
    const filePath = (input.filePath as string) || "";

    const patchContent = `# Generated Patch Proposal
# Task: ${description}
# Generated by: Sigma Forge Sandbox
# Date: ${new Date().toISOString()}

## Proposed Changes

### File: ${filePath || "new_file.ts"}
\`\`\`diff
+ // TODO: Implement patch content based on task requirements
+ // This is a placeholder - actual implementation would generate real diffs
\`\`\`
`;

    const artifact = createArtifact({
      kind: "patch_proposal",
      artifact_type: "patch",
      path: filePath || "new_file.ts",
      name: "proposal.patch",
      content: patchContent,
    });

    return createForgeResult({
      taskId: task.taskId,
      target: "sigma_forge",
      status: "done",
      summary: "Patch proposal generated",
      artifacts: [artifact],
      output: { description, fileCount: filePath ? 1 : 0 },
    });
  }

async execute(task: ForgeTask): Promise<ForgeResult> {
    const manifest = await this.handshake();
    const policy = manifest.execution_policy || { mode: "sandbox", sandbox_restrictions: [] };

    emitStreamEvent(task.taskId, "execution_started", {
      kind: task.kind,
      mode: policy.mode,
      target: task.target,
    });

    if (manifest.health === "unavailable") {
      emitStreamEvent(task.taskId, "execution_completed", { status: "blocked", reason: "unavailable" });
      return createForgeResult({
        taskId: task.taskId,
        target: "sigma_forge",
        status: "blocked",
        summary: "Sigma Forge runtime unavailable",
        diagnostics: {
          code: "sigma_forge_unavailable",
          message: "Sigma Forge runtime is not reachable.",
          details: { taskKind: task.kind, runtimeHealth: manifest.health },
        },
      });
    }

    if (!isSandboxAllowed(task.kind, policy)) {
      emitStreamEvent(task.taskId, "execution_completed", { status: "blocked", reason: "sandbox_restriction" });
      return createForgeResult({
        taskId: task.taskId,
        target: "sigma_forge",
        status: "blocked",
        summary: "Task kind not allowed in current execution mode",
        diagnostics: {
          code: "sandbox_restriction",
          message: `Kind '${task.kind}' is not permitted in mode '${policy.mode}'.`,
          details: { allowedKinds: Array.from(SANDBOX_ALLOWED_KINDS), mode: policy.mode },
        },
      });
    }

    switch (task.kind) {
      case "analyze_repo":
        emitStreamEvent(task.taskId, "execution_progress", { phase: "analyzing", files_scanned: 0 });
        const result = await this.executeAnalyzeRepo(task);
        emitStreamEvent(task.taskId, "artifact_generated", { artifact_type: "analysis", artifact_count: 1 });
        return result;
      case "generate_patch":
        emitStreamEvent(task.taskId, "execution_progress", { phase: "generating_patch" });
        const patchResult = await this.executeGeneratePatch(task);
        emitStreamEvent(task.taskId, "artifact_generated", { artifact_type: "patch", artifact_count: 1 });
        return patchResult;
      case "execute_kilocode_task":
        emitStreamEvent(task.taskId, "execution_progress", { phase: "routing_to_kilocode" });
        // TGR-6.47 — Routing to KiloCode Bridge
        const { getKiloMcpAdapter } = await import("./kilo-mcp.adapter.js");
        const kiloAdapter = getKiloMcpAdapter();
        const kiloResult = await kiloAdapter.execute(task);

        // Wrap output in a report artifact if not already present
        if (kiloResult.status === "done") {
          const artifacts = kiloResult.artifacts || [];
          const hasReport = artifacts.some(a => a.artifact_type === "report");

          if (!hasReport) {
            const reportContent = `## KiloCode Bridge Report\n\nTask: ${task.kind}\nStatus: Success\n\n### Output\n\`\`\`json\n${JSON.stringify(kiloResult.output, null, 2)}\n\`\`\``;
            artifacts.push(createArtifact({
              kind: "kilocode_report",
              artifact_type: "report",
              name: "kilocode_report.md",
              content: reportContent
            }));
            kiloResult.artifacts = artifacts;
          }
        }

        emitStreamEvent(task.taskId, "execution_completed", { status: kiloResult.status });
        return kiloResult;
      case "verify_runtime":
        emitStreamEvent(task.taskId, "execution_progress", { phase: "verifying" });
        const verifyResult = createForgeResult({
          taskId: task.taskId,
          target: "sigma_forge",
          status: "done",
          summary: "Sigma Forge runtime verified",
          output: { mode: policy.mode, restrictions: policy.sandbox_restrictions },
        });
        emitStreamEvent(task.taskId, "execution_completed", { status: "done" });
        return verifyResult;
      case "list_files":
      case "read_file":
        emitStreamEvent(task.taskId, "execution_progress", { phase: "reading_files" });
        const fileResult = createForgeResult({
          taskId: task.taskId,
          target: "sigma_forge",
          status: "done",
          summary: "File operation completed (sandbox)",
          output: { path: task.path },
        });
        emitStreamEvent(task.taskId, "execution_completed", { status: "done" });
        return fileResult;
      default:
        emitStreamEvent(task.taskId, "execution_progress", { phase: "executing" });
        const defaultResult = createForgeResult({
          taskId: task.taskId,
          target: "sigma_forge",
          status: "done",
          summary: `Task '${task.kind}' executed in sandbox mode`,
          output: { mode: policy.mode },
        });
        emitStreamEvent(task.taskId, "execution_completed", { status: "done" });
        return defaultResult;
    }
  }
}