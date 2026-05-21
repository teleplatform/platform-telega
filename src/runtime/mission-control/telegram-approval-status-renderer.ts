export type TelegramApprovalStatusView =
  | "pending"
  | "approved"
  | "denied"
  | "executed"
  | "expired"
  | "duplicate_blocked"
  | "unauthorized";

const STATUS_LABELS: Record<TelegramApprovalStatusView, string> = {
  pending: "⏳ Pending",
  approved: "✅ Approved",
  denied: "❌ Denied",
  executed: "▶ Executed",
  expired: "⏰ Expired",
  duplicate_blocked: "⚠ Duplicate callback ignored",
  unauthorized: "⛔ Unauthorized callback",
};

export function renderApprovalStatusText(status: TelegramApprovalStatusView, details?: string): string {
  let text = STATUS_LABELS[status];
  if (details) {
    text += `\n\n${details}`;
  }
  return text;
}

export function getStatusViewFromAction(
  action: string,
  success: boolean,
): TelegramApprovalStatusView {
  if (!success) {
    if (action === "execute") return "pending";
    return "denied";
  }
  if (action === "approve") return "approved";
  if (action === "deny") return "denied";
  if (action === "execute") return "executed";
  return "pending";
}
