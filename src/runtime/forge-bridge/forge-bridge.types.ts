// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE CIRCUIT — UNIFIED CONTRACT
//
// ONE contract for ALL forge execution paths:
// - forge_remote (ForgeClientZero)
// - kilo_mcp (Kilo Code MCP)
//
// Principles:
// - SINGLE source of truth
// - ZERO direct adapter calls from menu/handlers
// - ZERO surface-owned execution logic
// - executor is replaceable without surface change
// ─────────────────────────────────────────────────────────────

export type ForgeExecutionTarget = "forge_remote" | "kilo_mcp" | "sigma_forge" | "unknown";

export type SigmaForgeRuntimeHealth = "healthy" | "degraded" | "unavailable";

export interface SigmaForgeCapabilityManifest {
  runtime_id: string;
  runtime_name: "sigma_forge";
  version: string;
  protocol_version: "telecore-build-v1";
  health: SigmaForgeRuntimeHealth;
  capabilities: string[];
  supported_targets: string[];
  max_concurrent_tasks?: number;
  supports_streaming?: boolean;
  supports_artifacts?: boolean;
  checked_at: string;
}

export type ForgeTaskKind =
  | "create_file"
  | "read_file"
  | "update_file"
  | "delete_file"
  | "list_files"
  | "run_code"
  | "run_bridge_task"
  | "verify_runtime"
  | "open_project"
  | "generic";

export interface ForgeTask {
  taskId: string;
  userId: string;
  role: string;
  target: ForgeExecutionTarget;
  kind: ForgeTaskKind;
  projectId?: string;
  path?: string;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type ForgeResultStatus = "done" | "partial" | "blocked" | "failed";

export interface ForgeArtifact {
  kind: string;
  path?: string;
  name?: string;
  uri?: string;
  content?: string;
}

export interface ForgeDiagnostics {
  code: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ForgeResult {
  taskId: string;
  target: ForgeExecutionTarget;
  status: ForgeResultStatus;
  summary: string;
  output?: Record<string, unknown>;
  artifacts?: ForgeArtifact[];
  diagnostics?: ForgeDiagnostics;
  traceId?: string;
}

export interface ForgeAdapter {
  execute(task: ForgeTask): Promise<ForgeResult>;
}

export function createForgeTask(params: {
  taskId?: string;
  userId: string;
  role: string;
  target: ForgeExecutionTarget;
  kind: ForgeTaskKind;
  projectId?: string;
  path?: string;
  input?: Record<string, unknown>;
}): ForgeTask {
  return {
    taskId: params.taskId || `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: params.userId,
    role: params.role,
    target: params.target,
    kind: params.kind,
    projectId: params.projectId,
    path: params.path,
    input: params.input,
  };
}

export function createForgeResult(params: {
  taskId: string;
  target: ForgeExecutionTarget;
  status: ForgeResultStatus;
  summary: string;
  output?: Record<string, unknown>;
  artifacts?: ForgeArtifact[];
  diagnostics?: ForgeDiagnostics;
}): ForgeResult {
  return {
    taskId: params.taskId,
    target: params.target,
    status: params.status,
    summary: params.summary,
    output: params.output,
    artifacts: params.artifacts,
    diagnostics: params.diagnostics,
    traceId: `trace_${Date.now()}`,
  };
}

export function mapTaskKindToKiloTool(kind: ForgeTaskKind): string {
  const mapping: Record<ForgeTaskKind, string> = {
    create_file: "create_file",
    read_file: "read_file",
    update_file: "update_file",
    delete_file: "delete_file",
    list_files: "list_files",
    run_code: "execute_code",
    run_bridge_task: "run_bridge_task",
    verify_runtime: "verify_runtime",
    open_project: "open_project",
    generic: "generic_task",
  };
  return mapping[kind] || "generic_task";
}