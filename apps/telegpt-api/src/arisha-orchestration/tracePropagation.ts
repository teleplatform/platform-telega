import type { ArishaOrchestrationState } from "./types.js";

export function getTraceId(state: ArishaOrchestrationState): string {
  return state.trace_id;
}

export function logWithTrace(stage: string, traceId: string, message: string): void {
  console.log(`[${traceId}] ${stage}: ${message}`);
}
