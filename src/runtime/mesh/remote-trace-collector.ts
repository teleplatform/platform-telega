import type { TraceEvent } from './mesh-replay-types.js';

const remoteTraces = new Map<string, TraceEvent[]>();

export interface RemoteTraceCollectionRequest {
  nodeId: string;
  traceId: string;
  events: TraceEvent[];
  evidenceId?: string;
  contractId?: string;
}

export interface RemoteTraceCollectionResult {
  traceId: string;
  nodeId: string;
  eventsCollected: number;
  success: boolean;
  error?: string;
}

export function collectRemoteTraces(
  request: RemoteTraceCollectionRequest
): RemoteTraceCollectionResult {
  const { traceId, nodeId, events } = request;

  if (!events || events.length === 0) {
    return {
      traceId,
      nodeId,
      eventsCollected: 0,
      success: false,
      error: 'No events provided',
    };
  }

  const existing = remoteTraces.get(traceId) || [];
  const newEvents = events.filter(
    e => !existing.some(existingEvent => existingEvent.eventId === e.eventId)
  );

  remoteTraces.set(traceId, [...existing, ...newEvents]);

  return {
    traceId,
    nodeId,
    eventsCollected: newEvents.length,
    success: true,
  };
}

export function getRemoteTraces(traceId: string): TraceEvent[] {
  return remoteTraces.get(traceId) || [];
}

export function getAllCollectedTraces(): Map<string, TraceEvent[]> {
  return new Map(remoteTraces);
}

export function clearRemoteTraces(traceId?: string): void {
  if (traceId) {
    remoteTraces.delete(traceId);
  } else {
    remoteTraces.clear();
  }
}

export function getTracesByEvidence(evidenceId: string): TraceEvent[] {
  const result: TraceEvent[] = [];
  for (const events of remoteTraces.values()) {
    result.push(...events.filter(e => e.payload?.evidenceId === evidenceId));
  }
  return result;
}
