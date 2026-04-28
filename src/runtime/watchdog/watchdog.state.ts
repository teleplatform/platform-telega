import * as fs from "node:fs";
import * as path from "node:path";
import type { WatchdogState, RecoveryLevel, RecoveryConfig } from "./watchdog.types.js";
import { DEFAULT_RECOVERY_CONFIG } from "./watchdog.types.js";

const STATE_FILE = "/Users/vijaytaitoo/Projects/tele-gpt/telegram-bot.watchdog.json";
const LOCK_FILE = "/Users/vijaytaitoo/Projects/tele-gpt/.self-heal-lock";

function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const saved = JSON.parse(raw);
      state = { ...state, ...saved };
      console.log("[state] Loaded from disk");
    }
    if (fs.existsSync(LOCK_FILE)) {
      state.lockStateActive = true;
      state.lockStateSince = fs.statSync(LOCK_FILE).mtimeMs;
      console.log("[state] Lock state restored from lock file");
    }
  } catch {
    // ignore, use defaults
  }
}

function saveState(): void {
  try {
    const toSave = {
      lastRecovery: state.lastRecovery,
      recoveryCount: state.recoveryCount,
      lastLockClear: state.lastLockClear,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

let state: WatchdogState = {
  lastHeartbeat: Date.now(),
  lastSuccessfulReply: Date.now(),
  lastProviderSuccess: Date.now(),
  consecutiveFailures: 0,
  lastRecovery: 0,
  isDegraded: false,
  lockStateActive: false,
  lockStateSince: undefined,
  recoveryCount: 0,
  lastLockClear: 0,
};

// Load persisted state on startup
loadState();

export function getState(): WatchdogState {
  return state;
}

export function updateHeartbeat(): void {
  state.lastHeartbeat = Date.now();
}

export function updateReplySuccess(): void {
  state.lastSuccessfulReply = Date.now();
  state.consecutiveFailures = 0;
  state.isDegraded = false;
}

export function updateProviderSuccess(): void {
  state.lastProviderSuccess = Date.now();
}

export function incrementFailures(): void {
  state.consecutiveFailures++;
}

export function markDegraded(reason: string): void {
  state.isDegraded = true;
  state.degradationReason = reason;
}

export function recordRecovery(level: RecoveryLevel): void {
  state.lastRecovery = Date.now();
  state.recoveryCount++;
  saveState();
  console.log(`[watchdog] Recovery executed: ${level} at ${new Date().toISOString()} (count: ${state.recoveryCount})`);
}

export function getRecoveryCount(): number {
  return state.recoveryCount;
}

export function incrementRecoveryCount(): void {
  state.recoveryCount++;
  saveState();
}

export function setLockState(active: boolean): void {
  state.lockStateActive = active;
  state.lockStateSince = active ? Date.now() : undefined;
  if (active) {
    try {
      fs.writeFileSync(LOCK_FILE, `locked at ${new Date().toISOString()}\n`, "utf-8");
    } catch {}
  } else {
    state.lastLockClear = Date.now();
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {}
  }
  saveState();
}

export function isLockStateActiveBoolean(): boolean {
  return state.lockStateActive;
}

export function clearLockState(): void {
  setLockState(false);
  console.log("[watchdog] Lock state cleared");
}

export function getLockDuration(): number {
  if (state.lockStateSince) {
    return Date.now() - state.lockStateSince;
  }
  return 0;
}

export function shouldRecover(config = DEFAULT_RECOVERY_CONFIG): boolean {
  const now = Date.now();

  if (state.lastRecovery > 0 && now - state.lastRecovery < config.cooldownMs) {
    return false;
  }

  const silenceMs = now - state.lastSuccessfulReply;
  const failuresOk = state.consecutiveFailures >= config.maxConsecutiveFailures;

  return silenceMs > config.maxSilenceMs || failuresOk;
}

export function getDegradationStatus(config = DEFAULT_RECOVERY_CONFIG): { level: RecoveryLevel; reason: string } | null {
  const now = Date.now();
  const silenceMs = now - state.lastSuccessfulReply;

  if (silenceMs > config.maxSilenceMs) {
    return { level: "hard", reason: `No reply for ${Math.round(silenceMs / 1000)}s` };
  }

  if (state.consecutiveFailures >= config.maxConsecutiveFailures) {
    return { level: "medium", reason: `${state.consecutiveFailures} consecutive failures` };
  }

  if (state.isDegraded) {
    return { level: "soft", reason: state.degradationReason || "bridge degraded" };
  }

  return null;
}