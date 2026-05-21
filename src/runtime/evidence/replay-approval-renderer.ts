import type { ReplayApprovalRequest } from "./replay-approval-queue.js";
import type {
  ReplayApprovalAction,
  ReplayApprovalActionPayload,
} from "./replay-approval-queue.js";
import { handleReplayApprovalAction } from "./replay-approval-queue.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";

export interface ReplayApprovalButton {
  label: string;
  action: ReplayApprovalAction;
  approval_id: string;
  callback_data: string;
  payload: ReplayApprovalActionPayload;
}

export interface ReplayApprovalRenderedMessage {
  text: string;
  buttons: ReplayApprovalButton[];
}

const BUTTON_DEFS: Array<{ label: string; action: ReplayApprovalAction }> = [
  { label: "Approve", action: "approve" },
  { label: "Deny", action: "deny" },
  { label: "Execute", action: "execute" },
  { label: "Notify again", action: "notify" },
];

export function renderReplayApprovalMessage(
  request: ReplayApprovalRequest,
): ReplayApprovalRenderedMessage {
  const text = [
    `Replay approval required`,
    ``,
    `approval_id: ${request.approval_id}`,
    `trace_id: ${request.trace_id}`,
    `reason: ${request.replay_reason || "-"}`,
    `requested_by: ${request.requested_by}`,
    `target_override: ${request.target_override || "-"}`,
    `force: ${request.force ? "yes" : "no"}`,
    `expires_at: ${request.expires_at || "-"}`,
  ].join("\n");

  const buttons: ReplayApprovalButton[] = BUTTON_DEFS.map((def) => ({
    label: def.label,
    action: def.action,
    approval_id: request.approval_id,
    callback_data: `replay:${def.action}:${request.approval_id}`,
    payload: {
      approval_id: request.approval_id,
      action: def.action,
    },
  }));

  return { text, buttons };
}

export async function renderAndEmitReplayApproval(
  request: ReplayApprovalRequest,
): Promise<ReplayApprovalRenderedMessage> {
  const rendered = renderReplayApprovalMessage(request);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(request.approval_id, "replay_approval_rendered"),
    trace_id: request.trace_id,
    job_id: request.approval_id,
    type: "replay_approval_rendered",
    timestamp: new Date().toISOString(),
    payload: {
      approval_id: request.approval_id,
      text: rendered.text,
      buttons: rendered.buttons.map((b) => ({
        label: b.label,
        action: b.action,
        callback_data: b.callback_data,
      })),
    },
  });

  return rendered;
}

export async function parseReplayApprovalAction(
  payload: ReplayApprovalActionPayload,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  return handleReplayApprovalAction(payload);
}
