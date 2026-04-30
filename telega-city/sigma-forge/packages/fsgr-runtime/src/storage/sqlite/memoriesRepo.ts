import type Database from "better-sqlite3";
import type { MemoryRecord, MemoryQuery } from "../../fsgr-contracts/src/index.js";

function parseMemory(row: any): MemoryRecord {
  return {
    ...row,
    tags: JSON.parse(row.tags_json || "[]"),
  };
}

export function createMemoriesRepo(db: Database.Database) {
  return {
    saveMemory(record: MemoryRecord): void {
      db.prepare(
        `INSERT OR REPLACE INTO fsgr_memories (memory_id, layer, scope_key, record_key, title, content, tags_json, source_run_id, source_event_id, source_artifact_id, importance, created_at, updated_at)
         VALUES (@memory_id, @layer, @scope_key, @record_key, @title, @content, @tags_json, @source_run_id, @source_event_id, @source_artifact_id, @importance, @created_at, @updated_at)`
      ).run({
        memory_id: record.memory_id,
        layer: record.layer,
        scope_key: record.scope_key,
        record_key: record.record_key,
        title: record.title,
        content: record.content,
        tags_json: JSON.stringify(record.tags),
        source_run_id: record.source_run_id ?? null,
        source_event_id: record.source_event_id ?? null,
        source_artifact_id: record.source_artifact_id ?? null,
        importance: record.importance,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
    },

    getMemoryById(memory_id: string): MemoryRecord | null {
      const row = db.prepare("SELECT * FROM fsgr_memories WHERE memory_id = ?").get(memory_id);
      return row ? parseMemory(row) : null;
    },

    queryMemories(query: MemoryQuery): MemoryRecord[] {
      let sql = "SELECT * FROM fsgr_memories WHERE 1=1";
      const params: any[] = [];
      if (query.layer) { sql += " AND layer = ?"; params.push(query.layer); }
      if (query.scope_key) { sql += " AND scope_key = ?"; params.push(query.scope_key); }
      if (query.record_key) { sql += " AND record_key = ?"; params.push(query.record_key); }
      if (query.source_run_id) { sql += " AND source_run_id = ?"; params.push(query.source_run_id); }
      sql += " ORDER BY created_at DESC";
      if (query.limit) sql += " LIMIT ?"; params.push(query.limit);
      const rows = db.prepare(sql).all(...params);
      return rows.map(parseMemory);
    },

    upsertMemory(record: MemoryRecord): void {
      this.saveMemory(record);
    },

    listMemoriesByRun(run_id: string): MemoryRecord[] {
      const rows = db.prepare("SELECT * FROM fsgr_memories WHERE source_run_id = ? ORDER BY created_at DESC").all(run_id);
      return rows.map(parseMemory);
    },
  };
}
