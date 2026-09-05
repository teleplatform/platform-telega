import { applyMemoryRetentionPolicy, classifyMemoryPrivacy, classifyMemoryRetention } from "./memory-retention-policy.js";
import type { MemoryPrivacyLevel, MemoryRetentionClass } from "./memory-retention-policy.js";
import { setMemory, getMemory, deleteMemory, getAllMemories } from "./runtime-memory-store.js";

export type MemoryStoreBackend = "runtime_jsonl" | "postgres" | "supabase" | "memory";

export interface MemoryStoreRecord {
  id: string;
  created_at: number;
  updated_at: number;
  type: string;
  category: string;
  user_id?: string;
  project?: string;
  task_id?: string;
  privacy: MemoryPrivacyLevel;
  retention: MemoryRetentionClass;
  expires_at?: number;
  text: string;
  data?: unknown;
  evidence_ref?: string[];
  full_text_ref?: string;
  collapse_ref?: string;
  verified?: boolean;
}

export interface MemoryStoreQuery {
  user_id?: string;
  project?: string;
  task_id?: string;
  type?: string;
  category?: string;
  privacy?: MemoryPrivacyLevel;
  retention?: MemoryRetentionClass;
  created_after?: number;
}

export interface MemoryStoreWriteResult {
  ok: boolean;
  id: string;
  reason?: string;
  expires_at?: number;
}

export interface MemoryStoreAdapter {
  writeMemoryRecord(record: MemoryStoreRecord): Promise<MemoryStoreWriteResult>;
  readMemoryRecord(id: string): Promise<MemoryStoreRecord | undefined>;
  queryMemoryRecords(query: MemoryStoreQuery): Promise<MemoryStoreRecord[]>;
  updateMemoryRecord(id: string, patch: Partial<MemoryStoreRecord>): Promise<MemoryStoreWriteResult>;
  deleteExpiredMemoryRecords(now: number): Promise<number>;
  appendEvidenceLinkedRecord(record: MemoryStoreRecord, evidence_ref: string): Promise<MemoryStoreWriteResult>;
}

export interface MemoryStoreAdapterConfig {
  backend?: MemoryStoreBackend;
}

export function createMemoryStoreAdapter(config: MemoryStoreAdapterConfig = {}): MemoryStoreAdapter {
  const backend = config.backend ?? "runtime_jsonl";

  if (backend === "postgres" || backend === "supabase" || backend === "memory") {
    return {
      async writeMemoryRecord() { throw new Error("not_implemented"); },
      async readMemoryRecord() { throw new Error("not_implemented"); },
      async queryMemoryRecords() { throw new Error("not_implemented"); },
      async updateMemoryRecord() { throw new Error("not_implemented"); },
      async deleteExpiredMemoryRecords() { throw new Error("not_implemented"); },
      async appendEvidenceLinkedRecord() { throw new Error("not_implemented"); },
    };
  }

  return {
    async writeMemoryRecord(record: MemoryStoreRecord): Promise<MemoryStoreWriteResult> {
      const policyInput = {
        key: record.id,
        category: record.category,
        type: record.type,
        text: record.text,
        value: record.data,
        verified: record.verified,
        created_at: record.created_at,
        expires_at: record.expires_at,
      };

      const decision = applyMemoryRetentionPolicy(policyInput, Date.now());

      if (!decision.allow_store) {
        return { ok: false, id: record.id, reason: decision.reason || "policy_blocked" };
      }

      const storedRecord: MemoryStoreRecord = {
        ...record,
        text: decision.redacted_text,
        data: decision.sanitized_value ?? record.data,
        privacy: decision.privacy,
        retention: decision.retention,
        expires_at: decision.expires_at ?? record.expires_at,
      };

      setMemory(record.id, storedRecord, record.category, record.verified ?? true);

      return {
        ok: true,
        id: record.id,
        expires_at: storedRecord.expires_at,
      };
    },

    async readMemoryRecord(id: string): Promise<MemoryStoreRecord | undefined> {
      const mem = getMemory(id);
      if (!mem) return undefined;
      return mem.value as MemoryStoreRecord;
    },

    async queryMemoryRecords(query: MemoryStoreQuery): Promise<MemoryStoreRecord[]> {
      const all = getAllMemories();
      const records = all.map(m => m.value as MemoryStoreRecord).filter(r => r != null && r.id != null);

      return records.filter(r => {
        if (query.user_id && r.user_id !== query.user_id) return false;
        if (query.project && r.project !== query.project) return false;
        if (query.task_id && r.task_id !== query.task_id) return false;
        if (query.type && r.type !== query.type) return false;
        if (query.category && r.category !== query.category) return false;
        if (query.privacy && r.privacy !== query.privacy) return false;
        if (query.retention && r.retention !== query.retention) return false;
        if (query.created_after && r.created_at < query.created_after) return false;
        return true;
      });
    },

    async updateMemoryRecord(id: string, patch: Partial<MemoryStoreRecord>): Promise<MemoryStoreWriteResult> {
      const existing = await this.readMemoryRecord(id);
      if (!existing) return { ok: false, id, reason: "not_found" };

      const merged: MemoryStoreRecord = { ...existing, ...patch, updated_at: Date.now() };
      return this.writeMemoryRecord(merged);
    },

    async deleteExpiredMemoryRecords(now: number): Promise<number> {
      const all = getAllMemories();
      let deleted = 0;
      for (const m of all) {
        const record = m.value as MemoryStoreRecord;
        if (record && record.expires_at != null && record.expires_at <= now) {
          deleteMemory(record.id);
          deleteMemory(m.key); // Ensure key from setMemory is also used just in case
          deleted++;
        }
      }
      return deleted;
    },

    async appendEvidenceLinkedRecord(record: MemoryStoreRecord, evidence_ref: string): Promise<MemoryStoreWriteResult> {
      const refs = record.evidence_ref || [];
      if (!refs.includes(evidence_ref)) {
        refs.push(evidence_ref);
      }
      const newRec = { ...record, evidence_ref: refs };
      return this.writeMemoryRecord(newRec);
    }
  };
}

let defaultAdapter: MemoryStoreAdapter;

function getAdapter(): MemoryStoreAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createMemoryStoreAdapter({ backend: "runtime_jsonl" });
  }
  return defaultAdapter;
}

export async function writeMemoryRecord(record: MemoryStoreRecord): Promise<MemoryStoreWriteResult> {
  return getAdapter().writeMemoryRecord(record);
}

export async function readMemoryRecord(id: string): Promise<MemoryStoreRecord | undefined> {
  return getAdapter().readMemoryRecord(id);
}

export async function queryMemoryRecords(query: MemoryStoreQuery): Promise<MemoryStoreRecord[]> {
  return getAdapter().queryMemoryRecords(query);
}

export async function updateMemoryRecord(id: string, patch: Partial<MemoryStoreRecord>): Promise<MemoryStoreWriteResult> {
  return getAdapter().updateMemoryRecord(id, patch);
}

export async function deleteExpiredMemoryRecords(now: number): Promise<number> {
  return getAdapter().deleteExpiredMemoryRecords(now);
}

export async function appendEvidenceLinkedRecord(record: MemoryStoreRecord, evidence_ref: string): Promise<MemoryStoreWriteResult> {
  return getAdapter().appendEvidenceLinkedRecord(record, evidence_ref);
}
