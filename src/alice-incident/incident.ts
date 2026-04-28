// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Incident Record
//
// Builds first-class incident records.
// Incident is not "something broke" — it's a formal tracked event.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { AliceIncidentRecord } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildAliceIncidentRecord(input: {
  incidentId?: string;
  severity: AliceIncidentRecord["severity"];
  trigger: AliceIncidentRecord["trigger"];
  notes?: string[];
}): AliceIncidentRecord {
  return {
    incidentId: input.incidentId ?? crypto.randomUUID(),
    createdAt: nowIso(),
    status: "suspected",
    severity: input.severity,
    trigger: input.trigger,
    notes: input.notes,
  };
}

export function transitionIncidentStatus(
  record: AliceIncidentRecord,
  newStatus: AliceIncidentRecord["status"],
): AliceIncidentRecord {
  return {
    ...record,
    status: newStatus,
    notes: [...(record.notes ?? []), `Status transitioned to: ${newStatus}`],
  };
}
