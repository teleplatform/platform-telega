import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { supabaseService } from "@/server/supabase/service";
import { voiceAudit } from "@/server/voice/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const voiceId = String(body?.voice_id ?? "");
  const name = String(body?.label ?? "").trim();

  if (!voiceId) {
    return NextResponse.json({ ok: false, error: "missing_voice_id" }, { status: 400 });
  }
  if (name.length < 1) {
    return NextResponse.json({ ok: false, error: "empty_label" }, { status: 400 });
  }
  if (name.length > 64) {
    return NextResponse.json({ ok: false, error: "label_too_long" }, { status: 400 });
  }

  const sb = supabaseService();
  const { error } = await sb
    .from("voice_profiles")
    .update({ label: name })
    .eq("voice_id", voiceId)
    .eq("owner_user_id", auth.userId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  await voiceAudit({
    owner_user_id: auth.userId,
    actor_user_id: auth.userId,
    action: "rename",
    voice_id: voiceId,
    provider: "local.cosyvoice.v3",
    status: "done",
    ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    meta: { label: name },
  });

  return NextResponse.json({ ok: true });
}
