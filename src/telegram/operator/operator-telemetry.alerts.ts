import { collectHomeSnapshot } from "./operator-telemetry.service.js";
import { renderHomeScreen } from "./operator-telemetry.view.js";

const ALERT_COOLDOWN_FILE = ".telemetry-alert-lock";
const ALERT_COOLDOWN_MS = 300_000; // 5 min cooldown between alerts

let lastAlertLevel: "none" | "degraded" | "critical" = "none";

function getLastAlertLevel(): "none" | "degraded" | "critical" {
  const fs = require("fs");
  try {
    const content = fs.readFileSync(ALERT_COOLDOWN_FILE, "utf-8").trim();
    const lines = content.split("\n");
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      const data = JSON.parse(lastLine);
      return data.level;
    }
  } catch {}
  return "none";
}

function canSendAlert(): boolean {
  const fs = require("fs");
  try {
    const content = fs.readFileSync(ALERT_COOLDOWN_FILE, "utf-8").trim();
    const lines = content.split("\n");
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      const data = JSON.parse(lastLine);
      const timeSince = Date.now() - data.timestamp;
      return timeSince > ALERT_COOLDOWN_MS;
    }
  } catch {}
  return true;
}

function markAlertSent(level: "degraded" | "critical"): void {
  const fs = require("fs");
  const entry = JSON.stringify({ timestamp: Date.now(), level }) + "\n";
  fs.appendFileSync(ALERT_COOLDOWN_FILE, entry, "utf-8");
  lastAlertLevel = level;
}

export function checkAndAlert(): { shouldAlert: boolean; level: "none" | "degraded" | "critical"; message?: string } {
  const snap = collectHomeSnapshot();
  const lastSuccessSec = snap.lastSuccessAgeSec;

  // Thresholds
  const DEGRADED_THRESHOLD = 120; // 2 min
  const CRITICAL_THRESHOLD = 300; // 5 min

  let level: "none" | "degraded" | "critical" = "none";
  let reason = "";

  // Check drift
  if (lastSuccessSec >= CRITICAL_THRESHOLD) {
    level = "critical";
    reason = `No successful replies for ${Math.floor(lastSuccessSec / 60)}m+`;
  } else if (lastSuccessSec >= DEGRADED_THRESHOLD) {
    level = "degraded";
    reason = `No successful replies for ${Math.floor(lastSuccessSec)}s`;
  }

  // Already sent for this level?
  const currentAlertLevel = getLastAlertLevel();
  if (level !== "none" && level === currentAlertLevel) {
    return { shouldAlert: false, level: "none" };
  }

  if (level !== "none" && canSendAlert()) {
    return {
      shouldAlert: true,
      level,
      message: `🚨 Tele•GPT Alert\n\nStatus: ${level === "critical" ? "🔥 CRITICAL" : "⚠️ DEGRADED"}\nReason: ${reason}\n\nProvider: ${snap.providerEffective}\nBridge: ${snap.bridgeEnabled ? "ON" : "OFF"}\nCDP: ${snap.botServiceStatus === "RUNNING" ? "connected" : "disconnected"}\n\nAction: awaiting recovery / operator check`,
    };
  }

  return { shouldAlert: false, level: "none" };
}

export function markAlertDelivered(level: "degraded" | "critical"): void {
  markAlertSent(level);
  lastAlertLevel = level;
}