import { getAuthContext } from "../../_auth";
import { supabaseService } from "@/server/supabase/service";
import { voiceAudit } from "@/server/voice/audit";
import { makeTraceId, pickIncomingTraceId } from "@/lib/trace/traceId";
import { withTraceHeaders } from "@/lib/trace/withTraceHeaders";
import { writeVoiceTrace } from "@/server/voice/traceStore";
import { safeEnvSnapshot } from "@/server/voice/safeEnvSnapshot";

export const runtime = "nodejs";

type SpeakBody = {
  voice_id?: string | null;
  text: string;
  prompt_text?: string;
  lang_hint?: "ru" | "uz" | "en" | "auto";
};

export async function POST(req: Request) {
  const traceId = pickIncomingTraceId(req) ?? makeTraceId();
  const auth = await getAuthContext();

  const body = (await req.json().catch(() => ({}))) as SpeakBody;
  if (!body?.text) {
    return Response.json(
      { ok: false, error: "missing_voice_id_or_text" },
      { status: 400 }
    );
  }

  let voiceId = body.voice_id ?? null;
  if (voiceId !== null && voiceId !== undefined) {
    const trimmed = String(voiceId).trim();
    voiceId = trimmed ? trimmed : null;
  }
  const sb = supabaseService();

  if (!voiceId) {
    const { data: vp } = await sb
      .from("voice_profiles")
      .select("voice_id")
      .eq("owner_user_id", auth.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    voiceId = vp?.voice_id ?? null;
  }

  if (!voiceId) {
    return Response.json({ ok: false, error: "no_default_voice" }, { status: 400 });
  }

  const base = process.env.TELEGPT_COSYVOICE_BASE_URL || "http://127.0.0.1:7788";
  const r = await fetch(`${base}/tts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      voice_id: voiceId,
      text: body.text,
      prompt_text: body.prompt_text ?? "Ты — полезный ассистент.<|endofprompt|>",
      lang_hint: body.lang_hint ?? "ru",
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    return Response.json(
      { ok: false, error: "provider_error", detail: t },
      { status: 502 }
    );
  }

  const data = (await r.json()) as { wav_path?: string };
  const wavPath = data.wav_path;
  if (!wavPath) {
    return Response.json(
      { ok: false, error: "bad_provider_response" },
      { status: 502 }
    );
  }

  const { createReadStream } = await import("fs");
  const stream = createReadStream(wavPath);

  try {
    await sb
      .from("voice_profiles")
      .update({ last_used_at: new Date().toISOString() })
      .eq("voice_id", voiceId);
    const { data: vp } = await sb
      .from("voice_profiles")
      .select("owner_user_id")
      .eq("voice_id", voiceId)
      .maybeSingle();
    const owner = vp?.owner_user_id ?? auth.userId;

    await voiceAudit({
      owner_user_id: owner,
      actor_user_id: auth.userId,
      action: "speak",
      voice_id: voiceId ?? null,
      provider: "local.cosyvoice.v3",
      status: "done",
      ip: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
      meta: { lang_hint: body.lang_hint ?? "ru", text_len: body.text?.length ?? 0 },
    });
  } catch {
    // ignore audit errors
  }

  const res = new Response(stream as unknown as BodyInit, {
    headers: {
      "content-type": "audio/wav",
      "cache-control": "no-store",
      "x-telegpt-voice-provider": "local.cosyvoice.v3",
    },
  });

  try {
    await writeVoiceTrace({
      id: traceId,
      route: "speak",
      preset: null,
      speaker: voiceId,
      failover_used: false,
      meta: { env: safeEnvSnapshot() },
    });
  } catch {
    // ignore trace errors
  }

  return withTraceHeaders(res, traceId, { "x-telegpt-voice-route": "speak" });
}
