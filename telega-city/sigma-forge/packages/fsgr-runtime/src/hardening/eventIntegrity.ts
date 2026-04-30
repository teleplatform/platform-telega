import type { LedgerEvent } from "../ledger/ledgerEvents.js";

export function validateEventSequence(events: LedgerEvent[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const eventTypes = events.map((e) => e.event_type as string);

  // run.created must exist
  if (!eventTypes.includes("run.created")) {
    errors.push("missing run.created event");
  }

  // plan.built must exist
  if (!eventTypes.includes("plan.built")) {
    errors.push("missing plan.built event");
  }

  // node.completed cannot come before node.started for same node
  const nodeStarted = new Set<string>();
  const nodeCompleted = new Set<string>();
  for (const event of events) {
    const eventType = event.event_type as string;
    if (eventType === "node.started" && event.node_id) {
      nodeStarted.add(event.node_id);
    }
    if (eventType === "node.completed" && event.node_id) {
      if (!nodeStarted.has(event.node_id)) {
        errors.push(`node.completed for ${event.node_id} without prior node.started`);
      }
      nodeCompleted.add(event.node_id);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function ensureRunLifecycleEvents(events: LedgerEvent[]): { ok: boolean; missing: string[] } {
  const required = ["run.created", "plan.built"];
  const eventTypes = events.map((e) => e.event_type as string);
  const missing = required.filter((r) => !eventTypes.includes(r));
  return { ok: missing.length === 0, missing };
}

export function ensureNodeLifecycleEvents(events: LedgerEvent[], node_id: string): { ok: boolean; missing: string[] } {
  const required = ["node.started", "node.completed"];
  const nodeEvents = events.filter((e) => e.node_id === node_id).map((e) => e.event_type as string);
  const missing = required.filter((r) => !nodeEvents.includes(r));
  return { ok: missing.length === 0, missing };
}
