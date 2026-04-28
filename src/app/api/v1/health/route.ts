import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET() {
  const cutoffIso = new Date(Date.now() - 45 * 1000).toISOString();
  const stale = db.tasks.listStaleRunning({ cutoffIso });
  const queuedLrl = db.lrl.listQueuedEvents(200).length;

  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    tasks: {
      stale_running: stale.length,
    },
    lrl: {
      queued: queuedLrl,
    },
  });
}
