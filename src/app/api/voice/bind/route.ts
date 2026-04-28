import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { supabaseService } from "@/server/supabase/service";
import { voiceAudit } from "@/server/voice/audit";

export const runtime = "nodejs";

// POST /api/voice/bind  { assistant_id: string, voice_id: string|null }
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const assistantId = String(body?.assistant_id ?? "").trim();
  const voiceIdRaw = body?.voice_id ?? null;

  if (!assistantId) {
    return NextResponse.json(
      { ok: false, error: "missing_assistant_id" },
      { status: 400 }
    );
  }

  const voiceId = voiceIdRaw === null || voiceIdRaw === "" ? null : String(voiceIdRaw);

  const sb = supabaseService();
  const { error } = await sb
    .from("assistant_voice_bindings")
    .upsert(
      {
        owner_user_id: auth.userId,
        assistant_id: assistantId,
        voice_id: voiceId,
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
    action: voiceId ? "assistant_bind" : "assistant_unbind",
    voice_id: voiceId ?? undefined,
    provider: "local.cosyvoice.v3",
    status: "done",
    ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    meta: { assistant_id: assistantId, voice_id: voiceId },
  });

  return NextResponse.json({ ok: true });
}
