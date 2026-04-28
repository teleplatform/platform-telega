import crypto from "crypto";
import { spawn } from "child_process";
import path from "path";
import type {
  AuthContext,
  VoiceCloneRequest,
  VoiceCloneResponse,
  VoiceSpeakRequest,
  VoiceSpeakResponse,
  VoiceConvertRequest,
  VoiceDialogueRequest,
} from "@/server/voice/types";

function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function runPython(payload: any): Promise<any> {
  const py = process.env.TELEGPT_COSYVOICE_PYTHON || "python3";
  const workdir = process.env.TELEGPT_COSYVOICE_WORKDIR || "./src/workers/voice/python";
  const script = path.join(workdir, "run_cosyvoice.py");

  return new Promise((resolve, reject) => {
    const p = spawn(py, [script], { stdio: ["pipe", "pipe", "pipe"] });

    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString("utf8")));
    p.stderr.on("data", (d) => (err += d.toString("utf8")));

    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`cosyvoice worker failed (code=${code})\n${err}`));
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error(`cosyvoice worker bad json\n${out}\n${err}`));
      }
    });

    p.stdin.write(JSON.stringify(payload));
    p.stdin.end();
  });
}

export async function localCosyClone(auth: AuthContext, req: VoiceCloneRequest): Promise<VoiceCloneResponse> {
  const t0 = Date.now();
  const audioBuf = Buffer.from(req.audio.content_base64, "base64");
  const inputHash = sha256(audioBuf);

  const res = await runPython({
    op: "clone",
    user_id: auth.userId,
    model_dir: process.env.TELEGPT_COSYVOICE_MODEL_DIR,
    max_ref_seconds: Number(process.env.TELEGPT_VOICE_MAX_REF_SECONDS || 30),
    audio_base64: req.audio.content_base64,
    mime: req.audio.mime,
    label: req.meta?.voice_label || "",
    lang_hint: req.meta?.lang_hint || "auto",
  });

  return {
    status: res.status ?? "done",
    voice_id: res.voice_id,
    embedding_ref: res.embedding_ref,
    warnings: res.warnings ?? [],
    trace: {
      lane: "voice.local.cosyvoice.v3",
      duration_ms: Date.now() - t0,
      input_audio_sha256: inputHash,
    },
  };
}

export async function localCosySpeak(auth: AuthContext, req: VoiceSpeakRequest): Promise<VoiceSpeakResponse> {
  const t0 = Date.now();
  const res = await runPython({
    op: "speak",
    user_id: auth.userId,
    model_dir: process.env.TELEGPT_COSYVOICE_MODEL_DIR,
    text: req.text,
    voice: req.voice,
    lang: req.lang || "auto",
    seed: req.seed ?? null,
    out_sr: req.format?.sample_rate ?? Number(process.env.TELEGPT_VOICE_OUT_SR || 44100),
  });

  return {
    status: res.status ?? "done",
    audio_base64: res.audio_base64,
    mime: "audio/wav",
    warnings: res.warnings ?? [],
    trace: { lane: "voice.local.cosyvoice.v3", duration_ms: Date.now() - t0, provider_used: "local.cosyvoice.v3" },
  };
}

export async function localCosyConvert(auth: AuthContext, req: VoiceConvertRequest) {
  const t0 = Date.now();
  const res = await runPython({
    op: "convert",
    user_id: auth.userId,
    model_dir: process.env.TELEGPT_COSYVOICE_MODEL_DIR,
    target_voice_id: req.target.voice_id,
    source_audio_base64: req.source_audio.content_base64,
    source_mime: req.source_audio.mime,
    out_sr: Number(process.env.TELEGPT_VOICE_OUT_SR || 44100),
    lang: req.lang || "auto",
  });

  return {
    status: res.status ?? "done",
    audio_base64: res.audio_base64,
    mime: "audio/wav",
    warnings: res.warnings ?? [],
    trace: { lane: "voice.local.cosyvoice.v3", duration_ms: Date.now() - t0, provider_used: "local.cosyvoice.v3" },
  };
}

export async function localCosyDialogue(auth: AuthContext, req: VoiceDialogueRequest) {
  const t0 = Date.now();
  const res = await runPython({
    op: "dialogue",
    user_id: auth.userId,
    model_dir: process.env.TELEGPT_COSYVOICE_MODEL_DIR,
    script: req.script,
    voices: req.voices,
    out_sr: req.format?.sample_rate ?? Number(process.env.TELEGPT_VOICE_OUT_SR || 44100),
    lang: req.lang || "auto",
  });

  return {
    status: res.status ?? "done",
    audio_base64: res.audio_base64,
    mime: "audio/wav",
    warnings: res.warnings ?? [],
    trace: { lane: "voice.local.cosyvoice.v3", duration_ms: Date.now() - t0, provider_used: "local.cosyvoice.v3" },
  };
}
