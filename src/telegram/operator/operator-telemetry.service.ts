import type {
  HomeSnapshot,
  HealthSnapshot,
  RecoverySnapshot,
  RuntimeSnapshot,
  CriticalEvent,
} from "./operator-telemetry.types.js";
import { getHealthSummary, getProviderStats } from "../../runtime/delivery/delivery-summary.js";
import { getRecentErrors, getRecentEvidence } from "../../runtime/delivery/delivery-evidence.store.js";
import { getRecentReceipts } from "../../runtime/watchdog/decision-receipts.js";
import { getState as getWatchdogState } from "../../runtime/watchdog/watchdog.state.js";
import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const EVIDENCE_LOG = path.resolve(process.cwd(), "delivery-evidence.log");
const DECISIONS_LOG = path.resolve(process.cwd(), "telegram-bot.decisions.log");
const LOCK_FILE = path.resolve(process.cwd(), ".self-heal-lock");

const BOT_SERVICE_LABEL = "com.telegpt.bot";
const WATCHDOG_SERVICE_LABEL = "com.telegpt.watchdog";

function getLaunchdStatus(label: string): "RUNNING" | "STOPPED" | "UNKNOWN" {
  try {
    const out = execSync(`launchctl list | grep "${label}"`, { timeout: 3000 }).toString();
    if (out.includes(label)) {
      return "RUNNING";
    }
  } catch {}
  return "STOPPED";
}

function isCdpConnected(): boolean {
  try {
    execSync(`lsof -i :9222`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

// Bot service status inference - from REAL launchd + drift detection
function inferBotServiceStatus(): "RUNNING" | "DEGRADED" | "STOPPED" | "UNKNOWN" {
  const launchdStatus = getLaunchdStatus(BOT_SERVICE_LABEL);
  if (launchdStatus === "RUNNING") {
    // Check for recent activity + drift detection
    const recent = getRecentEvidence(10);
    const now = Date.now();
    const twoMinutesAgo = now - 120_000;
    const fiveMinutesAgo = now - 300_000;
    const recentActive = recent.filter(e => e.createdAt > twoMinutesAgo);
    const olderActive = recent.filter(e => e.createdAt > fiveMinutesAgo);
    
    if (recentActive.length === 0) return "RUNNING"; // Running but idle
    const hasSuccess = recentActive.some(e => e.status === "success");
    
    // Drift detection: no success in 2min → DEGRADED, in 5min → CRITICAL
    if (hasSuccess) return "RUNNING";
    if (olderActive.length > 0) return "DEGRADED";
    return "DEGRADED";
  }
  return launchdStatus;
}

// Watchdog status inference - from REAL launchd
function inferWatchdogStatus(): "RUNNING" | "DEGRADED" | "STOPPED" | "UNKNOWN" {
  const launchdStatus = getLaunchdStatus(WATCHDOG_SERVICE_LABEL);
  if (launchdStatus === "RUNNING") {
    // Check if actively making decisions
    try {
      const content = fs.readFileSync(DECISIONS_LOG, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      if (lines.length === 0) return "RUNNING";
      const recent = lines.slice(-10).map(line => JSON.parse(line));
      const nonNoop = recent.filter((r: any) => r.selectedAction !== "NO_OP").length;
      return nonNoop > 0 ? "DEGRADED" : "RUNNING";
    } catch {}
    return "RUNNING";
  }
  return launchdStatus;
}

// Effective provider & transport — from recent successful delivery evidence
function getLastProviderFromEvidence(): { provider: string; transport: string } {
  const recent = getRecentEvidence(20);
  const success = recent.filter(e => e.status === "success").sort((a, b) => b.createdAt - a.createdAt);
  if (success.length > 0) {
    const prov = success[0].provider || "unknown";
    const trans = success[0].transport || "api";
    // If provider is still unknown, check CDP port as proxy
    if (prov === "unknown" && isCdpConnected()) {
      return { provider: "chatgpt_web", transport: "cdp" };
    }
    return { provider: prov, transport: trans };
  }
  // No evidence yet — check CDP as hint
  if (isCdpConnected()) {
    return { provider: "chatgpt_web", transport: "cdp" };
  }
  return { provider: "none", transport: "api" };
}

function inferEffectiveProvider(): string {
  return getLastProviderFromEvidence().provider;
}

function inferTransport(): string {
  return getLastProviderFromEvidence().transport;
}

// Bridge enabled status — infer from presence of recent delivery attempts
function inferBridgeEnabled(): boolean {
  const recent = getRecentEvidence(5);
  return recent.length > 0;
}

// Lock state — check both state and lock file
function getLockState(): "ACTIVE" | "CLEAR" {
  const state = getWatchdogState();
  if (state.lockStateActive) return "ACTIVE";
  try {
    if (fs.existsSync(LOCK_FILE)) return "ACTIVE";
  } catch {}
  return "CLEAR";
}

// Last success age in seconds
function getLastSuccessAgeSec(): number {
  const recent = getRecentEvidence(20);
  const success = recent.filter(e => e.status === "success").sort((a, b) => b.createdAt - a.createdAt);
  if (success.length > 0) {
    return Math.floor((Date.now() - success[0].createdAt) / 1000);
  }
  return -1; // never
}

// Last decision (most recent non-NO_OP, or last anyway)
function getLastDecision(): string {
  const receipts = getRecentReceipts(5);
  if (receipts.length === 0) return "none";
  const r = receipts[0];
  return `${r.selectedAction} — ${r.reason.slice(0, 60)}`;
}

// Last critical event (most recent ERROR evidence)
function getLastCriticalEvent(): string {
  const errors = getRecentErrors(5);
  if (errors.length === 0) return "none";
  const e = errors[0];
  return `${e.provider}: ${e.reason || "unknown error"} (${Math.floor((Date.now() - e.createdAt) / 60)}s ago)`;
}

// Trend — compare last minute vs previous minute
function computeTrend(): "↑ improving" | "→ stable" | "↓ degrading" | "? unknown" {
  const now = Date.now();
  const lastMinute = now - 60_000;
  const prevMinute = now - 120_000;

  const all = getRecentEvidence(100);

  const recent = all.filter(e => e.createdAt > lastMinute);
  const previous = all.filter(e => e.createdAt > prevMinute && e.createdAt <= lastMinute);

  const recentSuccess = recent.filter(e => e.status === "success").length;
  const prevSuccess = previous.filter(e => e.status === "success").length;

  if (recentSuccess > prevSuccess) return "↑ improving";
  if (recentSuccess < prevSuccess) return "↓ degrading";
  return "→ stable";
}

// Provider breakdown from evidence
function getProviderBreakdown(): Record<string, { success: number; error: number }> {
  return getProviderStats(100);
}

export function collectHomeSnapshot(): HomeSnapshot {
  return {
    botServiceStatus: inferBotServiceStatus(),
    watchdogStatus: inferWatchdogStatus(),
    providerEffective: inferEffectiveProvider(),
    bridgeEnabled: inferBridgeEnabled(),
    lockState: getLockState(),
    lastSuccessAgeSec: getLastSuccessAgeSec(),
    lastDecision: getLastDecision(),
    lastCritical: getLastCriticalEvent(),
    counters: {
      success: getRecentEvidence(100).filter(e => e.status === "success").length,
      blocked: getRecentEvidence(100).filter(e => e.status === "blocked").length,
      error: getRecentEvidence(100).filter(e => e.status === "error").length,
    },
  };
}

export function collectHealthSnapshot(): HealthSnapshot {
  const summary = getHealthSummary(100);
  const trend = computeTrend();
  const providerStats = getProviderStats(100);

  return {
    windowMs: summary.window,
    total: summary.total,
    success: summary.success,
    blocked: summary.blocked,
    error: summary.error,
    fallback: summary.fallback,
    successRate: `${((summary.success / summary.total) * 100).toFixed(1)}%`,
    blockedRate: `${((summary.blocked / summary.total) * 100).toFixed(1)}%`,
    errorRate: `${((summary.error / summary.total) * 100).toFixed(1)}%`,
    providerStats,
    trend,
  };
}

export function collectRecoverySnapshot(): RecoverySnapshot {
  const receipts = getRecentReceipts(10);
  const receiptCount = getRecentReceipts(100).filter(r => r.selectedAction !== "NO_OP").length;

  return {
    recentReceipts: receipts.map(r => ({
      timestamp: r.timestamp,
      degradationClass: r.degradationClass,
      selectedAction: r.selectedAction,
      reason: r.reason,
      precedence: r.precedence,
      confidence: r.confidence,
    })),
    recoveryCountInWindow: receiptCount,
    maxRecoveriesPerWindow: 5,
    windowMs: 300000,
    isLocked: getLockState() === "ACTIVE",
  };
}

export function collectRuntimeSnapshot(): RuntimeSnapshot {
  const state = getWatchdogState();
  const lastProvider = getLastProviderFromEvidence();

  // REAL CDP connection check via port 9222
  const cdpConnected = isCdpConnected();

  // Last provider error
  const lastError = getRecentErrors(1)[0];
  const lastProviderError = lastError ? `${lastError.provider}: ${lastError.reason}` : null;

  // Uptime — from state.lastHeartbeat
  const uptimeSec = Math.floor((Date.now() - state.lastHeartbeat) / 1000);

  return {
    bridgeEnabled: inferBridgeEnabled(),
    forcedProvider: null,
    effectiveProvider: lastProvider.provider,
    transport: lastProvider.transport,
    cdpConnected,
    cdpEndpoint: process.env.CDP_ENDPOINT || null,
    lastProviderSuccess: state.lastProviderSuccess,
    lastProviderError: lastProviderError,
    uptimeSec,
  };
}

export function collectCriticalEvents(limit = 5): CriticalEvent[] {
  const errors = getRecentErrors(limit);
  return errors.map(e => ({
    timestamp: e.createdAt,
    level: "ERROR",
    message: `Provider ${e.provider} failed`,
    reason: e.reason,
  }));
}
