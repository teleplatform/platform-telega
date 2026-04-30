import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../../../..");
const COSYVOICE_SCRIPT = path.join(PROJECT_ROOT, "src/workers/voice/python/run_cosyvoice.py");

export interface VoiceRequest {
  provider: string;
  mode: string;
  text: string;
  language: string;
  policy_scope: string;
  fallback_allowed: boolean;
  render_strategy: string;
  trace_id: string;
}

export interface VoiceResult {
  text_output: string;
  audio_asset_id?: string;
  audio_file_path?: string;
  audio_filename?: string;
  audio_mime?: string;
  audio_size_bytes?: number;
  provider: string;
  duration_ms?: number;
  fallback_used: boolean;
}

/**
 * Call Kozy local XTTS server (http://127.0.0.1:8010).
 * Returns full metadata or null if Kozy is unavailable.
 */
async function tryKozy(text: string, traceId: string): Promise<{
  audio_asset_id: string;
  audio_file_path: string;
  audio_filename: string;
  audio_size_bytes: number;
  fallback_used: boolean;
} | null> {
  const kozyUrl = process.env.KOZY_SERVER_URL ?? "http://127.0.0.1:8010";
  if ((process.env.KOZY_ENABLED ?? "true") !== "true") {
    return null;
  }

  try {
    const filename = `arisha_${traceId}_${Date.now()}`;
    const response = await fetch(`${kozyUrl}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        lang: process.env.KOZY_DEFAULT_LANG ?? "ru",
        speed: parseFloat(process.env.KOZY_DEFAULT_SPEED ?? "1.0"),
        filename,
      }),
    });

    if (!response.ok) {
      console.warn(`[voiceRouter] Kozy HTTP ${response.status}`);
      return null;
    }

    const result = (await response.json()) as Record<string, unknown>;
    const audioFilePath = (result.file as string) ?? "";
    const audioFilename = (result.filename as string) ?? filename;
    const audioSizeBytes = (result.size_bytes as number) ?? 0;

    if (!audioFilename) {
      return null;
    }

    return {
      audio_asset_id: audioFilename,
      audio_file_path: audioFilePath,
      audio_filename: audioFilename,
      audio_size_bytes: audioSizeBytes,
      fallback_used: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[voiceRouter] Kozy failed: ${msg}`);
    return null;
  }
}

/**
 * Fallback: CosyVoice Python stub bridge.
 */
async function tryCosyVoiceStub(_text: string): Promise<{
  audio_asset_id: string;
  audio_file_path: string;
  audio_filename: string;
  audio_size_bytes: number;
  fallback_used: boolean;
} | null> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      op: "speak",
      user_id: "arisha",
      model_dir: process.env.COSYVOICE_MODEL_DIR || "",
    });

    const cmd = `python3 ${COSYVOICE_SCRIPT}`;
    const proc = exec(cmd, { timeout: 30000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        const audioBase64 = result.audio_base64 || "";
        const warnings = (result.warnings as string[]) || [];
        const hasRealAudio = audioBase64 && audioBase64.length > 24;

        if (hasRealAudio) {
          resolve({
            audio_asset_id: `voice_stub_${Date.now()}`,
            audio_file_path: "",
            audio_filename: `voice_stub_${Date.now()}.wav`,
            audio_size_bytes: audioBase64.length,
            fallback_used: warnings.length > 0,
          });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
    proc.stdin?.write(payload);
    proc.stdin?.end();
  });
}

export async function routeVoiceRequest(
  req: VoiceRequest,
  _actorRole: string,
): Promise<VoiceResult> {
  const t0 = Date.now();

  // Attempt 1: Kozy local XTTS (primary)
  const kozyResult = await tryKozy(req.text, req.trace_id);
  if (kozyResult) {
    const latencyMs = Date.now() - t0;
    console.log(
      `[voiceRouter] Kozy succeeded: ${kozyResult.audio_filename} (${kozyResult.audio_size_bytes}b) in ${latencyMs}ms`,
    );
    return {
      text_output: req.text,
      audio_asset_id: kozyResult.audio_asset_id,
      audio_file_path: kozyResult.audio_file_path,
      audio_filename: kozyResult.audio_filename,
      audio_mime: "audio/wav",
      audio_size_bytes: kozyResult.audio_size_bytes,
      provider: "kozy",
      duration_ms: latencyMs,
      fallback_used: kozyResult.fallback_used,
    };
  }

  // Attempt 2: CosyVoice Python stub (fallback)
  const cosyResult = await tryCosyVoiceStub(req.text);
  if (cosyResult) {
    const latencyMs = Date.now() - t0;
    console.log(
      `[voiceRouter] CosyVoice stub succeeded: ${cosyResult.audio_filename} in ${latencyMs}ms`,
    );
    return {
      text_output: req.text,
      audio_asset_id: cosyResult.audio_asset_id,
      audio_file_path: cosyResult.audio_file_path,
      audio_filename: cosyResult.audio_filename,
      audio_mime: "audio/wav",
      audio_size_bytes: cosyResult.audio_size_bytes,
      provider: "cosyvoice_stub",
      duration_ms: latencyMs,
      fallback_used: cosyResult.fallback_used,
    };
  }

  // Final: text-only delivery
  const latencyMs = Date.now() - t0;
  console.warn(
    `[voiceRouter] All voice providers failed for trace_id=${req.trace_id} in ${latencyMs}ms`,
  );
  return {
    text_output: req.text,
    provider: req.provider,
    fallback_used: true,
  };
}
