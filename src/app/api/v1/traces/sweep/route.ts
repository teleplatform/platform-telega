import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const maker_mode = Boolean(body?.maker_mode);
  if (!maker_mode) {
    return NextResponse.json({ ok: false, error: "maker_required" }, { status: 403 });
  }

  const days = typeof body?.days === "number" ? body.days : 30;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const res = db.traces.deleteBefore(cutoffMs);

  return NextResponse.json({ ok: true, deleted: res.changed, days });
}
