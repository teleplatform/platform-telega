/**
 * TGR-6.42.1 — Audio Content Validation
 * Checks buffer size, duration, and silence (RMS).
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface AudioValidationResult {
  ok: boolean;
  errorCode?: "invalid_audio_empty" | "invalid_audio_too_short" | "invalid_audio_silent" | "invalid_audio_decode_failed";
  details?: string;
  detectedFormat?: string;
  contentType?: string;
  byteLength?: number;
  ffprobeError?: string;
}

export interface AudioValidationOptions {
  contentType?: string;
  requestedFormat?: string;
  providerId?: string;
}

function detectFormatFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.includes(Buffer.from("RIFF"), 0) && buffer.slice(8, 12).toString() === "WAVE") return "wav";
  if (buffer.includes(Buffer.from("OggS"), 0)) return "ogg";
  if (buffer.includes(Buffer.from("ID3"), 0) || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return "mp3";
  if (buffer.includes(Buffer.from("fLaC"), 0)) return "flac";
  if (buffer.slice(4, 8).toString() === "ftyp") return "m4a";
  return null;
}

export async function validateAudioBuffer(
  buffer: Buffer,
  options: AudioValidationOptions = {}
): Promise<AudioValidationResult> {
  const byteLength = buffer.length;
  const contentType = options.contentType;

  // 1. Byte length check (min 2 KB)
  if (byteLength < 2048) {
    return { ok: false, errorCode: "invalid_audio_empty", details: `Size: ${byteLength} bytes`, byteLength };
  }

  const detectedFormat = detectFormatFromMagicBytes(buffer) || options.requestedFormat || "wav";
  const tempFile = join(tmpdir(), `tgpt-audio-${Date.now()}-${Math.random().toString(36).slice(2)}.${detectedFormat}`);

  try {
    writeFileSync(tempFile, buffer);

    // 2. Duration and Silence check using ffprobe/ffmpeg
    const ffprobe = spawnSync("ffprobe", [
      "-i", tempFile,
      "-show_entries", "format=duration",
      "-v", "quiet",
      "-of", "csv=p=0"
    ], { timeout: 5000 });

    if (ffprobe.status !== 0) {
      const ffprobeErr = ffprobe.stderr?.toString().slice(0, 100) || "unknown ffprobe error";
      return {
        ok: false,
        errorCode: "invalid_audio_decode_failed",
        details: `ffprobe failed for ${detectedFormat}`,
        detectedFormat,
        contentType,
        byteLength,
        ffprobeError: ffprobeErr
      };
    }

    const duration = parseFloat(ffprobe.stdout.toString().trim());
    if (isNaN(duration)) {
      return { ok: false, errorCode: "invalid_audio_decode_failed", details: "Could not parse duration", detectedFormat, byteLength };
    }

    if (duration < 0.3) {
      return { ok: false, errorCode: "invalid_audio_too_short", details: `Duration: ${duration.toFixed(2)}s`, detectedFormat, byteLength };
    }

    // 3. Silence check (RMS) using ffmpeg volumedetect
    const ffmpeg = spawnSync("ffmpeg", [
      "-i", tempFile,
      "-af", "volumedetect",
      "-f", "null",
      "-"
    ], { timeout: 5000 });

    const stderr = ffmpeg.stderr.toString();
    const maxVolumeMatch = stderr.match(/max_volume: ([\-\d.]+) dB/);

    if (maxVolumeMatch) {
      const maxVol = parseFloat(maxVolumeMatch[1]);
      if (maxVol < -50) {
        return { ok: false, errorCode: "invalid_audio_silent", details: `Max volume: ${maxVol} dB`, detectedFormat, byteLength };
      }
    }

    return { ok: true, detectedFormat, byteLength, contentType };
  } catch (e: any) {
    console.error("[audio-validator] exception", e?.message);
    return { ok: true, details: "validator_exception_bypass", detectedFormat, byteLength };
  } finally {
    try { unlinkSync(tempFile); } catch {}
  }
}

/** Returns audio duration in seconds, or null if ffprobe cannot decode the buffer. */
export function probeAudioDuration(buffer: Buffer): number | null {
  const detectedFormat = detectFormatFromMagicBytes(buffer) || "ogg";
  const tempFile = join(tmpdir(), `tgpt-audio-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.${detectedFormat}`);

  try {
    writeFileSync(tempFile, buffer);
    const ffprobe = spawnSync("ffprobe", [
      "-i", tempFile,
      "-show_entries", "format=duration",
      "-v", "quiet",
      "-of", "csv=p=0",
    ], { timeout: 5000 });

    if (ffprobe.status !== 0) return null;
    const duration = parseFloat(ffprobe.stdout.toString().trim());
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  } finally {
    try { unlinkSync(tempFile); } catch {}
  }
}
