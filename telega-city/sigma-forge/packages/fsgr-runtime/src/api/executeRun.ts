import type { FsgrRuntime } from "../runtime/initRuntime.js";
import { executeRun as executeRunInternal, type ExecutorContext } from "../execution/executor.js";

export async function executeFsgrRun(runtime: FsgrRuntime, runId: string, ctx?: ExecutorContext): Promise<{ status: string; completed: number; failed: number }> {
  const ledger = runtime.ledgerStore.getRun(runId);
  if (!ledger) throw new Error(`Run ${runId} not found`);
  if (ledger.status === "completed" || ledger.status === "failed") {
    return { status: ledger.status, completed: ledger.completed_node_ids.length, failed: ledger.failed_node_ids.length };
  }
  return executeRunInternal(runtime, runId, ctx);
}
