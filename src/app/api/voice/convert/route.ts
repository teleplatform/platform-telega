import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker, maxUploadBytes } from "../../_guard";
import { voiceAudit } from "@/server/voice/audit";
import { voiceRateHit } from "@/server/voice/rateLimit";
import { supabaseService } from "@/server/supabase/service";

export const runtime = "nodejs";

type ConvertBody = {
  target_voice_id: string;
  source_audio_base64: string;
  source_mime?: string;
  prompt_text?: string;
  lang_hint?: "ru" | "uz" | "en" | "auto";
};

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json(
      { ok: false, error: "maker_required" },
      { status: 403 }
    );
  }

  const rl = await voiceRateHit({
    userId: auth.userId,
    action: "convert",
    windowSeconds: 60,
    limit: 6,
  });
  if (!rl.allowed) {
    await voiceAudit({
      owner_user_id: auth.userId,
      actor_user_id: auth.userId,
      action: "convert",
      status: "blocked",
      ip: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
      meta: { reason: "rate_limited", bucket: rl.key },
    });
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  const body = (await req.json()) as ConvertBody;
  if (!body?.target_voice_id || !body?.source_audio_base64) {
    return NextResponse.json(
      { ok: false, error: "missing_target_or_audio" },
      { status: 400 }
    );
  }

  const approxBytes = Math.floor((body.source_audio_base64.length * 3) / 4);
  if (approxBytes > maxUploadBytes()) {
    return NextResponse.json(
      { ok: false, error: "audio_too_large" },
      { status: 413 }
    );
  }

  const base = process.env.TELEGPT_COSYVOICE_BASE_URL || "http://127.0.0.1:7788";
  const r = await fetch(`${base}/convert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      target_voice_id: body.target_voice_id,
      source_audio_base64: body.source_audio_base64,
      source_mime: body.source_mime ?? "audio/wav",
      prompt_text: body.prompt_text ?? "Ты — полезный ассистент.<|endofprompt|>",
      lang_hint: body.lang_hint ?? "ru",
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    return NextResponse.json(
      { ok: false, error: "provider_error", detail: t },
      { status: 502 }
    );
  }

  const data = (await r.json()) as { wav_path?: string; warnings?: string[] };
  const wavPath = data.wav_path;
  if (!wavPath) {
    return NextResponse.json(
      { ok: false, error: "bad_provider_response" },
      { status: 502 }
    );
  }
  const warnings = Array.isArray(data?.warnings) ? data.warnings : [];

  const { createReadStream } = await import("fs");
  const stream = createReadStream(wavPath);

  const sb = supabaseService();
  await sb
    .from("voice_profiles")
    .update({ last_used_at: new Date().toISOString() })
    .eq("voice_id", body.target_voice_id);

  await voiceAudit({
    owner_user_id: auth.userId,
    actor_user_id: auth.userId,
    action: "convert",
    voice_id: body.target_voice_id ?? null,
    provider: "local.cosyvoice.v3",
    status: "done",
    ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    meta: { lang_hint: body.lang_hint ?? "ru" },
  });

  return new Response(stream as unknown as BodyInit, {
    headers: {
      "content-type": "audio/wav",
      "cache-control": "no-store",
      "x-telegpt-voice-provider": "local.cosyvoice.v3",
      "x-voice-warnings": warnings.slice(0, 3).join(" | "),
    },
  });
}
