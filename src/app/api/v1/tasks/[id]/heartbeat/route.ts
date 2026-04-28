import { NextResponse } from "next/server";
import { db } from "@/core/db";

const TERMINAL = new Set(["done", "partial", "blocked"]);

export async function POST(_: Request, ctx: { params: { id: string } }) {
  const taskId = ctx.params.id;
  const runnerId = process.env.RUNNER_ID || "runner-dev";

  const task = db.tasks.get(taskId);
  if (!task) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (TERMINAL.has(task.status)) {
    return NextResponse.json(
      { ok: false, error: "terminal_status", status: task.status },
      { status: 409 }
    );
  }
  if (task.status !== "running") {
    return NextResponse.json(
      { ok: false, error: "not_running", status: task.status },
      { status: 409 }
    );
  }

  if (task.runner_id && task.runner_id !== runnerId) {
    return NextResponse.json({ ok: false, error: "runner_mismatch" }, { status: 409 });
  }

  const updated = db.tasks.updateCAS({
    id: taskId,
    expectedVersion: task.version ?? 0,
    patch: {
      heartbeat_at: new Date().toISOString(),
      runner_id: task.runner_id || runnerId,
      status: "running",
    },
  });

  if (!updated.ok) {
    return NextResponse.json({ ok: false, error: "version_conflict" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
