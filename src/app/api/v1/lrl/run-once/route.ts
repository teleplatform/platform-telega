import { NextResponse } from "next/server";
import { lrlRunnerOnce } from "@/core/lrl/lrlRunnerOnce";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const maker_mode = Boolean(body?.maker_mode);
  if (!maker_mode) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const res = await lrlRunnerOnce(50);
  return NextResponse.json({ ok: true, ...res });
}
