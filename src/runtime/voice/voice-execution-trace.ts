/**
 * TGR-6.36 — Voice Execution Trace
 *
 * Records full voice pipeline execution to the Evidence Fabric.
 * Each voice request produces a linked chain of evidence records:
 *
 *   voice_input_received
 *   → voice_stt_started / voice_stt_completed
 *   → voice_tts_started / voice_tts_completed
 *   → voice_reply_sent
 */

import type { VoiceProviderId } from "./voice-provider.types.js";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { appendTraceToFile } from "./voice-trace-persistence.js";

export interface VoiceExecutionSpan {
  provider: VoiceProviderId | string;
  startedAt: number;
  finishedAt: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  outputBytes?: number;
  transcript?: string;
}

export interface VoiceExecutionTraceData {
  traceId: string;
  userId: string;
  chatId: string;
  language: string;
  audioDurationSec: number;
  stt: VoiceExecutionSpan;
  llm: VoiceExecutionSpan;
  style?: VoiceExecutionSpan;
  answerText?: string;
  tts?: VoiceExecutionSpan;
  reply: {
    method: "voice" | "text";
    latencyMs: number;
    success: boolean;
  };
  replyChoice?: {
    requested: boolean;
    selected?: "voice" | "text";
    mode: string;
  };
  totalLatencyMs: number;
  status: "completed" | "partial" | "failed";
}

const RECENT_TRACES: VoiceExecutionTraceData[] = [];
const MAX_RECENT_TRACES = 20;

export function getRecentVoiceTraces(n = 5): VoiceExecutionTraceData[] {
  return RECENT_TRACES.slice(0, n);
}

export function getLastVoiceTrace(): VoiceExecutionTraceData | null {
  return RECENT_TRACES.length > 0 ? RECENT_TRACES[0] : null;
}

export function formatVoiceTrace(trace: VoiceExecutionTraceData): string {
  const lines: string[] = [
    "🎙 Voice Execution Trace",
    `ID: ${trace.traceId}`,
    `Status: ${trace.status === "completed" ? "✅ Completed" : trace.status === "partial" ? "⚠️ Partial" : "❌ Failed"}`,
    trace.replyChoice ? `Reply mode: ${trace.replyChoice.mode}${trace.replyChoice.selected ? ` (chosen: ${trace.replyChoice.selected})` : " (awaiting choice)"}` : "",
    "",
    "### STT",
    `Provider: ${trace.stt.provider}`,
    `Latency: ${trace.stt.latencyMs}ms`,
    trace.stt.transcript ? `Transcript: "${trace.stt.transcript.slice(0, 120)}${trace.stt.transcript.length > 120 ? "..." : ""}"` : "",
    trace.stt.errorCode ? `Error: ${trace.stt.errorCode}` : "",
    "",
    "### LLM (Tele•GPT)",
    `Provider: ${trace.llm.provider}`,
    `Latency: ${trace.llm.latencyMs}ms`,
    trace.llm.errorCode ? `Error: ${trace.llm.errorCode}` : "",
    "",
    trace.style ? [
      "### Style Engine",
      `Style: ${trace.style.provider}`,
      `Latency: ${trace.style.latencyMs}ms`,
      trace.style.errorCode ? `Error: ${trace.style.errorCode}` : "",
      "",
    ].join("\n") : "",
    trace.tts ? [
      "### TTS",
      `Provider: ${trace.tts.provider}`,
      `Latency: ${trace.tts.latencyMs}ms`,
      trace.tts.outputBytes ? `Audio: ${(trace.tts.outputBytes / 1024).toFixed(1)}KB` : "",
      trace.tts.errorCode ? `Error: ${trace.tts.errorCode}` : "",
      "",
    ].join("\n") : "",
    "### Delivery",
    `Method: ${trace.reply.method}`,
    `Latency: ${trace.reply.latencyMs}ms`,
    "",
    `Total: ${trace.totalLatencyMs}ms (${(trace.totalLatencyMs / 1000).toFixed(1)}s)`,
  ];

  return lines.filter(Boolean).join("\n");
}

export async function recordVoiceExecutionTrace(data: VoiceExecutionTraceData): Promise<void> {
  RECENT_TRACES.unshift(data);
  if (RECENT_TRACES.length > MAX_RECENT_TRACES) {
    RECENT_TRACES.length = MAX_RECENT_TRACES;
  }

  // TGR-6.37: Persist to file
  appendTraceToFile(data);

  const ts = new Date().toISOString();

  // voice_input_received
  await appendEvidenceRecord({
    evidence_id: hashTraceId(data.traceId, "voice_input_received"),
    trace_id: data.traceId,
    job_id: `voice-${data.userId}`,
    type: "voice_input_received",
    timestamp: ts,
    payload: {
      user_id: data.userId,
      chat_id: data.chatId,
      language: data.language,
      audio_duration_sec: data.audioDurationSec,
    },
  }).catch(() => {});

  // voice_stt_completed
  await appendEvidenceRecord({
    evidence_id: hashTraceId(data.traceId, "voice_stt_completed"),
    trace_id: data.traceId,
    job_id: `voice-${data.userId}`,
    type: "voice_stt_completed",
    timestamp: ts,
    payload: {
      provider: data.stt.provider,
      latency_ms: data.stt.latencyMs,
      success: data.stt.success,
      transcript_length: data.stt.transcript?.length ?? 0,
      error_code: data.stt.errorCode,
    },
  }).catch(() => {});

  // voice_tts_completed (only if TTS was invoked)
  if (data.tts) {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(data.traceId, "voice_tts_completed"),
      trace_id: data.traceId,
      job_id: `voice-${data.userId}`,
      type: "voice_tts_completed",
      timestamp: ts,
      payload: {
        provider: data.tts.provider,
        latency_ms: data.tts.latencyMs,
        success: data.tts.success,
        audio_bytes: data.tts.outputBytes,
        error_code: data.tts.errorCode,
      },
    }).catch(() => {});
  }

  // voice_reply_sent
  await appendEvidenceRecord({
    evidence_id: hashTraceId(data.traceId, "voice_reply_sent"),
    trace_id: data.traceId,
    job_id: `voice-${data.userId}`,
    type: "voice_reply_sent",
    timestamp: ts,
    payload: {
      method: data.reply.method,
      latency_ms: data.reply.latencyMs,
      success: data.reply.success,
      total_latency_ms: data.totalLatencyMs,
      status: data.status,
      stt_provider: data.stt.provider,
      tts_provider: data.tts?.provider,
    },
  }).catch(() => {});
}

/**
 * Build a partial trace for error paths (STT fail, empty transcript, etc.).
 * Call right before returning on failure — ensures the trace is persisted even
 * when the voice pipeline doesn't complete.
 */
export function buildPartialTrace(params: {
  traceId: string;
  userId: string;
  chatId: string;
  language: string;
  audioDurationSec: number;
  stt?: { provider: string; latencyMs: number; success: boolean; errorCode?: string; transcript?: string };
  llm?: { provider: string; latencyMs?: number; success: boolean; errorCode?: string; answerText?: string };
  reply?: { method: "voice" | "text"; latencyMs: number; success: boolean };
  status: "completed" | "partial" | "failed";
}): VoiceExecutionTraceData {
  const now = Date.now();
  return {
    traceId: params.traceId,
    userId: params.userId,
    chatId: params.chatId,
    language: params.language,
    audioDurationSec: params.audioDurationSec,
    stt: {
      provider: params.stt?.provider ?? "none",
      startedAt: now,
      finishedAt: now,
      latencyMs: params.stt?.latencyMs ?? 0,
      success: params.stt?.success ?? false,
      errorCode: params.stt?.errorCode,
      transcript: params.stt?.transcript,
    },
    llm: {
      provider: params.llm?.provider ?? "none",
      startedAt: now,
      finishedAt: now,
      latencyMs: params.llm?.latencyMs ?? 0,
      success: params.llm?.success ?? false,
      errorCode: params.llm?.errorCode,
    },
    answerText: params.llm?.answerText,
    tts: undefined,
    reply: params.reply ?? { method: "text", latencyMs: 0, success: false },
    totalLatencyMs: params.reply?.latencyMs ?? 0,
    status: params.status,
  };
}

// TGR-6.37: Re-export persistence queries for commands
export { getVoiceTraceById, loadAllTraces, formatTraceSummaryLine } from "./voice-trace-persistence.js";
