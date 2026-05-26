// TODO(RD-2): implement stream store
import type { GroupEventType, GroupEventPayload } from "./task-group-types.js";

interface StreamEvent {
  event_type: GroupEventType;
  payload?: GroupEventPayload;
}

const streamEvents = new Map<string, StreamEvent[]>();

export function emitGroupEvent(groupId: string, event: GroupEventType, payload?: GroupEventPayload): void {
  const events = streamEvents.get(groupId) ?? [];
  events.push({ event_type: event, payload });
  streamEvents.set(groupId, events);
}

export function getTaskGroupStreamStore(): { getStreamEvents(groupId: string): StreamEvent[] } {
  return {
    getStreamEvents: (groupId: string) => streamEvents.get(groupId) ?? []
  };
}

export function resetTaskGroupStreamStore(): void {
  streamEvents.clear();
}