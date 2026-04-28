import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { supabaseService } from "@/server/supabase/service";
import { voiceAudit } from "@/server/voice/audit";

export const runtime = "nodejs";

// POST /api/voice/auto
// { assistant_id: string, auto_speak: boolean, cooldown_ms?: number }
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const assistantId = String(body?.assistant_id ?? "").trim();
  const autoSpeak = !!body?.auto_speak;
  const cooldownRaw = body?.cooldown_ms;
  const maxCharsRaw = body?.max_chars;

  if (!assistantId) {
    return NextResponse.json(
      { ok: false, error: "missing_assistant_id" },
      { status: 400 }
    );
  }

  let cooldownMs = 45000;
  if (cooldownRaw !== undefined && cooldownRaw !== null) {
    const n = Number(cooldownRaw);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ ok: false, error: "bad_cooldown_ms" }, { status: 400 });
    }
    cooldownMs = Math.max(10000, Math.min(300000, Math.floor(n)));
  }

  let maxChars = 420;
  if (maxCharsRaw !== undefined && maxCharsRaw !== null) {
    const n = Number(maxCharsRaw);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ ok: false, error: "bad_max_chars" }, { status: 400 });
    }
    maxChars = Math.max(60, Math.min(4000, Math.floor(n)));
  }

  const sb = supabaseService();
  const { error } = await sb
    .from("assistant_voice_bindings")
    .upsert(
      {
        owner_user_id: auth.userId,
        assistant_id: assistantId,
        auto_speak: autoSpeak,
        auto_speak_cooldown_ms: cooldownMs,
        auto_speak_max_chars: maxChars,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_user_id,assistant_id" }
    );

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  await voiceAudit({
    owner_user_id: auth.userId,
    actor_user_id: auth.userId,
    action: autoSpeak ? "assistant_auto_on" : "assistant_auto_off",
    provider: "local.cosyvoice.v3",
    status: "done",
    ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    meta: {
      assistant_id: assistantId,
      auto_speak: autoSpeak,
      cooldown_ms: cooldownMs,
      max_chars: maxChars,
    },
  });

  return NextResponse.json({
    ok: true,
    assistant_id: assistantId,
    auto_speak: autoSpeak,
    cooldown_ms: cooldownMs,
    max_chars: maxChars,
  });
}
