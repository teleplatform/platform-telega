import type { FsgrRuntime } from "../runtime/initRuntime.js";
import { getRunMemoryContext } from "../memory/memoryReaders.js";
import { makeRunScopeKey } from "../memory/memoryKeys.js";

export function getFsgrRunMemory(runtime: FsgrRuntime, run_id: string) {
  return getRunMemoryContext(runtime.memoryStore, run_id);
}
