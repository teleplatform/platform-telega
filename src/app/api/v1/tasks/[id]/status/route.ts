import { NextResponse } from "next/server";
import { db } from "@/core/db";

const TERMINAL = new Set(["done", "partial", "blocked"]);

function isAllowed(from: string, to: string) {
  if (TERMINAL.has(from)) return false;
  if (from === "queued" && (to === "running" || to === "blocked")) return true;
  if (from === "running" && (to === "done" || to === "partial" || to === "blocked")) {
    return true;
  }
  return false;
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const taskId = ctx.params.id;
  const body = await req.json().catch(() => ({}));
  const toStatus = String(body?.status || "");
  const expectedVersion = Number(body?.expected_version);

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

  if (!isAllowed(task.status, toStatus)) {
    return NextResponse.json(
      { ok: false, error: "illegal_transition", from: task.status, to: toStatus },
      { status: 409 }
    );
  }

  const patch: any = { status: toStatus };
  if (toStatus === "blocked") {
    patch.blocked_reason = String(body?.blocked_reason || "BLOCKED");
  }

  const res = db.tasks.updateCAS({
    id: taskId,
    expectedVersion: expectedVersion,
    patch,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "version_conflict" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
