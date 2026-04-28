import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { supabaseService } from "@/server/supabase/service";

export const runtime = "nodejs";

// GET /api/voice/bindings
// -> { bindings: { [assistant_id]: { voice_id, auto_speak, cooldown_ms } } }
export async function GET() {
  const auth = await getAuthContext();
  const sb = supabaseService();

  const { data, error } = await sb
    .from("assistant_voice_bindings")
    .select("assistant_id, voice_id, auto_speak, auto_speak_cooldown_ms, auto_speak_max_chars")
    .eq("owner_user_id", auth.userId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  const bindings: Record<
    string,
    { voice_id: string | null; auto_speak: boolean; cooldown_ms: number; max_chars: number }
  > = {};
  for (const row of data ?? []) {
    bindings[row.assistant_id] = {
      voice_id: row.voice_id ?? null,
      auto_speak: !!row.auto_speak,
      cooldown_ms: Number(row.auto_speak_cooldown_ms ?? 45000),
      max_chars: Number(row.auto_speak_max_chars ?? 420),
    };
  }

  return NextResponse.json({ ok: true, bindings });
}
