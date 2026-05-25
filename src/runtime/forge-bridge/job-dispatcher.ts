import type { BuildTask, BuildResult } from "../../types/telecore.js";
import { getForgeBridge } from "./forge-bridge.js";
import type { ForgeTaskKind } from "./forge-bridge.types.js";

export interface DispatchedBuildResult {
  summary: BuildResult["summary"];
  execution?: {
    trace_id?: string;
    duration_ms?: number;
  };
  diagnostics?: { error?: string; [k: string]: unknown };
  executor?: { target?: string; id?: string };
}

function mapToForgeParams(task: BuildTask) {
  const taskId = (task as any).task_id || task.meta?.task_id || `task_${Date.now()}`;
  const rawKind = (task as any).execution?.kind || (task as any).kind || "run_bridge_task";
  const safeKinds = ["create_file","read_file","update_file","delete_file","list_files","run_code","run_bridge_task","verify_runtime","open_project","generic","analyze_repo","generate_patch"] as const;
  const kind = (safeKinds as readonly string[]).includes(rawKind) ? rawKind : "run_bridge_task";
  const target = (task as any).execution?.target;
  const path = (task as any).execution?.path;
  const input = (task as any).execution?.input || { prompt: task.goal?.title };
  const userId = (task as any).context?.user_id || (task as any).context?.creator_id || (task as any).meta?.user_id || "creator";
  return { taskId, kind, target, path, input, userId };
}

export async function dispatchBuildTask(
  task: BuildTask,
  traceId: string,
): Promise<DispatchedBuildResult> {
  const { taskId, kind, target, path, input, userId } = mapToForgeParams(task);
  const start = Date.now();
  const executorTarget = target || "auto";
  const executorId = target === "kilo" || !target ? "kilo_mcp" : target === "sigma_forge" ? "sigma_forge" : "forge_http";

  try {
    const bridge = getForgeBridge();
    const result = await bridge.run({ userId, kind: kind as ForgeTaskKind, target, path, input });
    const duration_ms = Date.now() - start;
    return {
      summary: {
        status: (result as any).status || "done",
        task_id: taskId,
        mode_used: task.meta?.mode || "smart",
        iterations_used: 1,
      },
      execution: { trace_id: traceId, duration_ms },
      executor: { target: executorTarget, id: executorId },
    };
  } catch (err: any) {
    return {
      summary: {
        status: "failed",
        task_id: taskId,
        mode_used: task.meta?.mode || "smart",
        iterations_used: 0,
      },
      execution: { trace_id: traceId, duration_ms: Date.now() - start },
      diagnostics: { error: String(err) },
      executor: { target: executorTarget, id: executorId },
    };
  }
}
