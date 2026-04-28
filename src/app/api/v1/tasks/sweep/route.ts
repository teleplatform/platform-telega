import { NextResponse } from "next/server";
import { db } from "@/core/db";
import { writeTrace } from "@/core/traces/writeTrace";

const HEARTBEAT_TTL_SEC = 45;

export async function POST() {
  const cutoff = new Date(Date.now() - HEARTBEAT_TTL_SEC * 1000).toISOString();
  const stale = db.tasks.listStaleRunning({ cutoffIso: cutoff });

  let blocked = 0;

  for (const t of stale) {
    const res = db.tasks.updateCAS({
      id: t.id,
      expectedVersion: t.version,
      patch: {
        status: "blocked",
        blocked_reason: "STALE_HEARTBEAT",
      },
    });
    if (res.ok) blocked++;
  }

  await writeTrace({
    ok: true,
    route: "/v1/tasks/sweep",
    provider: "core",
    meta: { blocked_count: blocked, cutoff },
  });

  return NextResponse.json({ ok: true, blocked_count: blocked, cutoff });
}
