import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { listCreatorWebProviders } from "@/providers/creatorWebController";
import { CreatorWebStateStore } from "@/providers/creatorWebStateStore";
import { RuntimeFlagsStore } from "@/providers/runtimeFlagsStore";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const stateStore = new CreatorWebStateStore();
  await stateStore.load();

  const flagsStore = new RuntimeFlagsStore();
  await flagsStore.load();

  const providers = listCreatorWebProviders();
  const snapshot = stateStore.getSnapshot();

  const result = providers.map((p) => {
    const st = snapshot.providers[p.id];
    return {
      id: p.id,
      display_name: p.display_name,
      source_url: p.source_url,
      enabled: p.enabled,
      maker_only: p.maker_only,
      policy_id: p.policy_id,
      status: st?.status ?? "normal",
      paused_until: st?.paused_until ?? 0,
      actions_10m: st?.actions_10m?.length ?? 0,
      actions_day: st?.actions_day?.length ?? 0,
      relogin_required: Boolean(st?.relogin_required),
      relogin_reason: String(st?.relogin_reason ?? ""),
      relogin_at: Number(st?.relogin_at ?? 0),
    };
  });

  return NextResponse.json({
    ok: true,
    kill_switch: flagsStore.get().creator_web_automation_kill_switch,
    providers: result,
  });
}
