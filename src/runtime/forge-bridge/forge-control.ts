import type { ForgeControlAction } from "./forge-control.types.js";
import type { ForgeControlResult } from "./forge-control.types.js";
import type { ForgeControlEvent } from "./forge-control.types.js";
import { assertForgeControlAllowed } from "./forge-control-policy.js";

export async function runForgeControl(
  userId: string,
  role: string,
  action: ForgeControlAction,
): Promise<ForgeControlResult> {
  assertForgeControlAllowed(role);
  return executeForgeControl(action, userId, role);
}

export async function executeForgeControl(
  action: ForgeControlAction,
  userId: string,
  role: string,
): Promise<ForgeControlResult> {
  // TODO(RD-2): replace temporary runtime governance type narrowing
  const actionType = (action as any).type;
  switch (actionType) {
    case "retry": return handleRetry(action, userId, role);
    case "rerun": return handleRerun(action, userId, role);
    case "cancel": return handleCancel(action, userId, role);
    case "mark_reviewed": return handleMarkReviewed(action, userId, role);
    case "attach_note": return handleAttachNote(action, userId, role);
    default: return { ok: false, action: actionType as string, summary: "Unknown control action" };
  }
}

async function handleRetry(action: ForgeControlAction, userId: string, role: string): Promise<ForgeControlResult> {
  return { ok: true, action: "retry", summary: "Retry started", newInvocationId: `inv_${Date.now()}_retry` };
}

async function handleRerun(action: ForgeControlAction, userId: string, role: string): Promise<ForgeControlResult> {
  return { ok: true, action: "rerun", summary: "Rerun started", newInvocationId: `inv_${Date.now()}_rerun` };
}

async function handleCancel(action: ForgeControlAction, userId: string, role: string): Promise<ForgeControlResult> {
  return { ok: true, action: "cancel", summary: "Cancelled" };
}

async function handleMarkReviewed(action: ForgeControlAction, userId: string, role: string): Promise<ForgeControlResult> {
  return { ok: true, action: "mark_reviewed", summary: "Marked as reviewed" };
}

async function handleAttachNote(action: ForgeControlAction, userId: string, role: string): Promise<ForgeControlResult> {
  // TODO(RD-2): replace temporary runtime governance type narrowing
  return { ok: true, action: "attach_note", summary: "Note attached" };
}
