import { NextResponse } from "next/server";
import { getAuthContext } from "../../_auth";
import { isMaker } from "../../_guard";
import { RuntimeFlagsStore } from "@/providers/runtimeFlagsStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body?.enabled);

  const flagsStore = new RuntimeFlagsStore();
  await flagsStore.load();
  flagsStore.setKillSwitch(enabled);
  await flagsStore.save();

  return NextResponse.json({ ok: true, kill_switch: enabled });
}
