// ─────────────────────────────────────────────────────────────
// FORGE EVIDENCE TELEGRAM v1
//
// Telegram-safe formatter for evidence views.
// Bounded length, no internal details leaked.
// ─────────────────────────────────────────────────────────────

import type {
  ForgeEvidenceListItem,
  ForgeEvidenceDetailView,
  ForgeEvidenceStatsView,
} from "./forge-evidence-views.js";

const MAX_TELEGRAM_LENGTH = 4000;
const MAX_LIST_ITEMS = 20;

function getStatusEmoji(status: string): string {
  switch (status) {
    case "done":
      return "✅";
    case "failed":
      return "❌";
    case "blocked":
      return "⛔";
    case "started":
      return "⏳";
    case "partial":
      return "⚠️";
    default:
      return "❓";
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("ru", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRecentEvidenceList(
  items: ForgeEvidenceListItem[],
): string {
  if (items.length === 0) {
    return "📭 Нет недавних вызовов.";
  }

  const limited = items.slice(0, MAX_LIST_ITEMS);
  const lines: string[] = ["🛠 Sigma Forge — Recent", ""];

  for (const item of limited) {
    const emoji = getStatusEmoji(item.status);
    const time = formatTime(item.startedAt);
    const line = `${emoji} ${item.status} | ${item.target} | ${item.kind} | ${item.taskId.slice(-6)}`;
    lines.push(line);
  }

  if (items.length > MAX_LIST_ITEMS) {
    lines.push(`\n... и ещё ${items.length - MAX_LIST_ITEMS}`);
  }

  return truncate(lines.join("\n"), MAX_TELEGRAM_LENGTH);
}

export function formatFailedEvidenceList(
  items: ForgeEvidenceListItem[],
): string {
  if (items.length === 0) {
    return "✅ Нет Failed вызовов.";
  }

  const limited = items.slice(0, MAX_LIST_ITEMS);
  const lines: string[] = ["❌ Sigma Forge — Failed", ""];

  for (const item of limited) {
    const time = formatTime(item.startedAt);
    const line = `❌ ${item.target} | ${item.kind} | ${item.summary.slice(0, 40)} | ${item.taskId.slice(-6)}`;
    lines.push(line);
  }

  return truncate(lines.join("\n"), MAX_TELEGRAM_LENGTH);
}

export function formatBlockedEvidenceList(
  items: ForgeEvidenceListItem[],
): string {
  if (items.length === 0) {
    return "✅ Нет Blocked вызовов.";
  }

  const limited = items.slice(0, MAX_LIST_ITEMS);
  const lines: string[] = ["⛔ Sigma Forge — Blocked", ""];

  for (const item of limited) {
    const line = `⛔ ${item.target} | ${item.kind} | ${item.taskId.slice(-6)}`;
    lines.push(line);
  }

  return truncate(lines.join("\n"), MAX_TELEGRAM_LENGTH);
}

export function formatEvidenceDetail(view: ForgeEvidenceDetailView): string {
  const emoji = getStatusEmoji(view.status);

  const lines: string[] = [
    `🧾 Forge Invocation`,
    "",
    `Status: ${emoji} ${view.status}`,
    `Target: ${view.target}`,
    `Kind: ${view.kind}`,
    `Task: ${view.taskId.slice(-12)}`,
    `Role: ${view.role}`,
    `Started: ${formatTime(view.startedAt)}`,
  ];

  if (view.finishedAt) {
    lines.push(`Finished: ${formatTime(view.finishedAt)}`);
  }

  lines.push("");
  lines.push(`Summary: ${view.summary}`);

  if (view.renderedText) {
    lines.push("");
    lines.push(`Result:`);
    lines.push(truncate(view.renderedText, 200));
  }

  if (view.blockedReason) {
    lines.push("");
    lines.push(`Reason: ${view.blockedReason}`);
  }

  if (view.errorCode) {
    lines.push("");
    lines.push(`Error: ${view.errorCode}`);
    if (view.errorMessage) {
      lines.push(truncate(view.errorMessage, 150));
    }
  }

  return truncate(lines.join("\n"), MAX_TELEGRAM_LENGTH);
}

export function formatEvidenceStats(view: ForgeEvidenceStatsView): string {
  const lines = [
    "📊 Sigma Forge Stats",
    "",
    `Total: ${view.total}`,
    `✅ Done: ${view.done}`,
    `❌ Failed: ${view.failed}`,
    `⛔ Blocked: ${view.blocked}`,
    `⏳ Started: ${view.started}`,
  ];

  return lines.join("\n");
}

export function formatEmptyEvidence(): string {
  return "📭 Нет данных для отображения.";
}

export function formatEvidenceNotFound(): string {
  return "🔍 Invocation не найден.";
}