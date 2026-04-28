import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { supabaseService } from "@/server/supabase/service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const sb = supabaseService();
  const { data, error } = await sb
    .from("voice_profiles")
    .select(
      "voice_id,label,provider,created_at,last_used_at,input_mime,input_seconds,input_sha256,deleted_at"
    )
    .eq("owner_user_id", auth.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, voices: data ?? [] });
}
