import type { ReplayApprovalAction } from "./replay-approval-queue.js";
import { handleReplayApprovalAction } from "./replay-approval-queue.js";
import { appendEvidenceRecord } from "./execution-evidence-store.js";
import { hashTraceId } from "./execution-hash.js";

const CALLBACK_PREFIX = "replay:";

export interface MissionControlCallbackPayload {
  source: "telegram";
  actor_id?: string;
  actor_username?: string;
  chat_id?: string | number;
  message_id?: string | number;
  callback_data: string;
  received_at: string;
}

export interface ParsedReplayCallback {
  action: ReplayApprovalAction;
  approval_id: string;
  raw: string;
}

export function parseReplayCallback(callbackData: string): ParsedReplayCallback | null {
  if (!callbackData.startsWith(CALLBACK_PREFIX)) {
    return null;
  }

  const rest = callbackData.slice(CALLBACK_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length < 2) return null;

  const [actionStr, ...idParts] = parts;
  const approval_id = idParts.join(":");

  const VALID_ACTIONS: ReplayApprovalAction[] = ["approve", "deny", "execute", "notify"];
  if (!VALID_ACTIONS.includes(actionStr as ReplayApprovalAction)) {
    return null;
  }

  if (!approval_id) return null;

  return {
    action: actionStr as ReplayApprovalAction,
    approval_id,
    raw: callbackData,
  };
}

export async function handleReplayCallback(
  payload: MissionControlCallbackPayload,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const parsed = parseReplayCallback(payload.callback_data);
  if (!parsed) {
    return { ok: false, error: `invalid callback_data: ${payload.callback_data}` };
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId(parsed.approval_id, "replay_approval_callback_received"),
    trace_id: parsed.approval_id,
    job_id: parsed.approval_id,
    type: "replay_approval_callback_received",
    timestamp: new Date().toISOString(),
    payload: {
      source: payload.source,
      actor_id: payload.actor_id,
      actor_username: payload.actor_username,
      message_id: payload.message_id,
      callback_data: payload.callback_data,
      parsed_action: parsed.action,
      parsed_approval_id: parsed.approval_id,
    },
  });

  return handleReplayApprovalAction({
    approval_id: parsed.approval_id,
    action: parsed.action,
    actor: payload.actor_username || payload.actor_id || "telegram",
  });
}
