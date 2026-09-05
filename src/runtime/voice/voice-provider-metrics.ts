/**
 * TGR-6.33 — Voice Provider Metrics
 * Persistent metrics for voice providers — same pattern as provider-metrics-store.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { VoiceProviderId } from "./voice-provider.types.js";

export interface VoiceProviderMetrics {
  provider: VoiceProviderId;
  successCount: number;
  failureCount: number;
  recentLatencies: number[];
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastErrorCode: string | null;
  currentFailureStreak: number;
  updatedAt: number;
}

export interface VoiceProviderMetricsSummary {
  provider: VoiceProviderId;
  successRate: number;
  confidence: number;
  avgLatencyMs: number;
  totalCalls: number;
  currentFailureStreak: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

const METRICS_FILE = path.join(
  process.env.TELEGA_ROOT || process.cwd(),
  ".data",
  "voice-provider-metrics.json"
);
const RECENT_WINDOW = 20;
const metricsMap = new Map<VoiceProviderId, VoiceProviderMetrics>();
let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(METRICS_FILE)) return;
    const raw = fs.readFileSync(METRICS_FILE, "utf-8").trim();
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, VoiceProviderMetrics>;
    for (const [id, m] of Object.entries(data)) {
      metricsMap.set(id as VoiceProviderId, m);
    }
  } catch (e: any) {
    console.warn(`[voice-metrics] load failed: ${e?.message}`);
  }
}

function save(): void {
  try {
    const dir = path.dirname(METRICS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data: Record<string, VoiceProviderMetrics> = {};
    for (const [id, m] of Array.from(metricsMap.entries())) data[id] = m;
    fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e: any) {
    console.warn(`[voice-metrics] save failed: ${e?.message}`);
  }
}

function getOrCreate(provider: VoiceProviderId): VoiceProviderMetrics {
  ensureLoaded();
  if (!metricsMap.has(provider)) {
    metricsMap.set(provider, {
      provider,
      successCount: 0,
      failureCount: 0,
      recentLatencies: [],
      lastSuccessAt: null,
      lastFailureAt: null,
      lastErrorCode: null,
      currentFailureStreak: 0,
      updatedAt: Date.now(),
    });
  }
  return metricsMap.get(provider)!;
}

export function recordVoiceSuccess(provider: VoiceProviderId, latencyMs: number): void {
  const m = getOrCreate(provider);
  m.successCount++;
  m.recentLatencies.push(latencyMs);
  if (m.recentLatencies.length > RECENT_WINDOW) m.recentLatencies.shift();
  m.lastSuccessAt = Date.now();
  m.currentFailureStreak = 0;
  m.updatedAt = Date.now();
  save();
}

export function recordVoiceFailure(provider: VoiceProviderId, latencyMs: number, errorCode?: string): void {
  const m = getOrCreate(provider);
  m.failureCount++;
  m.recentLatencies.push(latencyMs);
  if (m.recentLatencies.length > RECENT_WINDOW) m.recentLatencies.shift();
  m.lastFailureAt = Date.now();
  m.lastErrorCode = errorCode ?? null;
  m.currentFailureStreak++;
  m.updatedAt = Date.now();
  save();
}

export function getVoiceSuccessRate(provider: VoiceProviderId): number {
  ensureLoaded();
  const m = metricsMap.get(provider);
  if (!m) return 1.0;
  const total = m.successCount + m.failureCount;
  return total === 0 ? 1.0 : m.successCount / total;
}

export function getVoiceAvgLatency(provider: VoiceProviderId): number {
  ensureLoaded();
  const m = metricsMap.get(provider);
  if (!m || m.recentLatencies.length === 0) return 3000;
  return m.recentLatencies.reduce((s, l) => s + l, 0) / m.recentLatencies.length;
}

export function getVoiceFailureStreak(provider: VoiceProviderId): number {
  ensureLoaded();
  return metricsMap.get(provider)?.currentFailureStreak ?? 0;
}

export function computeVoiceConfidence(provider: VoiceProviderId): number {
  ensureLoaded();
  const m = metricsMap.get(provider);
  if (!m) return 0;
  const total = m.successCount + m.failureCount;
  return Math.min(1, total / 20);
}

export function getVoiceMetrics(provider: VoiceProviderId): VoiceProviderMetrics | null {
  ensureLoaded();
  return metricsMap.get(provider) ?? null;
}

export function getAllVoiceMetricsSummaries(): VoiceProviderMetricsSummary[] {
  ensureLoaded();
  return Array.from(metricsMap.values()).map(m => {
    const total = m.successCount + m.failureCount;
    return {
      provider: m.provider,
      successRate: total === 0 ? 1.0 : m.successCount / total,
      confidence: Math.min(1, total / 20),
      avgLatencyMs: m.recentLatencies.length === 0 ? 0
        : Math.round(m.recentLatencies.reduce((s, l) => s + l, 0) / m.recentLatencies.length),
      totalCalls: total,
      currentFailureStreak: m.currentFailureStreak,
      lastSuccessAt: m.lastSuccessAt
        ? new Date(m.lastSuccessAt).toISOString().slice(0, 16).replace("T", " ") : null,
      lastFailureAt: m.lastFailureAt
        ? new Date(m.lastFailureAt).toISOString().slice(0, 16).replace("T", " ") : null,
    };
  });
}

export function voiceFailureStreakPenalty(streak: number): number {
  if (streak <= 0) return 0;
  if (streak === 1) return -5;
  if (streak === 2) return -15;
  return -1000;
}
