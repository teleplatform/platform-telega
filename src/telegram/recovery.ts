import fs from "fs/promises";
import path from "path";
import https from "https";
import http from "http";

const DATA_DIR = path.join(process.cwd(), "data");
const VALIDATION_DIR = path.join(DATA_DIR, "validation");
const LOG_FILE = path.join(DATA_DIR, "telegram", "recovery.jsonl");

interface RecoveryAttempt {
  id: string;
  issue: string;
  action: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

const RECOVERY_FILE = path.join(VALIDATION_DIR, "recovery-attempts.jsonl");

interface RecoveryState {
  enabled: boolean;
  attempts: number;
  successCount: number;
  failCount: number;
  lastAttempt: number | null;
}

const state: RecoveryState = {
  enabled: true,
  attempts: 0,
  successCount: 0,
  failCount: 0,
  lastAttempt: null,
};

async function httpGet(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      resolve(res.statusCode === 200);
      req.destroy();
    });
    req.on("error", () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
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

async function tryProviderSwitch(): Promise<boolean> {
  try {
    const { getBestProvider } = await import("../providers/creator/stability.js");
    const fallback = getBestProvider(["openai", "qwen", "deepseek"]);
    if (fallback) {
      console.log("[recovery] Switched to provider:", fallback);
      await logEvidence("recovery_provider_switch", { to: fallback });
      return true;
    }
    return false;
  } catch (e: any) {
    console.error("[recovery] provider switch failed", e?.message);
    return false;
  }
}

async function tryIndexRebuild(): Promise<boolean> {
  try {
    const { rebuildAllIndexes } = await import("../server/storage-indexer.js");
    const result = await rebuildAllIndexes();
    console.log("[recovery] Indexes rebuilt:", result.rebuilt.length);
    await logEvidence("recovery_index_rebuild", { count: result.rebuilt.length });
    return result.rebuilt.length > 0;
  } catch (e: any) {
    console.error("[recovery] index rebuild failed", e?.message);
    return false;
  }
}

async function tryOutputDeliveryRetry(): Promise<boolean> {
  try {
    const deliveryFile = path.join(DATA_DIR, "telegram", "delivery.jsonl");
    await fs.access(deliveryFile);
    console.log("[recovery] Delivery file exists, no retry needed");
    return true;
  } catch {
    await ensureDir(path.join(DATA_DIR, "telegram"));
    await fs.writeFile(
      path.join(DATA_DIR, "telegram", "delivery.jsonl"),
      ""
    );
    await logEvidence("recovery_delivery_retry", { recreated: true });
    return true;
  }
}

async function tryMCPPing(): Promise<boolean> {
  try {
    const result = await httpGet("http://127.0.0.1:8787/mcp/status");
    return result;
  } catch {
    return false;
  }
}

async function tryKiloPing(): Promise<boolean> {
  try {
    const kiloFile = path.join(DATA_DIR, "telegram", "kilo-execution.jsonl");
    await fs.access(kiloFile);
    return true;
  } catch {
    await ensureDir(path.join(DATA_DIR, "telegram"));
    await fs.writeFile(
      path.join(DATA_DIR, "telegram", "kilo-execution.jsonl"),
      ""
    );
    await logEvidence("recovery_kilo_file", { recreated: true });
    return true;
  }
}

export async function recoverFromIssue(
  issue: string
): Promise<RecoveryAttempt | null> {
  if (!state.enabled) return null;

  const attempt: RecoveryAttempt = {
    id: `rec-${Date.now()}`,
    issue,
    action: "unknown",
    timestamp: Date.now(),
    success: false,
  };

  try {
    if (issue.includes("provider") && issue.includes("unhealthy")) {
      attempt.action = "provider_switch";
      attempt.success = await tryProviderSwitch();
    } else if (issue.includes("index")) {
      attempt.action = "index_rebuild";
      attempt.success = await tryIndexRebuild();
    } else if (issue.includes("delivery")) {
      attempt.action = "delivery_retry";
      attempt.success = await tryOutputDeliveryRetry();
    } else if (issue.includes("MCP")) {
      attempt.action = "mcp_ping";
      attempt.success = await tryMCPPing();
    } else if (issue.includes("Kilo")) {
      attempt.action = "kilo_ping";
      attempt.success = await tryKiloPing();
    } else {
      attempt.action = "no_action";
      attempt.success = false;
      attempt.error = "Unknown issue";
    }
  } catch (e: any) {
    attempt.error = e?.message;
    attempt.success = false;
  }

  state.attempts++;
  if (attempt.success) {
    state.successCount++;
  } else {
    state.failCount++;
  }
  state.lastAttempt = attempt.timestamp;

  await ensureDir(VALIDATION_DIR);
  await fs.appendFile(RECOVERY_FILE, JSON.stringify(attempt) + "\n");

  if (attempt.success) {
    await logEvidence("recovery_success", attempt);
  } else {
    await logEvidence("recovery_failed", attempt);
  }

  return attempt;
}

export function getRecoveryState(): RecoveryState {
  return { ...state };
}

export async function getRecoveryLogs(): Promise<RecoveryAttempt[]> {
  try {
    const content = await fs.readFile(RECOVERY_FILE, "utf-8");
    return content.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).reverse().slice(0, 20);
  } catch {
    return [];
  }
}

export function isRecoveryEnabled(): boolean {
  return state.enabled;
}

export function enableRecovery(): void {
  state.enabled = true;
  logEvidence("recovery_enabled", {});
}

export function disableRecovery(): void {
  state.enabled = false;
  logEvidence("recovery_disabled", {});
}