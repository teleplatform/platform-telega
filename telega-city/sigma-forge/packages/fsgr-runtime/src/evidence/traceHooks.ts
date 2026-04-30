import type { LedgerEvent } from "../ledger/ledgerEvents.js";
import { randomUUID } from "crypto";

const traceEvents: LedgerEvent[] = [];

export function emitTraceEvent(runId: string, eventType: string, payload: Record<string, unknown>): void {
  traceEvents.push({
    event_id: `trace_${randomUUID()}`,
    run_id: runId,
    event_type: eventType as any,
    payload,
    created_at: new Date().toISOString(),
  });
}

export function getTraceEvents(runId: string): LedgerEvent[] {
  return traceEvents.filter((e) => e.run_id === runId);
}

export function getAllTraceEvents(): LedgerEvent[] {
  return [...traceEvents];
}

export function clearTraceEvents(): void {
  traceEvents.length = 0;
}
