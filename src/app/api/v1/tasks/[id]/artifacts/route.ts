import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const taskId = ctx.params.id;
  const task = db.tasks.get(taskId);
  if (!task) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const items = db.taskArtifacts.list(taskId);
  return NextResponse.json({ ok: true, items });
}
