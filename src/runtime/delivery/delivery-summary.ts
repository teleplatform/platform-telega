import * as fs from "node:fs";
import * as path from "node:path";
import type { DeliveryEvidenceRecord } from "./delivery-evidence.types.js";

const FILE = path.resolve(process.cwd(), "delivery-evidence.log");

export type HealthSummary = {
  success: number;
  blocked: number;
  error: number;
  fallback: number;
  total: number;
  window: number; // how many recent records examined
};

export function getHealthSummary(window = 100): HealthSummary {
  try {
    const content = fs.readFileSync(FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const recent = lines.slice(-window);

    let success = 0;
    let blocked = 0;
    let error = 0;
    let fallback = 0;

    for (const line of recent) {
      const r = JSON.parse(line) as DeliveryEvidenceRecord;
      if (r.status === "success") success++;
      else if (r.status === "blocked") blocked++;
      else if (r.status === "error") error++;
      else if (r.status === "fallback") fallback++;
    }

    return { success, blocked, error, fallback, total: recent.length, window };
  } catch {
    return { success: 0, blocked: 0, error: 0, fallback: 0, total: 0, window };
  }
}

export function getRecentErrors(limit = 10): DeliveryEvidenceRecord[] {
  try {
    const content = fs.readFileSync(FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines
      .map(line => JSON.parse(line) as DeliveryEvidenceRecord)
      .filter(r => r.status === "error")
      .slice(-limit);
  } catch {
    return [];
  }
}

export function getProviderStats(window = 100): Record<string, { success: number; error: number }> {
  try {
    const content = fs.readFileSync(FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const recent = lines.slice(-window);

    const stats: Record<string, { success: number; error: number }> = {};

    for (const line of recent) {
      const r = JSON.parse(line) as DeliveryEvidenceRecord;
      if (!stats[r.provider]) {
        stats[r.provider] = { success: 0, error: 0 };
      }
      if (r.status === "success") stats[r.provider].success++;
      if (r.status === "error") stats[r.provider].error++;
    }

    return stats;
  } catch {
    return {};
  }
}

export function formatHealthReport(summary: HealthSummary): string {
  const errorRate = summary.total > 0 ? ((summary.error / summary.total) * 100).toFixed(1) : "0";
  const blockedRate = summary.total > 0 ? ((summary.blocked / summary.total) * 100).toFixed(1) : "0";

  let report = `📊 Tele•GPT Health (last ${summary.window} events)\n\n`;
  report += `✅ Success: ${summary.success}\n`;
  report += `⚠️ Blocked: ${summary.blocked} (${blockedRate}%)\n`;
  report += `❌ Errors: ${summary.error} (${errorRate}%)\n`;
  if (summary.fallback > 0) report += `🔁 Fallback: ${summary.fallback}\n`;
  report += `\nTotal processed: ${summary.total}`;

  return report;
}
