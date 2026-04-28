import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker, maxUploadBytes } from "../../_guard";
import { sha256HexFromFile } from "@/server/crypto/sha256";
import { supabaseService } from "@/server/supabase/service";
import { voiceAudit } from "@/server/voice/audit";
import { voiceRateHit } from "@/server/voice/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json(
      { ok: false, error: "maker_required" },
      { status: 403 }
    );
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "multipart_required" },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("ref") as File | null;

  if (!file) {
    return NextResponse.json(
      { ok: false, error: "missing_ref_file" },
      { status: 400 }
    );
  }
  if (file.size > maxUploadBytes()) {
    return NextResponse.json(
      { ok: false, error: "file_too_large" },
      { status: 413 }
    );
  }

  const rl = await voiceRateHit({
    userId: auth.userId,
    action: "clone",
    windowSeconds: 60,
    limit: 3,
  });
  if (!rl.allowed) {
    await voiceAudit({
      owner_user_id: auth.userId,
      actor_user_id: auth.userId,
      action: "register",
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

  const inputSha = await sha256HexFromFile(file);

  const base = process.env.TELEGPT_COSYVOICE_BASE_URL || "http://127.0.0.1:7788";
  const fwd = new FormData();
  fwd.append("ref", file, file.name || "ref.wav");

  const r = await fetch(`${base}/voice/register`, {
    method: "POST",
    body: fwd,
  });

  if (!r.ok) {
    const t = await r.text();
    return NextResponse.json(
      { ok: false, error: "provider_error", detail: t },
      { status: 502 }
    );
  }

  const data = await r.json();
  const sb = supabaseService();

  await sb.from("voice_profiles").insert({
    voice_id: data.voice_id,
    owner_user_id: auth.userId,
    label: file.name || "voice_ref",
    input_sha256: inputSha,
    input_mime: file.type || null,
    input_seconds: null,
    provider: "local.cosyvoice.v3",
  });

  await voiceAudit({
    owner_user_id: auth.userId,
    actor_user_id: auth.userId,
    action: "register",
    voice_id: data.voice_id,
    provider: "local.cosyvoice.v3",
    status: "done",
    ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    meta: { file_name: file.name, sha256: inputSha },
  });

  return NextResponse.json(
    { ok: true, voice_id: data.voice_id },
    { status: 200 }
  );
}
