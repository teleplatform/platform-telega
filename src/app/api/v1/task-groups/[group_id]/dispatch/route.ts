import { NextResponse } from "next/server";
import { dispatchTaskGroup } from "@/runtime/forge-bridge/job-dispatcher";

export async function POST(req: Request, { params }: { params: { group_id: string } }) {
  try {
    const result = await dispatchTaskGroup(params.group_id);
    
    return NextResponse.json({
      ok: true,
      group_id: result.group_id,
      dispatched_count: result.dispatched_tasks.length,
      failed_count: result.failed_tasks.length,
      summary: result.summary,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}