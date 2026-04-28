import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { RuntimeFlagsStore } from "@/providers/runtimeFlagsStore";
import { getCreatorWebProvider } from "@/providers/creatorWebRegistry";

export const runtime = "nodejs";

const COOKIE_PROVIDER = "telegpt_cw_provider";
const COOKIE_SELECTED_AT = "telegpt_cw_selected_at";

export async function GET() {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const flagsStore = new RuntimeFlagsStore();
  await flagsStore.load();

  if (
    !process.env.TELEGPT_CREATOR_WEB_AUTOMATION_ENABLED ||
    process.env.TELEGPT_CREATOR_WEB_AUTOMATION_ENABLED === "false"
  ) {
    return NextResponse.json({ ok: true, selected_provider: null, disabled: true });
  }

  if (flagsStore.get().creator_web_automation_kill_switch) {
    return NextResponse.json({ ok: true, selected_provider: null, kill_switch: true });
  }

  const jar = await cookies();
  const provider_id = jar.get(COOKIE_PROVIDER)?.value ?? "";
  const selected_at = Number(jar.get(COOKIE_SELECTED_AT)?.value ?? "0");

  const p = provider_id ? getCreatorWebProvider(provider_id) : null;

  return NextResponse.json({
    ok: true,
    selected_provider: p ? p.id : null,
    selected_at: selected_at || 0,
    kill_switch: false,
    disabled: false,
  });
}
