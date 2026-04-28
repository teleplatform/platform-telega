// ─────────────────────────────────────────────────────────────
// SIGMA FORGE BRIDGE — UNIFIED CONTRACT
//
// ONE contract for all forge execution paths:
// - Kilo (temporary executor)
// - SigmaForge (future target executor)
//
// Principles:
// - ONE unified input/output contract
// - ZERO surface-owned execution logic
// - executor is replaceable without surface change
// ─────────────────────────────────────────────────────────────

export type ForgeTaskType = "code" | "ui" | "agent" | "analysis";

export interface ForgeTaskInput {
  task: string;
  context?: Record<string, unknown>;
}

export interface ForgeTaskContext {
  repo_root?: string;
  allow_paths?: string[];
  deny_paths?: string[];
  language?: string;
}

export interface ForgeTask {
  id: string;
  type: ForgeTaskType;
  input: ForgeTaskInput;
  context?: ForgeTaskContext;
  userId: string;
  sessionId?: string;
  sourceSurface?: "telegram" | "alice" | "web" | "api" | "bridge";
  mode?: "creator" | "safe";
}

export interface ForgeFileOutput {
  name: string;
  mimeType?: string;
  content?: string;
  path?: string;
}

export interface ForgeOutputs {
  text?: string;
  code?: string;
  files?: ForgeFileOutput[];
  logs?: string[];
}

export interface ForgeError {
  code: string;
  message: string;
  recoverable?: boolean;
}

export type ForgeStatus = "done" | "partial" | "blocked" | "error";

export interface ForgeResult {
  id: string;
  status: ForgeStatus;
  traceId: string;
  outputs?: ForgeOutputs;
  error?: ForgeError;
  durationMs?: number;
  executor: ForgeExecutor;
}

export type ForgeExecutor = "kilo" | "sigmaforge" | "unknown";

export interface ForgeBridge {
  provider: ForgeExecutor;
  execute(task: ForgeTask): Promise<ForgeResult>;
  health?: () => Promise<{ ok: boolean; error?: string }>;
}

export interface ForgeExecutionConfig {
  userId: string;
  sessionId?: string;
  surface: "telegram" | "alice" | "web" | "api" | "bridge";
  mode: "creator" | "safe";
  allowCode?: boolean;
  allowFileOps?: boolean;
  timeoutMs?: number;
}

export interface ForgeCapabilitySet {
  code_generation: boolean;
  file_operations: boolean;
  web_fetch: boolean;
  shell_access: boolean;
  diagnostics: boolean;
}

export const FORGE_CAPABILITIES_BY_ROLE: Record<string, ForgeCapabilitySet> = {
  owner_creator: {
    code_generation: true,
    file_operations: true,
    web_fetch: true,
    shell_access: true,
    diagnostics: true,
  },
  partner_creator: {
    code_generation: true,
    file_operations: false,
    web_fetch: false,
    shell_access: false,
    diagnostics: false,
  },
  public: {
    code_generation: false,
    file_operations: false,
    web_fetch: false,
    shell_access: false,
    diagnostics: false,
  },
};

export function createForgeTask(params: {
  type: ForgeTaskType;
  input: ForgeTaskInput;
  userId: string;
  surface: ForgeTask["sourceSurface"];
  mode?: "creator" | "safe";
  context?: ForgeTaskContext;
}): ForgeTask {
  return {
    id: `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: params.type,
    input: params.input,
    context: params.context,
    userId: params.userId,
    sourceSurface: params.surface,
    mode: params.mode,
  };
}

export function createForgeResult(params: {
  id: string;
  status: ForgeStatus;
  outputs?: ForgeOutputs;
  error?: ForgeError;
  executor: ForgeExecutor;
  durationMs?: number;
}): ForgeResult {
  return {
    id: params.id,
    status: params.status,
    traceId: `trace_${Date.now()}`,
    outputs: params.outputs,
    error: params.error,
    executor: params.executor,
    durationMs: params.durationMs,
  };
}