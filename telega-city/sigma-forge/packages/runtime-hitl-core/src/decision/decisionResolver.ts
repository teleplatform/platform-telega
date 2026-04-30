import type { HumanHandoffPacket } from "../../runtime-hitl-contracts/src/handoff.js";
import type { HumanDecision } from "../../runtime-hitl-contracts/src/decision.js";
import type { HandoffResolution } from "../../runtime-hitl-contracts/src/resolution.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export function resolveHumanDecision(packet: HumanHandoffPacket, decision: HumanDecision): HandoffResolution {
  let next_task_status: HandoffResolution["next_task_status"];
  let next_action: HandoffResolution["next_action"];
  const notes: string[] = [];

  switch (decision.action) {
    case "approve":
      next_task_status = "running";
      next_action = "resume";
      notes.push(decision.editor_notes ?? "Approved");
      break;
    case "edit":
      next_task_status = "running";
      next_action = "resume";
      notes.push(decision.editor_notes ?? "Edited");
      if (decision.replacement_output) notes.push("replacement_output attached");
      break;
    case "reject":
      next_task_status = "cancelled";
      next_action = "cancel";
      notes.push(decision.editor_notes ?? "Rejected");
      break;
    case "reroute":
      next_task_status = "planning";
      next_action = "reroute";
      notes.push(decision.editor_notes ?? `Reroute to ${decision.reroute_target}`);
      break;
    case "escalate":
      next_task_status = "waiting_human";
      next_action = "stay_waiting";
      notes.push(decision.editor_notes ?? "Escalated");
      break;
    case "takeover":
      next_task_status = "completed";
      next_action = "manual_takeover";
      notes.push(decision.editor_notes ?? "Manual takeover");
      break;
    default:
      next_task_status = "paused";
      next_action = "stay_waiting";
      notes.push("Unknown decision action");
  }

  return {
    resolution_id: `resolution_${randomUUID()}`,
    handoff_id: packet.handoff_id,
    task_id: decision.task_id,
    next_task_status,
    next_action,
    notes,
    created_at: nowIso(),
  };
}
