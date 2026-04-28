import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const task = db.tasks.get(ctx.params.id);
  if (!task) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: task.task_id,
    status: task.status,
    runner_id: task.runner_id ?? null,
    heartbeat_at: task.heartbeat_at ?? null,
    blocked_reason: task.blocked_reason ?? null,
    version: task.version ?? 0,
    task_json: task.task_json ?? null,
    result_json: task.result_json ?? null,
    source_trace_id: task.source_trace_id ?? null,
  });
}
