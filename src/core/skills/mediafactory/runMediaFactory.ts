import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "../../db.ts";

const execFileAsync = promisify(execFile);

type Stage = "Image" | "Video" | "Audio" | "Mux" | "Export";

export type MediaFactoryInput = {
  stage: Stage;
  maker_mode: boolean;
  prompt: string;
  image_path?: string;
  video_path?: string;
  audio_path?: string;
  captions_srt_path?: string;
  public_preset?: "reel_9x16_basic";
  maker?: {
    duration_sec?: number;
    fps?: number;
    with_audio?: boolean;
    music_style?: string;
    voice_style?: string;
  };
};

export async function runMediaFactory(input: MediaFactoryInput) {
  const run_id = crypto.randomUUID();
  const isMaker = input.maker_mode === true;
  const stage = input.stage;

  if (!isMaker && stage !== "Image") {
    return {
      ok: false,
      skill_id: "mediafactory",
      version: "1.0.0",
      stage,
      validators: {},
      meta: { maker_mode: false, failures_count: 1, timeouts: 0 },
      error: "maker_required",
    };
  }

  const duration_sec = clampNumber(input.maker?.duration_sec ?? 8, 6, 30);
  const fps = normalizeFps(input.maker?.fps ?? 30);
  const with_audio = input.maker?.with_audio ?? true;

  const baseDir = path.join(process.cwd(), "artifacts", run_id, "mediafactory");
  await fs.mkdir(baseDir, { recursive: true });

  const artifacts: Array<{ name: string; path: string; bytes: number; mime: string }> = [];

  let reelPath = input.video_path || path.join(baseDir, "reel.mp4");
  let audioPath = input.audio_path || path.join(baseDir, "audio.wav");
  const coverPath = path.join(baseDir, "cover.jpg");
  const captionsPath = input.captions_srt_path || path.join(baseDir, "captions.srt");
  const packPath = path.join(baseDir, "pack.json");

  let failures_count = 0;

  try {
    if (stage === "Image") {
      await writeMinimalJpeg(coverPath);
      artifacts.push(await artifactRow("cover.jpg", coverPath, "image/jpeg"));
    }

    if (stage === "Video" || stage === "Mux" || stage === "Export") {
      await ensureFfmpeg();
      await generateVideo(reelPath, duration_sec, fps);
      artifacts.push(await artifactRow("reel.mp4", reelPath, "video/mp4"));
    }

    if (stage === "Audio" || ((stage === "Mux" || stage === "Export") && with_audio)) {
      await ensureFfmpeg();
      await generateAudio(audioPath, duration_sec);
      artifacts.push(await artifactRow("audio.wav", audioPath, "audio/wav"));
    }

    if (stage === "Mux" || stage === "Export") {
      if (with_audio) {
        await ensureFfmpeg();
        await muxVideoAudio(reelPath, audioPath, reelPath);
      }
    }

    if (stage === "Export") {
      await ensureFfmpeg();
      await extractCover(reelPath, coverPath);
      artifacts.push(await artifactRow("cover.jpg", coverPath, "image/jpeg"));
      await fs.writeFile(captionsPath, "1\n00:00:00,000 --> 00:00:02,000\n", "utf-8");
      artifacts.push(await artifactRow("captions.srt", captionsPath, "text/plain"));
    }

    const validators = await runValidators({
      reelPath,
      duration_sec,
      with_audio,
      requireVideo: stage !== "Image",
    });

    const pack = {
      run_id,
      mode: isMaker ? "Maker" : "Public",
      inputs: {
        prompt: input.prompt,
        image_path: input.image_path ?? null,
        video_path: reelPath,
        audio_path: with_audio ? audioPath : null,
        captions_srt_path: stage === "Export" ? captionsPath : null,
      },
      outputs: artifacts.map((a) => ({
        name: a.name,
        path: a.path,
        bytes: a.bytes,
      })),
      validators,
      created_at: new Date().toISOString(),
    };

    await fs.writeFile(packPath, JSON.stringify(pack, null, 2), "utf-8");
    artifacts.push(await artifactRow("pack.json", packPath, "application/json"));

    const ok =
      stage === "Image" ||
      (validators.mp4_exists && validators.duration_ok && validators.aspect_9x16 && (!with_audio || validators.audio_present));

    if (!ok) failures_count = 1;

    for (const a of artifacts) {
      db.taskArtifacts.insert({
        id: crypto.randomUUID(),
        task_id: run_id,
        name: a.name,
        mime: a.mime,
        path: a.path,
        bytes: a.bytes,
        created_at: Date.now(),
      });
    }

    return {
      ok,
      skill_id: "mediafactory",
      version: "1.0.0",
      stage,
      artifacts,
      pack_json: pack,
      validators,
      meta: {
        maker_mode: isMaker,
        duration_sec,
        failures_count,
        timeouts: 0,
      },
      run_id,
    };
  } catch (e: any) {
    failures_count = 1;
    return {
      ok: false,
      skill_id: "mediafactory",
      version: "1.0.0",
      stage,
      validators: {},
      meta: {
        maker_mode: isMaker,
        duration_sec,
        failures_count,
        timeouts: 0,
      },
      error: e?.message ?? "mediafactory_failed",
      run_id,
    };
  }
}

async function artifactRow(name: string, filePath: string, mime: string) {
  const stat = await fs.stat(filePath);
  return { name, path: filePath, bytes: stat.size, mime };
}

async function ensureFfmpeg() {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
  } catch {
    throw new Error("ffmpeg_missing");
  }
}

async function generateVideo(outPath: string, duration: number, fps: number) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=size=1080x1920:rate=${fps}:color=black`,
    "-t",
    String(duration),
    "-pix_fmt",
    "yuv420p",
    outPath,
  ]);
}

async function generateAudio(outPath: string, duration: number) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440",
    "-t",
    String(duration),
    outPath,
  ]);
}

async function muxVideoAudio(videoPath: string, audioPath: string, outPath: string) {
  const tmpPath = outPath + ".tmp.mp4";
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-shortest",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    tmpPath,
  ]);
  await fs.rename(tmpPath, outPath);
}

async function extractCover(videoPath: string, coverPath: string) {
  await execFileAsync("ffmpeg", ["-y", "-i", videoPath, "-vframes", "1", coverPath]);
}

function normalizeFps(v: number) {
  return v === 24 ? 24 : 30;
}

function clampNumber(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

async function writeMinimalJpeg(outPath: string) {
  const data =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFhUVFhUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAAEBQADBgIBB//EADoQAAIBAgQDBgQEBQQDAAAAAAECAwQRAAUSITEGEyJBUWFxgZEykaGxQqHB0QcjM1Lh8RYkQ1OC/8QAGQEAAwEBAQAAAAAAAAAAAAAAAAECAwQF/8QAJhEAAgICAgICAgMAAAAAAAAAAAECEQMhEjEEE0EiUWEUM1Jhgf/aAAwDAQACEQMRAD8A8Z2p4cKQqD6wQXc8tO+uS6V9vtQJ3nS1Q3mOQ6yF6kF1l9r2Uo1Q8zJ4CqE8mC7l0yE4HqU5nG9yBq5aF3k0p1B7G6Dk0fFZbA2kq3q4qV8bq2qf4A1gq2M0cTz2mX7UQ2lqH0Jr9O7u3tM2KXKpK9c6qGx9N7iO3n2ZbQX3rC0v2yS2m4Ue5x1J3o8dQyS5Kq9oG3GvO0w9qj0i8e8EipwHfJ1o2p1yJpP2rTnHcQyXb5sE9pP8AqM7Zb8a1o2S2r8n5gLwC2rZbM0p1vNfHkHq8cV2lH7Vw5kq8P2Xw0kG9L1+7nXl5V7xjQp7BfQ2H1Wq5V6mU+u3Q6r8B9u3r2m7T3bV4lq3E8r0j7m2sTzY0qzVvT9a2m7g7wB3mQe+o8lXvW+u9f8AoY7bG8tW8k4m9p6m+0o2n5xvW6n0o1l2k4fI5vZqM0b1e1p1m6Zf8Apl9vB0qk8qvV1m0r8h0k0m0b7o2xG2lQnY1X0j7sB8P0o+zXbN7mG1m0G2f4uQ0F4g8fI2y1m2c7v1pQ9m8rXv8A6kq5i1bG4qf1m+5oU2lS8q2lK+z0B1n6xV4XzqR6xV4q0r4W8p2LQ8D7xXb7gqvB4fXc3w1k0uS9E4p6D6rK2v1M2tU0w8aJb2YH3q5rZkqQZk7gTzP0pM2u0b3b6b5kZKp9a5wVnQp2t2pUu6x1pK2t4z7tQq6bG5bZb0q8mV5rZg2m2sZb9o8aVq6n0Wb0rQmW6e+3mV1+Xn0rM6k1n0rQqk5j9p7qj3Xf0V3m7o3r1q5Z6tQ0r1s8q0t9yq2Y9i8HcHq1S1P3s8J2a0zR3b2q2G9u3m5a2w9Q8mX8rHfO0v1o6s1rM2o3l1b7g0s0q2b7o5vYq3t1o5e8h7lV5r1r4b1Ww7n4o3r1p0m0i8tQ7gH0qW2b0s1s3b0q0pHc7m+U3n1qX0r9L2tN7m6nK+qfW8U5f1b7q9z7k0i1m0m7r1p1y1m1o0z9o0W0k5rZg2b2r1Jb7p8a9W2r6m1q5M6j2m6j9a7g7p0q6n1b7b0q0p9G0b9o3o9K1j2m1m2o0n0r1S4m7b0e1k0m8Uq8F7pK2m6a9x0q3mX1o3h0a8q1Z9m0Y0r1k0r8j0n0W0m2r2n1k0k1m1s9p0+8QH/9k=";
  const buf = Buffer.from(data, "base64");
  await fs.writeFile(outPath, buf);
}

async function runValidators(input: {
  reelPath: string;
  duration_sec: number;
  with_audio: boolean;
  requireVideo: boolean;
}) {
  const mp4_exists = input.requireVideo ? await validateMp4Exists(input.reelPath) : false;
  const duration_ok = input.requireVideo
    ? await validateDuration(input.reelPath, 6, 30)
    : false;
  const aspect_9x16 = input.requireVideo ? await validateAspect9x16(input.reelPath) : false;
  const audio_present = input.requireVideo
    ? await validateAudioPresent(input.reelPath, input.with_audio)
    : false;

  return { mp4_exists, duration_ok, aspect_9x16, audio_present };
}

async function validateMp4Exists(p: string) {
  try {
    const stat = await fs.stat(p);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function validateDuration(p: string, min: number, max: number) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nw=1:nk=1",
      p,
    ]);
    const sec = Number(stdout.trim());
    if (!Number.isFinite(sec)) return false;
    return sec >= min && sec <= max;
  } catch {
    return false;
  }
}

async function validateAspect9x16(p: string) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      p,
    ]);
    const json = JSON.parse(stdout);
    const stream = json?.streams?.[0];
    const w = Number(stream?.width);
    const h = Number(stream?.height);
    if (!w || !h) return false;
    const ratio = w / h;
    const target = 9 / 16;
    return Math.abs(ratio - target) <= target * 0.02;
  } catch {
    return false;
  }
}

async function validateAudioPresent(p: string, required: boolean) {
  if (!required) return true;
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "json",
      p,
    ]);
    const json = JSON.parse(stdout);
    return Array.isArray(json?.streams) && json.streams.length > 0;
  } catch {
    return false;
  }
}
