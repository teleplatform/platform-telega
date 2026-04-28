// View layer — renders compact telemetry screens + inline keyboards
// All data is sourced from service layer; no direct file reads here

import {
  collectHomeSnapshot,
  collectHealthSnapshot,
  collectRecoverySnapshot,
  collectRuntimeSnapshot,
} from "./operator-telemetry.service.js";
import type { TelemetryScreen } from "./operator-telemetry.types.js";

function formatAge(seconds: number): string {
  if (seconds < 0) return "never";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    RUNNING: "✅",
    DEGRADED: "⚠️",
    STOPPED: "❌",
    UNKNOWN: "❓",
    CRITICAL: "🔥",
    ACTIVE: "🔒",
    CLEAR: "✅",
  };
  return map[status] || "•";
}

// ============================================
// HOME SCREEN
// ============================================

export function renderHomeScreen(snap: ReturnType<typeof collectHomeSnapshot>): string {
  let text = `🛡 Tele•GPT Ops — Home\n\n`;

  // Top-level status row
  text += `Bot: ${statusBadge(snap.botServiceStatus)} ${snap.botServiceStatus}\n`;
  text += `Watchdog: ${statusBadge(snap.watchdogStatus)} ${snap.watchdogStatus}\n`;
  text += `Lock: ${statusBadge(snap.lockState)} ${snap.lockState}\n\n`;

  // Quick metrics
  text += `📈 counters (recent 100):\n`;
  text += `  ✅ ${snap.counters.success}\n`;
  text += `  ⚠️ ${snap.counters.blocked}\n`;
  text += `  ❌ ${snap.counters.error}\n\n`;

  // Runtime details
  text += `🔧 runtime:\n`;
  text += `  Provider: ${snap.providerEffective}\n`;
  text += `  Bridge: ${snap.bridgeEnabled ? "ON" : "OFF"}\n`;
  text += `  Last success: ${formatAge(snap.lastSuccessAgeSec)}\n\n`;

  // Last activity
  text += `📋 last decision: ${snap.lastDecision.slice(0, 80)}\n`;
  text += `🚨 last critical: ${snap.lastCritical.slice(0, 80)}\n`;

  return text;
}

// ============================================
// HEALTH SCREEN
// ============================================

export function renderHealthScreen(snap: ReturnType<typeof collectHealthSnapshot>): string {
  let text = `📊 Health Metrics\n\n`;

  text += `Window: ${snap.windowMs / 1000}s\n`;
  text += `Total: ${snap.total}\n\n`;

  text += `✅ Success: ${snap.success} (${snap.successRate})\n`;
  text += `⚠️ Blocked: ${snap.blocked} (${snap.blockedRate})\n`;
  text += `❌ Errors: ${snap.error} (${snap.errorRate})\n`;
  if (snap.fallback > 0) text += `🔁 Fallback: ${snap.fallback}\n`;

  text += `\n📈 Trend: ${snap.trend}\n\n`;

  if (Object.keys(snap.providerStats).length > 0) {
    text += `🏷 Providers:\n`;
    for (const [p, s] of Object.entries(snap.providerStats)) {
      text += `  ${p}: ✅${s.success} ❌${s.error}\n`;
    }
  }

  return text;
}

// ============================================
// RECOVERY SCREEN
// ============================================

export function renderRecoveryScreen(snap: ReturnType<typeof collectRecoverySnapshot>): string {
  let text = `🔄 Recovery Decisions\n\n`;

  text += `Window: ${snap.windowMs / 60}s\n`;
  text += `Recoveries: ${snap.recoveryCountInWindow}/${snap.maxRecoveriesPerWindow}\n`;
  text += `Lock: ${statusBadge(snap.isLocked ? "ACTIVE" : "CLEAR")} ${snap.isLocked ? "ACTIVE" : "CLEAR"}\n\n`;

  if (snap.recentReceipts.length === 0) {
    text += `No recent recovery actions.\n`;
  } else {
    text += `Recent decisions:\n\n`;
    for (const r of snap.recentReceipts.slice(0, 8)) {
      const time = new Date(r.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      text += `${time} ${r.selectedAction.slice(0, 4)} — ${r.reason.slice(0, 65)}\n`;
    }
  }

  return text;
}

// ============================================
// RUNTIME SCREEN
// ============================================

export function renderRuntimeScreen(snap: ReturnType<typeof collectRuntimeSnapshot>): string {
  let text = `⚙️ Runtime Status\n\n`;

  text += `Bridge: ${snap.bridgeEnabled ? "ENABLED" : "DISABLED"}\n`;
  text += `Provider: ${snap.effectiveProvider}\n`;
  text += `Transport: ${snap.transport}\n`;
  text += `CDP: ${statusBadge(snap.cdpConnected ? "RUNNING" : "STOPPED")} ${snap.cdpConnected ? "connected" : "disconnected"}\n`;
  if (snap.cdpEndpoint) text += `  Endpoint: ${snap.cdpEndpoint}\n`;

  text += `\nUptime: ${formatAge(snap.uptimeSec)}\n`;

  if (snap.lastProviderError) {
    text += `\n🚨 Last error: ${snap.lastProviderError}\n`;
  }

  text += `\nForced provider: ${snap.forcedProvider || "none (auto)"}\n`;

  return text;
}

// ============================================
// NAVIGATION KEYBOARDS
// ============================================

export function buildMainKeyboard(currentScreen: TelemetryScreen) {
  const { Markup } = require("telegraf");

  const isHome = currentScreen === "HOME";
  const isHealth = currentScreen === "HEALTH";
  const isRecovery = currentScreen === "RECOVERY";
  const isRuntime = currentScreen === "RUNTIME";

  return Markup.keyboard([
    [isHome ? "🏠 Home" : "🏠 Home", isHealth ? "📊 Health" : "📊 Health"],
    [isRecovery ? "🔄 Recovery" : "🔄 Recovery", isRuntime ? "⚙️ Runtime" : "⚙️ Runtime"],
    ["🎬 Actions", "◀️ Back"],
  ]);
}

export function buildActionsKeyboard() {
  const { Markup } = require("telegraf");

  return Markup.keyboard([
    ["🔄 Refresh"],
    ["🔧 Operator Reset"],
    ["⚡ Soft Recover"],
    ["⌨️ Restart Watchdog"],
    ["🔁 Restart Bot"],
    ["◀️ Back"],
  ]);
}

// ============================================
// SCREEN RENDERER
// ============================================

export function renderScreen(screen: TelemetryScreen): string {
  switch (screen) {
    case "HOME":
      return renderHomeScreen(collectHomeSnapshot());
    case "HEALTH":
      return renderHealthScreen(collectHealthSnapshot());
    case "RECOVERY":
      return renderRecoveryScreen(collectRecoverySnapshot());
    case "RUNTIME":
      return renderRuntimeScreen(collectRuntimeSnapshot());
    default:
      return "Unknown screen";
  }
}
