/**
 * TGR-6.34 — Voice STT Executors
 *
 * Each executor implements the STT contract for one provider.
 * Used by VoiceProviderOrchestrator.executeWithFallback(stt).
 *
 * Canon: Tele•GPT is the brain. Voice providers are replaceable adapters.
 */

import type { VoiceProviderId } from "./voice-provider.types.js";

export interface STTInput {
  /** Raw audio buffer (OGG/OPUS from Telegram) */
  audioBuffer: Buffer;
  /** MIME type hint */
  mimeType?: string;
  /** BCP-47 language hint */
  language?: string;
  /** Duration in seconds */
  durationSeconds?: number;
}

export interface STTResult {
  success: boolean;
  transcript?: string;
  errorCode?: string;
}

export type STTExecutor = (input: STTInput, traceId: string) => Promise<STTResult>;

// ─── OpenAI Whisper API ───────────────────────────────────────────────────────

export async function executeOpenAIWhisperSTT(
  input: STTInput,
  traceId: string
): Promise<STTResult> {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey || !apiKey.startsWith("sk-") || !/^[\x20-\x7E]+$/.test(apiKey)) {
    return { success: false, errorCode: "missing_credentials" };
  }

  try {
    const { Blob } = await import("node:buffer");
    const blob = new Blob([new Uint8Array(input.audioBuffer)], { type: input.mimeType || "audio/ogg" });

    const formData = new FormData();
    formData.append("file", blob as any, "voice.ogg");
    formData.append("model", "whisper-1");
    if (input.language) formData.append("language", input.language);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const errorCode = res.status === 401 ? "invalid_key"
        : res.status === 429 ? "rate_limit"
        : `http_${res.status}`;
      console.error("[stt:openai_whisper] failed", { status: res.status, body: body.slice(0, 200) });
      return { success: false, errorCode };
    }

    const data = await res.json().catch(() => ({})) as any;
    const transcript = String(data?.text || "").trim();

    if (!transcript) return { success: false, errorCode: "empty_transcript" };

    console.log("[stt:openai_whisper] success", { traceId, chars: transcript.length });
    return { success: true, transcript };
  } catch (e: any) {
    return { success: false, errorCode: e?.message || "exception" };
  }
}

// ─── Yandex SpeechKit STT ─────────────────────────────────────────────────────

export async function executeYandexSpeechKitSTT(
  input: STTInput,
  traceId: string
): Promise<STTResult> {
  const apiKey = (process.env.YANDEX_API_KEY || process.env.YANDEX_SPEECHKIT_API_KEY || "").trim();
  const folderId = (process.env.YANDEX_FOLDER_ID || "").trim();

  if (!apiKey || !folderId) {
    return { success: false, errorCode: "missing_credentials" };
  }

  try {
    const lang = input.language === "uz" ? "uz-UZ"
      : input.language === "en" ? "en-US"
      : "ru-RU";

    const url = `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?folderId=${folderId}&lang=${lang}&format=oggopus`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        "Content-Type": "audio/ogg",
      },
      body: new Uint8Array(input.audioBuffer),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errorCode = res.status === 401 || res.status === 403 ? "invalid_key"
        : res.status === 429 ? "rate_limit"
        : `http_${res.status}`;
      return { success: false, errorCode };
    }

    const data = await res.json().catch(() => ({})) as any;
    const transcript = String(data?.result || "").trim();

    if (!transcript) return { success: false, errorCode: "empty_transcript" };

    console.log("[stt:yandex_speechkit] success", { traceId, chars: transcript.length });
    return { success: true, transcript };
  } catch (e: any) {
    return { success: false, errorCode: e?.message || "exception" };
  }
}

// ─── Faster Whisper (local server) ───────────────────────────────────────────

export async function executeFasterWhisperSTT(
  input: STTInput,
  traceId: string
): Promise<STTResult> {
  const serverUrl = (process.env.FASTER_WHISPER_URL || "http://127.0.0.1:9000").replace(/\/$/, "");

  try {
    const { Blob } = await import("node:buffer");
    const blob = new Blob([new Uint8Array(input.audioBuffer)], { type: input.mimeType || "audio/ogg" });

    const formData = new FormData();
    formData.append("audio_file", blob as any, "voice.ogg");
    if (input.language) formData.append("language", input.language);

    const res = await fetch(`${serverUrl}/asr`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      return { success: false, errorCode: `http_${res.status}` };
    }

    const data = await res.json().catch(() => ({})) as any;
    const transcript = String(data?.text || data?.transcript || "").trim();

    if (!transcript) return { success: false, errorCode: "empty_transcript" };

    console.log("[stt:faster_whisper] success", { traceId, chars: transcript.length });
    return { success: true, transcript };
  } catch (e: any) {
    return { success: false, errorCode: e?.message?.includes("ECONNREFUSED") ? "server_down" : e?.message || "exception" };
  }
}

// ─── Local Whisper (model path) ───────────────────────────────────────────────

export async function executeLocalWhisperSTT(
  input: STTInput,
  traceId: string
): Promise<STTResult> {
  // Placeholder — requires local whisper.cpp or Python whisper binding
  // Falls back to faster_whisper server if available
  return executeFasterWhisperSTT(input, traceId);
}

// ─── Executor map ─────────────────────────────────────────────────────────────

export const STT_EXECUTORS: Record<string, STTExecutor> = {
  openai_whisper_stt:    executeOpenAIWhisperSTT,
  yandex_speechkit_stt:  executeYandexSpeechKitSTT,
  faster_whisper_stt:    executeFasterWhisperSTT,
  local_whisper_stt:     executeLocalWhisperSTT,
};

export function getSTTExecutor(provider: VoiceProviderId): STTExecutor | null {
  return STT_EXECUTORS[provider] ?? null;
}
