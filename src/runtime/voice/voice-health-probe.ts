/**
 * TGR-6.33 — Voice Provider Health Probes
 * Each provider has a specific availability check.
 */

import type { VoiceProviderId, VoiceHealthStatus } from "./voice-provider.types.js";
import { spawnSync } from "node:child_process";

export interface VoiceHealthResult {
  provider: VoiceProviderId;
  status: VoiceHealthStatus;
  latencyMs: number;
  reason: string;
}

const HEALTH_CACHE_TTL_MS = 60_000; // 1 min — voice probes are heavier
const healthCache = new Map<VoiceProviderId, { result: VoiceHealthResult; checkedAt: number }>();

async function probeYandexKey(): Promise<boolean> {
  const key = (process.env.YANDEX_API_KEY || process.env.YANDEX_SPEECHKIT_API_KEY || "").trim();
  const folder = (process.env.YANDEX_FOLDER_ID || "").trim();
  return key.length > 10 && folder.length > 0 && /^[\x20-\x7E]+$/.test(key);
}

async function probeOpenAIKey(): Promise<boolean> {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  return key.length > 10 && /^[\x20-\x7E]+$/.test(key) && key.startsWith("sk-");
}

async function probeLocalModel(envVar: string, defaultPath?: string): Promise<boolean> {
  const modelPath = process.env[envVar] || defaultPath || "";
  if (!modelPath) return false;
  try {
    const { existsSync } = await import("node:fs");
    return existsSync(modelPath);
  } catch {
    return false;
  }
}

async function probeLocalServer(url: string): Promise<{ ok: boolean; latencyMs: number; service?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      latencyMs: Date.now() - start,
      service: data?.service || data?.name
    };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function runProbe(provider: VoiceProviderId): Promise<VoiceHealthResult> {
  const start = Date.now();

  switch (provider) {
    case "yandex_speechkit_stt":
    case "yandex_speechkit_tts": {
      const ok = await probeYandexKey();
      return {
        provider,
        status: ok ? "healthy" : "unavailable",
        latencyMs: 0,
        reason: ok ? "api_key_valid" : "missing_yandex_key_or_folder_id",
      };
    }

    case "openai_whisper_stt":
    case "openai_tts": {
      const ok = await probeOpenAIKey();
      return {
        provider,
        status: ok ? "healthy" : "unavailable",
        latencyMs: 0,
        reason: ok ? "api_key_valid" : "missing_openai_key",
      };
    }

    case "faster_whisper_stt": {
      // Check if faster-whisper server is running locally, or model path exists
      const serverProbe = await probeLocalServer(
        process.env.FASTER_WHISPER_URL || "http://127.0.0.1:9000/health"
      );
      if (serverProbe.ok) {
        return { provider, status: "healthy", latencyMs: serverProbe.latencyMs, reason: "server_alive" };
      }
      // Fallback: check model path
      const modelOk = await probeLocalModel("FASTER_WHISPER_MODEL_PATH", "");
      return {
        provider,
        status: modelOk ? "healthy" : "degraded",
        latencyMs: Date.now() - start,
        reason: modelOk ? "model_path_exists" : "server_down_no_model_path",
      };
    }

    case "local_whisper_stt": {
      const modelOk = await probeLocalModel("WHISPER_MODEL_PATH", "");
      return {
        provider,
        status: modelOk ? "healthy" : "degraded",
        latencyMs: Date.now() - start,
        reason: modelOk ? "model_path_exists" : "no_model_path_configured",
      };
    }

    case "silero_tts": {
      const serverProbe = await probeLocalServer(
        process.env.SILERO_TTS_URL || "http://127.0.0.1:9001/health"
      );
      if (serverProbe.ok) {
        return { provider, status: "healthy", latencyMs: serverProbe.latencyMs, reason: "server_alive" };
      }
      const modelOk = await probeLocalModel("SILERO_MODEL_PATH", "");
      return {
        provider,
        status: modelOk ? "degraded" : "unavailable",
        latencyMs: Date.now() - start,
        reason: modelOk ? "server_down_model_exists" : "server_down_no_model",
      };
    }

    case "supertone_tts": {
      const baseUrl = (process.env.SUPERTONE_URL || "http://127.0.0.1:8025").replace(/\/$/, "");
      const serverProbe = await probeLocalServer(`${baseUrl}/health`);

      if (!serverProbe.ok) {
        return {
          provider,
          status: "unavailable",
          latencyMs: Date.now() - start,
          reason: "supertone_server_not_running",
        };
      }

      const isMock = serverProbe.service === "mock-supertone";

      // Urgent fix: TGR-6.42.1 — Basic generation test during health check
      try {
        const { executeSupertoneTTS } = await import("./voice-tts-executors.js");
        const testResult = await executeSupertoneTTS({ text: "test", language: "ru" }, `health-probe-${Date.now()}`);

        if (testResult.success) {
          const diag = `fmt=${testResult.mimeType || "unknown"} size=${testResult.audioBuffer?.length || 0}`;
          return {
            provider,
            status: "healthy",
            latencyMs: serverProbe.latencyMs,
            reason: isMock ? `server_alive_mock_valid (${diag})` : `audio_generation_valid (${diag})`
          };
        } else {
          return {
            provider,
            status: "degraded",
            latencyMs: serverProbe.latencyMs,
            reason: `${testResult.errorCode || "invalid_audio"}`,
          };
        }
      } catch (e) {
        return {
          provider,
          status: "healthy", // Fallback to basic alive if test fails due to infra
          latencyMs: serverProbe.latencyMs,
          reason: isMock ? "server_alive_mock" : "server_alive"
        };
      }
    }

    case "xtts_tts": {
      const serverProbe = await probeLocalServer(
        process.env.XTTS_SERVER_URL || "http://127.0.0.1:8020/health"
      );
      if (serverProbe.ok) {
        return { provider, status: "healthy", latencyMs: serverProbe.latencyMs, reason: "server_alive" };
      }
      return {
        provider,
        status: "unavailable",
        latencyMs: Date.now() - start,
        reason: "xtts_server_not_running",
      };
    }

    case "local_tts": {
      // Always available as last-resort fallback (uses system TTS or stub)
      return { provider, status: "healthy", latencyMs: 0, reason: "always_available_fallback" };
    }

    default: {
      return { provider, status: "unknown", latencyMs: 0, reason: "no_probe_defined" };
    }
  }
}

export async function probeVoiceProvider(provider: VoiceProviderId): Promise<VoiceHealthResult> {
  const cached = healthCache.get(provider);
  if (cached && Date.now() - cached.checkedAt < HEALTH_CACHE_TTL_MS) {
    return cached.result;
  }

  const result = await runProbe(provider);
  healthCache.set(provider, { result, checkedAt: Date.now() });

  console.log("[voice-health-probe]", {
    provider,
    status: result.status,
    latencyMs: result.latencyMs,
    reason: result.reason,
  });

  return result;
}

export async function probeAllVoiceProviders(
  providers: VoiceProviderId[]
): Promise<Map<VoiceProviderId, VoiceHealthResult>> {
  const results = await Promise.all(providers.map(p => probeVoiceProvider(p)));
  const map = new Map<VoiceProviderId, VoiceHealthResult>();
  for (const r of results) map.set(r.provider, r);
  return map;
}

export function invalidateVoiceHealthCache(provider: VoiceProviderId): void {
  healthCache.delete(provider);
}

// ── ffmpeg health check ──────────────────────────────────────────

export function checkFfmpegAvailable(): { ok: boolean; reason: string } {
  try {
    const r = spawnSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 5000 });
    if (r.status === 0) return { ok: true, reason: "ffmpeg_available" };
    return { ok: false, reason: "ffmpeg_not_found" };
  } catch {
    return { ok: false, reason: "ffmpeg_check_failed" };
  }
}
