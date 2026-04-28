import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function POST(_: Request, ctx: { params: { id: string } }) {
  const taskId = ctx.params.id;

  const task = db.tasks.get(taskId);
  if (!task) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (task.status !== "running") {
    return NextResponse.json(
      { ok: false, error: "not_running", status: task.status },
      { status: 409 }
    );
  }

  const res = db.tasks.setHeartbeatStale({ id: taskId, secondsAgo: 600 });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
