import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { writeCivilizationMemory } from "../civilization/civilization-memory.js";

export interface ConsolidationResult {
  consolidation_id: string;
  started_at: string;
  completed_at: string;
  short_term_scanned: number;
  promoted_to_long_term: number;
  archived: number;
}

let consolidationCounter = 0;

export async function consolidateMemory(): Promise<ConsolidationResult> {
  consolidationCounter++;
  const startTime = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`cons_${consolidationCounter}`, "memory_consolidation_started"),
    trace_id: `cons_${consolidationCounter}`,
    job_id: "knowledge",
    type: "memory_consolidation_started",
    timestamp: startTime,
    payload: { consolidation_id: consolidationCounter },
  });

  const records = readEvidenceRecords();
  let promoted = 0;
  let archived = 0;

  const canonTypes = ["strategic_signal_detected", "runtime_self_correction_proposal_created",
    "runtime_disaster_detected", "runtime_recovery_executed", "incident_postmortem_created",
    "runtime_belief_revised", "runtime_claim_verified"];

  for (const r of records) {
    if (canonTypes.includes(r.type)) {
      writeCivilizationMemory(
        "strategic",
        "pattern",
        `${r.type} — ${r.trace_id}`,
        JSON.stringify(r.payload || {}),
        [r.type, "consolidated"],
        r.trace_id,
      );
      promoted++;
    } else if (r.timestamp < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) {
      archived++;
    }
  }

  const result: ConsolidationResult = {
    consolidation_id: `cons_${Date.now()}_${consolidationCounter}`,
    started_at: startTime,
    completed_at: new Date().toISOString(),
    short_term_scanned: records.length,
    promoted_to_long_term: promoted,
    archived,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(result.consolidation_id, "memory_consolidation_completed"),
    trace_id: result.consolidation_id,
    job_id: "knowledge",
    type: "memory_consolidation_completed",
    timestamp: result.completed_at,
    payload: { scanned: result.short_term_scanned, promoted, archived },
  });

  return result;
}
