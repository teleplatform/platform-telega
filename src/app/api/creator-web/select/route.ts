import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { getCreatorWebProvider } from "@/providers/creatorWebRegistry";
import { RuntimeFlagsStore } from "@/providers/runtimeFlagsStore";
import { appendCreatorWebTrace } from "@/providers/creatorWebTraceWriter";

export const runtime = "nodejs";

const COOKIE_PROVIDER = "telegpt_cw_provider";
const COOKIE_SELECTED_AT = "telegpt_cw_selected_at";

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider_id = String(body?.provider_id ?? "");

  const p = getCreatorWebProvider(provider_id);
  if (!p) return NextResponse.json({ ok: false, error: "unknown_provider" }, { status: 400 });
  if (!p.enabled) return NextResponse.json({ ok: false, error: "provider_disabled" }, { status: 400 });
  if (!p.maker_only) return NextResponse.json({ ok: false, error: "not_maker_only" }, { status: 400 });

  const flagsStore = new RuntimeFlagsStore();
  await flagsStore.load();

  if (!process.env.TELEGPT_CREATOR_WEB_AUTOMATION_ENABLED || process.env.TELEGPT_CREATOR_WEB_AUTOMATION_ENABLED === "false") {
    return NextResponse.json({ ok: false, error: "creator_web_disabled" }, { status: 403 });
  }

  if (flagsStore.get().creator_web_automation_kill_switch) {
    await appendCreatorWebTrace({
      provider_id: p.id,
      source_url: p.source_url,
      policy_id: p.policy_id,
      action_type: "select",
      delay_applied_ms: 0,
      policy_verdict: "blocked",
      meta: { reason: "kill_switch" },
    });
    return NextResponse.json({ ok: false, error: "kill_switch_on" }, { status: 423 });
  }

  const now = Date.now();

  await appendCreatorWebTrace({
    provider_id: p.id,
    source_url: p.source_url,
    policy_id: p.policy_id,
    action_type: "select",
    delay_applied_ms: 0,
    policy_verdict: "allowed",
    meta: { selected_at: now },
  });

  const res = NextResponse.json({ ok: true, selected_provider: p.id });

  res.cookies.set(COOKIE_PROVIDER, p.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  res.cookies.set(COOKIE_SELECTED_AT, String(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
