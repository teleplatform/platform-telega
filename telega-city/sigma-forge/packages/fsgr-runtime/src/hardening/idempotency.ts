import type { LedgerEvent } from "../ledger/ledgerEvents.js";

export function isDuplicateEvent(events: LedgerEvent[], candidate: Omit<LedgerEvent, "event_id" | "created_at">): boolean {
  return events.some(
    (e) =>
      e.run_id === candidate.run_id &&
      e.node_id === candidate.node_id &&
      e.event_type === candidate.event_type &&
      JSON.stringify(e.payload) === JSON.stringify(candidate.payload)
  );
}

export function ensureIdempotentEventAppend(existingEvents: LedgerEvent[], candidate: Omit<LedgerEvent, "event_id" | "created_at">): { appended: boolean; reason: string } {
  if (isDuplicateEvent(existingEvents, candidate)) {
    return { appended: false, reason: "duplicate_event" };
  }
  return { appended: true, reason: "new_event" };
}
