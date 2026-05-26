import { NextResponse } from "next/server";
import { cancelTaskGroup } from "@/runtime/forge-bridge/job-dispatcher";

export async function POST(req: Request, { params }: { params: { group_id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    
    const result = cancelTaskGroup(params.group_id, {
      mode: body?.mode,
      reason: body?.reason,
    });
    
    return NextResponse.json({
      ok: true,
      group_id: result.group_id,
      cancelled_tasks: result.cancelled_tasks,
      needs_creator_tasks: result.needs_creator_tasks,
      summary: result.summary,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}