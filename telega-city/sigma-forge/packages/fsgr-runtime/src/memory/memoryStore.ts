import type { MemoryRecord, MemoryQuery } from "../../fsgr-contracts/src/index.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export interface MemoriesRepoLike {
  saveMemory(record: MemoryRecord): void;
  getMemoryById(memory_id: string): MemoryRecord | null;
  queryMemories(query: MemoryQuery): MemoryRecord[];
  upsertMemory(record: MemoryRecord): void;
  listMemoriesByRun(run_id: string): MemoryRecord[];
}

export function createMemoryStore(deps: { memoriesRepo: MemoriesRepoLike }) {
  const { memoriesRepo } = deps;

  return {
    writeMemory(record: MemoryRecord): void {
      memoriesRepo.saveMemory(record);
    },

    readMemory(query: MemoryQuery): MemoryRecord[] {
      return memoriesRepo.queryMemories(query);
    },

    writeEvidenceMemory(record: MemoryRecord): void {
      if (record.layer !== "evidence") {
        throw new Error("writeEvidenceMemory requires layer='evidence'");
      }
      memoriesRepo.saveMemory(record);
    },

    readRunMemories(run_id: string): MemoryRecord[] {
      return memoriesRepo.listMemoriesByRun(run_id);
    },

    readWorkspaceMemories(workspace_id: string): MemoryRecord[] {
      return memoriesRepo.queryMemories({ scope_key: `workspace:${workspace_id}` });
    },

    makeMemoryId(): string {
      return `mem_${randomUUID()}`;
    },

    createMemoryRecord(params: Omit<MemoryRecord, "memory_id" | "created_at" | "updated_at">): MemoryRecord {
      const now = nowIso();
      return {
        ...params,
        memory_id: this.makeMemoryId(),
        created_at: now,
        updated_at: now,
      };
    },
  };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;
