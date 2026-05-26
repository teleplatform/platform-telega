// TODO(RD-2): implement executor router
import type { ForgeExecutionTarget } from "./forge-bridge.types.js";

export function getExecutorRouter(): { resolveExecutor: (task: { taskId: string; target?: string; kind: string; userId?: string; path?: string; input?: Record<string, unknown> }) => { target: ForgeExecutionTarget } } | null {
  return null;
}
export function initExecutorRouter(_config?: {
  sigmaForgeRegistry?: unknown;
  kiloMcpAvailable?: boolean;
  forgeRemoteAvailable?: boolean;
  defaultMode?: "sandbox" | "creator_only" | "full";
}): void {}

export type ForgeTask = {
  taskId: string;
  target?: string;
  kind: string;
  userId?: string;
  path?: string;
  input?: Record<string, unknown>;
};