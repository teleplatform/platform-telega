import { runSystemSmoke } from "./smoke-test.js";
import { getProviderVerificationReport } from "./provider-verification.js";
import { getProviderStatus } from "../providers/creator/stability.js";
import fs from "fs/promises";
import path from "path";
import https from "https";
import http from "http";

const DATA_DIR = path.join(process.cwd(), "data");
const VALIDATION_DIR = path.join(DATA_DIR, "validation");
const DOCS_DIR = path.join(process.cwd(), "docs", "validation");
const LOG_FILE = path.join(DATA_DIR, "telegram", "watchdog.jsonl");

interface Alert {
  id: string;
  type: "INFO" | "WARN" | "CRITICAL";
  section: string;
  issue: string;
  suggested: string;
  timestamp: number;
  sent: boolean;
  suppressed: boolean;
}

interface WatchdogState {
  running: boolean;
  paused: boolean;
  lastCheck: number;
  lastAlert: number;
  alertsTriggered: number;
  alertsSent: number;
  lastAlertId: string | null;
  intervalIds: number[];
}

const state: WatchdogState = {
  running: false,
  paused: false,
  lastCheck: 0,
  lastAlert: 0,
  alertsTriggered: 0,
  alertsSent: 0,
  lastAlertId: null,
  intervalIds: [],
};

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
const ALERT_FILE = path.join(VALIDATION_DIR, "watchdog-alerts.jsonl");

interface QuickCheckResult {
  section: string;
  status: "PASS" | "WARN" | "FAIL";
  issue?: string;
}

async function httpGet(url: string): Promise<{ ok: boolean; status?: number }> {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      resolve({ ok: res.statusCode === 200, status: res.statusCode });
      req.destroy();
    });
    req.on("error", () => resolve({ ok: false }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ ok: false });
    });
  });
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function logEvidence(event: string, data: object): Promise<void> {
  await ensureDir(path.dirname(LOG_FILE));
  const line = JSON.stringify({ event, ...data, timestamp: Date.now() });
  await fs.appendFile(LOG_FILE, line + "\n");
}

async function quickSmoke(): Promise<QuickCheckResult[]> {
  const results: QuickCheckResult[] = [];

  try {
    const storage = await httpGet("http://127.0.0.1:8787/health");
    results.push({
      section: "Storage API",
      status: storage.ok ? "PASS" : "FAIL",
      issue: storage.ok ? undefined : "Not responding",
    });
  } catch {
    results.push({ section: "Storage API", status: "FAIL", issue: "Connection error" });
  }

  try {
    const bridge = await httpGet("http://127.0.0.1:8787/api/bridge");
    results.push({
      section: "Bridge",
      status: bridge.ok ? "PASS" : "FAIL",
      issue: bridge.ok ? undefined : "Not responding",
    });
  } catch {
    results.push({ section: "Bridge", status: "FAIL", issue: "Connection error" });
  }

  try {
    const forgeFile = path.join(DATA_DIR, "forge", "workflows.jsonl");
    const content = await fs.readFile(forgeFile, "utf-8").catch(() => "");
    const lines = content.trim().split("\n").filter(Boolean);
    const stalled = lines.filter((l) => l.includes("running") || l.includes("pending")).length;
    results.push({
      section: "Forge Workflows",
      status: stalled > 0 ? "WARN" : "PASS",
      issue: stalled > 0 ? `${stalled} stalled` : undefined,
    });
  } catch {
    results.push({ section: "Forge Workflows", status: "WARN", issue: "Cannot read" });
  }

  try {
    const pv = await getProviderVerificationReport();
    const minRate = Math.min(
      ...pv.results.map((r: any) => {
        const total = (r.successCount || 0) + (r.failCount || 0);
        return total > 0 ? (r.successCount || 0) / total : 1;
      })
    );
    results.push({
      section: "Provider Health",
      status: minRate < 0.3 ? "WARN" : "PASS",
      issue: minRate < 0.3 ? `Success rate ${minRate.toFixed(2)}` : undefined,
    });
  } catch {
    results.push({ section: "Provider Health", status: "WARN", issue: "Cannot read" });
  }

  try {
    const validationFiles = [
      path.join(DATA_DIR, "validation", "e2e-validation-v2.jsonl"),
      path.join(DATA_DIR, "validation", "provider-verification.jsonl"),
    ];
    let corrupt = 0;
    for (const f of validationFiles) {
      const content = await fs.readFile(f, "utf-8").catch(() => "");
      for (const line of content.trim().split("\n")) {
        if (line && !line.startsWith("{")) corrupt++;
      }
    }
    results.push({
      section: "Storage Integrity",
      status: corrupt > 0 ? "WARN" : "PASS",
      issue: corrupt > 0 ? `${corrupt} corrupt lines` : undefined,
    });
  } catch {
    results.push({ section: "Storage Integrity", status: "PASS" });
  }

  return results;
}

export async function checkWatchdog(): Promise<QuickCheckResult[]> {
  const results = await quickSmoke();
  state.lastCheck = Date.now();
  await logEvidence("watchdog_check_run", { results });
  return results;
}

export function getWatchdogState(): WatchdogState {
  return { ...state, intervalIds: [] };
}

export function isWatchdogRunning(): boolean {
  return state.running;
}

export function getWatchdogAlerts(): Promise<Alert[]> {
  return new Promise(async (resolve) => {
    try {
      const content = await fs.readFile(ALERT_FILE, "utf-8");
      const alerts = content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).reverse().slice(0, 20);
      resolve(alerts);
    } catch {
      resolve([]);
    }
  });
}

interface AlertCallbacks {
  sendAlert?: (alert: Alert) => Promise<void>;
}

let callbacks: AlertCallbacks = {};

export function setAlertCallback(fn: (alert: Alert) => Promise<void>): void {
  callbacks.sendAlert = fn;
}

function shouldSuppress(alert: Alert): boolean {
  if (!state.lastAlertId) return false;
  if (Date.now() - state.lastAlert < ALERT_COOLDOWN_MS) {
    return true;
  }
  return false;
}

export async function triggerAlert(
  type: Alert["type"],
  section: string,
  issue: string,
  suggested: string
): Promise<Alert | null> {
  const alert: Alert = {
    id: `alert-${Date.now()}`,
    type,
    section,
    issue,
    suggested,
    timestamp: Date.now(),
    sent: false,
    suppressed: false,
  };

  if (shouldSuppress(alert)) {
    alert.suppressed = true;
    await logEvidence("watchdog_alert_suppressed", alert);
    return null;
  }

  state.alertsTriggered++;
  state.lastAlert = Date.now();
  state.lastAlertId = alert.id;

  if (callbacks.sendAlert) {
    try {
      await callbacks.sendAlert(alert);
      alert.sent = true;
      state.alertsSent++;
    } catch (e) {
      console.error("[watchdog] send alert failed", e);
    }
  }

  await ensureDir(VALIDATION_DIR);
  await fs.appendFile(ALERT_FILE, JSON.stringify(alert) + "\n");
  await logEvidence("watchdog_alert_triggered", alert);

  return alert;
}

export async function startWatchdog(onAlert?: (alert: Alert) => Promise<void>): Promise<void> {
  if (state.running) return;
  if (onAlert) callbacks.sendAlert = onAlert;

  state.running = true;
  state.paused = false;
  await logEvidence("watchdog_started", { interval_ms: CHECK_INTERVAL_MS });
  console.log("[watchdog] Started");

  const interval = setInterval(async () => {
    if (state.paused) return;

    const checks = await quickSmoke();

    for (const check of checks) {
      if (check.status === "FAIL") {
        await triggerAlert("CRITICAL", check.section, check.issue || "Failed", `Check /${check.section.toLowerCase().replace(" ", "_")}`);
      } else if (check.status === "WARN") {
        await triggerAlert("WARN", check.section, check.issue || "Warning", `Check /runtime_status`);
      }
    }
  }, CHECK_INTERVAL_MS);

  state.intervalIds.push(Number(interval));
}

export async function stopWatchdog(): Promise<void> {
  for (const id of state.intervalIds) {
    clearInterval(id);
  }
  state.intervalIds = [];
  state.running = false;
  await logEvidence("watchdog_stopped", {});
  console.log("[watchdog] Stopped");
}

export async function pauseWatchdog(): Promise<void> {
  state.paused = true;
  await logEvidence("watchdog_paused", {});
}

export async function resumeWatchdog(): Promise<void> {
  state.paused = false;
  await logEvidence("watchdog_resumed", {});
}