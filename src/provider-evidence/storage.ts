import fs from "node:fs";
import path from "node:path";
import type { EvidenceEntry, EvidenceStats, ProviderStats, EvidenceSummary } from "./types.js";
import type { ProviderId } from "../provider-auto-router-v2/types.js";

const EVIDENCE_DIR = process.env.PROVIDER_EVIDENCE_DIR || "./tmp/provider-events";
const EVIDENCE_FILE = path.join(EVIDENCE_DIR, "evidence.jsonl");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function ensureDir(): void {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

export function recordEvidence(entry: EvidenceEntry): void {
  ensureDir();

  // Rotate if too large
  if (fs.existsSync(EVIDENCE_FILE) && fs.statSync(EVIDENCE_FILE).size > MAX_FILE_SIZE) {
    const rotated = `${EVIDENCE_FILE}.${Date.now()}.rotated`;
    fs.renameSync(EVIDENCE_FILE, rotated);
    // Keep only last 3 rotated files
    const rotatedFiles = fs.readdirSync(EVIDENCE_DIR)
      .filter(f => f.endsWith(".rotated"))
      .sort()
      .reverse();
    for (const old of rotatedFiles.slice(3)) {
      fs.unlinkSync(path.join(EVIDENCE_DIR, old));
    }
  }

  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(EVIDENCE_FILE, line, "utf8");
}

export function readAllEvidence(): EvidenceEntry[] {
  if (!fs.existsSync(EVIDENCE_FILE)) return [];

  const entries: EvidenceEntry[] = [];
  const content = fs.readFileSync(EVIDENCE_FILE, "utf8");
  for (const line of content.split("\n").filter(Boolean)) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip corrupted lines
    }
  }
  return entries;
}

export function readRecentEvidence(maxEntries: number = 100): EvidenceEntry[] {
  const all = readAllEvidence();
  return all.slice(-maxEntries);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function computeStatsForIntent(
  entries: EvidenceEntry[],
  provider: ProviderId,
  intent: string,
): EvidenceStats {
  const filtered = entries.filter(e => e.provider === provider && e.intent === intent);
  const successCount = filtered.filter(e => e.success).length;
  const totalCalls = filtered.length;
  const latencies = filtered.map(e => e.latencyMs).sort((a, b) => a - b);
  const tokensIn = filtered.filter(e => e.tokensIn != null).map(e => e.tokensIn!);
  const tokensOut = filtered.filter(e => e.tokensOut != null).map(e => e.tokensOut!);
  const fallbacks = filtered.filter(e => e.fallbackUsed).length;

  return {
    provider,
    intent,
    totalCalls,
    successCount,
    failureCount: totalCalls - successCount,
    successRate: totalCalls > 0 ? successCount / totalCalls : 0,
    avgLatencyMs: latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgTokensIn: tokensIn.length > 0
      ? Math.round(tokensIn.reduce((a, b) => a + b, 0) / tokensIn.length)
      : 0,
    avgTokensOut: tokensOut.length > 0
      ? Math.round(tokensOut.reduce((a, b) => a + b, 0) / tokensOut.length)
      : 0,
    fallbackRate: totalCalls > 0 ? fallbacks / totalCalls : 0,
    lastCallTimestamp: filtered.length > 0
      ? Math.max(...filtered.map(e => e.timestamp))
      : 0,
    recentFailures: filtered.filter(e => !e.success).length,
  };
}

export function getProviderStats(entries: EvidenceEntry[]): ProviderStats[] {
  const providerMap = new Map<ProviderId, EvidenceEntry[]>();
  for (const e of entries) {
    const list = providerMap.get(e.provider) || [];
    list.push(e);
    providerMap.set(e.provider, list);
  }

  const result: ProviderStats[] = [];
  for (const [provider, providerEntries] of providerMap) {
    const intents = new Map<string, EvidenceEntry[]>();
    for (const e of providerEntries) {
      const list = intents.get(e.intent) || [];
      list.push(e);
      intents.set(e.intent, list);
    }

    const intentStats: EvidenceStats[] = [];
    for (const [intent, intentEntries] of intents) {
      intentStats.push(computeStatsForIntent(entries, provider, intent));
    }

    const totalCalls = providerEntries.length;
    const successCount = providerEntries.filter(e => e.success).length;
    const latencies = providerEntries.map(e => e.latencyMs);

    result.push({
      provider,
      totalCalls,
      successRate: totalCalls > 0 ? successCount / totalCalls : 0,
      avgLatencyMs: latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
      intents: intentStats,
    });
  }

  result.sort((a, b) => b.totalCalls - a.totalCalls);
  return result;
}

export function getEvidenceSummary(): EvidenceSummary {
  const entries = readAllEvidence();
  const providers = getProviderStats(entries);
  const intents = new Set(entries.map(e => e.intent));

  return {
    totalEntries: entries.length,
    totalProviders: providers.length,
    totalIntents: intents.size,
    byProvider: providers,
    lastEntry: entries[entries.length - 1],
  };
}

export function resetEvidence(): void {
  if (fs.existsSync(EVIDENCE_FILE)) {
    fs.unlinkSync(EVIDENCE_FILE);
  }
}

export function formatEvidenceSummary(): string {
  const summary = getEvidenceSummary();
  const lines: string[] = [
    "📊 *Provider Evidence System*",
    "",
    `Total entries: ${summary.totalEntries}`,
    `Providers tracked: ${summary.totalProviders}`,
    `Intents tracked: ${summary.totalIntents}`,
    "",
  ];

  for (const ps of summary.byProvider) {
    const rateEmoji = ps.successRate >= 0.95 ? "🟢" : ps.successRate >= 0.8 ? "🟡" : "🔴";
    const latencyLabel = ps.avgLatencyMs < 1000 ? "⚡fast" : ps.avgLatencyMs < 5000 ? "⏳moderate" : "🐢slow";
    lines.push(`${rateEmoji} \`${ps.provider}\` — ${ps.totalCalls} calls, ${(ps.successRate * 100).toFixed(0)}% ok, ${latencyLabel} (${ps.avgLatencyMs}ms)`);

    for (const ist of ps.intents) {
      const iRateEmoji = ist.successRate >= 0.95 ? "🟢" : ist.successRate >= 0.8 ? "🟡" : "🔴";
      lines.push(`  ${iRateEmoji} \`${ist.intent}\`: ${ist.totalCalls} calls, ${(ist.successRate * 100).toFixed(0)}% ok, avg ${ist.avgLatencyMs}ms${ist.fallbackRate > 0.1 ? `, fallback ${(ist.fallbackRate * 100).toFixed(0)}%` : ""}`);
    }
    lines.push("");
  }

  if (summary.lastEntry) {
    const le = summary.lastEntry;
    lines.push(`*Last entry*: ${le.success ? "✅" : "❌"} \`${le.provider}\` / \`${le.intent}\` — ${le.latencyMs}ms (${new Date(le.timestamp).toISOString()})`);
  }

  return lines.join("\n");
}
