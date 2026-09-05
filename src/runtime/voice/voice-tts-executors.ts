/**
 * TGR-6.34 — Voice TTS Executors
 *
 * Each executor implements the TTS contract for one provider.
 * Used by VoiceProviderOrchestrator.executeWithFallback(tts).
 * TTS is optional — failure falls back to text reply.
 *
 * Canon: Tele•GPT is the brain. Voice providers are replaceable adapters.
 */

import type { VoiceProviderId } from "./voice-provider.types.js";
import { validateAudioBuffer } from "./audio-validator.js";

export interface TTSInput {
  text: string;
  language?: string;
  /** Voice/speaker hint */
  voice?: string;
  /** Speed 0.5–2.0 */
  speed?: number;
  format?: string;
}

export interface TTSResult {
  success: boolean;
  audioBuffer?: Buffer;
  mimeType?: string;
  errorCode?: string;
}

export type TTSExecutor = (input: TTSInput, traceId: string) => Promise<TTSResult>;

// ─── OpenAI TTS ───────────────────────────────────────────────────────────────

export async function executeOpenAITTS(
  input: TTSInput,
  traceId: string
): Promise<TTSResult> {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey || !apiKey.startsWith("sk-") || !/^[\x20-\x7E]+$/.test(apiKey)) {
    return { success: false, errorCode: "missing_credentials" };
  }

  try {
    const voice = input.voice || (input.language === "ru" ? "onyx" : "alloy");
    const speed = input.speed ?? 1.0;

    console.log("[tts:openai] request", { traceId, voice, speed, textLen: input.text.length });

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: input.text.slice(0, 4096), // OpenAI TTS limit
        voice,
        speed,
        response_format: "opus",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errorCode = res.status === 401 ? "invalid_key"
        : res.status === 429 ? "rate_limit"
        : `http_${res.status}`;
      return { success: false, errorCode };
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "audio/mpeg";

    // TGR-6.42.1 — Audio Content Validation
    const validation = await validateAudioBuffer(audioBuffer, {
      contentType,
      requestedFormat: input.format || "mp3",
      providerId: "openai_tts"
    });
    if (!validation.ok) {
      console.warn("[tts:openai] invalid audio", { traceId, error: validation.errorCode, details: validation.details });
      return { success: false, errorCode: validation.errorCode };
    }

    console.log("[tts:openai] success", { traceId, bytes: audioBuffer.length, format: validation.detectedFormat, speed, voice });
    return { success: true, audioBuffer, mimeType: contentType };
  } catch (e: any) {
    return { success: false, errorCode: e?.message || "exception" };
  }
}

// ─── Yandex SpeechKit TTS ─────────────────────────────────────────────────────

export async function executeYandexSpeechKitTTS(
  input: TTSInput,
  traceId: string
): Promise<TTSResult> {
  const apiKey = (process.env.YANDEX_API_KEY || process.env.YANDEX_SPEECHKIT_API_KEY || "").trim();
  const folderId = (process.env.YANDEX_FOLDER_ID || "").trim();

  if (!apiKey || !folderId) {
    return { success: false, errorCode: "missing_credentials" };
  }

  try {
    const lang = input.language === "uz" ? "uz-UZ"
      : input.language === "en" ? "en-US"
      : "ru-RU";
    const voice = input.voice || (lang === "ru-RU" ? "alena" : "john");
    const speed = input.speed ?? 1.0;

    const params = new URLSearchParams({
      folderId,
      text: input.text.slice(0, 5000),
      lang,
      voice,
      speed: String(speed),
      format: "oggopus",
    });

    const res = await fetch(`https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize?${params}`, {
      method: "POST",
      headers: { Authorization: `Api-Key ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errorCode = res.status === 401 || res.status === 403 ? "invalid_key"
        : res.status === 429 ? "rate_limit"
        : `http_${res.status}`;
      return { success: false, errorCode };
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "audio/ogg";

    // TGR-6.42.1 — Audio Content Validation
    const validation = await validateAudioBuffer(audioBuffer, {
      contentType,
      requestedFormat: "ogg",
      providerId: "yandex_speechkit_tts"
    });
    if (!validation.ok) {
      console.warn("[tts:yandex_speechkit] invalid audio", { traceId, error: validation.errorCode, details: validation.details });
      return { success: false, errorCode: validation.errorCode };
    }

    console.log("[tts:yandex_speechkit] success", { traceId, bytes: audioBuffer.length, format: validation.detectedFormat });
    return { success: true, audioBuffer, mimeType: contentType };
  } catch (e: any) {
    return { success: false, errorCode: e?.message || "exception" };
  }
}

// ─── Silero TTS (local server) ────────────────────────────────────────────────

export async function executeSileroTTS(
  input: TTSInput,
  traceId: string
): Promise<TTSResult> {
  const serverUrl = (process.env.SILERO_TTS_URL || "http://127.0.0.1:9001").replace(/\/$/, "");

  try {
    const res = await fetch(`${serverUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text.slice(0, 3000),
        language: input.language || "ru",
        speaker: input.voice || "aidar",
        speed: input.speed ?? 1.0,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return { success: false, errorCode: `http_${res.status}` };
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "audio/wav";

    // TGR-6.42.1 — Audio Content Validation
    const validation = await validateAudioBuffer(audioBuffer, {
      contentType,
      requestedFormat: "wav",
      providerId: "silero_tts"
    });
    if (!validation.ok) {
      console.warn("[tts:silero] invalid audio", { traceId, error: validation.errorCode, details: validation.details });
      return { success: false, errorCode: validation.errorCode };
    }

    console.log("[tts:silero] success", { traceId, bytes: audioBuffer.length, format: validation.detectedFormat });
    return { success: true, audioBuffer, mimeType: contentType };
  } catch (e: any) {
    return { success: false, errorCode: e?.message?.includes("ECONNREFUSED") ? "server_down" : e?.message || "exception" };
  }
}

// ─── XTTS (local server) ──────────────────────────────────────────────────────

export async function executeXTTSTTS(
  input: TTSInput,
  traceId: string
): Promise<TTSResult> {
  const serverUrl = (process.env.XTTS_SERVER_URL || "http://127.0.0.1:8020").replace(/\/$/, "");

  try {
    const res = await fetch(`${serverUrl}/tts_to_audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text.slice(0, 3000),
        speaker_wav: input.voice || "default",
        language: input.language || "ru",
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      return { success: false, errorCode: `http_${res.status}` };
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "audio/wav";

    // TGR-6.42.1 — Audio Content Validation
    const validation = await validateAudioBuffer(audioBuffer, {
      contentType,
      requestedFormat: "wav",
      providerId: "xtts_tts"
    });
    if (!validation.ok) {
      console.warn("[tts:xtts] invalid audio", { traceId, error: validation.errorCode, details: validation.details });
      return { success: false, errorCode: validation.errorCode };
    }

    console.log("[tts:xtts] success", { traceId, bytes: audioBuffer.length, format: validation.detectedFormat });
    return { success: true, audioBuffer, mimeType: contentType };
  } catch (e: any) {
    return { success: false, errorCode: e?.message?.includes("ECONNREFUSED") ? "server_down" : e?.message || "exception" };
  }
}

// ─── Supertone TTS (local server) ────────────────────────────────────────────

export async function executeSupertoneTTS(
  input: TTSInput,
  traceId: string
): Promise<TTSResult> {
  const serverUrl = (process.env.SUPERTONE_URL || "http://127.0.0.1:8025").replace(/\/$/, "");

  try {
    const res = await fetch(`${serverUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text.slice(0, 3000),
        voice: input.voice || (input.language === "ru" ? "ru_RU" : "en_US"),
        language: input.language || "ru",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return { success: false, errorCode: `http_${res.status}` };
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "audio/wav";

    // TGR-6.42.1 — Audio Content Validation
    const validation = await validateAudioBuffer(audioBuffer, {
      contentType,
      requestedFormat: "wav",
      providerId: "supertone_tts"
    });
    if (!validation.ok) {
      console.warn("[tts:supertone] invalid audio", { traceId, error: validation.errorCode, details: validation.details });
      return { success: false, errorCode: validation.errorCode };
    }

    console.log("[tts:supertone] success", { traceId, bytes: audioBuffer.length, format: validation.detectedFormat });
    return { success: true, audioBuffer, mimeType: contentType };
  } catch (e: any) {
    return { success: false, errorCode: e?.message?.includes("ECONNREFUSED") ? "server_down" : e?.message || "exception" };
  }
}

// ─── Local TTS (stub / disabled) ─────────────────────────────────────────────

export async function executeLocalTTS(
  _input: TTSInput,
  _traceId: string
): Promise<TTSResult> {
  // Placeholder — no local TTS configured, caller falls back to text
  return { success: false, errorCode: "local_tts_not_configured" };
}

// ─── Executor map ─────────────────────────────────────────────────────────────

export const TTS_EXECUTORS: Record<string, TTSExecutor> = {
  openai_tts:            executeOpenAITTS,
  yandex_speechkit_tts:  executeYandexSpeechKitTTS,
  silero_tts:            executeSileroTTS,
  xtts_tts:              executeXTTSTTS,
  supertone_tts:         executeSupertoneTTS,
  local_tts:             executeLocalTTS,
};

export function getTTSExecutor(provider: VoiceProviderId): TTSExecutor | null {
  return TTS_EXECUTORS[provider] ?? null;
}
