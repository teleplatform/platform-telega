import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons, type CanonEntry } from "./strategic-canon-registry.js";
import { getConstitutionState } from "../constitution/runtime-constitution.js";

export interface CanonConflict {
  conflict_id: string;
  canon_id: string;
  canon_title: string;
  conflicting_rule: string;
  conflict_type: "constitution" | "ethics" | "policy" | "existing_canon" | "governance" | "recovery";
  description: string;
  detected_at: string;
}

let conflictCounter = 0;

export function detectCanonConflicts(canon: CanonEntry): CanonConflict[] {
  const conflicts: CanonConflict[] = [];
  conflictCounter++;

  const constitution = getConstitutionState();
  for (const rule of constitution.rules_active) {
    const canonLower = canon.description.toLowerCase();
    const ruleLower = rule.description.toLowerCase();
    if (canonLower.includes("override") && ruleLower.includes("creator_sovereignty")) {
      conflicts.push({
        conflict_id: `cf_${Date.now()}_${conflictCounter}`,
        canon_id: canon.canon_id,
        canon_title: canon.title,
        conflicting_rule: rule.rule_id,
        conflict_type: "constitution",
        description: `Canon may conflict with constitution rule: ${rule.description}`,
        detected_at: new Date().toISOString(),
      });
    }
  }

  const activeCanons = getActiveCanons();
  for (const existing of activeCanons) {
    if (existing.canon_id === canon.canon_id) continue;
    if (existing.category === canon.category && existing.title.toLowerCase() === canon.title.toLowerCase()) {
      conflicts.push({
        conflict_id: `cf_${Date.now()}_${conflictCounter}`,
        canon_id: canon.canon_id,
        canon_title: canon.title,
        conflicting_rule: existing.canon_id,
        conflict_type: "existing_canon",
        description: `Duplicate canon in category ${canon.category}: "${existing.title}" already exists`,
        detected_at: new Date().toISOString(),
      });
    }
  }

  for (const c of conflicts) {
    appendEvidenceRecord({
      evidence_id: hashTraceId(c.conflict_id, "canon_conflict_detected"),
      trace_id: c.conflict_id,
      job_id: "knowledge",
      type: "canon_conflict_detected",
      timestamp: c.detected_at,
      payload: {
        conflict_id: c.conflict_id,
        canon_id: canon.canon_id,
        conflict_type: c.conflict_type,
        description: c.description,
      },
    });
  }

  return conflicts;
}
