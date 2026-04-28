import { NextResponse } from "next/server";
import { db } from "@/core/db";

export async function GET() {
  const cutoffIso = new Date(Date.now() - 45 * 1000).toISOString();
  const stale = db.tasks.listStaleRunning({ cutoffIso });
  const queuedLrl = db.lrl.listQueuedEvents(200).length;

  const warnings: string[] = [];
  if (stale.length > 0) warnings.push("tasks_stale");
  if (queuedLrl > 50) warnings.push("lrl_backlog");

  return NextResponse.json({
    ok: true,
    ready: warnings.length === 0,
    warnings,
  });
}
