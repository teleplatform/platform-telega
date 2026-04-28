import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { voiceAudit } from "@/server/voice/audit";
import { voiceRateHit } from "@/server/voice/rateLimit";
import { supabaseService } from "@/server/supabase/service";

export const runtime = "nodejs";

type DialogueBody = {
  script: Array<{ speaker: "A" | "B"; text: string }>;
  voices: { A: { voice_id: string }; B: { voice_id: string } };
  prompt_text_A?: string;
  prompt_text_B?: string;
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
    action: "dialogue",
    windowSeconds: 60,
    limit: 3,
  });
  if (!rl.allowed) {
    await voiceAudit({
      owner_user_id: auth.userId,
      actor_user_id: auth.userId,
      action: "dialogue",
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

  const body = (await req.json()) as DialogueBody;
  if (!body?.script?.length || !body?.voices?.A?.voice_id || !body?.voices?.B?.voice_id) {
    return NextResponse.json(
      { ok: false, error: "missing_script_or_voices" },
      { status: 400 }
    );
  }

  const base = process.env.TELEGPT_COSYVOICE_BASE_URL || "http://127.0.0.1:7788";
  const r = await fetch(`${base}/dialogue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      script: body.script,
      voices: {
        A: { voice_id: body.voices.A.voice_id },
        B: { voice_id: body.voices.B.voice_id },
      },
      prompt_text_A: body.prompt_text_A ?? "Ты — спикер A.<|endofprompt|>",
      prompt_text_B: body.prompt_text_B ?? "Ты — спикер B.<|endofprompt|>",
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

  const data = (await r.json()) as { wav_path?: string };
  const wavPath = data.wav_path;
  if (!wavPath) {
    return NextResponse.json(
      { ok: false, error: "bad_provider_response" },
      { status: 502 }
    );
  }

  const { createReadStream } = await import("fs");
  const stream = createReadStream(wavPath);

  const sb = supabaseService();
  await sb
    .from("voice_profiles")
    .update({ last_used_at: new Date().toISOString() })
    .in("voice_id", [body.voices.A.voice_id, body.voices.B.voice_id]);

  await voiceAudit({
    owner_user_id: auth.userId,
    actor_user_id: auth.userId,
    action: "dialogue",
    provider: "local.cosyvoice.v3",
    status: "done",
    ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    meta: { lang_hint: body.lang_hint ?? "ru", script_len: body.script.length },
  });

  return new Response(stream as unknown as BodyInit, {
    headers: {
      "content-type": "audio/wav",
      "cache-control": "no-store",
      "x-telegpt-voice-provider": "local.cosyvoice.v3",
    },
  });
}
