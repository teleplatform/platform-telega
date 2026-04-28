import { NextResponse } from "next/server";
import { CreatorWebStateStore } from "@/providers/creatorWebStateStore";
import { getAuthContext } from "../../../_auth";
import { isMaker } from "../../../_guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await getAuthContext();
  if (!isMaker(auth)) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const provider_id = String(searchParams.get("provider_id") || "").trim();
  if (!provider_id) {
    return NextResponse.json({ ok: false, error: "missing_provider_id" }, { status: 400 });
  }

  const store = new CreatorWebStateStore();
  await store.load();
  const snap = store.getSnapshot();
  const st = snap.providers?.[provider_id];

  return NextResponse.json({
    ok: true,
    provider_id,
    last_trace_id: st?.last_trace_id ?? null,
    last_runner_job_id: st?.last_runner_job_id ?? null,
    last_runner_status: st?.last_runner_status ?? null,
    last_runner_action: st?.last_runner_action ?? null,
  });
}
