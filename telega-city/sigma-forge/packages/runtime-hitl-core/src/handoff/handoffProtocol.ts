import type { HumanHandoffPacket, HandoffReasonCode } from "../../runtime-hitl-contracts/src/handoff.js";
import type { HumanDecision, HumanDecisionAction } from "../../runtime-hitl-contracts/src/decision.js";
import type { HandoffResolution } from "../../runtime-hitl-contracts/src/resolution.js";
import { createHumanHandoffPacket } from "./handoffPacket.js";
export { createHumanHandoffPacket };
import { requiresHumanCheckpoint } from "./handoffReasons.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export interface HandoffContext {
  task_id: string;
  run_id?: string;
  node_id?: string;
  summary: string;
  completed_steps?: string[];
  blocked_reason?: string;
  recommended_action?: string;
  draft_output?: string;
  required_human_input?: string[];
  risk_flags?: string[];
  rejected_options?: string[];
  reason_code: HandoffReasonCode;
}

export interface HandoffResult {
  packet: HumanHandoffPacket;
  task_status_changed: boolean;
}

export function createHandoff(context: HandoffContext): HumanHandoffPacket {
  return createHumanHandoffPacket(context);
}

export function persistHandoff(packet: HumanHandoffPacket, storage: { saveHandoff: (p: HumanHandoffPacket) => void }): void {
  storage.saveHandoff(packet);
}

export function handoffTask(task: { status: string; task_id: string }, context: HandoffContext, transitionFn: (task: any, status: string) => boolean): HandoffResult {
  const packet = createHumanHandoffPacket(context);
  const task_status_changed = transitionFn(task, "waiting_human");
  return { packet, task_status_changed };
}

export function resolveHumanDecision(packet: HumanHandoffPacket, decision: HumanDecision): HandoffResolution {
  let next_task_status: HandoffResolution["next_task_status"];
  let next_action: HandoffResolution["next_action"];
  const notes: string[] = [];

  switch (decision.action) {
    case "approve":
      next_task_status = "running";
      next_action = "resume";
      notes.push(decision.editor_notes ?? "Approved by human");
      break;
    case "edit":
      next_task_status = "running";
      next_action = "resume";
      notes.push(decision.editor_notes ?? "Edited by human");
      if (decision.replacement_output) notes.push("replacement_output attached");
      break;
    case "reject":
      next_task_status = "cancelled";
      next_action = "cancel";
      notes.push(decision.editor_notes ?? "Rejected by human");
      break;
    case "reroute":
      next_task_status = "planning";
      next_action = "reroute";
      notes.push(decision.editor_notes ?? `Reroute to ${decision.reroute_target}`);
      break;
    case "escalate":
      next_task_status = "waiting_human";
      next_action = "stay_waiting";
      notes.push(decision.editor_notes ?? "Escalated to higher level");
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
