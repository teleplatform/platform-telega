import { getMemory, setMemory, getMemoriesByCategory, memorySummary } from "./runtime-memory-store.js";

export interface OperationalRecord {
  action: string;
  timestamp: number;
  details: string;
}

export function recordOperation(action: string, details: string): void {
  const ops = getOperationalHistory();
  ops.push({ action, timestamp: Date.now(), details });
  if (ops.length > 100) {
    ops.splice(0, ops.length - 100);
  }
  setMemory("operational.history", ops, "operations", true);
}

export function getOperationalHistory(): OperationalRecord[] {
  const mem = getMemory("operational.history");
  return (mem?.value as OperationalRecord[]) || [];
}

export function recordSessionSummary(chatId: string, summary: string): void {
  setMemory(`session.${chatId}.summary`, summary, "sessions", true);
}

export function getSessionSummary(chatId: string): string | null {
  const mem = getMemory(`session.${chatId}.summary`);
  return (mem?.value as string) || null;
}

export function recordRuntimeEvent(event: string, data: string): void {
  const events = getRuntimeEvents();
  events.push({ action: event, timestamp: Date.now(), details: data });
  if (events.length > 50) {
    events.splice(0, events.length - 50);
  }
  setMemory("runtime.events", events, "runtime", true);
}

export function getRuntimeEvents(): OperationalRecord[] {
  const mem = getMemory("runtime.events");
  return (mem?.value as OperationalRecord[]) || [];
}

export function getOperationalSummary(): string {
  const ops = getOperationalHistory().slice(-5);
  const events = getRuntimeEvents().slice(-5);
  const lines: string[] = [];
  if (ops.length > 0) {
    lines.push("=== Recent Operations ===");
    ops.forEach(o => lines.push(`- ${o.action}: ${o.details}`));
  }
  if (events.length > 0) {
    lines.push("=== Runtime Events ===");
    events.forEach(e => lines.push(`- ${e.action}: ${e.details}`));
  }
  return lines.join("\n");
}
