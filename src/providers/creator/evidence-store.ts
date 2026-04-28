import fs from "fs/promises";
import path from "path";
import type { SessionProviderId } from "./session/session-registry.js";

const EVIDENCE_DIR = path.join(process.cwd(), "data", "creator-bridge");
const EVIDENCE_FILE = path.join(EVIDENCE_DIR, "evidence.jsonl");
const COOLDOWN_FILE = path.join(EVIDENCE_DIR, "cooldowns.json");
const MAX_RECORDS = 500;

export type ExecutionMode = "single" | "multi" | "debate" | "research";
export type ExecutionStatus = "success" | "failed" | "timeout" | "attempted";
export type ErrorCode =
  | "EMPTY_OUTPUT"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "OVERLOAD"
  | "AUTH_REQUIRED"
  | "DOM_SELECTOR_MISS"
  | "EXTRACTION_FAILED"
  | "UNKNOWN";

export interface BridgeEvidence {
  id: string;
  timestamp: number;
  message: string;
  mode: ExecutionMode;
  finalProvider: SessionProviderId;
  providers: Array<{
    provider: SessionProviderId;
    status: ExecutionStatus;
    latencyMs?: number;
    outputChars?: number;
    errorCode?: ErrorCode;
  }>;
  fallbackCount: number;
  totalLatencyMs: number;
  outputLength: number;
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  } catch {}
}

async function appendEvidenceToFile(evidence: BridgeEvidence): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(evidence) + "\n";
    await fs.appendFile(EVIDENCE_FILE, line, "utf-8");
  } catch (e) {
    console.error("[bridge-evidence] write failed", e);
  }
}

async function loadEvidenceFromFile(): Promise<BridgeEvidence[]> {
  const evidences: BridgeEvidence[] = [];
  try {
    await ensureDir();
    const content = await fs.readFile(EVIDENCE_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const recent = lines.slice(-MAX_RECORDS);
    for (const line of recent) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.id && parsed.timestamp) {
          evidences.push(parsed);
        }
      } catch {}
    }
  } catch {}
  return evidences;
}

interface PersistedCooldown {
  provider: SessionProviderId;
  errorCode: ErrorCode;
  cooldownUntil: number;
}

async function saveCooldowns(cooldowns: PersistedCooldown[]): Promise<void> {
  try {
    await ensureDir();
    await fs.writeFile(COOLDOWN_FILE, JSON.stringify(cooldowns, null, 2), "utf-8");
  } catch (e) {
    console.error("[bridge-cooldown] save failed", e);
  }
}

async function loadCooldowns(): Promise<PersistedCooldown[]> {
  try {
    const content = await fs.readFile(COOLDOWN_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

class BridgeEvidenceStore {
  private evidences: BridgeEvidence[] = [];
  private maxSize = 500;

  async init(): Promise<void> {
    this.evidences = await loadEvidenceFromFile();
    console.log("[bridge-evidence] loaded", this.evidences.length, "records");
  }

  add(evidence: BridgeEvidence): void {
    this.evidences.unshift(evidence);
    if (this.evidences.length > this.maxSize) {
      this.evidences.pop();
    }
    appendEvidenceToFile(evidence).catch(() => {});
  }

  getRecent(limit = 10): BridgeEvidence[] {
    return this.evidences.slice(0, limit);
  }

  getFailed(limit = 10): BridgeEvidence[] {
    return this.evidences
      .filter(e => e.providers.some(p => p.status === "failed"))
      .slice(0, limit);
  }

  getByProvider(provider: SessionProviderId, limit = 10): BridgeEvidence[] {
    return this.evidences
      .filter(e => e.finalProvider === provider)
      .slice(0, limit);
  }

  getProviderStats(): Record<SessionProviderId, { attempts: number; success: number; failed: number; avgLatencyMs: number }> {
    const stats: Record<string, { attempts: number; success: number; failed: number; avgLatencyMs: number }> = {};
    
    for (const e of this.evidences) {
      for (const p of e.providers) {
        if (!stats[p.provider]) {
          stats[p.provider] = { attempts: 0, success: 0, failed: 0, avgLatencyMs: 0 };
        }
        stats[p.provider].attempts++;
        if (p.status === "success") stats[p.provider].success++;
        if (p.status === "failed") stats[p.provider].failed++;
        if (p.latencyMs) {
          stats[p.provider].avgLatencyMs = 
            (stats[p.provider].avgLatencyMs * (stats[p.provider].attempts - 1) + p.latencyMs) / stats[p.provider].attempts;
        }
      }
    }
    
    return stats as Record<SessionProviderId, { attempts: number; success: number; failed: number; avgLatencyMs: number }>;
  }

  getEmptyOutputCount(): number {
    return this.evidences.filter(e => e.outputLength === 0).length;
  }

  getRateLimitCount(): number {
    return this.evidences.filter(e => 
      e.providers.some(p => p.errorCode === "RATE_LIMIT" || p.errorCode === "OVERLOAD")
    ).length;
  }

  clear(): void {
    this.evidences = [];
  }
}

interface ProviderCooldown {
  provider: SessionProviderId;
  errorCode: ErrorCode;
  cooldownUntil: number;
}

class ProviderCooldownManager {
  private cooldowns: Map<SessionProviderId, ProviderCooldown> = new Map();
  private cooldownMinutes: Record<ErrorCode, number> = {
    RATE_LIMIT: 10,
    OVERLOAD: 10,
    AUTH_REQUIRED: 999999,
    EMPTY_OUTPUT: 2,
    TIMEOUT: 2,
    DOM_SELECTOR_MISS: 5,
    EXTRACTION_FAILED: 5,
    UNKNOWN: 5,
  };

  async init(): Promise<void> {
    const persisted = await loadCooldowns();
    const now = Date.now();
    for (const cd of persisted) {
      if (cd.cooldownUntil > now) {
        this.cooldowns.set(cd.provider, cd);
      }
    }
    console.log("[bridge-cooldown] restored", this.cooldowns.size, "cooldowns");
  }

  setCooldown(provider: SessionProviderId, errorCode: ErrorCode): void {
    const minutes = this.cooldownMinutes[errorCode] || 5;
    this.cooldowns.set(provider, {
      provider,
      errorCode,
      cooldownUntil: Date.now() + minutes * 60 * 1000,
    });
    this.persistCooldowns();
  }

  isInCooldown(provider: SessionProviderId): boolean {
    const cd = this.cooldowns.get(provider);
    if (!cd) return false;
    if (Date.now() > cd.cooldownUntil) {
      this.cooldowns.delete(provider);
      this.persistCooldowns();
      return false;
    }
    return true;
  }

  getCooldownInfo(provider: SessionProviderId): ProviderCooldown | undefined {
    return this.cooldowns.get(provider);
  }

  getAllCooldowns(): ProviderCooldown[] {
    return Array.from(this.cooldowns.values()).filter(
      cd => Date.now() <= cd.cooldownUntil
    );
  }

  reset(provider: SessionProviderId): void {
    this.cooldowns.delete(provider);
    this.persistCooldowns();
  }

  resetAll(): void {
    this.cooldowns.clear();
    this.persistCooldowns();
  }

  private async persistCooldowns(): Promise<void> {
    const arr = Array.from(this.cooldowns.values());
    await saveCooldowns(arr);
  }
}

export const bridgeEvidenceStore = new BridgeEvidenceStore();
export const providerCooldownManager = new ProviderCooldownManager();

export async function initEvidenceStore(): Promise<void> {
  await bridgeEvidenceStore.init();
  await providerCooldownManager.init();
}

export function addBridgeEvidence(evidence: BridgeEvidence): void {
  bridgeEvidenceStore.add(evidence);
}

export function formatEvidenceSummary(evidence: BridgeEvidence): string {
  const time = new Date(evidence.timestamp).toLocaleTimeString();
  const status = evidence.providers.some(p => p.status === "failed") ? "⚠️" : "✅";
  const providers = evidence.providers.map(p => `${p.provider}:${p.status[0]}`).join(" → ");
  
  return `${status} [${time}] ${evidence.finalProvider} (${evidence.totalLatencyMs}ms) ${evidence.outputLength}chars\n${providers}`;
}

export function formatProviderHealth(): string {
  const stats = bridgeEvidenceStore.getProviderStats();
  const lines: string[] = ["🏥 Provider Health"];
  
  for (const [provider, stat] of Object.entries(stats)) {
    const rate = stat.attempts > 0 ? Math.round((stat.success / stat.attempts) * 100) : 0;
    lines.push(`${provider}: ${stat.success}/${stat.attempts} (${rate}%) avg ${Math.round(stat.avgLatencyMs)}ms`);
  }
  
  const cooldowns = providerCooldownManager.getAllCooldowns();
  if (cooldowns.length > 0) {
    lines.push("\n❄️ Cooldowns:");
    for (const cd of cooldowns) {
      const remaining = Math.round((cd.cooldownUntil - Date.now()) / 60000);
      const mins = cd.errorCode === "AUTH_REQUIRED" ? "∞" : `${remaining}m`;
      lines.push(`${cd.provider}: ${cd.errorCode} (${mins})`);
    }
  }
  
  const emptyCount = bridgeEvidenceStore.getEmptyOutputCount();
  const rateLimitCount = bridgeEvidenceStore.getRateLimitCount();
  
  if (emptyCount > 0 || rateLimitCount > 0) {
    lines.push(`\n⚠️ Issues: ${emptyCount} empty, ${rateLimitCount} rate-limited`);
  }
  
  return lines.join("\n");
}