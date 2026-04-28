import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { supabaseService } from "@/server/supabase/service";
import { makeTraceId, pickIncomingTraceId } from "@/lib/trace/traceId";
import { withTraceHeaders } from "@/lib/trace/withTraceHeaders";
import { writeVoiceTrace } from "@/server/voice/traceStore";
import { safeEnvSnapshot } from "@/server/voice/safeEnvSnapshot";

export const runtime = "nodejs";

async function speakOnceViaApi(
  origin: string,
  payload: { text: string; voice_id?: string | null }
): Promise<Buffer> {
  const r = await fetch(`${origin}/api/voice/speak`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error || "speak_failed");
  }

  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

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
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "");
    let voiceId = body?.voice_id ?? null;
    if (voiceId !== null && voiceId !== undefined) {
      const trimmed = String(voiceId).trim();
      voiceId = trimmed ? trimmed : null;
    }
    const maxChars = Number(body?.max_chars ?? 900);
    const isAuto = !!body?.auto;
    const assistantId = body?.assistant_id ? String(body.assistant_id).trim() : "";

    const auth = await getAuthContext();

    if (isAuto) {
      if (!isMaker(auth)) {
        return Response.json({ ok: false, error: "maker_required" }, { status: 403 });
      }
      if (!assistantId) {
        return Response.json({ ok: false, error: "missing_assistant_id" }, { status: 400 });
      }

      const sb = supabaseService();
      const { data, error } = await sb
        .from("assistant_voice_bindings")
        .select("auto_speak, auto_speak_cooldown_ms, last_auto_spoken_at")
        .eq("owner_user_id", auth.userId)
        .eq("assistant_id", assistantId)
        .maybeSingle();

      if (error) {
        return Response.json(
          { ok: false, error: "db_error", detail: error.message },
          { status: 500 }
        );
      }

      const autoSpeak = !!data?.auto_speak;
      const cooldown = Number(data?.auto_speak_cooldown_ms ?? 45000);
      const last = data?.last_auto_spoken_at ? Date.parse(data.last_auto_spoken_at) : 0;

      if (!autoSpeak) {
        return Response.json({ ok: false, error: "auto_speak_disabled" }, { status: 409 });
      }

      const now = Date.now();
      if (last && now - last < cooldown) {
        return Response.json(
          {
            ok: false,
            error: "auto_speak_cooldown",
            retry_after_ms: cooldown - (now - last),
          },
          { status: 429 }
        );
      }

      const { error: upErr } = await sb
        .from("assistant_voice_bindings")
        .update({ last_auto_spoken_at: new Date().toISOString() })
        .eq("owner_user_id", auth.userId)
        .eq("assistant_id", assistantId);

      if (upErr) {
        return Response.json(
          { ok: false, error: "db_error", detail: upErr.message },
          { status: 500 }
        );
      }
    }

    const chunks = splitByParagraphs(text, Math.max(300, Math.min(1400, maxChars)));
    if (chunks.length === 0) {
      return Response.json({ ok: false, error: "empty_text" }, { status: 400 });
    }

    ensureFfmpeg();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "telegpt-tts-"));
    const listPath = path.join(dir, "list.txt");
    const outPath = path.join(dir, "out.mp3");

    const origin =
      req.headers.get("origin") ||
      process.env.TELEGPT_BASE_URL ||
      "http://127.0.0.1:3000";

    const mp3Files: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const wavBytes = await speakOnceViaApi(origin, { text: chunk, voice_id: voiceId });

      const wavPath = path.join(dir, `chunk_${i}.wav`);
      fs.writeFileSync(wavPath, wavBytes);

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
    }

    const list = mp3Files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n";
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

    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }

    const res = Response.json({
      ok: true,
      mime: "audio/mpeg",
      audio_base64,
      chunks: chunks.length,
    });
    try {
      await writeVoiceTrace({
        id: traceId,
        route: "speak",
        preset: null,
        speaker: voiceId,
        chunks: chunks.length,
        failover_used: false,
        meta: { env: safeEnvSnapshot() },
      });
    } catch {
      // ignore trace errors
    }
    return withTraceHeaders(res, traceId, { "x-telegpt-voice-route": "speak" });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "bulk_speak_failed" },
      { status: 500 }
    );
  }
}
