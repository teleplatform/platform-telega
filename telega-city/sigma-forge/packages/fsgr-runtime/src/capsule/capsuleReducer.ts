import type { ContextCapsule } from "../../../fsgr-contracts/src/index.js";
import type { LedgerEvent } from "../ledger/ledgerEvents.js";

export function reduceCapsule(
  capsule: ContextCapsule,
  newEvents: LedgerEvent[]
): ContextCapsule {
  const updated = { ...capsule };

  for (const event of newEvents) {
    if (event.event_type === "node.completed") {
      const nodeTitle = (event.payload.title as string) ?? event.node_id;
      if (nodeTitle && !updated.completed_milestones.includes(nodeTitle)) {
        updated.completed_milestones.push(nodeTitle);
      }
    }
    if (event.event_type === "node.failed") {
      const risk = `Node ${event.node_id} failed: ${JSON.stringify(event.payload).substring(0, 80)}`;
      if (!updated.open_risks.includes(risk)) {
        updated.open_risks.push(risk);
      }
    }
    if (event.event_type.includes("retry") || event.event_type.includes("fallback")) {
      updated.last_decisions.push({
        kind: event.event_type,
        summary: JSON.stringify(event.payload).substring(0, 100),
        at: event.created_at,
      });
    }
  }

  updated.last_decisions = updated.last_decisions.slice(-10);
  updated.updated_at = new Date().toISOString();

  return updated;
}
