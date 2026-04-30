import type { RunLedger } from "../../../fsgr-contracts/src/index.js";
import type { FsgrRuntime } from "../runtime/initRuntime.js";

export function getFsgrRun(runtime: FsgrRuntime, runId: string): RunLedger | null {
  return runtime.ledgerStore.getRun(runId);
}
