/**
 * Fast Voice Provider v1.0 — macOS `say` command
 *
 * Uses the built-in macOS text-to-speech engine.
 * Voice: Milena (ru_RU) — high-quality Russian neural voice.
 *
 * Latency: <1 second (vs Kozy ~30-40s)
 * Quality: Good system TTS — not as natural as Kozy XTTS, but perfectly intelligible.
 *
 * This is the voice_fast provider plugged into the existing strategy layer.
 */

import { execFile } from "child_process";
import path from "path";
import fs from "fs";

export interface FastProviderConfig {
  /** Voice name for `say` command (default: "Milena" for Russian) */
  voice: string;
  /** Speech speed (default: 1.0, range ~0.5-2.0) */
  speed: number;
  /** Max chars for fast provider (default: 300) */
  maxChars: number;
  /** Output directory for generated audio files */
  outputDir: string;
  /** Language for say command */
  lang: string;
}

export interface FastProviderResult {
  ok: boolean;
  /** Path to generated WAV file */
  wavPath: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Synthesis latency in ms */
  latencyMs: number;
  provider: "say_macos";
}

function defaultConfig(): FastProviderConfig {
  const outDir = process.env.VOICE_FAST_OUTPUT_DIR || "/tmp/tele-gpt-voice-fast";
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  return {
    voice: process.env.VOICE_FAST_VOICE || "Milena",
    speed: parseFloat(process.env.VOICE_FAST_SPEED || "1.0"),
    maxChars: Number(process.env.VOICE_FAST_MAX_CHARS || "300"),
    outputDir: outDir,
    lang: process.env.VOICE_FAST_LANG || "ru",
  };
}

/**
 * Synthesize text using macOS `say` command.
 * Produces a WAV file via: say → AIFF → afconvert → WAV
 * 
 * @param speechRate - Words per minute (default 200, range ~100-300). 
 *   Lower = slower/calmer, higher = faster/concise.
 */
export async function synthesizeFast(
  text: string,
  traceId: string,
  cfg?: Partial<FastProviderConfig>,
  speechRate?: number,
): Promise<FastProviderResult> {
  const config = { ...defaultConfig(), ...cfg };
  const startMs = Date.now();

  if (!text || !text.trim()) {
    throw new Error("fast_provider: empty text");
  }

  if (text.length > config.maxChars) {
    throw new Error(`fast_provider: text too long (${text.length} > ${config.maxChars})`);
  }

  const safeText = text.trim().slice(0, config.maxChars);
  const aiffPath = path.join(config.outputDir, `fast_${traceId}_${Date.now()}.aiff`);
  const wavPath = path.join(config.outputDir, `fast_${traceId}_${Date.now()}.wav`);

  // Step 1: say → AIFF
  await new Promise<void>((resolve, reject) => {
    // speechRate parameter overrides config.speed if provided
    // say -r expects words per minute * 100 (e.g., 200 wpm → -r 200)
    const rate = speechRate ?? Math.round(config.speed * 200);
    const args = ["-v", config.voice, "-r", String(rate), "-o", aiffPath, safeText];

    execFile("/usr/bin/say", args, { timeout: 15000 }, (error) => {
      if (error) {
        reject(new Error(`say command failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });

  // Step 2: afconvert AIFF → WAV
  await new Promise<void>((resolve, reject) => {
    execFile(
      "/usr/bin/afconvert",
      ["-f", "WAVE", "-d", "LEI16", aiffPath, wavPath],
      { timeout: 10000 },
      (error) => {
        if (error) {
          reject(new Error(`afconvert failed: ${error.message}`));
          return;
        }
        resolve();
      },
    );
  });

  // Verify output
  if (!fs.existsSync(wavPath)) {
    throw new Error("fast_provider: wav file not created");
  }

  const sizeBytes = fs.statSync(wavPath).size;
  if (sizeBytes < 1000) {
    throw new Error(`fast_provider: wav too small (${sizeBytes}b), likely empty`);
  }

  const latencyMs = Date.now() - startMs;

  // Clean up AIFF
  try { fs.unlinkSync(aiffPath); } catch { /* ignore */ }

  return {
    ok: true,
    wavPath,
    sizeBytes,
    latencyMs,
    provider: "say_macos",
  };
}

/** Check if the fast provider is available on this system. */
export function isFastProviderAvailable(): boolean {
  try {
    return fs.existsSync("/usr/bin/say") && fs.existsSync("/usr/bin/afconvert");
  } catch {
    return false;
  }
}
