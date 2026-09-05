/**
 * TGR-6.37 — Voice Trace Persistence
 *
 * Append-only JSONL storage for voice execution traces.
 * One file per day: runtime/voice_traces/YYYY-MM-DD.jsonl
 */

import fs from "node:fs";
import path from "node:path";
import type { VoiceExecutionTraceData } from "./voice-execution-trace.js";

const TRACES_DIR = path.join(process.cwd(), ".data", "voice_traces");

function ensureTracesDir(): void {
  if (!fs.existsSync(TRACES_DIR)) {
    fs.mkdirSync(TRACES_DIR, { recursive: true });
  }
}

function dailyFile(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return path.join(TRACES_DIR, `${y}-${m}-${d}.jsonl`);
}

export function appendTraceToFile(data: VoiceExecutionTraceData): void {
  try {
    ensureTracesDir();
    const line = JSON.stringify(data) + "\n";
    fs.appendFileSync(dailyFile(), line, { encoding: "utf8" });
  } catch (e: any) {
    console.error("[voice-trace:persist] append error", e?.message);
  }
}

function loadFile(filePath: string): VoiceExecutionTraceData[] {
  try {
    const content = fs.readFileSync(filePath, { encoding: "utf8" });
    const lines = content.split("\n").filter(Boolean);
    const traces: VoiceExecutionTraceData[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as VoiceExecutionTraceData;
        if (parsed && parsed.traceId) {
          traces.push(parsed);
        }
      } catch {
        // skip malformed lines
      }
    }
    return traces;
  } catch {
    return [];
  }
}

export function getAllTraceFiles(): string[] {
  try {
    ensureTracesDir();
    const files = fs.readdirSync(TRACES_DIR)
      .filter(f => f.endsWith(".jsonl"))
      .sort()
      .reverse();
    return files.map(f => path.join(TRACES_DIR, f));
  } catch {
    return [];
  }
}

export function loadAllTraces(
  limit = 50,
  filter?: { status?: "completed" | "partial" | "failed" },
): VoiceExecutionTraceData[] {
  const files = getAllTraceFiles();
  const all: VoiceExecutionTraceData[] = [];

  for (const file of files) {
    const traces = loadFile(file);
    all.push(...traces);
    if (all.length >= limit * 3) break; // read enough to satisfy filter
  }

  const filtered = filter?.status
    ? all.filter(t => t.status === filter.status)
    : all;

  const sorted = filtered.sort((a, b) => {
    const aTime = a.stt?.startedAt ?? 0;
    const bTime = b.stt?.startedAt ?? 0;
    return bTime - aTime;
  });

  return sorted.slice(0, limit);
}

export function getVoiceTraceById(traceId: string): VoiceExecutionTraceData | null {
  const files = getAllTraceFiles();
  for (const file of files) {
    const traces = loadFile(file);
    for (const t of traces) {
      if (t.traceId === traceId) return t;
    }
  }
  return null;
}

export function formatTraceSummaryLine(t: VoiceExecutionTraceData, index: number): string {
  const icon = t.status === "completed" ? "✅"
    : t.status === "partial" ? "⚠️"
    : "❌";
  const total = t.totalLatencyMs >= 1000
    ? `${(t.totalLatencyMs / 1000).toFixed(1)}s`
    : `${t.totalLatencyMs}ms`;
  return `${index === 0 ? "▶" : " "} ${icon} \`${t.traceId.slice(0, 20)}…\` ` +
    `${t.stt?.provider ?? "?"} → ${t.tts?.provider ?? "—"} → ${t.reply?.method ?? "?"}  (${total})`;
}
