import { listSessions, closeSession } from "./browser-session-manager.js";
import { getResourceLimits } from "./browser-resource-limits.js";

interface CleanerStats {
  runs: number;
  totalCleaned: number;
  lastRunAt?: number;
  lastCleanedCount: number;
}

const stats: CleanerStats = { runs: 0, totalCleaned: 0, lastCleanedCount: 0 };
let timer: ReturnType<typeof setInterval> | null = null;
const CLEAN_INTERVAL_MS = 60000;

export function startDeadSessionCleaner(): void {
  if (timer) return;
  timer = setInterval(runCleaner, CLEAN_INTERVAL_MS);
}

export function stopDeadSessionCleaner(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

export function runCleaner(): { cleaned: number; reasons: string[] } {
  stats.runs++;
  const now = Date.now();
  const limits = getResourceLimits();
  const reasons: string[] = [];
  let cleaned = 0;

  for (const s of listSessions()) {
    const idleMs = now - s.lastUsedAt;
    const ageMs = now - s.createdAt;

    if (s.errorCount >= 5) {
      closeSession(s.id);
      cleaned++;
      reasons.push(`session ${s.id}: too many errors (${s.errorCount})`);
      continue;
    }

    if (s.taskId === undefined && idleMs > limits.sessionIdleTimeoutMs) {
      closeSession(s.id);
      cleaned++;
      reasons.push(`session ${s.id}: idle ${(idleMs / 1000).toFixed(0)}s`);
      continue;
    }

    if (ageMs > limits.sessionIdleTimeoutMs * 2) {
      closeSession(s.id);
      cleaned++;
      reasons.push(`session ${s.id}: max age exceeded`);
      continue;
    }

    const livePages = s.context.pages();
    if (livePages.length === 0 && s.pages.length > 0) {
      closeSession(s.id);
      cleaned++;
      reasons.push(`session ${s.id}: all pages closed`);
      continue;
    }
  }

  stats.lastRunAt = now;
  stats.lastCleanedCount = cleaned;
  stats.totalCleaned += cleaned;

  if (cleaned > 0) {
    console.log(`[browser-cleaner] cleaned ${cleaned} sessions: ${reasons.join("; ")}`);
  }

  return { cleaned, reasons };
}

export function getCleanerStats(): CleanerStats {
  return { ...stats };
}

export async function forceCleanSession(sessionId: string): Promise<boolean> {
  const s = listSessions().find(x => x.id === sessionId);
  if (!s) return false;
  await closeSession(sessionId);
  return true;
}
