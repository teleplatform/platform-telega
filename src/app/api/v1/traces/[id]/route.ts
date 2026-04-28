import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const trace = db.traces.get(ctx.params.id);
  if (!trace) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, trace });
}
