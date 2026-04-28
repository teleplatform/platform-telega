import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { runSay, resolveAgentVoice } from "@/server/voice/sayCli";
import { sayWithFallback } from "@/lib/voice/sayWithFallback";
import { POST as speakBulkPost } from "../speak-bulk/route";
import { makeTraceId, pickIncomingTraceId } from "@/lib/trace/traceId";
import { withTraceHeaders } from "@/lib/trace/withTraceHeaders";
import { writeVoiceTrace } from "@/server/voice/traceStore";
import { safeEnvSnapshot } from "@/server/voice/safeEnvSnapshot";

export const runtime = "nodejs";

type SayBulkBody = {
  text: string;
  assistant_id?: string | null;
  speaker_id?: string | null;
  preset?: string | null;
  voice_id?: string | null;
  lang?: "ru" | "en" | "uz" | "auto";
  max_chars?: number;
};

function splitByParagraphs(text: string, maxChars = 900): string[] {
  const cleaned = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paras = cleaned
    .split(/\n{2,}/g)
    .map((p) => p.replace(/\n+/g, " ").trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const p of paras) {
    if (p.length <= maxChars) {
      out.push(p);
      continue;
    }

    const parts = p.split(/(?<=[.!?…])\s+/g).map((s) => s.trim()).filter(Boolean);
    let buf = "";
    for (const s of parts) {
      const cand = buf ? `${buf} ${s}` : s;
      if (cand.length > maxChars && buf) {
        out.push(buf);
        buf = s;
      } else {
        buf = cand;
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}

function ensureFfmpeg() {
  const r = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (r.status !== 0) throw new Error("ffmpeg_not_found");
}

export async function POST(req: Request) {
  const traceId = pickIncomingTraceId(req) ?? makeTraceId();
  const body = (await req.json().catch(() => ({}))) as SayBulkBody;
  const text = String(body?.text ?? "");
  const assistantId = body?.assistant_id ? String(body.assistant_id).trim() : null;
  const override =
    body?.speaker_id && body?.preset ? { speaker: body.speaker_id, preset: body.preset } : undefined;
  const cfg = resolveAgentVoice(assistantId, override);
  if (!cfg) {
    return Response.json({ ok: false, error: "missing_voice_config" }, { status: 400 });
  }

  return sayWithFallback(
    async () => {
      const chunks = splitByParagraphs(text, Math.max(300, Math.min(1400, Number(body?.max_chars ?? 900))));
      if (chunks.length === 0) {
        return Response.json({ ok: false, error: "empty_text" }, { status: 400 });
      }

      ensureFfmpeg();

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "telegpt-say-"));
      const listPath = path.join(dir, "list.txt");
      const outPath = path.join(dir, "out.mp3");

      let total_tts_ms = 0;
      let total_dsp_ms = 0;
      let total_duration_ms = 0;
      let have_duration = false;

      try {
        const mp3Files: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const { audio, metrics } = runSay({
            speaker: cfg.speaker,
            preset: cfg.preset,
            text: chunk,
            lang: body?.lang || "ru",
          });

          const wavPath = path.join(dir, `chunk_${i}.wav`);
          fs.writeFileSync(wavPath, audio);

          const mp3Path = path.join(dir, `chunk_${i}.mp3`);
          const r = spawnSync("ffmpeg", [
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            wavPath,
            "-ar",
            "24000",
            "-ac",
            "1",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "96k",
            mp3Path,
          ]);

          if (r.status !== 0) throw new Error("ffmpeg_encode_failed");
          mp3Files.push(mp3Path);

          if (metrics.tts_ms !== undefined) total_tts_ms += metrics.tts_ms;
          if (metrics.dsp_ms !== undefined) total_dsp_ms += metrics.dsp_ms;
          if (metrics.duration_ms !== undefined) {
            total_duration_ms += metrics.duration_ms;
            have_duration = true;
          }
        }

        const list =
          mp3Files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n";
        fs.writeFileSync(listPath, list, "utf-8");

        const rc = spawnSync("ffmpeg", [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c",
          "copy",
          outPath,
        ]);

        if (rc.status !== 0) throw new Error("ffmpeg_concat_failed");

        const finalBytes = fs.readFileSync(outPath);
        const audio_base64 = finalBytes.toString("base64");

        const total_ms = total_tts_ms + total_dsp_ms;
        const rtf = have_duration && total_ms > 0 ? Number((total_ms / total_duration_ms).toFixed(3)) : undefined;

        const headers: Record<string, string> = {
          "x-telegpt-voice-route": "say",
          "x-telegpt-voice-preset": cfg.preset,
          "x-telegpt-voice-speaker": cfg.speaker,
          "x-telegpt-trace-id": traceId,
        };
        if (total_tts_ms) headers["x-telegpt-tts-ms"] = String(total_tts_ms);
        if (total_dsp_ms) headers["x-telegpt-dsp-ms"] = String(total_dsp_ms);
        if (rtf !== undefined) headers["x-telegpt-rtf"] = String(rtf);

        if (process.env.NODE_ENV !== "production") {
          console.info("[say-bulk] metrics", {
            trace_id: traceId,
            route: "say",
            speaker: cfg.speaker,
            preset: cfg.preset,
            tts_ms: total_tts_ms || undefined,
            dsp_ms: total_dsp_ms || undefined,
            rtf,
            chunks: chunks.length,
          });
        }

        await writeVoiceTrace({
          id: traceId,
          route: "say",
          preset: cfg.preset,
          speaker: cfg.speaker,
          tts_ms: total_tts_ms || undefined,
          dsp_ms: total_dsp_ms || undefined,
          rtf,
          chunks: chunks.length,
          failover_used: false,
        });

        return Response.json(
          {
            ok: true,
            mime: "audio/mpeg",
            audio_base64,
            chunks: chunks.length,
            trace: {
              route: "say",
              tts_ms: total_tts_ms || undefined,
              dsp_ms: total_dsp_ms || undefined,
              rtf,
            },
            trace_id: traceId,
          },
          { headers }
        );
      } finally {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          // ignore cleanup
        }
      }
    },
    async () => {
      const headers = new Headers(req.headers);
      headers.set("content-type", "application/json");
      headers.set("x-telegpt-trace-id", traceId);
      const fallbackReq = new Request(req.url.replace("/say-bulk", "/speak-bulk"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          voice_id: body?.voice_id ?? null,
          max_chars: body?.max_chars ?? 900,
        }),
      });
      const res = await speakBulkPost(fallbackReq);
      await writeVoiceTrace({
        id: traceId,
        route: "speak",
        preset: cfg?.preset,
        speaker: cfg?.speaker,
        failover_used: true,
        meta: {
          failover_reason: "say_unavailable_or_failed",
          env: safeEnvSnapshot(),
        },
      });
      return withTraceHeaders(res, traceId, { "x-telegpt-voice-route": "speak" });
    }
  );
}
