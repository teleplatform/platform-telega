import type { ForgeAdapter, ForgeTask, ForgeResult } from "../forge-bridge.types.js";
import { createForgeResult } from "../forge-bridge.types.js";

export class SigmaForgeAdapter implements ForgeAdapter {
  async execute(task: ForgeTask): Promise<ForgeResult> {
    return createForgeResult({
      taskId: task.taskId,
      target: "sigma_forge",
      status: "blocked",
      summary: "Sigma Forge executor not yet available",
      diagnostics: {
        code: "sigma_forge_not_ready",
        message: "Sigma Forge adapter is stubbed. Enable when executor is ready.",
        details: { taskKind: task.kind, taskTarget: task.target },
      },
    });
  }
}