import type { TelegramRuntimeStatus } from "./telegram-status.types";

export function renderRuntimeStatusText(s: TelegramRuntimeStatus): string {
  return [
    "📡 Runtime Status",
    "",
    `Session Provider: ${s.forcedProvider || "auto"}`,
    `Effective Provider: ${s.effectiveProvider || "unknown"}`,
    `Bridge: ${s.bridge_enabled ? "ON" : "OFF"}`,
    `Mode: ${s.creatorMode ? "Creator" : "Normal"}`,
    `Voice: ${s.voice_enabled ? "ON" : "OFF"}`,
    `Last Fallback: ${s.lastFallback ? "YES" : "NO"}`,
    `Last Error: ${s.lastError || "none"}`,
    "",
    "Why:",
    s.lastWhy || "No runtime decision recorded yet",
  ].join("\n");
}
