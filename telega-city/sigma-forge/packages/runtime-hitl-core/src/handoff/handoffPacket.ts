import type { HumanHandoffPacket, HandoffReasonCode } from "../../runtime-hitl-contracts/src/handoff.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export function createHumanHandoffPacket(input: {
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
}): HumanHandoffPacket {
  if (!input.summary || input.summary.trim().length === 0) {
    throw new Error("Handoff packet requires a non-empty summary");
  }
  if (!input.reason_code) {
    throw new Error("Handoff packet requires a reason_code");
  }

  return {
    handoff_id: `handoff_${randomUUID()}`,
    task_id: input.task_id,
    run_id: input.run_id,
    node_id: input.node_id,
    summary: input.summary.trim(),
    completed_steps: input.completed_steps ?? [],
    blocked_reason: input.blocked_reason,
    recommended_action: input.recommended_action,
    draft_output: input.draft_output,
    required_human_input: input.required_human_input,
    risk_flags: input.risk_flags,
    rejected_options: input.rejected_options,
    reason_code: input.reason_code,
    created_at: nowIso(),
  };
}
