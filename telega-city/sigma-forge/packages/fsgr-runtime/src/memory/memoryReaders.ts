import type { MemoryRecord, MemoryQuery } from "../../fsgr-contracts/src/index.js";
import type { MemoryStore } from "./memoryStore.js";
import { makeRunScopeKey, makeWorkspaceScopeKey, makeOperatorScopeKey, makeCanonScopeKey } from "./memoryKeys.js";
import { getLayerPriority } from "./layers.js";

export function getRunMemoryContext(memoryStore: MemoryStore, run_id: string): MemoryRecord[] {
  return memoryStore.readMemory({ scope_key: makeRunScopeKey(run_id) });
}

export function getWorkspaceMemoryContext(memoryStore: MemoryStore, workspace_id: string): MemoryRecord[] {
  return memoryStore.readMemory({ scope_key: makeWorkspaceScopeKey(workspace_id) });
}

export function getOperatorMemoryContext(memoryStore: MemoryStore, actor_id: string): MemoryRecord[] {
  return memoryStore.readMemory({ scope_key: makeOperatorScopeKey(actor_id) });
}

export function getCanonMemoryContext(memoryStore: MemoryStore, domain?: string): MemoryRecord[] {
  return memoryStore.readMemory({ scope_key: makeCanonScopeKey(domain) });
}

export function getSortedMemoryContext(memories: MemoryRecord[]): MemoryRecord[] {
  return [...memories].sort((a, b) => getLayerPriority(a.layer) - getLayerPriority(b.layer));
}
