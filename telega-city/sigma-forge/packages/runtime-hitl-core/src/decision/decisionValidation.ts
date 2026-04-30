import type { HumanHandoffPacket } from "../../runtime-hitl-contracts/src/handoff.js";
import type { HumanDecision } from "../../runtime-hitl-contracts/src/decision.js";

export function validateHumanDecision(packet: HumanHandoffPacket, decision: HumanDecision): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (decision.action === "edit" && !decision.replacement_output) {
    errors.push("edit action requires replacement_output");
  }
  if (decision.action === "reroute" && !decision.reroute_target) {
    errors.push("reroute action requires reroute_target");
  }
  if (decision.action === "escalate" && !decision.editor_notes) {
    errors.push("escalate action requires editor_notes");
  }

  return { valid: errors.length === 0, errors };
}
