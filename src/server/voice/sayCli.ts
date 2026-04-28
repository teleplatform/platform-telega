import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { getAgentVoiceConfig, type AgentVoiceConfig } from "@/config/voiceAgents";

function resolveVoiceRoot() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return process.env.TELEGPT_VOICE_ROOT || path.join(home, "voices");
}

function resolveSayCmd() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return process.env.TELEGPT_TG_SAY || path.join(home, "bin", "tg-say");
}

export type SayRequest = {
  speaker: string;
  preset: string;
  text: string;
  lang?: "ru" | "en" | "uz" | "auto";
};

export type SayMetrics = {
  tts_ms?: number;
  dsp_ms?: number;
  total_ms?: number;
  duration_ms?: number;
  rtf?: number;
};

export function runSay(req: SayRequest): { audio: Buffer; metrics: SayMetrics } {
  const voiceRoot = resolveVoiceRoot();
  const outDir = path.join(voiceRoot, "raw", "out");
  const outPath = path.join(outDir, `${req.speaker}__${req.preset}.wav`);

  const cmd = resolveSayCmd();
  const args = [
    req.speaker,
    req.text,
    "--preset",
    req.preset,
    "--lang",
    req.lang || "ru",
    "--json",
  ];

  const r = spawnSync(cmd, args, { encoding: "utf-8" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error("say_failed");

  if (!fs.existsSync(outPath)) throw new Error("say_output_missing");
  const audio = fs.readFileSync(outPath);

  let metrics: SayMetrics = {};
  try {
    const raw = String(r.stdout || "").trim();
    const last = raw.split("\n").pop() || "";
    const parsed = JSON.parse(last);
    const total_ms = Number(parsed?.total_ms ?? 0) || undefined;
    const duration_ms = Number(parsed?.duration_ms ?? 0) || undefined;
    metrics = {
      tts_ms: Number(parsed?.tts_ms ?? 0) || undefined,
      dsp_ms: Number(parsed?.dsp_ms ?? 0) || undefined,
      total_ms,
      duration_ms,
      rtf: total_ms && duration_ms ? Number((total_ms / duration_ms).toFixed(3)) : undefined,
    };
  } catch {
    metrics = {};
  }

  return { audio, metrics };
}

export function resolveAgentVoice(agent?: string | null, override?: Partial<AgentVoiceConfig>) {
  if (override?.speaker && override?.preset) {
    return { speaker: override.speaker, preset: override.preset };
  }
  if (!agent) return null;
  return getAgentVoiceConfig(agent);
}
