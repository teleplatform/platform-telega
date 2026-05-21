import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

export interface CulturalMemoryEntry {
  entry_id: string;
  category: "incident" | "lesson" | "recovery_story" | "strategic_transition" | "epoch_shift";
  title: string;
  content: string;
  source_trace_id: string;
  created_at: string;
}

const CULTURAL_MEMORY: Map<string, CulturalMemoryEntry> = new Map();
let culturalCounter = 0;

export function writeCulturalMemory(
  category: CulturalMemoryEntry["category"],
  title: string,
  content: string,
  sourceTraceId: string,
): CulturalMemoryEntry {
  culturalCounter++;
  const entry: CulturalMemoryEntry = {
    entry_id: `cultural_${Date.now()}_${culturalCounter}`,
    category,
    title,
    content,
    source_trace_id: sourceTraceId,
    created_at: new Date().toISOString(),
  };

  CULTURAL_MEMORY.set(entry.entry_id, entry);

  appendEvidenceRecord({
    evidence_id: hashTraceId(entry.entry_id, "runtime_cultural_memory_written"),
    trace_id: entry.entry_id,
    job_id: "knowledge",
    type: "runtime_cultural_memory_written",
    timestamp: entry.created_at,
    payload: {
      entry_id: entry.entry_id,
      category,
      title,
      source_trace_id: sourceTraceId,
    },
  });

  return entry;
}

export function getCulturalMemory(entryId: string): CulturalMemoryEntry | null {
  return CULTURAL_MEMORY.get(entryId) || null;
}

export function getCulturalMemoryByCategory(category: CulturalMemoryEntry["category"]): CulturalMemoryEntry[] {
  return Array.from(CULTURAL_MEMORY.values()).filter((e) => e.category === category);
}

export function getAllCulturalMemory(): CulturalMemoryEntry[] {
  return Array.from(CULTURAL_MEMORY.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function autoRecordLessons(): number {
  const records = readEvidenceRecords();
  let recorded = 0;

  for (const r of records) {
    if (r.type === "incident_postmortem_created") {
      writeCulturalMemory("lesson", `Postmortem: ${r.trace_id}`, JSON.stringify(r.payload || {}), r.trace_id);
      recorded++;
    }
    if (r.type === "runtime_recovery_executed") {
      writeCulturalMemory("recovery_story", `Recovery: ${r.trace_id}`, JSON.stringify(r.payload || {}), r.trace_id);
      recorded++;
    }
    if (r.type === "epoch_state_changed") {
      writeCulturalMemory("epoch_shift", `Epoch change: ${r.trace_id}`, JSON.stringify(r.payload || {}), r.trace_id);
      recorded++;
    }
  }

  return recorded;
}
